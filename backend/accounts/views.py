# accounts/views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import login
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .serializers import UserRegistrationSerializer, UserLoginSerializer, UserSerializer
from .models import User
from .utils import send_verification_email, send_welcome_email, send_password_reset_email
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
# from .icloud_service import icloud_service  # 削除: pyicloud依存を削除

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    print(f"=== 新規登録リクエスト開始 ===")
    print(f"リクエストデータ: {request.data}")
    
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        print("シリアライザー検証成功")
        user = serializer.save()
        print(f"ユーザー作成完了: {user.email}, トークン: {user.email_verification_token}")
        
        # 認証メールを送信
        print("認証メール送信開始...")
        mail_sent = send_verification_email(user, request)
        print(f"メール送信結果: {mail_sent}")
        
        if mail_sent:
            return Response({
                'message': 'アカウントが作成されました。メールに送信された認証リンクをクリックして、メールアドレスを認証してください。',
                'email': user.email,
                'requires_verification': True
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'message': 'アカウントは作成されましたが、認証メールの送信に失敗しました。',
                'email': user.email,
                'requires_verification': True
            }, status=status.HTTP_201_CREATED)
    else:
        print(f"シリアライザー検証失敗: {serializer.errors}")
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = UserLoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        
        # メール認証チェック
        if not user.is_email_verified:
            return Response({
                'error': 'メールアドレスが認証されていません。メールをご確認いただき、認証リンクをクリックしてください。',
                'requires_verification': True,
                'email': user.email
            }, status=status.HTTP_400_BAD_REQUEST)
        
        login(request, user)
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def profile(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email(request, token):
    """メール認証を実行"""
    try:
        user = get_object_or_404(User, email_verification_token=token)
        
        if user.is_email_verified:
            return Response({
                'message': 'このメールアドレスは既に認証済みです。',
                'already_verified': True
            })
        
        if user.is_verification_token_expired():
            return Response({
                'error': '認証トークンの有効期限が切れています。新しい認証メールを送信してください。',
                'expired': True
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # メール認証を完了
        user.is_email_verified = True
        user.save()
        
        # ウェルカムメールを送信
        send_welcome_email(user)
        
        return Response({
            'message': 'メールアドレスの認証が完了しました。ログインしてアプリをご利用ください。',
            'verified': True
        })
        
    except User.DoesNotExist:
        return Response({
            'error': '無効な認証トークンです。'
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def resend_verification_email(request):
    """認証メールを再送信"""
    email = request.data.get('email')
    
    if not email:
        return Response({
            'error': 'メールアドレスが必要です。'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(email=email)
        
        if user.is_email_verified:
            return Response({
                'message': 'このメールアドレスは既に認証済みです。'
            })
        
        # 新しいトークンを生成してメール送信
        user.generate_new_verification_token()
        
        if send_verification_email(user, request):
            return Response({
                'message': '認証メールを再送信しました。メールをご確認ください。'
            })
        else:
            return Response({
                'error': 'メール送信に失敗しました。しばらく後でお試しください。'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except User.DoesNotExist:
        return Response({
            'error': '指定されたメールアドレスのユーザーが見つかりません。'
        }, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """パスワードリセットメールを送信"""
    email = request.data.get('email')
    
    if not email:
        return Response({
            'error': 'メールアドレスが必要です。'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = User.objects.get(email=email)
        
        # メール認証済みユーザーのみパスワードリセット可能
        if not user.is_email_verified:
            return Response({
                'error': 'メールアドレスが認証されていません。まずメール認証を完了してください。',
                'requires_verification': True
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # パスワードリセットトークンを生成
        user.generate_password_reset_token()
        
        if send_password_reset_email(user, request):
            return Response({
                'message': 'パスワードリセット用のメールを送信しました。メールをご確認ください。'
            })
        else:
            return Response({
                'error': 'メール送信に失敗しました。しばらく後でお試しください。'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except User.DoesNotExist:
        # セキュリティ上、ユーザーが存在しない場合でも同じメッセージを返す
        return Response({
            'message': 'パスワードリセット用のメールを送信しました。メールをご確認ください。'
        })

@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request, token):
    """パスワードリセットを実行"""
    new_password = request.data.get('password')
    confirm_password = request.data.get('confirm_password')
    
    if not new_password or not confirm_password:
        return Response({
            'error': 'パスワードと確認用パスワードが必要です。'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    if new_password != confirm_password:
        return Response({
            'error': 'パスワードが一致しません。'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        user = get_object_or_404(User, password_reset_token=token)
        
        if user.is_password_reset_token_expired():
            return Response({
                'error': 'パスワードリセットトークンの有効期限が切れています。新しいリセットメールを送信してください。',
                'expired': True
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # パスワードのバリデーション
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response({
                'error': list(e.messages)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # パスワードを更新
        user.set_password(new_password)
        user.password_reset_token = None
        user.password_reset_sent_at = None
        # パスワードリセットを実行できたということは、メールアドレスは認証済み
        user.is_email_verified = True
        user.save()
        
        return Response({
            'message': 'パスワードが正常に変更されました。新しいパスワードでログインしてください。',
            'success': True
        })
        
    except User.DoesNotExist:
        return Response({
            'error': '無効なパスワードリセットトークンです。'
        }, status=status.HTTP_400_BAD_REQUEST)

# iCloud関連のAPI削除 - React Nativeで位置情報を直接取得

# 削除: verify_2fa_code - iCloud関連機能削除

# すべてのiCloud関連API削除 - React Nativeアプリで位置情報を直接取得

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_location(request):
    """React Nativeアプリから位置情報を更新"""
    user = request.user
    latitude = request.data.get('latitude')
    longitude = request.data.get('longitude')
    accuracy = request.data.get('accuracy')
    
    if not latitude or not longitude:
        return Response({
            'error': '緯度と経度が必要です。'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # 位置情報を更新
    user.last_known_latitude = latitude
    user.last_known_longitude = longitude
    user.last_location_update = timezone.now()
    user.save()
    
    return Response({
        'message': '位置情報が更新されました。',
        'location': {
            'latitude': latitude,
            'longitude': longitude,
            'accuracy': accuracy,
            'timestamp': user.last_location_update
        }
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_location(request):
    """現在の位置情報を取得"""
    user = request.user
    
    if not user.last_known_latitude or not user.last_known_longitude:
        return Response({
            'error': '位置情報が設定されていません。'
        }, status=status.HTTP_404_NOT_FOUND)
    
    return Response({
        'location': {
            'latitude': float(user.last_known_latitude),
            'longitude': float(user.last_known_longitude),
            'timestamp': user.last_location_update
        }
    })

# React Native接続テスト用エンドポイント
@api_view(['GET'])
@permission_classes([AllowAny])
def api_test(request):
    """React Native接続テスト"""
    return Response({
        'success': True,
        'message': 'Django API サーバーは正常に動作しています',
        'timestamp': timezone.now()
    })
