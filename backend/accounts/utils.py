# accounts/utils.py
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.urls import reverse
from django.utils import timezone

def send_verification_email(user, request):
    """メール認証用のメールを送信"""
    
    print(f"=== メール送信開始 ===")
    print(f"宛先: {user.email}")
    print(f"送信者: {settings.DEFAULT_FROM_EMAIL}")
    print(f"SMTP設定: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
    print(f"認証トークン: {user.email_verification_token}")
    
    # トークンが存在することを確認
    if not user.email_verification_token:
        print("エラー: 認証トークンが存在しません")
        return False
    
    # 認証URL（フロントエンド用）
    verification_url = f"{settings.FRONTEND_URL}/verify-email/{user.email_verification_token}/"
    print(f"認証URL: {verification_url}")
    
    # メールの内容
    subject = "【位置リマインダーアプリ】メールアドレスの認証"
    
    # HTMLメール用テンプレート（テキストでもOK）
    html_message = f"""
    <html>
    <body>
        <h2>メールアドレスの認証</h2>
        <p>こんにちは、{user.username}さん</p>
        <p>位置リマインダーアプリにご登録いただき、ありがとうございます。</p>
        <p>以下のリンクをクリックして、メールアドレスの認証を完了してください：</p>
        <p><a href="{verification_url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">メールアドレスを認証する</a></p>
        <p>または、以下のURLをブラウザにコピー＆ペーストしてください：</p>
        <p>{verification_url}</p>
        <p>このリンクは24時間で期限が切れます。</p>
        <p>もしこのメールに心当たりがない場合は、このメールを無視してください。</p>
        <br>
        <p>位置リマインダーアプリ運営チーム</p>
    </body>
    </html>
    """
    
    # プレーンテキスト版
    plain_message = f"""
メールアドレスの認証

こんにちは、{user.username}さん

位置リマインダーアプリにご登録いただき、ありがとうございます。

以下のリンクをクリックして、メールアドレスの認証を完了してください：
{verification_url}

このリンクは24時間で期限が切れます。

もしこのメールに心当たりがない場合は、このメールを無視してください。

位置リマインダーアプリ運営チーム
    """
    
    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        # 送信時刻を記録
        user.email_verification_sent_at = timezone.now()
        user.save()
        
        return True
    except Exception as e:
        print(f"メール送信エラー詳細: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def send_welcome_email(user):
    """認証完了後のウェルカムメール"""
    
    subject = "【位置リマインダーアプリ】登録完了のお知らせ"
    
    html_message = f"""
    <html>
    <body>
        <h2>登録完了</h2>
        <p>こんにちは、{user.username}さん</p>
        <p>メールアドレスの認証が完了しました！</p>
        <p>位置リマインダーアプリをお楽しみください。</p>
        <p><a href="{settings.FRONTEND_URL}/login">アプリにログインする</a></p>
        <br>
        <p>位置リマインダーアプリ運営チーム</p>
    </body>
    </html>
    """
    
    plain_message = f"""
登録完了

こんにちは、{user.username}さん

メールアドレスの認証が完了しました！

位置リマインダーアプリをお楽しみください。

{settings.FRONTEND_URL}/login からログインできます。

位置リマインダーアプリ運営チーム
    """
    
    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"ウェルカムメール送信エラー詳細: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def send_password_reset_email(user, request):
    """パスワードリセット用のメールを送信"""
    
    # パスワードリセットURL（フロントエンド用）
    reset_url = f"{settings.FRONTEND_URL}/reset-password/{user.password_reset_token}/"
    
    # メールの内容
    subject = "【位置リマインダーアプリ】パスワードリセットのご案内"
    
    # HTMLメール用テンプレート
    html_message = f"""
    <html>
    <body>
        <h2>パスワードリセット</h2>
        <p>こんにちは、{user.username}さん</p>
        <p>パスワードリセットのリクエストを受け付けました。</p>
        <p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
        <p><a href="{reset_url}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">パスワードをリセットする</a></p>
        <p>または、以下のURLをブラウザにコピー＆ペーストしてください：</p>
        <p>{reset_url}</p>
        <p><strong>このリンクは1時間で期限が切れます。</strong></p>
        <p>もしこのメールに心当たりがない場合は、このメールを無視してください。</p>
        <br>
        <p>位置リマインダーアプリ運営チーム</p>
    </body>
    </html>
    """
    
    # プレーンテキスト版
    plain_message = f"""
パスワードリセット

こんにちは、{user.username}さん

パスワードリセットのリクエストを受け付けました。

以下のリンクをクリックして、新しいパスワードを設定してください：
{reset_url}

このリンクは1時間で期限が切れます。

もしこのメールに心当たりがない場合は、このメールを無視してください。

位置リマインダーアプリ運営チーム
    """
    
    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        # 送信時刻を記録
        user.password_reset_sent_at = timezone.now()
        user.save()
        
        return True
    except Exception as e:
        print(f"パスワードリセットメール送信エラー詳細: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False