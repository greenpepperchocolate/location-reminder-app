import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { AuthContext } from '../App';

const LoginScreen = () => {
  const { login } = useContext(AuthContext);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください。');
      return;
    }

    try {
      setLoading(true);
      await login(loginForm.email, loginForm.password);
      Alert.alert('成功', 'ログインしました！');
    } catch (error) {
      console.error('ログインエラー詳細:', error);
      
      let errorMessage = 'ログインに失敗しました。';
      
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        errorMessage = 'ネットワーク接続エラー。サーバーが起動していることを確認してください。';
      } else if (error.response?.status === 400) {
        errorMessage = `リクエストエラー\n詳細: ${JSON.stringify(error.response.data)}`;
      } else if (error.response?.status === 401) {
        errorMessage = 'メールアドレスまたはパスワードが正しくありません。';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('ログインエラー', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>📍 位置リマインダー</Text>
      
      <View style={styles.loginForm}>
        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          value={loginForm.email}
          onChangeText={(text) => setLoginForm({...loginForm, email: text})}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="パスワード"
          value={loginForm.password}
          onChangeText={(text) => setLoginForm({...loginForm, password: text})}
          secureTextEntry
        />
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 50,
    marginTop: 50,
    color: '#333',
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
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen;