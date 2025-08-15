# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'is_premium', 'is_staff', 'is_active', 'created_at')
    list_filter = ('is_premium', 'is_staff', 'is_active', 'created_at')
    search_fields = ('username', 'email', 'phone_number')
    ordering = ('-created_at',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('追加情報', {
            'fields': ('phone_number', 'is_premium', 'stripe_customer_id')
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at')