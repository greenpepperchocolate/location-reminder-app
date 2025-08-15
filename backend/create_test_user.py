#!/usr/bin/env python
# create_test_user.py - テスト用ユーザーの作成

import os
import django

# Django設定の初期化
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'location_reminder.settings')
django.setup()

from accounts.models import User

def create_test_user():
    email = "testuser@example.com"
    password = "testpassword123"
    username = "testuser"
    
    # 既存ユーザーをチェック
    if User.objects.filter(email=email).exists():
        user = User.objects.get(email=email)
        print(f"既存のユーザー: {email}")
    else:
        # 新しいユーザーを作成
        user = User.objects.create_user(
            email=email,
            password=password,
            username=username
        )
        print(f"新しいユーザーを作成: {email}")
    
    # メール認証済みにする
    user.is_email_verified = True
    user.save()
    
    print(f"ユーザー情報:")
    print(f"  Email: {user.email}")
    print(f"  Username: {user.username}")
    print(f"  認証済み: {user.is_email_verified}")
    print(f"  パスワード: {password}")
    
    return user

if __name__ == '__main__':
    create_test_user()