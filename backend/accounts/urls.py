# accounts/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),
    path('profile/', views.profile, name='profile'),
    path('verify-email/<uuid:token>/', views.verify_email, name='verify_email'),
    path('resend-verification/', views.resend_verification_email, name='resend_verification'),
    path('request-password-reset/', views.request_password_reset, name='request_password_reset'),
    path('reset-password/<uuid:token>/', views.reset_password, name='reset_password'),
    
    # React Native位置情報API
    path('location/update/', views.update_location, name='update_location'),
    path('location/get/', views.get_location, name='get_location'),
    
    # 接続テスト用
    path('test/', views.api_test, name='api_test'),
]