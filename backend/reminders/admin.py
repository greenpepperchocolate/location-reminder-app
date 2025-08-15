# reminders/admin.py
from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Q
from .models import Reminder, ReminderLog

@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'user_display', 
        'store_display',
        'trigger_distance',
        'is_active',
        'last_triggered_display',
        'created_at'
    )
    
    list_filter = (
        'is_active',
        'store_type',
        'trigger_distance',
        'created_at',
        'last_triggered'
    )
    
    search_fields = (
        'title',
        'memo',
        'user__username',
        'user__email'
    )
    
    list_editable = ('is_active',)
    
    ordering = ('-created_at',)
    
    fieldsets = (
        ('基本情報', {
            'fields': ('user', 'title', 'memo', 'is_active')
        }),
        ('店舗・位置設定', {
            'fields': ('store_type', 'trigger_distance')
        }),
        ('履歴', {
            'fields': ('last_triggered', 'trigger_log_count'),
            'classes': ('collapse',)
        }),
        ('タイムスタンプ', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('last_triggered', 'created_at', 'updated_at', 'trigger_log_count')
    
    def user_display(self, obj):
        """ユーザー情報を表示"""
        return format_html(
            '<strong>{}</strong><br><small>{}</small>',
            obj.user.username,
            obj.user.email
        )
    user_display.short_description = 'ユーザー'
    
    def store_display(self, obj):
        """店舗タイプを表示"""
        store_type_color = '#007bff' if obj.store_type == 'convenience' else '#17a2b8'
        return format_html(
            '<span style="color: {};">{}</span>',
            store_type_color,
            obj.get_store_type_display()
        )
    store_display.short_description = '店舗タイプ'
    
    def last_triggered_display(self, obj):
        """最終トリガー時刻を表示"""
        if obj.last_triggered:
            return obj.last_triggered.strftime('%Y/%m/%d %H:%M')
        return '未実行'
    last_triggered_display.short_description = '最終実行'
    
    def trigger_log_count(self, obj):
        """トリガーログ数を表示"""
        count = obj.reminderlog_set.count()
        if count > 0:
            return format_html(
                '<a href="/admin/reminders/reminderlog/?reminder__id__exact={}">{} 件</a>',
                obj.id,
                count
            )
        return '0 件'
    trigger_log_count.short_description = '実行履歴'

@admin.register(ReminderLog)
class ReminderLogAdmin(admin.ModelAdmin):
    list_display = (
        'reminder_title_display',
        'user_display',
        'store_display', 
        'distance_display',
        'triggered_at'
    )
    
    list_filter = (
        'triggered_at',
        'reminder__store_type',
        'reminder__is_active'
    )
    
    search_fields = (
        'reminder__title',
        'reminder__user__username'
    )
    
    ordering = ('-triggered_at',)
    
    readonly_fields = (
        'reminder',
        'triggered_at', 
        'user_latitude', 
        'user_longitude',
        'distance_to_store',
        'google_maps_link'
    )
    
    def has_add_permission(self, request):
        """ログは追加不可"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """ログは変更不可"""
        return False
    
    def reminder_title_display(self, obj):
        """リマインダータイトルを表示"""
        return format_html(
            '<strong>{}</strong><br><small>{}</small>',
            obj.reminder.title,
            obj.reminder.memo[:50] + '...' if len(obj.reminder.memo) > 50 else obj.reminder.memo
        )
    reminder_title_display.short_description = 'リマインダー'
    
    def user_display(self, obj):
        """ユーザー情報を表示"""
        return obj.reminder.user.username
    user_display.short_description = 'ユーザー'
    
    def store_display(self, obj):
        """店舗タイプを表示"""
        return obj.reminder.get_store_type_display()
    store_display.short_description = '店舗タイプ'
    
    def distance_display(self, obj):
        """距離を表示"""
        return f'{obj.distance_to_store:.1f}m'
    distance_display.short_description = '距離'
    
    def google_maps_link(self, obj):
        """ユーザー位置をGoogle Mapsで表示"""
        url = f'https://maps.google.com/?q={obj.user_latitude},{obj.user_longitude}'
        return format_html(
            '<a href="{}" target="_blank" class="button">ユーザー位置を確認</a>',
            url
        )
    google_maps_link.short_description = 'ユーザー位置'