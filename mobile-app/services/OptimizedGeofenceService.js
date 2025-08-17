import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';

// バックグラウンドタスクの定義
const SIGNIFICANT_LOCATION_TASK = 'significant-location-task';  // iOS最適化イベント駆動
const PRECISE_LOCATION_TASK = 'precise-location-task';         // 精密位置監視

// 通知の設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class OptimizedGeofenceService {
  constructor() {
    this.isInitialized = false;
    this.activeReminders = [];
    this.nearbyStores = [];
    this.currentLocation = null;
    this.isExpoGo = false;
    this.lastStoreUpdateTime = 0;
    
    // 精密モード管理
    this.isInPreciseMode = false;
    this.preciseStartTime = 0;
    this.preciseDuration = 120000; // 初期2分
    this.maxPreciseDuration = 600000; // 最大10分
    
    // ヒステリシス設定
    this.ENTER_THRESHOLD = 100;  // 進入閾値: 100m
    this.EXIT_THRESHOLD = 150;   // 退出閾値: 150m（ヒステリシス）
    this.TRIGGER_DISTANCE = 30;  // トリガー距離: 30m
    
    // Dwell Time フィルタ
    this.dwellTimeRequired = 10000; // 10秒滞在必要
    this.storeEnterTimes = new Map(); // 店舗エリア進入時刻
    
    // 速度ゲート
    this.MAX_WALKING_SPEED = 8.33; // 30km/h = 8.33m/s (これ以上は車移動とみなす)
    this.lastLocationTime = 0;
    
    this.API_BASE_URL = "http://192.168.3.4:8000/api";
  }

  /**
   * サービスの初期化
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('=== 最適化ジオフェンスサービス初期化開始 ===');
      
      // 実行環境の検出
      this.isExpoGo = __DEV__ && !Constants.appOwnership;
      console.log('実行環境:', this.isExpoGo ? 'Expo Go (開発)' : 'スタンドアロン (本番)');
      
      // Expo Go環境では制限された機能で動作
      if (this.isExpoGo) {
        console.log('⚠️ Expo Go環境のため、ジオフェンス機能は制限されます');
        console.log('📱 位置情報とリマインダー管理機能のみ利用可能');
        this.isInitialized = true;
        return;
      }

      // 権限の確認と要求
      try {
        await this.requestPermissions();
        
        // バックグラウンドタスクの登録
        await this.registerBackgroundTasks();
      } catch (permissionError) {
        console.error('⚠️ 権限エラー (開発環境での制限の可能性):', permissionError.message);
        // 権限エラーでも初期化は続行（開発環境対応）
        if (permissionError.message.includes('NSLocation')) {
          console.log('📝 解決方法: eas build --platform ios --profile development で開発ビルドを作成してください');
        }
      }
      
      this.isInitialized = true;
      console.log('✅ 最適化ジオフェンスサービス初期化完了');
      
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

    // Significant Location Change タスク（iOS最適化）
    if (!TaskManager.isTaskDefined(SIGNIFICANT_LOCATION_TASK)) {
      TaskManager.defineTask(SIGNIFICANT_LOCATION_TASK, ({ data, error }) => {
        if (error) {
          console.error('Significant Location Change エラー:', error);
          return;
        }
        
        if (data) {
          this.handleSignificantLocationChange(data);
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
      
      // Significant Location Change 監視を開始（リマインダーがアクティブで、まだ監視していない場合）
      if (reminder.is_active && this.activeReminders.length === 1) {
        await this.startSignificantLocationMonitoring();
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
   * Significant Location Change 監視開始（iOS最適化・超省電力）
   */
  async startSignificantLocationMonitoring() {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(SIGNIFICANT_LOCATION_TASK);
      
      if (!isRunning && this.activeReminders.length > 0) {
        await Location.startLocationUpdatesAsync(SIGNIFICANT_LOCATION_TASK, {
          accuracy: Location.Accuracy.Low, // 低精度（超省電力）
          timeInterval: 600000, // 10分間隔（超省電力）
          distanceInterval: 500, // 500m移動で更新（大きな移動のみ）
          deferredUpdatesInterval: 1200000, // 20分間隔で一括更新
          showsBackgroundLocationIndicator: false,
          foregroundService: {
            notificationTitle: 'Location Reminder',
            notificationBody: 'イベント駆動で位置を監視中',
            notificationColor: '#4CAF50'
          }
        });
        console.log('📍 Significant Location Change 監視開始（イベント駆動・超省電力）');
      }
    } catch (error) {
      console.error('❌ Significant Location Change 監視開始エラー:', error);
    }
  }

  /**
   * 精密位置監視開始（短時間・高精度）
   */
  async startPreciseLocationMonitoring() {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(PRECISE_LOCATION_TASK);
      
      if (!isRunning) {
        await Location.startLocationUpdatesAsync(PRECISE_LOCATION_TASK, {
          accuracy: Location.Accuracy.High, // 高精度
          timeInterval: 10000, // 10秒間隔（高頻度）
          distanceInterval: 3, // 3m移動で更新
          deferredUpdatesInterval: 20000, // 20秒間隔で一括更新
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Location Reminder',
            notificationBody: '店舗付近で精密監視中（短時間）',
            notificationColor: '#FF6B35'
          }
        });
        
        this.isInPreciseMode = true;
        this.preciseStartTime = Date.now();
        console.log(`🎯 精密位置監視開始（10秒間隔・${this.preciseDuration/1000}秒間）`);
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
      // Significant Location Change 停止
      const isSignificantRunning = await Location.hasStartedLocationUpdatesAsync(SIGNIFICANT_LOCATION_TASK);
      if (isSignificantRunning) {
        await Location.stopLocationUpdatesAsync(SIGNIFICANT_LOCATION_TASK);
        console.log('🛑 Significant Location Change 監視停止');
      }

      // 精密位置監視停止
      await this.stopPreciseLocationMonitoring();
      
    } catch (error) {
      console.error('❌ 位置監視停止エラー:', error);
    }
  }

  /**
   * Significant Location Change ハンドリング（第1段階）
   */
  async handleSignificantLocationChange(data) {
    if (!data.locations || data.locations.length === 0) return;

    const location = data.locations[data.locations.length - 1];
    const now = Date.now();
    
    // 速度ゲート: 高速移動中は処理をスキップ
    if (this.currentLocation && this.lastLocationTime > 0) {
      const timeDiff = (now - this.lastLocationTime) / 1000; // 秒
      const distance = this.calculateDistance(
        this.currentLocation.coords.latitude,
        this.currentLocation.coords.longitude,
        location.coords.latitude,
        location.coords.longitude
      );
      const speed = distance / timeDiff; // m/s
      
      if (speed > this.MAX_WALKING_SPEED) {
        console.log(`🚗 高速移動検知 (${speed.toFixed(1)}m/s) → 処理をスキップ`);
        this.currentLocation = location;
        this.lastLocationTime = now;
        return;
      }
    }

    console.log('📍 Significant Location Change:', {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy
    });

    this.currentLocation = location;
    this.lastLocationTime = now;

    // 店舗データが古い場合（20分以上）は更新
    if (now - this.lastStoreUpdateTime > 1200000) {
      await this.updateNearbyStores();
    }

    // ヒステリシス付き範囲チェック
    const nearbyResult = await this.checkNearbyStoresWithHysteresis();

    if (nearbyResult.shouldEnterPreciseMode && !this.isInPreciseMode) {
      console.log('🎯 店舗接近検知（ヒステリシス） → 精密監視開始');
      await this.startPreciseLocationMonitoring();
    }
  }

  /**
   * 精密位置更新のハンドリング（第2段階）
   */
  async handlePreciseLocationUpdate(data) {
    if (!data.locations || data.locations.length === 0) return;

    const location = data.locations[data.locations.length - 1];
    const now = Date.now();

    console.log('🎯 精密位置更新:', {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy
    });

    this.currentLocation = location;

    // Dwell Time フィルタ付きジオフェンスチェック
    await this.checkGeofencesWithDwellTime();

    // タイムアウト管理（動的延長）
    const elapsed = now - this.preciseStartTime;
    
    if (elapsed > this.preciseDuration) {
      const nearbyResult = await this.checkNearbyStoresWithHysteresis();
      
      if (!nearbyResult.shouldStayInPreciseMode) {
        console.log('🛑 店舗から離脱 → 省電力モードに戻る');
        await this.stopPreciseLocationMonitoring();
      } else if (this.preciseDuration < this.maxPreciseDuration) {
        // 必要なら延長（最大10分まで）
        this.preciseDuration = Math.min(this.preciseDuration * 1.5, this.maxPreciseDuration);
        this.preciseStartTime = now;
        console.log(`⏳ 精密モード延長: ${this.preciseDuration/1000}秒`);
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
          radius: 0.3 // 300m範囲に絞る
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
   * ヒステリシス付き近隣店舗チェック
   */
  async checkNearbyStoresWithHysteresis() {
    if (!this.currentLocation || this.activeReminders.length === 0) {
      return { shouldEnterPreciseMode: false, shouldStayInPreciseMode: false };
    }

    let minDistanceToTargetStore = Infinity;

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

        minDistanceToTargetStore = Math.min(minDistanceToTargetStore, distance);
      }
    }

    // ヒステリシス判定
    const shouldEnterPreciseMode = minDistanceToTargetStore <= this.ENTER_THRESHOLD;
    const shouldStayInPreciseMode = minDistanceToTargetStore <= this.EXIT_THRESHOLD;

    if (minDistanceToTargetStore < Infinity) {
      console.log(`📍 最寄り対象店舗まで: ${Math.round(minDistanceToTargetStore)}m`);
    }

    return { shouldEnterPreciseMode, shouldStayInPreciseMode };
  }

  /**
   * Dwell Time フィルタ付きジオフェンスチェック
   */
  async checkGeofencesWithDwellTime() {
    if (!this.currentLocation || this.activeReminders.length === 0) return;

    const now = Date.now();

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

        const triggerDistance = reminder.trigger_distance || this.TRIGGER_DISTANCE;
        const storeKey = `${reminder.id}_${closestStore.id}`;
        
        if (distance <= triggerDistance) {
          // トリガー範囲内に進入
          if (!this.storeEnterTimes.has(storeKey)) {
            this.storeEnterTimes.set(storeKey, now);
            console.log(`⏰ 店舗エリア進入: ${closestStore.name} (${Math.round(distance)}m)`);
          } else {
            // Dwell Time チェック
            const dwellTime = now - this.storeEnterTimes.get(storeKey);
            if (dwellTime >= this.dwellTimeRequired) {
              await this.triggerReminder(reminder, closestStore, distance);
              // トリガー後はエントリを削除（重複防止）
              this.storeEnterTimes.delete(storeKey);
            }
          }
        } else {
          // トリガー範囲外に退出
          if (this.storeEnterTimes.has(storeKey)) {
            this.storeEnterTimes.delete(storeKey);
            console.log(`🚪 店舗エリア退出: ${closestStore.name}`);
          }
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

    console.log('🎯 ジオフェンストリガー（Dwell Time満足）:', {
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
    
    // サーバーにリマインダー無効化を通知
    try {
      await this.deactivateReminder(reminder.id);
    } catch (error) {
      console.error('❌ リマインダー無効化API呼び出しエラー:', error);
    }
    
    // ローカルのアクティブリマインダーリストから削除
    await this.removeReminder(reminder.id);
    
    console.log('📢 通知送信完了・リマインダー無効化:', {
      reminder: reminder.title,
      store: store.name
    });
  }

  /**
   * サーバーでリマインダーを無効化
   */
  async deactivateReminder(reminderId) {
    try {
      console.log('🔒 リマインダー無効化API呼び出し:', reminderId);
      
      const response = await axios.patch(`${this.API_BASE_URL}/reminders/${reminderId}/`, {
        is_active: false
      }, {
        timeout: 5000
      });
      
      console.log('✅ リマインダー無効化完了:', reminderId);
      return response.data;
      
    } catch (error) {
      console.error('❌ リマインダー無効化APIエラー:', error);
      throw error;
    }
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
      
      // アクティブなリマインダーがあれば監視開始
      if (this.activeReminders.length > 0) {
        await this.startSignificantLocationMonitoring();
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
      this.storeEnterTimes.clear();
      this.isInitialized = false;
      console.log('🛑 最適化ジオフェンスサービス停止');
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
      preciseDuration: this.preciseDuration,
      pendingDwells: this.storeEnterTimes.size,
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
const optimizedGeofenceService = new OptimizedGeofenceService();

export default optimizedGeofenceService;