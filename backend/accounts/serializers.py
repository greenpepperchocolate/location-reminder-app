# accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm', 'phone_number')

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("パスワードが一致しません")
        return attrs

    def create(self, validated_data):
        password_confirm = validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        # create_userメソッドを使ってユーザーを作成
        user = User.objects.create_user(
            username=validated_data.get('username'),
            email=validated_data.get('email'),
            password=password
        )
        
        # その他のフィールドを個別に設定
        if 'phone_number' in validated_data:
            user.phone_number = validated_data['phone_number']
        
        # メール認証トークンを確実に生成
        user.generate_new_verification_token()
        
        return user

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError('認証情報が正しくありません')
            if not user.is_active:
                raise serializers.ValidationError('ユーザーアカウントが無効です')
            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError('メールアドレスとパスワードが必要です')

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'phone_number', 'is_premium', 'created_at')
        read_only_fields = ('id', 'is_premium', 'created_at')