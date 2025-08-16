import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform, AppState, Alert } from 'react-native';
import PlacesService from './PlacesService';
import LocalDatabaseService from './LocalDatabaseService';
import LocationChangeService from './LocationChangeService';

// バックグラウンドタスクの定義
const GEOFENCE_TASK_NAME = 'geofence-task';
const LOCATION_TASK_NAME = 'background-location-task';

// 通知の設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class GeofenceService {
  constructor() {
    this.isInitialized = false;
    this.activeGeofences = new Map();
    this.stores = [];
    this.isExpoGo = false;
    this.currentLocation = null;
    this.lastGeofenceUpdate = null;
  }

  /**
   * サービスの初期化
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('=== ジオフェンスサービス初期化開始 ===');
      
      // 実行環境の検出
      this.isExpoGo = __DEV__ && !Constants.appOwnership;
      console.log('実行環境:', this.isExpoGo ? 'Expo Go (開発)' : 'スタンドアロン (本番)');
      
      // Expo Go環境ではサービスを無効化
      if (this.isExpoGo) {
        console.log('⚠️ Expo Go環境のため、ジオフェンスサービスをスキップします');
        this.isInitialized = true;
        return;
      }

      // ローカルDBの初期化
      await LocalDatabaseService.initialize();
      
      // 権限の確認と要求
      await this.requestPermissions();
      
      // バックグラウンドタスクの登録
      await this.registerBackgroundTasks();
      
      // Location Change サービスの初期化
      await LocationChangeService.initialize();
      
      // Significant Location Change の監視開始
      await LocationChangeService.startMonitoring(
        this.handleSignificantLocationChange.bind(this)
      );
      
      // 保存されたリマインダーの読み込み
      await this.loadStoredReminders();
      
      // 初期店舗スキャンの実行
      await this.performInitialScan();
      
      this.isInitialized = true;
      console.log('✅ ジオフェンスサービス初期化完了');
      
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

      console.log('権限要求完了:', {
        foreground: foregroundStatus,
        background: backgroundStatus,
        notification: notificationStatus
      });
      
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

    // ジオフェンス用タスク
    if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
      TaskManager.defineTask(GEOFENCE_TASK_NAME, ({ data, error }) => {
        if (error) {
          console.error('ジオフェンスタスクエラー:', error);
          return;
        }
        
        if (data) {
          this.handleGeofenceEvent(data);
        }
      });
    }

    // 位置情報監視用タスク
    if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
      TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
        if (error) {
          console.error('位置情報タスクエラー:', error);
          return;
        }
        
        if (data) {
          this.handleLocationUpdate(data);
        }
      });
    }

    console.log('✅ バックグラウンドタスク登録完了');
  }

  /**
   * 初期店舗スキャン
   */
  async performInitialScan() {
    try {
      console.log('=== 初期店舗スキャン開始 ===');
      
      // 現在位置取得
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      this.currentLocation = location;

      // Google Places API で店舗検索
      const nearbyStores = await PlacesService.searchNearbyStores(
        location.coords.latitude,
        location.coords.longitude,
        2000 // 2km範囲
      );

      console.log(`🏪 Places API: ${nearbyStores.length}件の店舗を取得`);

      // 店舗データを更新
      await this.updateStores(nearbyStores);

      // 既存のリマインダーに対してジオフェンスを設定
      await this.refreshGeofences();

      console.log('✅ 初期店舗スキャン完了');

    } catch (error) {
      console.error('❌ 初期店舗スキャンエラー:', error);
    }
  }

  /**
   * Significant Location Change ハンドリング
   */
  async handleSignificantLocationChange(newLocation, distance) {
    try {
      console.log(`🚨 大移動検知: ${Math.round(distance)}m移動`);
      
      this.currentLocation = newLocation;

      // ローカルDBに記録
      await LocalDatabaseService.logEvent({
        eventType: 'SIGNIFICANT_LOCATION_CHANGE',
        reminderId: null,
        reminderTitle: null,
        storeId: null,
        storeName: null,
        storeType: null,
        userLatitude: newLocation.coords.latitude,
        userLongitude: newLocation.coords.longitude,
        storeLatitude: null,
        storeLongitude: null,
        distance: distance,
        metadata: { accuracy: newLocation.coords.accuracy }
      });

      // 新しい位置での店舗検索
      const nearbyStores = await PlacesService.searchNearbyStores(
        newLocation.coords.latitude,
        newLocation.coords.longitude,
        2000
      );

      console.log(`🔄 新位置での店舗検索: ${nearbyStores.length}件`);

      // 店舗データを更新
      await this.updateStores(nearbyStores);

      // ジオフェンスを再設定
      await this.refreshGeofences();

      console.log('✅ ジオフェンス差し替え完了');

    } catch (error) {
      console.error('❌ Significant Location Change 処理エラー:', error);
    }
  }

  /**
   * リマインダーの追加/更新
   */
  async addReminder(reminder) {
    try {
      console.log('=== リマインダー追加 ===', reminder);
      
      // リマインダーをローカルストレージに保存
      await this.saveReminderToStorage(reminder);
      
      // ジオフェンスの設定
      await this.setupGeofencesForReminder(reminder);
      
      // ローカルDBに記録
      await LocalDatabaseService.logEvent({
        eventType: 'REMINDER_CREATED',
        reminderId: reminder.id,
        reminderTitle: reminder.title,
        storeId: null,
        storeName: null,
        storeType: reminder.store_type,
        userLatitude: this.currentLocation?.coords.latitude,
        userLongitude: this.currentLocation?.coords.longitude,
        storeLatitude: null,
        storeLongitude: null,
        distance: null,
        metadata: { trigger_distance: reminder.trigger_distance }
      });
      
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
      
      // ローカルストレージから削除
      await this.removeReminderFromStorage(reminderId);
      
      // 関連するジオフェンスを削除
      await this.removeGeofencesForReminder(reminderId);
      
      // ローカルDBに記録
      await LocalDatabaseService.logEvent({
        eventType: 'REMINDER_DELETED',
        reminderId: reminderId,
        reminderTitle: null,
        storeId: null,
        storeName: null,
        storeType: null,
        userLatitude: this.currentLocation?.coords.latitude,
        userLongitude: this.currentLocation?.coords.longitude,
        storeLatitude: null,
        storeLongitude: null,
        distance: null,
        metadata: {}
      });
      
      console.log('✅ リマインダー削除完了:', reminderId);
      
    } catch (error) {
      console.error('❌ リマインダー削除エラー:', error);
      throw error;
    }
  }

  /**
   * 特定のリマインダー用ジオフェンス設定
   */
  async setupGeofencesForReminder(reminder) {
    if (!reminder.is_active) {
      console.log('非アクティブなリマインダー、ジオフェンス設定をスキップ:', reminder.id);
      return;
    }

    // 対象店舗タイプの店舗を取得（近い順に20件）
    const targetStores = this.stores
      .filter(store => store.store_type === reminder.store_type)
      .slice(0, 20);
    
    console.log(`リマインダー ${reminder.id} 用ジオフェンス設定:`, {
      storeType: reminder.store_type,
      targetStores: targetStores.length,
      triggerDistance: reminder.trigger_distance
    });

    for (const store of targetStores) {
      const geofenceId = `${reminder.id}_${store.id}`;
      
      try {
        this.activeGeofences.set(geofenceId, {
          reminderId: reminder.id,
          storeId: store.id,
          store: store,
          reminder: reminder,
          center: {
            latitude: parseFloat(store.latitude),
            longitude: parseFloat(store.longitude)
          },
          radius: reminder.trigger_distance
        });

        console.log(`✅ ジオフェンス設定完了: ${geofenceId}`);
        
      } catch (error) {
        console.error(`❌ ジオフェンス設定エラー ${geofenceId}:`, error);
      }
    }

    // バックグラウンド位置監視を開始
    await this.startLocationMonitoring();
  }

  /**
   * バックグラウンド位置監視開始
   */
  async startLocationMonitoring() {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isRunning) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // 30秒間隔
          distanceInterval: 10, // 10m移動で更新
          deferredUpdatesInterval: 60000, // 1分間隔で一括更新
          showsBackgroundLocationIndicator: false,
          foregroundService: {
            notificationTitle: 'Location Reminder',
            notificationBody: 'リマインダーのために位置情報を監視しています',
            notificationColor: '#007AFF'
          }
        });
        console.log('📍 バックグラウンド位置監視開始');
      }
    } catch (error) {
      console.error('❌ バックグラウンド位置監視開始エラー:', error);
    }
  }

  /**
   * 位置情報更新のハンドリング
   */
  async handleLocationUpdate(data) {
    if (!data.locations || data.locations.length === 0) return;

    const location = data.locations[data.locations.length - 1];
    console.log('📍 位置情報更新:', {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy
    });

    this.currentLocation = location;

    // 位置履歴をローカルDBに記録
    await LocalDatabaseService.logLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      heading: location.coords.heading,
      activityType: 'background_tracking'
    });

    // アクティブなジオフェンスをチェック
    await this.checkGeofences(location.coords);
  }

  /**
   * ジオフェンスチェック
   */
  async checkGeofences(currentLocation) {
    for (const [geofenceId, geofence] of this.activeGeofences) {
      const distance = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        geofence.center.latitude,
        geofence.center.longitude
      );

      if (distance <= geofence.radius) {
        console.log(`🎯 ジオフェンストリガー: ${geofenceId}`, {
          distance: Math.round(distance),
          radius: geofence.radius,
          store: geofence.store.name
        });

        await this.triggerReminder(geofence, currentLocation, distance);
      }
    }
  }

  /**
   * リマインダートリガー
   */
  async triggerReminder(geofence, currentLocation, distance) {
    const { reminder, store } = geofence;
    
    // 重複通知を防ぐためのクールダウンチェック
    const lastTriggeredKey = `last_triggered_${reminder.id}`;
    const lastTriggered = await AsyncStorage.getItem(lastTriggeredKey);
    const now = Date.now();
    
    if (lastTriggered && (now - parseInt(lastTriggered)) < 3600000) { // 1時間以内
      console.log('⏰ クールダウン中、通知をスキップ:', reminder.id);
      return;
    }

    // ローカルDBにイベント記録
    await LocalDatabaseService.logEvent({
      eventType: 'GEOFENCE_ENTER',
      reminderId: reminder.id,
      reminderTitle: reminder.title,
      storeId: store.id,
      storeName: store.name,
      storeType: store.store_type,
      userLatitude: currentLocation.latitude,
      userLongitude: currentLocation.longitude,
      storeLatitude: store.latitude,
      storeLongitude: store.longitude,
      distance: distance,
      metadata: {
        accuracy: currentLocation.accuracy,
        trigger_distance: reminder.trigger_distance
      }
    });

    // ジオフェンス状態更新
    await LocalDatabaseService.updateGeofenceState(
      `${reminder.id}_${store.id}`,
      reminder.id,
      store.id,
      'ENTER'
    );

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
    
    console.log('📢 ローカル通知送信完了:', {
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
   * 店舗データの更新
   */
  async updateStores(stores) {
    this.stores = stores;
    await AsyncStorage.setItem('cached_stores', JSON.stringify(stores));
    console.log('📍 店舗データ更新:', stores.length, '件');
    this.lastGeofenceUpdate = Date.now();
  }

  /**
   * ジオフェンスの再設定
   */
  async refreshGeofences() {
    console.log('🔄 ジオフェンス再設定開始...');
    
    // 既存のジオフェンスを全てクリア
    this.activeGeofences.clear();
    
    // 保存されたリマインダーを再読み込みして設定
    const reminders = await this.loadStoredReminders();
    for (const reminder of reminders) {
      if (reminder.is_active) {
        await this.setupGeofencesForReminder(reminder);
      }
    }
    
    console.log('✅ ジオフェンス再設定完了');
  }

  /**
   * 保存されたリマインダーの読み込み
   */
  async loadStoredReminders() {
    try {
      const stored = await AsyncStorage.getItem('geofence_reminders');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('ローカルリマインダー読み込みエラー:', error);
      return [];
    }
  }

  /**
   * リマインダーをローカルストレージに保存
   */
  async saveReminderToStorage(reminder) {
    const reminders = await this.loadStoredReminders();
    const index = reminders.findIndex(r => r.id === reminder.id);
    
    if (index >= 0) {
      reminders[index] = reminder;
    } else {
      reminders.push(reminder);
    }
    
    await AsyncStorage.setItem('geofence_reminders', JSON.stringify(reminders));
  }

  /**
   * リマインダーをローカルストレージから削除
   */
  async removeReminderFromStorage(reminderId) {
    const reminders = await this.loadStoredReminders();
    const filtered = reminders.filter(r => r.id !== reminderId);
    await AsyncStorage.setItem('geofence_reminders', JSON.stringify(filtered));
  }

  /**
   * リマインダー用ジオフェンス削除
   */
  async removeGeofencesForReminder(reminderId) {
    const toRemove = [];
    
    for (const [geofenceId, geofence] of this.activeGeofences) {
      if (geofence.reminderId === reminderId) {
        toRemove.push(geofenceId);
      }
    }

    for (const geofenceId of toRemove) {
      this.activeGeofences.delete(geofenceId);
      console.log(`🗑️ ジオフェンス削除: ${geofenceId}`);
    }
  }

  /**
   * サービスの停止
   */
  async stop() {
    try {
      // Location Change Service 停止
      await LocationChangeService.stopMonitoring();

      // バックグラウンド位置監視停止
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      
      this.activeGeofences.clear();
      this.isInitialized = false;
      console.log('🛑 ジオフェンスサービス停止');
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
      activeGeofences: this.activeGeofences.size,
      stores: this.stores.length,
      isExpoGo: this.isExpoGo,
      reason: this.isExpoGo ? 'Expo Go環境' : null,
      lastGeofenceUpdate: this.lastGeofenceUpdate,
      currentLocation: this.currentLocation ? {
        latitude: this.currentLocation.coords.latitude,
        longitude: this.currentLocation.coords.longitude,
        timestamp: this.currentLocation.timestamp
      } : null
    };
  }
}

// シングルトンインスタンス
const geofenceService = new GeofenceService();

export default geofenceService;