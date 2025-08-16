import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlacesService from './PlacesService';
import LocalDatabaseService from './LocalDatabaseService';

// バックグラウンドタスク名
const SIGNIFICANT_LOCATION_TASK = 'significant-location-task';

class LocationChangeService {
  constructor() {
    this.isInitialized = false;
    this.lastKnownLocation = null;
    this.significantDistanceThreshold = 1000; // 1km
    this.onLocationChangeCallback = null;
    this.watchPositionId = null;
  }

  /**
   * サービスの初期化
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('=== Significant Location Change サービス初期化 ===');

      // バックグラウンドタスクの定義
      await this.defineBackgroundTask();

      // 最後の既知位置を読み込み
      await this.loadLastKnownLocation();

      this.isInitialized = true;
      console.log('✅ Significant Location Change サービス初期化完了');

    } catch (error) {
      console.error('❌ Significant Location Change 初期化エラー:', error);
      throw error;
    }
  }

  /**
   * バックグラウンドタスクの定義
   */
  async defineBackgroundTask() {
    if (!TaskManager.isTaskDefined(SIGNIFICANT_LOCATION_TASK)) {
      TaskManager.defineTask(SIGNIFICANT_LOCATION_TASK, ({ data, error }) => {
        if (error) {
          console.error('Significant Location Task エラー:', error);
          return;
        }

        if (data) {
          this.handleSignificantLocationChange(data);
        }
      });
    }
  }

  /**
   * Significant Location Change監視開始
   */
  async startMonitoring(callback) {
    try {
      console.log('📍 Significant Location Change 監視開始');
      
      this.onLocationChangeCallback = callback;

      // iOS: Significant Location Change を使用
      if (Platform.OS === 'ios') {
        await Location.startLocationUpdatesAsync(SIGNIFICANT_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 300000, // 5分間隔
          distanceInterval: this.significantDistanceThreshold, // 1km移動で更新
          deferredUpdatesInterval: 600000, // 10分間隔で一括更新
          showsBackgroundLocationIndicator: false,
          foregroundService: {
            notificationTitle: 'Location Reminder',
            notificationBody: 'バックグラウンドで位置情報を監視しています',
            notificationColor: '#007AFF'
          }
        });
        console.log('🍎 iOS Significant Location Change 開始');
      } else {
        // Android: 定期的な位置監視
        await Location.startLocationUpdatesAsync(SIGNIFICANT_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 600000, // 10分間隔
          distanceInterval: this.significantDistanceThreshold,
          foregroundService: {
            notificationTitle: 'Location Reminder',
            notificationBody: 'バックグラウンドで位置情報を監視しています',
            notificationColor: '#007AFF'
          }
        });
        console.log('🤖 Android 定期位置監視開始');
      }

      // フォアグラウンドでの補完監視も開始
      this.startForegroundMonitoring();

    } catch (error) {
      console.error('❌ Significant Location Change 監視開始エラー:', error);
      throw error;
    }
  }

  /**
   * フォアグラウンド監視（補完用）
   */
  async startForegroundMonitoring() {
    try {
      this.watchPositionId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // 30秒間隔
          distanceInterval: 100, // 100m移動で更新
        },
        (location) => {
          this.checkForSignificantChange(location);
        }
      );

      console.log('👁️ フォアグラウンド位置監視開始');

    } catch (error) {
      console.error('❌ フォアグラウンド監視開始エラー:', error);
    }
  }

  /**
   * Significant Change のチェック
   */
  async checkForSignificantChange(newLocation) {
    try {
      if (!this.lastKnownLocation) {
        await this.updateLastKnownLocation(newLocation);
        return;
      }

      const distance = this.calculateDistance(
        this.lastKnownLocation.coords.latitude,
        this.lastKnownLocation.coords.longitude,
        newLocation.coords.latitude,
        newLocation.coords.longitude
      );

      console.log(`📏 位置変化距離: ${Math.round(distance)}m`);

      if (distance >= this.significantDistanceThreshold) {
        console.log('🚨 Significant Location Change 検知!');
        
        // ローカルDBに記録
        await LocalDatabaseService.logLocation({
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
          accuracy: newLocation.coords.accuracy,
          altitude: newLocation.coords.altitude,
          speed: newLocation.coords.speed,
          heading: newLocation.coords.heading,
          activityType: 'significant_change'
        });

        // コールバック実行
        if (this.onLocationChangeCallback) {
          await this.onLocationChangeCallback(newLocation, distance);
        }

        // 位置を更新
        await this.updateLastKnownLocation(newLocation);
      }

    } catch (error) {
      console.error('❌ Significant Change チェックエラー:', error);
    }
  }

  /**
   * バックグラウンドタスクのハンドリング
   */
  async handleSignificantLocationChange(data) {
    try {
      if (!data.locations || data.locations.length === 0) return;

      const location = data.locations[data.locations.length - 1];
      console.log('📱 バックグラウンド位置更新:', {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy
      });

      // Significant Change チェック
      await this.checkForSignificantChange(location);

    } catch (error) {
      console.error('❌ バックグラウンド位置処理エラー:', error);
    }
  }

  /**
   * 最後の既知位置の読み込み
   */
  async loadLastKnownLocation() {
    try {
      const stored = await AsyncStorage.getItem('last_known_location');
      if (stored) {
        this.lastKnownLocation = JSON.parse(stored);
        console.log('📍 最後の既知位置読み込み:', {
          lat: this.lastKnownLocation.coords.latitude,
          lng: this.lastKnownLocation.coords.longitude
        });
      }
    } catch (error) {
      console.error('❌ 最後の既知位置読み込みエラー:', error);
    }
  }

  /**
   * 最後の既知位置の更新
   */
  async updateLastKnownLocation(location) {
    try {
      this.lastKnownLocation = location;
      await AsyncStorage.setItem('last_known_location', JSON.stringify(location));
      console.log('💾 最後の既知位置更新');
    } catch (error) {
      console.error('❌ 最後の既知位置更新エラー:', error);
    }
  }

  /**
   * 距離計算
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
   * 閾値の設定
   */
  setSignificantDistanceThreshold(meters) {
    this.significantDistanceThreshold = meters;
    console.log(`🎯 Significant距離閾値設定: ${meters}m`);
  }

  /**
   * 現在位置の取得
   */
  async getCurrentLocation() {
    try {
      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch (error) {
      console.error('❌ 現在位置取得エラー:', error);
      return null;
    }
  }

  /**
   * 監視停止
   */
  async stopMonitoring() {
    try {
      // バックグラウンドタスク停止
      const isRunning = await Location.hasStartedLocationUpdatesAsync(SIGNIFICANT_LOCATION_TASK);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(SIGNIFICANT_LOCATION_TASK);
      }

      // フォアグラウンド監視停止
      if (this.watchPositionId) {
        this.watchPositionId.remove();
        this.watchPositionId = null;
      }

      this.onLocationChangeCallback = null;
      console.log('⏹️ Significant Location Change 監視停止');

    } catch (error) {
      console.error('❌ 監視停止エラー:', error);
    }
  }

  /**
   * サービス状態取得
   */
  async getStatus() {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(SIGNIFICANT_LOCATION_TASK);
      
      return {
        isInitialized: this.isInitialized,
        isMonitoring: isRunning,
        significantDistanceThreshold: this.significantDistanceThreshold,
        lastKnownLocation: this.lastKnownLocation ? {
          latitude: this.lastKnownLocation.coords.latitude,
          longitude: this.lastKnownLocation.coords.longitude,
          timestamp: this.lastKnownLocation.timestamp
        } : null
      };
    } catch (error) {
      console.error('❌ 状態取得エラー:', error);
      return {
        isInitialized: this.isInitialized,
        isMonitoring: false,
        significantDistanceThreshold: this.significantDistanceThreshold,
        lastKnownLocation: null
      };
    }
  }
}

// シングルトンインスタンス
const locationChangeService = new LocationChangeService();

export default locationChangeService;