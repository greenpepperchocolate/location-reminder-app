# stores/admin.py
from django.contrib import admin
from .models import Store

@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ('name', 'store_type', 'chain_name', 'address', 'latitude', 'longitude', 'is_active', 'created_at')
    list_filter = ('store_type', 'chain_name', 'is_active', 'created_at')
    search_fields = ('name', 'address', 'chain_name', 'phone_number')
    list_editable = ('is_active',)
    ordering = ('-created_at',)
    
    fieldsets = (
        ('基本情報', {
            'fields': ('name', 'store_type', 'chain_name', 'is_active')
        }),
        ('住所・連絡先', {
            'fields': ('address', 'phone_number', 'opening_hours')
        }),
        ('位置情報', {
            'fields': ('latitude', 'longitude'),
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at')