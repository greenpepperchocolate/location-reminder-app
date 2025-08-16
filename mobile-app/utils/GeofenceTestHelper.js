/**
 * ジオフェンス機能のテストヘルパー
 * 開発・デバッグ用のユーティリティ関数群
 */
import LocalDatabaseService from '../services/LocalDatabaseService';
import PlacesService from '../services/PlacesService';
import GeofenceService from '../services/GeofenceService';
import LocationChangeService from '../services/LocationChangeService';

class GeofenceTestHelper {
  /**
   * 全サービスの状態確認
   */
  static async checkAllServicesStatus() {
    console.log('=== 全サービス状態確認 ===');
    
    try {
      // ローカルDB状態
      const dbStats = await LocalDatabaseService.getStats();
      console.log('📊 ローカルDB:', dbStats);
      
      // Places API状態
      const placesStats = PlacesService.getCacheStats();
      console.log('🏪 Places API:', placesStats);
      
      // ジオフェンスサービス状態
      const geofenceStatus = GeofenceService.getStatus();
      console.log('🎯 ジオフェンス:', geofenceStatus);
      
      // Location Change サービス状態
      const locationStatus = await LocationChangeService.getStatus();
      console.log('📍 Location Change:', locationStatus);
      
      return {
        database: dbStats,
        places: placesStats,
        geofence: geofenceStatus,
        locationChange: locationStatus
      };
      
    } catch (error) {
      console.error('❌ サービス状態確認エラー:', error);
      return null;
    }
  }

  /**
   * テストイベントをローカルDBに追加
   */
  static async addTestEvents() {
    console.log('=== テストイベント追加 ===');
    
    const testEvents = [
      {
        eventType: 'GEOFENCE_ENTER',
        reminderId: 1,
        reminderTitle: 'テストリマインダー：牛乳を買う',
        storeId: 'test_store_1',
        storeName: 'テストコンビニ',
        storeType: 'convenience',
        userLatitude: 35.6812,
        userLongitude: 139.7671,
        storeLatitude: 35.6815,
        storeLongitude: 139.7675,
        distance: 45,
        metadata: { test: true, accuracy: 10 }
      },
      {
        eventType: 'SIGNIFICANT_LOCATION_CHANGE',
        reminderId: null,
        reminderTitle: null,
        storeId: null,
        storeName: null,
        storeType: null,
        userLatitude: 35.6850,
        userLongitude: 139.7700,
        storeLatitude: null,
        storeLongitude: null,
        distance: 1200,
        metadata: { test: true, accuracy: 15 }
      },
      {
        eventType: 'REMINDER_CREATED',
        reminderId: 2,
        reminderTitle: 'テストリマインダー：薬を買う',
        storeId: null,
        storeName: null,
        storeType: 'pharmacy',
        userLatitude: 35.6880,
        userLongitude: 139.7730,
        storeLatitude: null,
        storeLongitude: null,
        distance: null,
        metadata: { test: true, trigger_distance: 50 }
      }
    ];

    try {
      for (const event of testEvents) {
        const eventId = await LocalDatabaseService.logEvent(event);
        console.log(`✅ テストイベント追加: ${event.eventType} (ID: ${eventId})`);
      }
      
      console.log('🎉 テストイベント追加完了');
      return true;
      
    } catch (error) {
      console.error('❌ テストイベント追加エラー:', error);
      return false;
    }
  }

  /**
   * テスト位置履歴を追加
   */
  static async addTestLocationHistory() {
    console.log('=== テスト位置履歴追加 ===');
    
    const baseTime = Date.now();
    const testLocations = [
      {
        latitude: 35.6812,
        longitude: 139.7671,
        accuracy: 10,
        altitude: 5,
        speed: 0,
        heading: null,
        activityType: 'stationary'
      },
      {
        latitude: 35.6820,
        longitude: 139.7680,
        accuracy: 8,
        altitude: 6,
        speed: 1.2,
        heading: 45,
        activityType: 'walking'
      },
      {
        latitude: 35.6850,
        longitude: 139.7700,
        accuracy: 15,
        altitude: 8,
        speed: 15.5,
        heading: 90,
        activityType: 'automotive'
      }
    ];

    try {
      for (let i = 0; i < testLocations.length; i++) {
        const locationId = await LocalDatabaseService.logLocation(testLocations[i]);
        console.log(`📍 テスト位置履歴追加: ${i + 1} (ID: ${locationId})`);
      }
      
      console.log('🎉 テスト位置履歴追加完了');
      return true;
      
    } catch (error) {
      console.error('❌ テスト位置履歴追加エラー:', error);
      return false;
    }
  }

  /**
   * Places APIのテスト呼び出し
   */
  static async testPlacesAPI(latitude = 35.6812, longitude = 139.7671) {
    console.log(`=== Places APIテスト ===`);
    console.log(`位置: ${latitude}, ${longitude}`);
    
    try {
      const stores = await PlacesService.searchNearbyStores(latitude, longitude, 1000);
      console.log(`🏪 Places API結果: ${stores.length}件の店舗`);
      
      stores.forEach((store, index) => {
        console.log(`  ${index + 1}. ${store.name} (${store.store_type}) - ${Math.round(store.distance)}m`);
      });
      
      return stores;
      
    } catch (error) {
      console.error('❌ Places APIテストエラー:', error);
      return [];
    }
  }

  /**
   * データベースのクリーンアップ（古いテストデータを削除）
   */
  static async cleanupTestData() {
    console.log('=== テストデータクリーンアップ ===');
    
    try {
      await LocalDatabaseService.cleanupOldData(7); // 7日以上古いデータを削除
      console.log('✅ テストデータクリーンアップ完了');
      return true;
      
    } catch (error) {
      console.error('❌ テストデータクリーンアップエラー:', error);
      return false;
    }
  }

  /**
   * 包括的なシステムテスト
   */
  static async runFullSystemTest() {
    console.log('=== 包括的システムテスト開始 ===');
    
    const results = {
      servicesStatus: null,
      testEventsAdded: false,
      testLocationsAdded: false,
      placesAPITest: [],
      cleanupCompleted: false
    };

    try {
      // 1. サービス状態確認
      console.log('1. サービス状態確認...');
      results.servicesStatus = await this.checkAllServicesStatus();
      
      // 2. テストデータ追加
      console.log('2. テストデータ追加...');
      results.testEventsAdded = await this.addTestEvents();
      results.testLocationsAdded = await this.addTestLocationHistory();
      
      // 3. Places APIテスト（APIキーが設定されている場合のみ）
      console.log('3. Places APIテスト...');
      results.placesAPITest = await this.testPlacesAPI();
      
      // 4. クリーンアップ
      console.log('4. クリーンアップ...');
      results.cleanupCompleted = await this.cleanupTestData();
      
      console.log('=== システムテスト完了 ===');
      console.log('結果:', results);
      
      return results;
      
    } catch (error) {
      console.error('❌ システムテストエラー:', error);
      return results;
    }
  }

  /**
   * 開発モード用デバッグ情報表示
   */
  static async showDebugInfo() {
    console.log('=== デバッグ情報 ===');
    
    try {
      const status = await this.checkAllServicesStatus();
      const dbStats = await LocalDatabaseService.getStats();
      
      console.log('📱 アプリ情報:');
      console.log('  - 総イベント数:', dbStats.totalEvents);
      console.log('  - 位置履歴数:', dbStats.totalLocations);
      console.log('  - ジオフェンス数:', dbStats.totalGeofences);
      
      if (status?.geofence) {
        console.log('🎯 ジオフェンス情報:');
        console.log('  - 初期化状態:', status.geofence.isInitialized);
        console.log('  - アクティブフェンス:', status.geofence.activeGeofences);
        console.log('  - 店舗数:', status.geofence.stores);
      }
      
      return status;
      
    } catch (error) {
      console.error('❌ デバッグ情報取得エラー:', error);
      return null;
    }
  }
}

export default GeofenceTestHelper;