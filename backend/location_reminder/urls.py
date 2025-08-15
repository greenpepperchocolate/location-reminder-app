# location_reminder/urls.py
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def api_root(request):
    """API ルートエンドポイント"""
    return JsonResponse({
        'message': 'Location Reminder API',
        'version': '1.0',
        'endpoints': {
            'auth': '/api/auth/',
            'stores': '/api/stores/',
            'reminders': '/api/reminders/',
            'subscriptions': '/api/subscriptions/',
        }
    })

urlpatterns = [
    path('', api_root, name='api_root'),  # ルートパス用
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/stores/', include('stores.urls')),
    path('api/reminders/', include('reminders.urls')),
    path('api/subscriptions/', include('subscriptions.urls')),
]