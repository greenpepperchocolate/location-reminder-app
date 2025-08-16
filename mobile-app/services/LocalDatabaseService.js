import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

class LocalDatabaseService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * データベースの初期化
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('=== ローカルDB初期化開始 ===');
      
      // データベースを開く
      this.db = await SQLite.openDatabaseAsync('geofence_events.db');
      
      // テーブル作成
      await this.createTables();
      
      this.isInitialized = true;
      console.log('✅ ローカルDB初期化完了');
      
    } catch (error) {
      console.error('❌ ローカルDB初期化エラー:', error);
      throw error;
    }
  }

  /**
   * テーブル作成
   */
  async createTables() {
    // イベントログテーブル
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS event_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        reminder_id INTEGER,
        reminder_title TEXT,
        store_id TEXT,
        store_name TEXT,
        store_type TEXT,
        user_latitude REAL,
        user_longitude REAL,
        store_latitude REAL,
        store_longitude REAL,
        distance REAL,
        triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        synced INTEGER DEFAULT 0
      )
    `);

    // 位置履歴テーブル
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS location_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        altitude REAL,
        speed REAL,
        heading REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        activity_type TEXT,
        synced INTEGER DEFAULT 0
      )
    `);

    // ジオフェンス状態テーブル
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS geofence_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        geofence_id TEXT UNIQUE,
        reminder_id INTEGER,
        store_id TEXT,
        state TEXT NOT NULL,
        entered_at DATETIME,
        exited_at DATETIME,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('📋 データベーステーブル作成完了');
  }

  /**
   * イベントログの記録
   */
  async logEvent(eventData) {
    try {
      const {
        eventType,
        reminderId,
        reminderTitle,
        storeId,
        storeName,
        storeType,
        userLatitude,
        userLongitude,
        storeLatitude,
        storeLongitude,
        distance,
        metadata = {}
      } = eventData;

      const result = await this.db.runAsync(
        `INSERT INTO event_logs (
          event_type, reminder_id, reminder_title, store_id, store_name, store_type,
          user_latitude, user_longitude, store_latitude, store_longitude, distance, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventType,
          reminderId,
          reminderTitle,
          storeId,
          storeName,
          storeType,
          userLatitude,
          userLongitude,
          storeLatitude,
          storeLongitude,
          distance,
          JSON.stringify(metadata)
        ]
      );

      console.log(`📝 イベントログ記録完了: ${eventType} (ID: ${result.lastInsertRowId})`);
      return result.lastInsertRowId;

    } catch (error) {
      console.error('❌ イベントログ記録エラー:', error);
      throw error;
    }
  }

  /**
   * 位置履歴の記録
   */
  async logLocation(locationData) {
    try {
      const {
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
        activityType
      } = locationData;

      const result = await this.db.runAsync(
        `INSERT INTO location_history (
          latitude, longitude, accuracy, altitude, speed, heading, activity_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [latitude, longitude, accuracy, altitude, speed, heading, activityType]
      );

      console.log(`📍 位置履歴記録完了 (ID: ${result.lastInsertRowId})`);
      return result.lastInsertRowId;

    } catch (error) {
      console.error('❌ 位置履歴記録エラー:', error);
      throw error;
    }
  }

  /**
   * ジオフェンス状態の更新
   */
  async updateGeofenceState(geofenceId, reminderId, storeId, state) {
    try {
      const now = new Date().toISOString();
      
      if (state === 'ENTER') {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO geofence_states (
            geofence_id, reminder_id, store_id, state, entered_at, last_updated
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [geofenceId, reminderId, storeId, state, now, now]
        );
      } else if (state === 'EXIT') {
        await this.db.runAsync(
          `UPDATE geofence_states 
           SET state = ?, exited_at = ?, last_updated = ?
           WHERE geofence_id = ?`,
          [state, now, now, geofenceId]
        );
      }

      console.log(`🚪 ジオフェンス状態更新: ${geofenceId} -> ${state}`);

    } catch (error) {
      console.error('❌ ジオフェンス状態更新エラー:', error);
      throw error;
    }
  }

  /**
   * タイムライン用イベント取得
   */
  async getTimelineEvents(limit = 50, offset = 0) {
    try {
      const events = await this.db.getAllAsync(
        `SELECT * FROM event_logs 
         ORDER BY triggered_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      return events.map(event => ({
        ...event,
        metadata: event.metadata ? JSON.parse(event.metadata) : {}
      }));

    } catch (error) {
      console.error('❌ タイムラインイベント取得エラー:', error);
      return [];
    }
  }

  /**
   * 今日のイベント統計
   */
  async getTodayStats() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [totalEvents] = await this.db.getAllAsync(
        `SELECT COUNT(*) as count FROM event_logs 
         WHERE date(triggered_at) = ?`,
        [today]
      );

      const [triggerEvents] = await this.db.getAllAsync(
        `SELECT COUNT(*) as count FROM event_logs 
         WHERE event_type = 'GEOFENCE_ENTER' AND date(triggered_at) = ?`,
        [today]
      );

      const [visitedStores] = await this.db.getAllAsync(
        `SELECT COUNT(DISTINCT store_id) as count FROM event_logs 
         WHERE event_type = 'GEOFENCE_ENTER' AND date(triggered_at) = ?`,
        [today]
      );

      return {
        totalEvents: totalEvents.count || 0,
        triggerEvents: triggerEvents.count || 0,
        visitedStores: visitedStores.count || 0
      };

    } catch (error) {
      console.error('❌ 今日の統計取得エラー:', error);
      return { totalEvents: 0, triggerEvents: 0, visitedStores: 0 };
    }
  }

  /**
   * 位置履歴の取得
   */
  async getLocationHistory(limit = 100) {
    try {
      return await this.db.getAllAsync(
        `SELECT * FROM location_history 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [limit]
      );

    } catch (error) {
      console.error('❌ 位置履歴取得エラー:', error);
      return [];
    }
  }

  /**
   * 古いデータの削除（パフォーマンス向上）
   */
  async cleanupOldData(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffIso = cutoffDate.toISOString();

      const eventResult = await this.db.runAsync(
        `DELETE FROM event_logs WHERE triggered_at < ?`,
        [cutoffIso]
      );

      const locationResult = await this.db.runAsync(
        `DELETE FROM location_history WHERE timestamp < ?`,
        [cutoffIso]
      );

      console.log(`🗑️ 古いデータ削除完了: イベント${eventResult.changes}件, 位置履歴${locationResult.changes}件`);

    } catch (error) {
      console.error('❌ 古いデータ削除エラー:', error);
    }
  }

  /**
   * データベース統計情報
   */
  async getStats() {
    try {
      const [eventCount] = await this.db.getAllAsync(
        `SELECT COUNT(*) as count FROM event_logs`
      );
      
      const [locationCount] = await this.db.getAllAsync(
        `SELECT COUNT(*) as count FROM location_history`
      );

      const [geofenceCount] = await this.db.getAllAsync(
        `SELECT COUNT(*) as count FROM geofence_states`
      );

      return {
        totalEvents: eventCount.count || 0,
        totalLocations: locationCount.count || 0,
        totalGeofences: geofenceCount.count || 0,
        isInitialized: this.isInitialized
      };

    } catch (error) {
      console.error('❌ DB統計取得エラー:', error);
      return { totalEvents: 0, totalLocations: 0, totalGeofences: 0, isInitialized: false };
    }
  }

  /**
   * データベースの破棄
   */
  async close() {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
      console.log('🗄️ ローカルDBを閉じました');
    }
  }
}

// シングルトンインスタンス
const localDatabaseService = new LocalDatabaseService();

export default localDatabaseService;