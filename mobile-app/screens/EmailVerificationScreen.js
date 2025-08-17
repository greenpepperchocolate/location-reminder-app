import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../App';

const EmailVerificationScreen = ({ navigation, route }) => {
  const { API_BASE_URL } = useContext(AuthContext);
  const { email } = route.params;
  const [loading, setLoading] = useState(false);

  const resendVerificationEmail = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          '送信完了',
          '認証メールを再送信しました。メールボックスを確認してください。'
        );
      } else {
        Alert.alert(
          'エラー',
          data.error || '認証メールの再送信に失敗しました。'
        );
      }
    } catch (error) {
      console.error('認証メール再送信エラー:', error);
      Alert.alert(
        'ネットワークエラー',
        'サーバーに接続できませんでした。インターネット接続を確認してください。'
      );
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    navigation.navigate('Login');
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
              <Text style={styles.appIcon}>📧</Text>
            </View>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>メールアドレスを認証してください</Text>
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <View style={styles.successBadge}>
              <Text style={styles.successText}>✓</Text>
            </View>
            
            <Text style={styles.congratsText}>
              アカウント登録が完了しました！
            </Text>
            
            <View style={styles.emailContainer}>
              <Text style={styles.emailLabel}>送信先</Text>
              <Text style={styles.email}>{email}</Text>
            </View>
            
            <Text style={styles.instruction}>
              上記のメールアドレスに認証リンクを送信しました。
              メールボックスを確認して、認証リンクをクリックしてアカウントを有効化してください。
            </Text>
            
            <View style={styles.noteContainer}>
              <Text style={styles.note}>
                💡 迷惑メールフォルダもご確認ください
              </Text>
            </View>
            
            <TouchableOpacity 
              style={[styles.resendButton, loading && styles.buttonDisabled]} 
              onPress={resendVerificationEmail}
              disabled={loading}
            >
              <Text style={styles.resendButtonText}>
                {loading ? '送信中...' : '認証メールを再送信'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.backButton}
              onPress={goToLogin}
            >
              <Text style={styles.backButtonText}>ログイン画面に戻る</Text>
            </TouchableOpacity>
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
  contentContainer: {
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
    alignItems: 'center',
  },
  successBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  successText: {
    fontSize: 30,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  congratsText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 20,
    textAlign: 'center',
  },
  emailContainer: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  emailLabel: {
    fontSize: 12,
    color: '#10b981',
    marginBottom: 4,
    fontWeight: '500',
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
  },
  instruction: {
    fontSize: 16,
    lineHeight: 24,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 20,
  },
  noteContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  note: {
    fontSize: 14,
    color: '#22c55e',
    textAlign: 'center',
  },
  resendButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
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
  resendButtonText: {
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
  backButton: {
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EmailVerificationScreen;