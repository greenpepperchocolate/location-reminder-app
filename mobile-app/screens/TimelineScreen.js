import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { AuthContext } from '../App';
import LocalDatabaseService from '../services/LocalDatabaseService';

const TimelineScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    triggerEvents: 0,
    visitedStores: 0
  });
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadTimelineData();
    loadTodayStats();
  }, []);

  const loadTimelineData = async (reset = true) => {
    try {
      if (reset) {
        setLoading(true);
        setCurrentPage(0);
      }

      const offset = reset ? 0 : currentPage * pageSize;
      const timelineEvents = await LocalDatabaseService.getTimelineEvents(pageSize, offset);

      if (reset) {
        setEvents(timelineEvents);
      } else {
        setEvents(prev => [...prev, ...timelineEvents]);
      }

      setHasMore(timelineEvents.length === pageSize);
      if (!reset) {
        setCurrentPage(prev => prev + 1);
      }

      console.log(`📅 タイムラインデータ読み込み: ${timelineEvents.length}件`);

    } catch (error) {
      console.error('❌ タイムラインデータ読み込みエラー:', error);
      Alert.alert('エラー', 'タイムラインデータの読み込みに失敗しました');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadTodayStats = async () => {
    try {
      const todayStats = await LocalDatabaseService.getTodayStats();
      setStats(todayStats);
      console.log('📊 今日の統計:', todayStats);
    } catch (error) {
      console.error('❌ 統計データ読み込みエラー:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTimelineData(true);
    await loadTodayStats();
    setRefreshing(false);
  };

  const loadMoreEvents = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      loadTimelineData(false);
    }
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'GEOFENCE_ENTER':
        return '🎯';
      case 'SIGNIFICANT_LOCATION_CHANGE':
        return '🚶‍♂️';
      case 'REMINDER_CREATED':
        return '✨';
      case 'REMINDER_DELETED':
        return '🗑️';
      case 'REMINDER_UPDATED':
        return '✏️';
      default:
        return '📍';
    }
  };

  const getEventTitle = (event) => {
    switch (event.event_type) {
      case 'GEOFENCE_ENTER':
        return `${event.store_name || '店舗'}に到着`;
      case 'SIGNIFICANT_LOCATION_CHANGE':
        return '大きな移動を検知';
      case 'REMINDER_CREATED':
        return `リマインダー「${event.reminder_title}」を作成`;
      case 'REMINDER_DELETED':
        return 'リマインダーを削除';
      case 'REMINDER_UPDATED':
        return `リマインダー「${event.reminder_title}」を更新`;
      default:
        return 'イベント';
    }
  };

  const getEventDescription = (event) => {
    switch (event.event_type) {
      case 'GEOFENCE_ENTER':
        return `${event.reminder_title}\n距離: ${Math.round(event.distance || 0)}m`;
      case 'SIGNIFICANT_LOCATION_CHANGE':
        return `移動距離: ${Math.round(event.distance || 0)}m`;
      case 'REMINDER_CREATED':
        return `種類: ${getStoreTypeDisplay(event.store_type)}`;
      default:
        return '';
    }
  };

  const getStoreTypeDisplay = (storeType) => {
    switch (storeType) {
      case 'convenience':
        return 'コンビニ';
      case 'pharmacy':
        return '薬局';
      default:
        return '店舗';
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return 'たった今';
    } else if (diffMins < 60) {
      return `${diffMins}分前`;
    } else if (diffHours < 24) {
      return `${diffHours}時間前`;
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const renderEventItem = ({ item: event }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={styles.eventIconContainer}>
          <Text style={styles.eventIcon}>{getEventIcon(event.event_type)}</Text>
        </View>
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle}>{getEventTitle(event)}</Text>
          <Text style={styles.eventDescription}>{getEventDescription(event)}</Text>
          <Text style={styles.eventTime}>{formatTime(event.triggered_at)}</Text>
        </View>
      </View>
      
      {event.event_type === 'GEOFENCE_ENTER' && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>
            📍 {event.user_latitude?.toFixed(6)}, {event.user_longitude?.toFixed(6)}
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📅</Text>
      <Text style={styles.emptyTitle}>タイムラインが空です</Text>
      <Text style={styles.emptyText}>
        リマインダーを作成して店舗に近づくと、行動履歴がここに表示されます
      </Text>
      <TouchableOpacity
        style={styles.createReminderButton}
        onPress={() => navigation.navigate('ReminderForm')}
      >
        <Text style={styles.createReminderButtonText}>リマインダーを作成</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>タイムライン読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>📊 今日の行動</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalEvents}</Text>
            <Text style={styles.statLabel}>総イベント</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.triggerEvents}</Text>
            <Text style={styles.statLabel}>リマインダー</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.visitedStores}</Text>
            <Text style={styles.statLabel}>訪問店舗</Text>
          </View>
        </View>
      </View>

      {/* Timeline */}
      <FlatList
        data={events}
        renderItem={renderEventItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreEvents}
        onEndReachedThreshold={0.3}
        style={styles.timeline}
        showsVerticalScrollIndicator={false}
      />

      {/* Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ReminderForm')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  timeline: {
    flex: 1,
  },
  eventCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 5,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventIcon: {
    fontSize: 20,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 6,
  },
  eventTime: {
    fontSize: 12,
    color: '#999',
  },
  locationInfo: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  locationText: {
    fontSize: 12,
    color: '#007AFF',
    fontFamily: 'monospace',
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
  createReminderButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  createReminderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default TimelineScreen;