# accounts/icloud_service.py
from pyicloud_ipd import PyiCloudService
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import Fernet
import base64
import json
import logging

logger = logging.getLogger(__name__)

class iCloudLocationService:
    def __init__(self):
        self.cipher_suite = None
        self._init_encryption()
    
    def _init_encryption(self):
        """暗号化キーを初期化"""
        # 本番環境では環境変数から取得
        key = getattr(settings, 'ICLOUD_ENCRYPTION_KEY', None)
        if not key:
            # 開発環境用のキー生成（本番では環境変数を使用）
            key = Fernet.generate_key()
            print(f"開発用暗号化キー: {key.decode()}")
        
        if isinstance(key, str):
            key = key.encode()
        
        self.cipher_suite = Fernet(key)
    
    def encrypt_password(self, password):
        """パスワードを暗号化"""
        if not password:
            return ""
        
        encrypted_password = self.cipher_suite.encrypt(password.encode())
        return base64.b64encode(encrypted_password).decode()
    
    def decrypt_password(self, encrypted_password):
        """パスワードを復号化"""
        if not encrypted_password:
            return ""
        
        try:
            encrypted_data = base64.b64decode(encrypted_password.encode())
            decrypted_password = self.cipher_suite.decrypt(encrypted_data)
            return decrypted_password.decode()
        except Exception as e:
            logger.error(f"パスワード復号化エラー: {e}")
            return ""
    
    def test_icloud_connection(self, apple_id, password):
        """iCloud接続をテスト"""
        try:
            api = PyiCloudService(apple_id, password)
            
            # 2FAが必要かチェック
            if api.requires_2fa:
                return {
                    'success': False,
                    'requires_2fa': True,
                    'message': '2段階認証が必要です',
                    'trusted_devices': api.trusted_devices
                }
            
            # デバイスリストを取得
            devices = []
            for device in api.devices:
                device_info = {
                    'name': device.get('name', 'Unknown'),
                    'model': device.get('deviceDisplayName', 'Unknown'),
                    'id': device.get('id'),
                    'location_enabled': device.location_enabled if hasattr(device, 'location_enabled') else False
                }
                devices.append(device_info)
            
            return {
                'success': True,
                'requires_2fa': False,
                'devices': devices,
                'message': '接続成功'
            }
            
        except Exception as e:
            error_str = str(e)
            logger.error(f"iCloud接続テストエラー: {e}")
            
            # エラーメッセージを詳細化
            if 'Invalid email/password combination' in error_str:
                return {
                    'success': False,
                    'requires_2fa': False,
                    'message': 'Apple IDまたはパスワードが間違っています。通常のApple IDパスワードではなく、App固有パスワードが必要です。Apple IDサイト（appleid.apple.com）で「App固有パスワード」を生成してください。'
                }
            elif 'PyiCloudAPIResponseError' in error_str:
                return {
                    'success': False,
                    'requires_2fa': False,
                    'message': 'iCloudサービスへの接続に失敗しました。Apple IDで2段階認証が有効になっていることと、App固有パスワードを使用していることを確認してください。'
                }
            else:
                return {
                    'success': False,
                    'requires_2fa': False,
                    'message': f'接続エラー: {error_str}'
                }
    
    def verify_2fa_code(self, apple_id, password, code):
        """2FA認証コードを検証"""
        try:
            api = PyiCloudService(apple_id, password)
            
            if api.requires_2fa:
                # 2FAコードを送信
                result = api.validate_2fa_code(code)
                
                if result:
                    return {
                        'success': True,
                        'message': '2段階認証成功'
                    }
                else:
                    return {
                        'success': False,
                        'message': '認証コードが無効です'
                    }
            else:
                return {
                    'success': True,
                    'message': '2段階認証は不要です'
                }
                
        except Exception as e:
            logger.error(f"2FA認証エラー: {e}")
            return {
                'success': False,
                'message': f'認証エラー: {str(e)}'
            }
    
    def get_device_location(self, user):
        """ユーザーのデバイス位置情報を取得"""
        if not user.icloud_email or not user.icloud_password_encrypted:
            return {
                'success': False,
                'message': 'iCloud設定が未完了です'
            }
        
        try:
            # パスワードを復号化
            password = self.decrypt_password(user.icloud_password_encrypted)
            if not password:
                return {
                    'success': False,
                    'message': 'パスワードの復号化に失敗しました'
                }
            
            # iCloudに接続
            api = pyicloud.PyiCloudService(user.icloud_email, password)
            
            if api.requires_2fa:
                return {
                    'success': False,
                    'requires_2fa': True,
                    'message': '2段階認証が必要です'
                }
            
            # 指定されたデバイスを検索
            target_device = None
            for device in api.devices:
                if device.get('name') == user.icloud_device_name:
                    target_device = device
                    break
            
            if not target_device:
                return {
                    'success': False,
                    'message': f'デバイス "{user.icloud_device_name}" が見つかりません'
                }
            
            # 位置情報を取得
            location = target_device.location()
            
            if location:
                # ユーザーの位置情報を更新
                user.last_known_latitude = location['latitude']
                user.last_known_longitude = location['longitude']
                user.last_location_update = timezone.now()
                user.save(update_fields=['last_known_latitude', 'last_known_longitude', 'last_location_update'])
                
                return {
                    'success': True,
                    'location': {
                        'latitude': location['latitude'],
                        'longitude': location['longitude'],
                        'accuracy': location.get('horizontalAccuracy', 0),
                        'timestamp': location.get('timeStamp', timezone.now().isoformat())
                    },
                    'message': '位置情報取得成功'
                }
            else:
                return {
                    'success': False,
                    'message': 'デバイスの位置情報が取得できませんでした'
                }
                
        except Exception as e:
            logger.error(f"位置情報取得エラー: {e}")
            return {
                'success': False,
                'message': f'位置情報取得エラー: {str(e)}'
            }
    
    def get_available_devices(self, apple_id, password):
        """利用可能なデバイスリストを取得"""
        try:
            api = PyiCloudService(apple_id, password)
            
            devices = []
            for device in api.devices:
                device_info = {
                    'name': device.get('name', 'Unknown'),
                    'model': device.get('deviceDisplayName', 'Unknown'),
                    'id': device.get('id'),
                    'location_enabled': hasattr(device, 'location') and device.location() is not None,
                    'battery_level': device.get('batteryLevel', 0) if hasattr(device, 'batteryLevel') else 0,
                    'is_online': device.get('isOnline', False) if hasattr(device, 'isOnline') else False
                }
                devices.append(device_info)
            
            return {
                'success': True,
                'devices': devices
            }
            
        except Exception as e:
            logger.error(f"デバイスリスト取得エラー: {e}")
            return {
                'success': False,
                'message': f'デバイスリスト取得エラー: {str(e)}'
            }

# グローバルインスタンス
icloud_service = iCloudLocationService()