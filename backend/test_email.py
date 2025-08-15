#!/usr/bin/env python
import os
import django
from django.conf import settings

# Django設定を読み込み
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'location_reminder.settings')
django.setup()

from django.core.mail import send_mail
from django.core import mail

def test_email_settings():
    """メール設定をテスト"""
    print("=== メール設定確認 ===")
    print(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
    print(f"EMAIL_HOST: {settings.EMAIL_HOST}")
    print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
    print(f"EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
    print(f"EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
    print(f"EMAIL_HOST_PASSWORD: {'*' * len(settings.EMAIL_HOST_PASSWORD) if settings.EMAIL_HOST_PASSWORD else 'NOT SET'}")
    print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
    print()

def test_email_send():
    """実際にメール送信をテスト"""
    print("=== メール送信テスト ===")
    try:
        result = send_mail(
            subject='Django メール送信テスト',
            message='これはDjangoからのテストメールです。',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.EMAIL_HOST_USER],  # 自分宛に送信
            fail_silently=False,
        )
        print(f"送信結果: {result}")
        print("メール送信成功！")
        return True
    except Exception as e:
        print(f"メール送信エラー: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    test_email_settings()
    test_email_send()