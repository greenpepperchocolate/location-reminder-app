import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform, AppState } from 'react-native';
import axios from 'axios';

// バックグラウンドタスクの定義
const COARSE_LOCATION_TASK = 'coarse-location-task';  // 粗い位置監視
const PRECISE_LOCATION_TASK = 'precise-location-task'; // 精密位置監視

// 通知の設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class TwoStageGeofenceService {
  constructor() {
    this.isInitialized = false;
    this.activeReminders = [];
    this.nearbyStores = [];
    this.currentLocation = null;
    this.isExpoGo = false;
    this.lastStoreUpdateTime = 0;
    this.isInPreciseMode = false; // 精密モード中かどうか
    this.preciseStartTime = 0;    // 精密モード開始時間
    this.API_BASE_URL = "http://192.168.3.4:8000/api";
  }

  /**
   * サービスの初期化
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('=== 2段階ジオフェンスサービス初期化開始 ===');
      
      // 実行環境の検出
      this.isExpoGo = __DEV__ && !Constants.appOwnership;
      console.log('実行環境:', this.isExpoGo ? 'Expo Go (開発)' : 'スタンドアロン (本番)');
      
      // Expo Go環境ではサービスを無効化
      if (this.isExpoGo) {
        console.log('⚠️ Expo Go環境のため、ジオフェンスサービスをスキップします');
        this.isInitialized = true;
        return;
      }

      // 権限の確認と要求
      await this.requestPermissions();
      
      // バックグラウンドタスクの登録
      await this.registerBackgroundTasks();
      
      this.isInitialized = true;
      console.log('✅ 2段階ジオフェンスサービス初期化完了');
      
    } catch (error) {
      console.error('❌ ジオフェンスサービス初期化エラー:', error);
      throw error;
    }
  }

  /**
   * 権限要求
   */
  async requestPermissions() {
    console.log('権限要求開始...');
    
    try {
      // 位置情報権限
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        throw new Error('位置情報権限が必要です');
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('⚠️ バックグラウンド位置情報権限が拒否されました');
      }

      // 通知権限
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      if (notificationStatus !== 'granted') {
        console.warn('⚠️ 通知権限が拒否されました');
      }

      console.log('権限要求完了');
      
    } catch (error) {
      console.error('❌ 権限要求エラー:', error);
      throw error;
    }
  }

  /**
   * バックグラウンドタスクの登録
   */
  async registerBackgroundTasks() {
    console.log('バックグラウンドタスク登録...');

    // 粗い位置監視タスク
    if (!TaskManager.isTaskDefined(COARSE_LOCATION_TASK)) {
      TaskManager.defineTask(COARSE_LOCATION_TASK, ({ data, error }) => {
        if (error) {
          console.error('粗い位置監視エラー:', error);
          return;
        }
        
        if (data) {
          this.handleCoarseLocationUpdate(data);
        }
      });
    }

    // 精密位置監視タスク
    if (!TaskManager.isTaskDefined(PRECISE_LOCATION_TASK)) {
      TaskManager.defineTask(PRECISE_LOCATION_TASK, ({ data, error }) => {
        if (error) {
          console.error('精密位置監視エラー:', error);
          return;
        }
        
        if (data) {
          this.handlePreciseLocationUpdate(data);
        }
      });
    }

    console.log('✅ バックグラウンドタスク登録完了');
  }

  /**
   * リマインダーの追加/更新
   */
  async addReminder(reminder) {
    try {
      console.log('=== リマインダー追加 ===', reminder);
      
      // アクティブリマインダーリストに追加
      const existingIndex = this.activeReminders.findIndex(r => r.id === reminder.id);
      if (existingIndex >= 0) {
        this.activeReminders[existingIndex] = reminder;
      } else {
        this.activeReminders.push(reminder);
      }
      
      // ローカルストレージに保存
      await AsyncStorage.setItem('active_reminders', JSON.stringify(this.activeReminders));
      
      // 粗い位置監視を開始（リマインダーがアクティブで、まだ監視していない場合）
      if (reminder.is_active && this.activeReminders.length === 1) {
        await this.startCoarseLocationMonitoring();
      }
      
      console.log('✅ リマインダー追加完了:', reminder.id);
      
    } catch (error) {
      console.error('❌ リマインダー追加エラー:', error);
      throw error;
    }
  }

  /**
   * リマインダーの削除
   */
  async removeReminder(reminderId) {
    try {
      console.log('=== リマインダー削除 ===', reminderId);
      
      // アクティブリマインダーリストから削除
      this.activeReminders = this.activeReminders.filter(r => r.id !== reminderId);
      
      // ローカルストレージを更新
      await AsyncStorage.setItem('active_reminders', JSON.stringify(this.activeReminders));
      
      // アクティブなリマインダーがなくなったら監視を停止
      if (this.activeReminders.length === 0) {
        await this.stopAllLocationMonitoring();
      }
      
      console.log('✅ リマインダー削除完了:', reminderId);
      
    } catch (error) {
      console.error('❌ リマインダー削除エラー:', error);
      throw error;
    }
  }

  /**
   * 粗い位置監視開始（省電力）
   */
  async startCoarseLocationMonitoring() {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(COARSE_LOCATION_TASK);
      
      if (!isRunning && this.activeReminders.length > 0) {
        await Location.startLocationUpdatesAsync(COARSE_LOCATION_TASK, {
          accuracy: Location.Accuracy.Low, // 低精度（省電力）
          timeInterval: 300000, // 5分間隔（超省電力）
          distanceInterval: 200, // 200m移動で更新
          deferredUpdatesInterval: 600000, // 10分間隔で一括更新
          showsBackgroundLocationIndicator: false,
          foregroundService: {
            notificationTitle: 'Location Reminder',
            notificationBody: '省電力モードで位置を監視中',
            notificationColor: '#007AFF'
          }
        });
        console.log('📍 粗い位置監視開始（5分間隔・低精度）');
      }
    } catch (error) {
      console.error('❌ 粗い位置監視開始エラー:', error);
    }
  }

  /**
   * 精密位置監視開始（高頻度・高精度）
   */
  async startPreciseLocationMonitoring() {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(PRECISE_LOCATION_TASK);
      
      if (!isRunning) {
        await Location.startLocationUpdatesAsync(PRECISE_LOCATION_TASK, {
          accuracy: Location.Accuracy.High, // 高精度
          timeInterval: 15000, // 15秒間隔（高頻度）
          distanceInterval: 5, // 5m移動で更新
          deferredUpdatesInterval: 30000, // 30秒間隔で一括更新
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Location Reminder',
            notificationBody: '店舗付近で精密位置監視中',
            notificationColor: '#FF6B35'
          }
        });
        
        this.isInPreciseMode = true;
        this.preciseStartTime = Date.now();
        console.log('🎯 精密位置監視開始（15秒間隔・高精度）');
      }
    } catch (error) {
      console.error('❌ 精密位置監視開始エラー:', error);
    }
  }

  /**
   * 精密位置監視停止
   */
  async stopPreciseLocationMonitoring() {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(PRECISE_LOCATION_TASK);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(PRECISE_LOCATION_TASK);
        this.isInPreciseMode = false;
        console.log('🛑 精密位置監視停止');
      }
    } catch (error) {
      console.error('❌ 精密位置監視停止エラー:', error);
    }
  }

  /**
   * 全ての位置監視停止
   */
  async stopAllLocationMonitoring() {
    try {
      // 粗い位置監視停止
      const isCoarseRunning = await Location.hasStartedLocationUpdatesAsync(COARSE_LOCATION_TASK);
      if (isCoarseRunning) {
        await Location.stopLocationUpdatesAsync(COARSE_LOCATION_TASK);
        console.log('🛑 粗い位置監視停止');
      }

      // 精密位置監視停止
      await this.stopPreciseLocationMonitoring();
      
    } catch (error) {
      console.error('❌ 位置監視停止エラー:', error);
    }
  }

  /**
   * 粗い位置更新のハンドリング（第1段階）
   */
  async handleCoarseLocationUpdate(data) {
    if (!data.locations || data.locations.length === 0) return;

    const location = data.locations[data.locations.length - 1];
    console.log('📍 粗い位置更新:', {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy
    });

    this.currentLocation = location;
    const now = Date.now();

    // 店舗データが古い場合（15分以上）は更新
    if (now - this.lastStoreUpdateTime > 900000) {
      await this.updateNearbyStores();
    }

    // 100m範囲チェック
    const isNearStore = await this.checkNearbyStores(100); // 100m範囲

    if (isNearStore && !this.isInPreciseMode) {
      console.log('🎯 店舗100m範囲に接近 → 精密監視開始');
      await this.startPreciseLocationMonitoring();
    }
  }

  /**
   * 精密位置更新のハンドリング（第2段階）
   */
  async handlePreciseLocationUpdate(data) {
    if (!data.locations || data.locations.length === 0) return;

    const location = data.locations[data.locations.length - 1];
    console.log('🎯 精密位置更新:', {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy
    });

    this.currentLocation = location;

    // 30m範囲でジオフェンスチェック
    await this.checkGeofences();

    // 精密モードのタイムアウト（10分）
    const now = Date.now();
    if (now - this.preciseStartTime > 600000) { // 10分
      const isStillNearStore = await this.checkNearbyStores(150); // 150m範囲で再チェック
      
      if (!isStillNearStore) {
        console.log('🛑 店舗から離れました → 粗い監視に戻る');
        await this.stopPreciseLocationMonitoring();
      } else {
        // まだ近くにいる場合は精密モード継続
        this.preciseStartTime = now;
      }
    }
  }

  /**
   * 近隣店舗データ更新
   */
  async updateNearbyStores() {
    if (!this.currentLocation) return;

    try {
      console.log('🏪 近隣店舗データ更新開始');
      
      const response = await axios.get(`${this.API_BASE_URL}/stores/nearby/`, {
        params: {
          lat: this.currentLocation.coords.latitude,
          lng: this.currentLocation.coords.longitude,
          radius: 0.5 // 500m範囲
        },
        timeout: 5000
      });

      this.nearbyStores = response.data || [];
      this.lastStoreUpdateTime = Date.now();
      
      console.log(`📍 店舗データ更新完了: ${this.nearbyStores.length}件`);
      
    } catch (error) {
      console.error('❌ 店舗データ更新エラー:', error);
    }
  }

  /**
   * 近隣店舗チェック
   */
  async checkNearbyStores(checkDistance) {
    if (!this.currentLocation || this.activeReminders.length === 0) return false;

    for (const reminder of this.activeReminders) {
      if (!reminder.is_active) continue;

      const closestStore = this.findClosestStore(reminder.store_type);
      
      if (closestStore) {
        const distance = this.calculateDistance(
          this.currentLocation.coords.latitude,
          this.currentLocation.coords.longitude,
          closestStore.latitude,
          closestStore.longitude
        );

        if (distance <= checkDistance) {
          console.log(`📍 店舗 ${checkDistance}m 範囲内検知:`, {
            store: closestStore.name,
            distance: Math.round(distance),
            type: closestStore.store_type
          });
          return true;
        }
      }
    }

    return false;
  }

  /**
   * ジオフェンスチェック（30m精密）
   */
  async checkGeofences() {
    if (!this.currentLocation || this.activeReminders.length === 0) return;

    for (const reminder of this.activeReminders) {
      if (!reminder.is_active) continue;

      const closestStore = this.findClosestStore(reminder.store_type);
      
      if (closestStore) {
        const distance = this.calculateDistance(
          this.currentLocation.coords.latitude,
          this.currentLocation.coords.longitude,
          closestStore.latitude,
          closestStore.longitude
        );

        // 30m以内でトリガー
        const triggerDistance = reminder.trigger_distance || 30;
        
        if (distance <= triggerDistance) {
          await this.triggerReminder(reminder, closestStore, distance);
        }
      }
    }
  }

  /**
   * 最も近い店舗を検索
   */
  findClosestStore(storeType) {
    const matchingStores = this.nearbyStores.filter(store => store.store_type === storeType);
    
    if (matchingStores.length === 0) return null;

    let closestStore = null;
    let minDistance = Infinity;

    for (const store of matchingStores) {
      const distance = this.calculateDistance(
        this.currentLocation.coords.latitude,
        this.currentLocation.coords.longitude,
        store.latitude,
        store.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestStore = store;
      }
    }

    return closestStore;
  }

  /**
   * リマインダートリガー
   */
  async triggerReminder(reminder, store, distance) {
    // 重複通知を防ぐためのクールダウンチェック
    const lastTriggeredKey = `last_triggered_${reminder.id}`;
    const lastTriggered = await AsyncStorage.getItem(lastTriggeredKey);
    const now = Date.now();
    
    if (lastTriggered && (now - parseInt(lastTriggered)) < 3600000) { // 1時間以内
      console.log('⏰ クールダウン中、通知をスキップ:', reminder.id);
      return;
    }

    console.log('🎯 ジオフェンストリガー:', {
      reminder: reminder.title,
      store: store.name,
      distance: Math.round(distance),
      storeType: store.store_type
    });

    // ローカル通知を送信
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🏪 ${store.name}`,
        body: reminder.title + (reminder.memo ? `\n📝 ${reminder.memo}` : ''),
        data: {
          reminderId: reminder.id,
          storeId: store.id,
          type: 'geofence_trigger'
        },
      },
      trigger: null, // 即座に表示
    });

    // 最後のトリガー時間を記録
    await AsyncStorage.setItem(lastTriggeredKey, now.toString());
    
    console.log('📢 通知送信完了:', {
      reminder: reminder.title,
      store: store.name
    });
  }

  /**
   * 距離計算（Haversine公式）
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球の半径（メートル）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 保存されたリマインダーの読み込み
   */
  async loadStoredReminders() {
    try {
      const stored = await AsyncStorage.getItem('active_reminders');
      this.activeReminders = stored ? JSON.parse(stored) : [];
      
      // アクティブなリマインダーがあれば粗い監視開始
      if (this.activeReminders.length > 0) {
        await this.startCoarseLocationMonitoring();
      }
      
      console.log(`📱 保存されたリマインダー読み込み: ${this.activeReminders.length}件`);
      
    } catch (error) {
      console.error('❌ リマインダー読み込みエラー:', error);
      this.activeReminders = [];
    }
  }

  /**
   * サービスの停止
   */
  async stop() {
    try {
      await this.stopAllLocationMonitoring();
      this.activeReminders = [];
      this.nearbyStores = [];
      this.isInitialized = false;
      console.log('🛑 2段階ジオフェンスサービス停止');
    } catch (error) {
      console.error('ジオフェンスサービス停止エラー:', error);
    }
  }

  /**
   * 現在の状態取得
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      activeReminders: this.activeReminders.length,
      nearbyStores: this.nearbyStores.length,
      isExpoGo: this.isExpoGo,
      isInPreciseMode: this.isInPreciseMode,
      lastStoreUpdate: this.lastStoreUpdateTime,
      currentLocation: this.currentLocation ? {
        latitude: this.currentLocation.coords.latitude,
        longitude: this.currentLocation.coords.longitude,
        timestamp: this.currentLocation.timestamp
      } : null
    };
  }
}

// シングルトンインスタンス
const twoStageGeofenceService = new TwoStageGeofenceService();

export default twoStageGeofenceService;