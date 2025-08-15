#!/usr/bin/env python
# update_user_password.py - ユーザーパスワードの更新

import os
import django

# Django設定の初期化
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'location_reminder.settings')
django.setup()

from accounts.models import User

def update_password():
    email = "greenpepperchocolate@yahoo.co.jp"
    new_password = "testpassword123"
    
    try:
        user = User.objects.get(email=email)
        user.set_password(new_password)
        user.is_email_verified = True  # 認証済みにする
        user.save()
        
        print(f"ユーザー {email} のパスワードを更新しました")
        print(f"新しいパスワード: {new_password}")
        print(f"メール認証状態: {user.is_email_verified}")
        
    except User.DoesNotExist:
        print(f"ユーザー {email} が見つかりません")

if __name__ == '__main__':
    update_password()