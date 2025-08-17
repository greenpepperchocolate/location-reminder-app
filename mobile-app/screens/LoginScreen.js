import React, { useState, useContext, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../App';
import GoogleAuthService from '../services/GoogleAuthService';
import * as Google from 'expo-auth-session/providers/google';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const { login } = useContext(AuthContext);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Google認証の設定
  const googleConfig = GoogleAuthService.getAuthConfig();
  const [request, response, promptAsync] = Google.useAuthRequest(googleConfig);

  // Google認証レスポンスの処理
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleAuthResponse();
    }
  }, [response]);

  const handleGoogleAuthResponse = async () => {
    try {
      setGoogleLoading(true);
      const result = await GoogleAuthService.signInWithGoogle(() => Promise.resolve(response));
      
      if (result.success) {
        Alert.alert('成功', 'Google認証でログインしました！');
      } else {
        Alert.alert('Google認証エラー', result.error || 'Google認証に失敗しました。');
      }
    } catch (error) {
      console.error('Google認証処理エラー:', error);
      Alert.alert('エラー', 'Google認証の処理中にエラーが発生しました。');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      // 設定の検証
      const configValidation = GoogleAuthService.validateConfig();
      if (!configValidation.isValid) {
        Alert.alert(
          'Google認証設定エラー',
          '開発者向け: Google認証の設定が不完全です。\n\n' + configValidation.errors.join('\n') + 
          '\n\nGoogle Cloud ConsoleでクライアントIDを設定してください。'
        );
        return;
      }
      
      const result = await GoogleAuthService.signInWithGoogle(promptAsync);
      
      if (result.success) {
        Alert.alert('成功', 'Google認証でログインしました！');
      } else {
        Alert.alert('Google認証エラー', result.error || 'Google認証に失敗しました。');
      }
    } catch (error) {
      console.error('Google認証エラー:', error);
      Alert.alert('エラー', 'Google認証中にエラーが発生しました。');
    } finally {
      setGoogleLoading(false);
    }
  };

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
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#000000']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.appIcon}>📍</Text>
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>位置リマインダーアプリにサインイン</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>メールアドレス</Text>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor="#6b7280"
                value={loginForm.email}
                onChangeText={(text) => setLoginForm({...loginForm, email: text})}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>パスワード</Text>
              <TextInput
                style={styles.input}
                placeholder="パスワードを入力"
                placeholderTextColor="#6b7280"
                value={loginForm.password}
                onChangeText={(text) => setLoginForm({...loginForm, password: text})}
                secureTextEntry
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity 
              style={[styles.loginButton, loading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'ログイン中...' : 'ログイン'}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>または</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity 
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]} 
              onPress={handleGoogleSignIn}
              disabled={googleLoading || !request}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>
                {googleLoading ? '認証中...' : 'Googleでログイン'}
              </Text>
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>アカウントをお持ちでない方は</Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.registerLink}>新規登録</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  appIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(34, 197, 94, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#10b981',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    shadowColor: '#22c55e',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  loginButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#22c55e',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    backgroundColor: '#374151',
    shadowOpacity: 0,
    elevation: 0,
    borderColor: '#4b5563',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
  },
  googleButton: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    shadowColor: '#22c55e',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
    marginRight: 12,
    backgroundColor: '#2d2d2d',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  googleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  registerText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  registerLink: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default LoginScreen;