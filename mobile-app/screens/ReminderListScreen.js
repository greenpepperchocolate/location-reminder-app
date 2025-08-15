import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Switch,
} from 'react-native';
import axios from 'axios';
import { AuthContext } from '../App';

const ReminderListScreen = ({ navigation }) => {
  const { user, logout } = useContext(AuthContext);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      console.log('=== ReminderList リマインダー取得開始 ===');
      console.log('リクエストURL:', `${axios.defaults.baseURL}/reminders/`);
      
      const response = await axios.get(`${axios.defaults.baseURL}/reminders/`);
      
      console.log('ReminderList レスポンスステータス:', response.status);
      console.log('ReminderList レスポンスデータ型:', typeof response.data);
      
      // HTMLレスポンスの検出
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
        console.error('⚠️ ReminderList リマインダー取得でHTMLレスポンスを受信');
        setReminders([]);
        return;
      }
      
      const remindersData = response.data.results || response.data || [];
      console.log('ReminderList fetchReminders - remindersData type:', typeof remindersData);
      console.log('ReminderList fetchReminders - remindersData isArray:', Array.isArray(remindersData));
      console.log('ReminderList fetchReminders - remindersData:', remindersData);
      setReminders(remindersData);
    } catch (error) {
      console.error('=== ReminderList リマインダー取得エラー ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Full error:', error);
      setReminders([]);
      Alert.alert('エラー', 'リマインダーの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReminders();
    setRefreshing(false);
  };

  const toggleReminderStatus = async (reminderId, currentStatus) => {
    try {
      await axios.patch(`${axios.defaults.baseURL}/reminders/${reminderId}/`, {
        is_active: !currentStatus
      });
      
      // Update local state
      setReminders(Array.isArray(reminders) ? reminders.map(reminder => 
        reminder.id === reminderId 
          ? { ...reminder, is_active: !currentStatus }
          : reminder
      ) : []);
      
      Alert.alert(
        '更新完了',
        `リマインダーを${!currentStatus ? '有効' : '無効'}にしました`
      );
    } catch (error) {
      console.error('リマインダー更新エラー:', error);
      Alert.alert('エラー', 'リマインダーの更新に失敗しました');
    }
  };

  const deleteReminder = async (reminderId, title) => {
    Alert.alert(
      'リマインダーを削除',
      `「${title}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { 
          text: '削除', 
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${axios.defaults.baseURL}/reminders/${reminderId}/`);
              setReminders(Array.isArray(reminders) ? reminders.filter(reminder => reminder.id !== reminderId) : []);
              Alert.alert('削除完了', 'リマインダーが削除されました');
            } catch (error) {
              console.error('リマインダー削除エラー:', error);
              Alert.alert('エラー', 'リマインダーの削除に失敗しました');
            }
          }
        }
      ]
    );
  };

  const getStoreTypeDisplay = (storeType) => {
    switch (storeType) {
      case 'convenience': return '🏪 コンビニ';
      case 'pharmacy': return '💊 薬局';
      default: return '🏪 店舗';
    }
  };

  const getDistanceDisplay = (distance) => {
    return `${distance}m以内`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {Array.isArray(reminders) ? reminders.length : 0}個のリマインダー
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('ReminderForm')}
          >
            <Text style={styles.addButtonText}>+ 新規作成</Text>
          </TouchableOpacity>
        </View>

        {/* Reminders List */}
        {!Array.isArray(reminders) || reminders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>リマインダーがありません</Text>
            <Text style={styles.emptyText}>
              新しいリマインダーを作成して、お店に近づいたときに通知を受け取りましょう
            </Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => navigation.navigate('ReminderForm')}
            >
              <Text style={styles.createFirstButtonText}>最初のリマインダーを作成</Text>
            </TouchableOpacity>
          </View>
        ) : (
          reminders.map(reminder => (
            <View key={reminder.id} style={styles.reminderCard}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.titleContainer}>
                  <Text style={styles.reminderTitle}>{reminder.title}</Text>
                  <Text style={styles.storeType}>
                    {getStoreTypeDisplay(reminder.store_type)}
                  </Text>
                </View>
                <Switch
                  value={reminder.is_active}
                  onValueChange={() => toggleReminderStatus(reminder.id, reminder.is_active)}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={reminder.is_active ? '#007AFF' : '#f4f3f4'}
                />
              </View>

              {/* Card Content */}
              {reminder.memo && (
                <Text style={styles.memo}>{reminder.memo}</Text>
              )}

              {/* Card Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.detailsContainer}>
                  <Text style={styles.distance}>
                    📏 {getDistanceDisplay(reminder.trigger_distance)}
                  </Text>
                  <Text style={styles.createdDate}>
                    作成: {new Date(reminder.created_at).toLocaleDateString('ja-JP')}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteReminder(reminder.id, reminder.title)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>

              {/* Status Badge */}
              <View style={[
                styles.statusBadge,
                { backgroundColor: reminder.is_active ? '#28a745' : '#6c757d' }
              ]}>
                <Text style={styles.statusText}>
                  {reminder.is_active ? 'アクティブ' : '無効'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  createFirstButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  createFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reminderCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleContainer: {
    flex: 1,
    marginRight: 15,
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  storeType: {
    fontSize: 14,
    color: '#666',
  },
  memo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
  },
  distance: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 2,
  },
  createdDate: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ffe6e6',
  },
  deleteButtonText: {
    fontSize: 18,
  },
  statusBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default ReminderListScreen;