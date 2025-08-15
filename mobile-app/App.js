import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

// Import screens (we'll create these)
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import MapScreen from './screens/MapScreen';
import ReminderFormScreen from './screens/ReminderFormScreen';
import ReminderListScreen from './screens/ReminderListScreen';

const Stack = createStackNavigator();

const getApiUrl = () => {
  if (__DEV__) {
    // Expo開発時は自動でIPを検出
    const debuggerHost = Constants.manifest?.debuggerHost;
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      return `http://${ip}:8000/api`;
    }
    // フォールバック: localhost
    return 'http://localhost:8000/api';
  }
  return 'http://localhost:8000/api'; // デフォルトはlocalhost
};

// API URLを1つに固定
const API_URLS = [
  'http://192.168.3.4:8084/api', // 開発マシンのIP:8084
];

const API_BASE_URL = "http://192.168.3.4:8084/api";
// Django APIのベースURL（ローカルネットワーク用）
//const API_BASE_URL = 'http://127.0.0.1:8000/api';

// 開発用: サーバーが起動していない場合のモックモード
const MOCK_MODE = false; // trueにすると擬似的にログインできます

// Axiosの設定 - 強制的に新しいURLを設定
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.timeout = 10000; // 10秒タイムアウト
axios.defaults.headers.common['Content-Type'] = 'application/json';

// デバッグ用: 起動時のURL確認
console.log('=== 起動時URL設定確認 ===');
console.log('API_BASE_URL:', API_BASE_URL);
console.log('axios.defaults.baseURL:', axios.defaults.baseURL);

// Context for sharing auth state
const AuthContext = React.createContext();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  // デバッグ用ログ
  console.log('=== App.js State ===');
  console.log('isLoggedIn:', isLoggedIn);
  console.log('loading:', loading);
  console.log('initialRouteName will be:', isLoggedIn ? "Map" : "Login");

  useEffect(() => {
    initializeApp();
    setupAxiosInterceptors();
  }, []);

  // URL設定を監視・修正する（デバッグ用）
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (axios.defaults.baseURL !== API_BASE_URL) {
        console.log('⚠️ baseURLが変更されました。修正します');
        console.log('変更前:', axios.defaults.baseURL);
        console.log('修正後:', API_BASE_URL);
        axios.defaults.baseURL = API_BASE_URL;
      }
    }, 2000);
    
    const forceAPITest = async () => {
      console.log('=== 強制API接続テスト実行 ===');
      console.log('テスト前のbaseURL:', axios.defaults.baseURL);
      
      // baseURLを強制的に設定
      axios.defaults.baseURL = API_BASE_URL;
      console.log('強制設定後のbaseURL:', axios.defaults.baseURL);
      
      // 直接APIテスト
      try {
        const directTest = await axios.get(`${API_BASE_URL}/stores/nearby/?lat=35.6982&lng=139.7164&radius=1.0`);
        console.log('直接テスト成功:', typeof directTest.data, Array.isArray(directTest.data));
      } catch (error) {
        console.error('直接テストエラー:', error.message);
      }
      
      await testAPIConnection();
      console.log('最終的に設定されたbaseURL:', axios.defaults.baseURL);
    };
    
    // 5秒後に強制テストを実行
    const timer = setTimeout(forceAPITest, 5000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const setupAxiosInterceptors = () => {
    // レスポンスインターセプター：認証エラーをキャッチしてログアウト
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.log('認証エラーを検出、自動ログアウト');
          await logout();
        }
        return Promise.reject(error);
      }
    );
  };

  const initializeApp = async () => {
    // URL設定を強制的に確認・修正
    console.log('=== アプリ初期化 URL強制設定 ===');
    console.log('設定前 axios.defaults.baseURL:', axios.defaults.baseURL);
    axios.defaults.baseURL = API_BASE_URL;
    console.log('設定後 axios.defaults.baseURL:', axios.defaults.baseURL);
    console.log('API_BASE_URL定数:', API_BASE_URL);
    
    await testAPIConnection();
    await checkAuthStatus();
    await requestLocationPermission();
  };

  const testAPIConnection = async () => {
    console.log('=== API接続テスト開始 ===');
    console.log('使用URL:', API_BASE_URL);
    
    try {
      // 店舗データでテスト
      const testResponse = await axios.get('/stores/nearby/', {
        baseURL: API_BASE_URL,
        timeout: 5000,
        params: { lat: 35.6982, lng: 139.7164, radius: 1.0 }
      });
      
      console.log(`レスポンス status: ${testResponse.status}`);
      console.log(`レスポンス data type: ${typeof testResponse.data}`);
      
      if (Array.isArray(testResponse.data)) {
        console.log(`✅ Django API サーバー接続成功`);
        console.log(`店舗データ取得: ${testResponse.data.length}件`);
        axios.defaults.baseURL = API_BASE_URL;
        return;
      } else if (typeof testResponse.data === 'string' && testResponse.data.includes('<!DOCTYPE')) {
        console.error(`❌ HTMLレスポンス - 間違ったサーバーです`);
        axios.defaults.baseURL = API_BASE_URL; // デフォルトを使用
        return;
      }
      
    } catch (error) {
      console.error(`❌ API接続エラー:`, error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log(`✅ Django認証サーバー確認 (認証が必要)`);
      }
      axios.defaults.baseURL = API_BASE_URL; // デフォルトを使用
    }
  };

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Token ${token}`;
        const response = await axios.get('/auth/profile/');
        setUser(response.data);
        setIsLoggedIn(true);
        await startLocationTracking();
      }
    } catch (error) {
      console.error('認証チェックエラー:', error);
      await AsyncStorage.removeItem('authToken');
    } finally {
      setLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('位置情報許可が必要です', 'アプリの機能を使用するために位置情報へのアクセスを許可してください。');
        return;
      }

      const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus.status !== 'granted') {
        Alert.alert('バックグラウンド位置情報', 'より正確なリマインダーのためにバックグラウンドでの位置情報アクセスを許可することをお勧めします。');
      }
    } catch (error) {
      console.error('位置情報許可エラー:', error);
    }
  };

  const startLocationTracking = async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy,
      };

      setLocation(locationData);
      await axios.post('/auth/location/update/', locationData);
      console.log('位置情報更新:', locationData);
    } catch (error) {
      console.error('位置情報取得エラー:', error);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('ログイン試行:', { email, baseURL: axios.defaults.baseURL });
      console.log('完全URL:', `${axios.defaults.baseURL}/auth/login/`);
      
      const response = await axios.post('/auth/login/', { email, password });
      
      console.log('=== ログインレスポンス詳細 ===');
      console.log('Status:', response.status);
      console.log('Headers:', response.headers);
      console.log('Data:', JSON.stringify(response.data, null, 2));
      console.log('Data type:', typeof response.data);
      console.log('Data is object:', typeof response.data === 'object' && response.data !== null);
      
      // response.dataがオブジェクトかチェック
      if (typeof response.data === 'object' && response.data !== null) {
        console.log('Token exists:', 'token' in response.data);
        console.log('User exists:', 'user' in response.data);
      } else {
        console.log('Response.data is not a valid object');
      }
      
      // response.dataがオブジェクトでない場合はエラー
      if (typeof response.data !== 'object' || response.data === null) {
        console.error('無効なレスポンス形式:', response.data);
        throw new Error('サーバーから無効なレスポンスが返されました');
      }
      
      const { token, user } = response.data;
      
      console.log('Extracted token:', token);
      console.log('Extracted user:', user);
      
      if (!token) {
        console.error('トークンが見つかりません。レスポンス全体:', response.data);
        throw new Error('トークンがレスポンスに含まれていません');
      }
      
      await AsyncStorage.setItem('authToken', token);
      axios.defaults.headers.common['Authorization'] = `Token ${token}`;
      
      // 認証後にbaseURLを再確認・設定
      console.log('ログイン後のbaseURL確認:', axios.defaults.baseURL);
      if (axios.defaults.baseURL !== API_BASE_URL) {
        console.log('baseURLを修正:', API_BASE_URL);
        axios.defaults.baseURL = API_BASE_URL;
      }
      
      setUser(user);
      setIsLoggedIn(true);
      await startLocationTracking();
      
      return { success: true };
    } catch (error) {
      console.error('ログインエラー詳細:', error);
      if (error.response) {
        console.error('エラーレスポンス Status:', error.response.status);
        console.error('エラーレスポンス Data:', error.response.data);
      }
      throw error;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setIsLoggedIn(false);
    setLocation(null);
  };

  const updateLocation = async () => {
    await startLocationTracking();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      location, 
      isLoggedIn, 
      login, 
      logout,
      updateLocation,
      API_BASE_URL 
    }}>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName={isLoggedIn ? "Map" : "Login"}
          screenOptions={{
            headerStyle: { backgroundColor: '#007AFF' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' }
          }}
        >
          {!isLoggedIn ? (
            <Stack.Screen 
              name="Login" 
              component={LoginScreen} 
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen 
                name="Map" 
                component={MapScreen} 
                options={{ title: '🗺️ マップ' }}
              />
              <Stack.Screen 
                name="Dashboard" 
                component={DashboardScreen} 
                options={{ title: '📍 ダッシュボード' }}
              />
              <Stack.Screen 
                name="ReminderForm" 
                component={ReminderFormScreen} 
                options={{ title: '✨ 新しいリマインダー' }}
              />
              <Stack.Screen 
                name="ReminderList" 
                component={ReminderListScreen} 
                options={{ title: '📝 リマインダー一覧' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

export { AuthContext };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  welcome: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
  loginForm: {
    padding: 20,
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
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
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
    color: '#666',
  },
});