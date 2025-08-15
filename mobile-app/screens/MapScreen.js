import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import axios from 'axios';
import { AuthContext } from '../App';

const { width, height } = Dimensions.get('window');

const MapScreen = ({ navigation }) => {
  const { location, updateLocation, logout } = useContext(AuthContext);
  const [stores, setStores] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [region, setRegion] = useState(null);

  useEffect(() => {
    console.log('=== MapScreen useEffect triggered ===');
    console.log('location:', location);
    if (location) {
      console.log('位置情報が利用可能:', {
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy
      });
      setRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05, // 表示範囲を広げる (5km範囲をカバー)
        longitudeDelta: 0.05,
      });
      fetchNearbyStores();
      fetchReminders();
    } else {
      console.log('⚠️ 位置情報がありません');
    }
  }, [location]);

  // 店舗データが更新されたときにマップ範囲を調整
  useEffect(() => {
    if (stores.length > 0 && location) {
      console.log('=== 店舗データに基づくマップ範囲調整 ===');
      const lats = [location.latitude, ...stores.map(s => parseFloat(s.latitude))];
      const lngs = [location.longitude, ...stores.map(s => parseFloat(s.longitude))];
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      const padding = 0.008; // パディング
      
      const newRegion = {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(0.02, (maxLat - minLat) + padding),
        longitudeDelta: Math.max(0.02, (maxLng - minLng) + padding),
      };
      
      console.log('新しいマップ範囲:', newRegion);
      setRegion(newRegion);
    }
  }, [stores, location]);

  const fetchNearbyStores = async () => {
    try {
      console.log('=== 店舗データ取得開始 ===');
      console.log('パラメータ:', {
        lat: location.latitude,
        lng: location.longitude,
        radius: Math.round(1.0 * 1000)
      });
      console.log('リクエストURL:', `${axios.defaults.baseURL}/stores/nearby/`);
      
      const response = await axios.get(`${axios.defaults.baseURL}/stores/nearby/`, {
        params: {
          lat: location.latitude,
          lng: location.longitude,
          radius: Math.round(5.0 * 1000) // 5km以内に拡大してテスト
        }
      });
      
      console.log('レスポンスステータス:', response.status);
      console.log('レスポンスデータ型:', typeof response.data);
      console.log('レスポンスデータ:', JSON.stringify(response.data, null, 2));
      
      const storesData = response.data || [];
      console.log('処理後の店舗データ:', storesData);
      console.log('店舗数:', storesData.length);
      
      if (storesData.length > 0) {
        console.log('最初の店舗データサンプル:', storesData[0]);
      } else {
        console.log('⚠️ 店舗データが空です');
      }
      
      setStores(storesData);
    } catch (error) {
      console.error('=== 近隣店舗取得エラー ===');
      console.error('エラー:', error.message);
      if (error.response) {
        console.error('レスポンスデータ:', error.response.data);
        console.error('ステータスコード:', error.response.status);
        console.error('レスポンスヘッダー:', error.response.headers);
      } else if (error.request) {
        console.error('リクエストエラー:', error.request);
      }
      setStores([]);
    }
  };

  const fetchReminders = async () => {
    try {
      console.log('=== Map リマインダー取得開始 ===');
      console.log('リクエストURL:', `${axios.defaults.baseURL}/reminders/`);
      
      const response = await axios.get(`${axios.defaults.baseURL}/reminders/`);
      
      console.log('Map レスポンスステータス:', response.status);
      console.log('Map レスポンスデータ型:', typeof response.data);
      
      // HTMLレスポンスの検出
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
        console.error('⚠️ Map リマインダー取得でHTMLレスポンスを受信');
        setReminders([]);
        return;
      }
      
      const remindersData = response.data.results || response.data || [];
      console.log('Map fetchReminders - remindersData type:', typeof remindersData);
      console.log('Map fetchReminders - remindersData isArray:', Array.isArray(remindersData));
      console.log('Map fetchReminders - remindersData:', remindersData);
      setReminders(remindersData);
    } catch (error) {
      console.error('=== Map リマインダー取得エラー ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Full error:', error);
      setReminders([]);
    }
  };

  const getStoreIcon = (storeType) => {
    switch (storeType) {
      case 'convenience': return '🏪';
      case 'pharmacy': return '💊';
      default: return '🏪';
    }
  };

  const getMarkerColor = (storeType) => {
    switch (storeType) {
      case 'convenience': return 'red';
      case 'pharmacy': return 'green';
      default: return 'blue';
    }
  };

  const onStorePress = (store) => {
    let activeReminders = [];
    try {
      if (Array.isArray(reminders)) {
        activeReminders = reminders.filter(r => 
          r.store_type === store.store_type && r.is_active
        );
      } else {
        console.error('reminders is not an array in onStorePress:', typeof reminders, reminders);
      }
    } catch (filterError) {
      console.error('Filter error in onStorePress:', filterError);
      console.error('reminders value:', reminders);
    }

    if (activeReminders.length > 0) {
      Alert.alert(
        `${getStoreIcon(store.store_type)} ${store.name}`,
        `この店舗で${activeReminders.length}個のアクティブなリマインダーがあります:\n\n` +
        activeReminders.map(r => `• ${r.title}`).join('\n'),
        [
          { text: 'OK' },
          { text: '新しいリマインダー', onPress: () => navigation.navigate('ReminderForm') }
        ]
      );
    } else {
      Alert.alert(
        `${getStoreIcon(store.store_type)} ${store.name}`,
        'この店舗にリマインダーを作成しますか？',
        [
          { text: 'キャンセル' },
          { text: 'リマインダー作成', onPress: () => navigation.navigate('ReminderForm') }
        ]
      );
    }
  };

  const refreshLocation = async () => {
    await updateLocation();
    Alert.alert('更新完了', '位置情報とマップが更新されました');
  };

  if (!region) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>マップを読み込み中...</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={refreshLocation}>
          <Text style={styles.refreshButtonText}>位置情報を更新</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* User Location Marker */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="現在の位置"
            description="あなたの現在位置"
            pinColor="blue"
          />
        )}

        {/* Store Markers */}
        {Array.isArray(stores) && stores.length > 0 ? (
          (() => {
            console.log('=== 全マーカーレンダリング開始 ===');
            console.log('総店舗数:', stores.length);
            console.log('店舗一覧:', stores.map(s => ({ id: s.id, name: s.name, lat: s.latitude, lng: s.longitude })));
            
            // 座標の重複をチェック
            const coordinateMap = new Map();
            stores.forEach((store, index) => {
              const lat = parseFloat(store.latitude);
              const lng = parseFloat(store.longitude);
              const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
              
              if (coordinateMap.has(coordKey)) {
                console.log(`⚠️ 座標重複検出: ${coordKey} - ${coordinateMap.get(coordKey)} と ${store.name}`);
              } else {
                coordinateMap.set(coordKey, store.name);
              }
            });
            
            const markers = stores.map((store, index) => {
              console.log(`=== マーカー ${index + 1}/${stores.length} レンダリング ===`);
              console.log('Store ID:', store.id);
              console.log('Store Name:', store.name);
              console.log('Store Type:', store.store_type);
              console.log('Original Latitude:', store.latitude, 'Parsed:', parseFloat(store.latitude));
              console.log('Original Longitude:', store.longitude, 'Parsed:', parseFloat(store.longitude));
              console.log('Distance:', store.distance);
              
              const lat = parseFloat(store.latitude);
              const lng = parseFloat(store.longitude);
              
              if (isNaN(lat) || isNaN(lng)) {
                console.error('⚠️ 無効な座標データ:', store);
                return null;
              }
              
              // より大きなオフセットを使用して完全に分離
              const offsetDistance = 0.001; // 約100mの距離
              const angle = (index * 45) % 360; // 45度ずつ回転
              const adjustedLat = lat + (offsetDistance * Math.cos(angle * Math.PI / 180));
              const adjustedLng = lng + (offsetDistance * Math.sin(angle * Math.PI / 180));
              
              console.log(`調整後座標: ${adjustedLat}, ${adjustedLng} (角度: ${angle}度)`);
              console.log(`マーカーkey: store-${store.id}`);
              
              const marker = (
                <Marker
                  key={`store-${store.id}-${index}`}
                  identifier={`store-${store.id}-${index}`}
                  coordinate={{
                    latitude: adjustedLat,
                    longitude: adjustedLng,
                  }}
                  title={`${getStoreIcon(store.store_type)} ${store.name} (${index + 1})`}
                  description={`${store.address} (${(store.distance * 1000).toFixed(0)}m)`}
                  pinColor={getMarkerColor(store.store_type)}
                  onPress={() => onStorePress(store)}
                  zIndex={1000 + index}
                  anchor={{ x: 0.5, y: 1 }}
                  centerOffset={{ x: 0, y: -30 }}
                />
              );
              
              console.log(`✅ マーカー ${index + 1} レンダリング完了:`, store.name);
              return marker;
            }).filter(marker => marker !== null);
            
            console.log('=== レンダリング結果 ===');
            console.log('レンダリングされたマーカー数:', markers.length);
            console.log('=== 全マーカーレンダリング終了 ===');
            
            return markers;
          })()
        ) : (
          console.log('⚠️ 店舗データなし または 配列でない:', stores)
        )}

        {/* Reminder Circles */}
        {(() => {
          try {
            return Array.isArray(reminders) && reminders
              .filter(reminder => reminder.is_active)
              .map(reminder => {
                return (
                  <Circle
                    key={`reminder-${reminder.id}`}
                    center={{
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }}
                    radius={reminder.trigger_distance}
                    strokeColor="rgba(0, 122, 255, 0.5)"
                    fillColor="rgba(0, 122, 255, 0.1)"
                    strokeWidth={2}
                  />
                );
              });
          } catch (renderError) {
            console.error('Render error for reminder circles:', renderError);
            return null;
          }
        })()}
      </MapView>

      {/* Map Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton} onPress={refreshLocation}>
          <Text style={styles.controlButtonText}>🔄 位置更新</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={() => navigation.navigate('ReminderForm')}
        >
          <Text style={styles.controlButtonText}>+ リマインダー</Text>
        </TouchableOpacity>
      </View>

     

      {/* Info Panel */}
      <View style={styles.infoPanel}>
        <Text style={styles.infoPanelTitle}>📊 マップ情報</Text>
        <Text style={styles.infoPanelText}>
          店舗データ: {Array.isArray(stores) ? stores.length : 0}件
        </Text>
        <Text style={styles.infoPanelText}>
          アクティブリマインダー: {(() => {
            try {
              return Array.isArray(reminders) ? reminders.filter(r => r.is_active).length : 0;
            } catch (error) {
              console.error('Error counting active reminders:', error);
              return 0;
            }
          })()}件
        </Text>
        <Text style={styles.infoPanelText}>
          検索範囲: 5km以内
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: width,
    height: height - 100, // Account for header
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlsContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 10,
  },
  controlButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 5,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  legendContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#333',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 150,
  },
  infoPanelTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  infoPanelText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});

export default MapScreen;