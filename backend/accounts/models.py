# accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid
from django.utils import timezone
from datetime import timedelta

class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=15, blank=True)
    is_premium = models.BooleanField(default=False)
    stripe_customer_id = models.CharField(max_length=255, blank=True)
    
    # メール認証用フィールド
    is_email_verified = models.BooleanField(default=False)
    email_verification_token = models.UUIDField(null=True, blank=True, unique=True)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)
    
    # パスワードリセット用フィールド
    password_reset_token = models.UUIDField(null=True, blank=True, unique=True)
    password_reset_sent_at = models.DateTimeField(null=True, blank=True)
    
    # Google認証関連フィールド
    google_id = models.CharField(max_length=255, blank=True, null=True, unique=True, help_text="GoogleアカウントのユニークID")
    google_picture = models.URLField(blank=True, null=True, help_text="Googleプロフィール画像URL")
    is_google_user = models.BooleanField(default=False, help_text="Google認証で作成されたアカウント")
    
    # iCloud位置情報設定
    icloud_email = models.EmailField(blank=True, null=True, help_text="iCloud位置情報取得用のApple ID")
    icloud_password_encrypted = models.TextField(blank=True, help_text="暗号化されたiCloudパスワード")
    icloud_device_name = models.CharField(max_length=100, blank=True, help_text="追跡するデバイス名")
    location_tracking_enabled = models.BooleanField(default=False, help_text="位置情報追跡を有効にする")
    last_known_latitude = models.DecimalField(max_digits=22, decimal_places=16, null=True, blank=True)
    last_known_longitude = models.DecimalField(max_digits=22, decimal_places=16, null=True, blank=True)
    last_location_update = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    def is_verification_token_expired(self):
        """認証トークンが期限切れかチェック（24時間）"""
        if not self.email_verification_sent_at:
            return True
        return timezone.now() > self.email_verification_sent_at + timedelta(hours=24)
    
    def generate_new_verification_token(self):
        """新しい認証トークンを生成"""
        self.email_verification_token = uuid.uuid4()
        self.email_verification_sent_at = timezone.now()
        self.save(update_fields=['email_verification_token', 'email_verification_sent_at'])
        print(f"認証トークン生成: ユーザー {self.email}, トークン: {self.email_verification_token}")
        return self.email_verification_token
    
    def is_password_reset_token_expired(self):
        """パスワードリセットトークンが期限切れかチェック（1時間）"""
        if not self.password_reset_sent_at:
            return True
        return timezone.now() > self.password_reset_sent_at + timedelta(hours=1)
    
    def generate_password_reset_token(self):
        """パスワードリセットトークンを生成"""
        self.password_reset_token = uuid.uuid4()
        self.password_reset_sent_at = timezone.now()
        self.save()