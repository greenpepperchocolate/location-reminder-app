import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import axios from 'axios';
import { AuthContext } from '../App';

const DashboardScreen = ({ navigation }) => {
  const { user, location, updateLocation, logout } = useContext(AuthContext);
  const [recentReminders, setRecentReminders] = useState([]);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [stats, setStats] = useState({
    totalReminders: 0,
    activeReminders: 0,
    triggeredToday: 0
  });
  const [refreshing, setRefreshing] = useState(false);

  // 状態が不正になった時の保護
  React.useEffect(() => {
    if (!Array.isArray(recentReminders)) {
      console.error('recentReminders is not an array, resetting:', recentReminders);
      setRecentReminders([]);
    }
    if (!Array.isArray(nearbyStores)) {
      console.error('nearbyStores is not an array, resetting:', nearbyStores);
      setNearbyStores([]);
    }
  }, [recentReminders, nearbyStores]);

  useEffect(() => {
    loadData();
  }, [location]);

  const loadData = async () => {
    await Promise.all([
      fetchRecentReminders(),
      location && fetchNearbyStores()
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await updateLocation();
    await loadData();
    setRefreshing(false);
  };

  const fetchRecentReminders = async () => {
    try {
      console.log('=== Dashboard リマインダー取得開始 ===');
      console.log('リクエストURL:', `${axios.defaults.baseURL}/reminders/`);
      
      const response = await axios.get(`${axios.defaults.baseURL}/reminders/`);
      
      console.log('Dashboard レスポンスステータス:', response.status);
      console.log('Dashboard レスポンスデータ型:', typeof response.data);
      
      // HTMLレスポンスの検出
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
        console.error('⚠️ リマインダー取得でHTMLレスポンスを受信 - 間違ったサーバーにアクセスしています');
        console.error('期待: JSON、実際: HTMLドキュメント');
        setRecentReminders([]);
        return;
      }
      
      const reminders = response.data.results || response.data || [];
      console.log('Dashboard fetchRecentReminders - reminders type:', typeof reminders);
      console.log('Dashboard fetchRecentReminders - reminders isArray:', Array.isArray(reminders));
      console.log('Dashboard fetchRecentReminders - reminders:', reminders);
      
      try {
        if (Array.isArray(reminders)) {
          setRecentReminders(reminders.slice(0, 5));
        } else {
          console.error('Cannot slice non-array reminders:', reminders);
          setRecentReminders([]);
        }
      } catch (sliceError) {
        console.error('Error slicing reminders:', sliceError);
        setRecentReminders([]);
      }
      
      let active = 0;
      try {
        if (Array.isArray(reminders)) {
          active = reminders.filter(r => r.is_active).length;
        } else {
          console.error('reminders is not an array in Dashboard:', typeof reminders, reminders);
        }
      } catch (filterError) {
        console.error('Filter error in Dashboard:', filterError);
        console.error('reminders value:', reminders);
      }
      setStats(prev => ({
        ...prev,
        totalReminders: Array.isArray(reminders) ? reminders.length : 0,
        activeReminders: active
      }));
    } catch (error) {
      console.error('=== Dashboard リマインダー取得エラー ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Full error:', error);
      setRecentReminders([]);
    }
  };

  const fetchNearbyStores = async () => {
    try {
      console.log('=== Dashboard: 店舗データ取得開始 ===');
      console.log('パラメータ:', {
        lat: location.latitude,
        lng: location.longitude,
        radius: 0.5
      });
      console.log('リクエストURL:', `${axios.defaults.baseURL}/stores/nearby/`);
      
      const response = await axios.get(`${axios.defaults.baseURL}/stores/nearby/`, {
        params: {
          lat: location.latitude,
          lng: location.longitude,
          radius: 5.0 // 5km以内に拡大してテスト
        }
      });
      
      console.log('Dashboard レスポンスステータス:', response.status);
      console.log('Dashboard レスポンスヘッダー:', response.headers);
      console.log('Dashboard レスポンスデータ型:', typeof response.data);
      console.log('Dashboard レスポンスデータ:', response.data);
      
      // HTMLレスポンスの検出
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
        console.error('⚠️ HTMLレスポンスを受信 - 間違ったサーバーにアクセスしています');
        console.error('期待: JSON配列、実際: HTMLドキュメント');
        setNearbyStores([]);
        return;
      }
      
      const stores = response.data || [];
      if (!Array.isArray(stores)) {
        console.error('⚠️ レスポンスが配列ではありません:', typeof stores);
        setNearbyStores([]);
        return;
      }
      
      console.log('Dashboard: 店舗データ取得成功:', stores.length, '件');
      setNearbyStores(stores.slice(0, 5));
    } catch (error) {
      console.error('=== Dashboard: 近隣店舗取得エラー ===');
      console.error('Error:', error.message);
      if (error.response) {
        console.error('レスポンスデータ:', error.response.data);
        console.error('ステータスコード:', error.response.status);
        console.error('レスポンスヘッダー:', error.response.headers);
      } else if (error.request) {
        console.error('リクエストエラー:', error.request);
      }
      setNearbyStores([]);
    }
  };

  // ログアウト機能を削除

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.welcome}>こんにちは、{user?.username}さん！</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalReminders}</Text>
          <Text style={styles.statLabel}>総リマインダー数</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.activeReminders}</Text>
          <Text style={styles.statLabel}>アクティブ</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.triggeredToday}</Text>
          <Text style={styles.statLabel}>今日のトリガー</Text>
        </View>
      </View>

      {/* Location Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 現在の位置情報</Text>
        {location ? (
          <View>
            <Text style={styles.locationText}>
              緯度: {location.latitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              経度: {location.longitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              精度: ±{Math.round(location.accuracy)}m
            </Text>
          </View>
        ) : (
          <Text style={styles.noLocationText}>位置情報を取得中...</Text>
        )}
        
        <TouchableOpacity style={styles.secondaryButton} onPress={updateLocation}>
          <Text style={styles.secondaryButtonText}>🔄 位置情報を更新</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ クイックアクション</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('ReminderForm')}
          >
            <Text style={styles.actionButtonIcon}>✨</Text>
            <Text style={styles.actionButtonText}>新規リマインダー</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('ReminderList')}
          >
            <Text style={styles.actionButtonIcon}>📝</Text>
            <Text style={styles.actionButtonText}>リマインダー一覧</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Map')}
          >
            <Text style={styles.actionButtonIcon}>🗺️</Text>
            <Text style={styles.actionButtonText}>マップ</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Reminders */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>📝 最近のリマインダー</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ReminderList')}>
            <Text style={styles.viewAllText}>すべて表示</Text>
          </TouchableOpacity>
        </View>
        
        {!Array.isArray(recentReminders) || recentReminders.length === 0 ? (
          <Text style={styles.emptyText}>リマインダーがありません</Text>
        ) : (
          (() => {
            try {
              return recentReminders.map(reminder => (
                <View key={reminder.id} style={styles.reminderItem}>
                  <Text style={styles.reminderTitle}>{reminder.title}</Text>
                  <Text style={styles.reminderStore}>{reminder.store_type_display}</Text>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: reminder.is_active ? '#28a745' : '#6c757d' }
                  ]}>
                    <Text style={styles.statusText}>
                      {reminder.is_active ? 'アクティブ' : '無効'}
                    </Text>
                  </View>
                </View>
              ));
            } catch (mapError) {
              console.error('recentReminders.map error:', mapError);
              console.error('recentReminders value:', recentReminders);
              return <Text style={styles.emptyText}>リマインダーの表示でエラーが発生しました</Text>;
            }
          })()
        )}
      </View>

      {/* Nearby Stores */}
      {Array.isArray(nearbyStores) && nearbyStores.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏪 近隣の店舗</Text>
          {nearbyStores.map(store => (
            <View key={store.id} style={styles.storeItem}>
              <Text style={styles.storeName}>{store.name}</Text>
              <Text style={styles.storeAddress}>{store.address}</Text>
              <Text style={styles.storeDistance}>
                {store.distance ? `${(store.distance * 1000).toFixed(0)}m` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ 設定</Text>
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={() => {
            Alert.alert(
              'ログアウト',
              'ログアウトしますか？',
              [
                { text: 'キャンセル', style: 'cancel' },
                { text: 'ログアウト', style: 'destructive', onPress: logout }
              ]
            );
          }}
        >
          <Text style={styles.logoutButtonText}>ログアウト</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  welcome: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  viewAllText: {
    color: '#007AFF',
    fontSize: 14,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '30%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  noLocationText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  reminderItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  reminderStore: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  storeItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  storeAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  storeDistance: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 5,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DashboardScreen;