import React, { useState, useContext } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../App';

const { width, height } = Dimensions.get('window');

const RegisterScreen = ({ navigation }) => {
  const { API_BASE_URL } = useContext(AuthContext);
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!registerForm.email || !registerForm.password || !registerForm.firstName || !registerForm.lastName) {
      Alert.alert('エラー', '全ての項目を入力してください。');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      Alert.alert('エラー', 'パスワードが一致しません。');
      return;
    }

    if (registerForm.password.length < 8) {
      Alert.alert('エラー', 'パスワードは8文字以上で入力してください。');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: registerForm.email.split('@')[0], // メールアドレスからユーザー名を生成
          email: registerForm.email,
          password: registerForm.password,
          password_confirm: registerForm.confirmPassword,
          first_name: registerForm.firstName,
          last_name: registerForm.lastName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          '登録完了',
          'アカウント登録が完了しました。メールアドレスに送信された認証リンクをクリックしてアカウントを有効化してください。',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('EmailVerification', { email: registerForm.email })
            }
          ]
        );
      } else {
        let errorMessage = 'アカウント登録に失敗しました。';
        
        if (data.email) {
          errorMessage = 'このメールアドレスは既に使用されています。';
        } else if (data.password) {
          errorMessage = `パスワードエラー: ${data.password.join(' ')}`;
        } else if (data.error) {
          errorMessage = data.error;
        }
        
        Alert.alert('登録エラー', errorMessage);
      }
    } catch (error) {
      console.error('登録エラー:', error);
      Alert.alert(
        'ネットワークエラー',
        'サーバーに接続できませんでした。インターネット接続を確認してください。'
      );
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
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.appIcon}>📝</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>新しいアカウントを作成</Text>
          </View>

          {/* Register Form */}
          <View style={styles.formContainer}>
            <View style={styles.nameRow}>
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.inputLabel}>名前</Text>
                <TextInput
                  style={styles.input}
                  placeholder="太郎"
                  placeholderTextColor="#6b7280"
                  value={registerForm.firstName}
                  onChangeText={(text) => setRegisterForm({...registerForm, firstName: text})}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
              
              <View style={[styles.inputContainer, styles.halfWidth]}>
                <Text style={styles.inputLabel}>姓</Text>
                <TextInput
                  style={styles.input}
                  placeholder="田中"
                  placeholderTextColor="#6b7280"
                  value={registerForm.lastName}
                  onChangeText={(text) => setRegisterForm({...registerForm, lastName: text})}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>メールアドレス</Text>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor="#A0A0A0"
                value={registerForm.email}
                onChangeText={(text) => setRegisterForm({...registerForm, email: text})}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>パスワード</Text>
              <TextInput
                style={styles.input}
                placeholder="8文字以上のパスワード"
                placeholderTextColor="#A0A0A0"
                value={registerForm.password}
                onChangeText={(text) => setRegisterForm({...registerForm, password: text})}
                secureTextEntry
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>パスワード確認</Text>
              <TextInput
                style={styles.input}
                placeholder="パスワードを再入力"
                placeholderTextColor="#A0A0A0"
                value={registerForm.confirmPassword}
                onChangeText={(text) => setRegisterForm({...registerForm, confirmPassword: text})}
                secureTextEntry
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity 
              style={[styles.registerButton, loading && styles.buttonDisabled]} 
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? '登録中...' : 'アカウント登録'}
              </Text>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>既にアカウントをお持ちの方は</Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginLink}>ログイン</Text>
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
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
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
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputContainer: {
    marginBottom: 20,
  },
  halfWidth: {
    width: '48%',
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
  registerButton: {
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
  registerButtonText: {
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  loginLink: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default RegisterScreen;