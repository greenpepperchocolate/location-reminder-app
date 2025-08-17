import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// WebBrowserの完了動作を設定
WebBrowser.maybeCompleteAuthSession();

class GoogleAuthService {
  constructor() {
    this.API_BASE_URL = "http://192.168.3.4:8000/api";
    
    // Google OAuth設定
    this.googleConfig = {
      // iOS用クライアントID
      iosClientId: process.env.GOOGLE_IOS_CLIENT_ID || 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
      // Android用クライアントID  
      androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
      // Web用クライアントID（Expo Go使用時）
      webClientId: process.env.GOOGLE_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
      // スコープ
      scopes: ['profile', 'email'],
      // Expo Go用のリダイレクトURI
      redirectUri: AuthSession.makeRedirectUri({
        scheme: Constants.manifest?.scheme || 'com.yourcompany.locationreminder',
        useProxy: true,
      }),
    };
  }

  /**
   * Google認証リクエストの設定を作成（Hookなので関数内で使用する必要があります）
   */
  getAuthConfig() {
    return {
      iosClientId: this.googleConfig.iosClientId,
      androidClientId: this.googleConfig.androidClientId,
      webClientId: this.googleConfig.webClientId,
      scopes: this.googleConfig.scopes,
      redirectUri: this.googleConfig.redirectUri,
    };
  }

  /**
   * Googleアクセストークンを使用してユーザー情報を取得
   */
  async getUserInfo(accessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('ユーザー情報の取得に失敗しました');
      }

      return await response.json();
    } catch (error) {
      console.error('Google ユーザー情報取得エラー:', error);
      throw error;
    }
  }

  /**
   * バックエンドでGoogle認証を処理
   */
  async authenticateWithBackend(googleUserInfo, accessToken) {
    try {
      console.log('バックエンドGoogle認証開始:', googleUserInfo.email);
      
      const response = await fetch(`${this.API_BASE_URL}/auth/google/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          email: googleUserInfo.email,
          first_name: googleUserInfo.given_name || '',
          last_name: googleUserInfo.family_name || '',
          google_id: googleUserInfo.id,
          picture: googleUserInfo.picture || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'バックエンド認証に失敗しました');
      }

      console.log('バックエンドGoogle認証成功:', data);
      return data;
    } catch (error) {
      console.error('バックエンドGoogle認証エラー:', error);
      throw error;
    }
  }

  /**
   * 完全なGoogle認証フロー
   */
  async signInWithGoogle(promptAsync) {
    try {
      console.log('Google認証開始...');
      
      // Google認証プロンプトを表示
      const result = await promptAsync();
      
      if (result.type === 'cancel') {
        throw new Error('認証がキャンセルされました');
      }
      
      if (result.type !== 'success') {
        throw new Error('認証に失敗しました');
      }

      const { access_token } = result.params;
      
      if (!access_token) {
        throw new Error('アクセストークンが取得できませんでした');
      }

      console.log('Googleアクセストークン取得成功');

      // Googleからユーザー情報を取得
      const googleUserInfo = await this.getUserInfo(access_token);
      console.log('Googleユーザー情報取得成功:', googleUserInfo.email);

      // バックエンドで認証処理
      const backendResponse = await this.authenticateWithBackend(googleUserInfo, access_token);

      // 認証トークンを保存
      if (backendResponse.token) {
        await AsyncStorage.setItem('authToken', backendResponse.token);
      }

      return {
        success: true,
        user: backendResponse.user,
        token: backendResponse.token,
        isNewUser: backendResponse.is_new_user || false,
      };

    } catch (error) {
      console.error('Google認証エラー:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Google認証設定の検証
   */
  validateConfig() {
    const errors = [];
    
    if (this.googleConfig.iosClientId.includes('YOUR_')) {
      errors.push('iOS Client IDが設定されていません');
    }
    
    if (this.googleConfig.androidClientId.includes('YOUR_')) {
      errors.push('Android Client IDが設定されていません');
    }
    
    if (this.googleConfig.webClientId.includes('YOUR_')) {
      errors.push('Web Client IDが設定されていません');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * 設定情報の表示（デバッグ用）
   */
  getConfigInfo() {
    return {
      redirectUri: this.googleConfig.redirectUri,
      scheme: Constants.manifest?.scheme,
      scopes: this.googleConfig.scopes,
    };
  }
}

// シングルトンインスタンス
const googleAuthService = new GoogleAuthService();

export default googleAuthService;