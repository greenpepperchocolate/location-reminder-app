# subscriptions/admin.py
from django.contrib import admin
from django.utils.html import format_html
from .models import Subscription, Payment

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        'user_display',
        'plan_type_display',
        'status_display',
        'period_display',
        'created_at'
    )
    
    list_filter = (
        'plan_type',
        'status',
        'created_at',
        'current_period_end'
    )
    
    search_fields = (
        'user__username',
        'user__email',
        'stripe_subscription_id'
    )
    
    ordering = ('-created_at',)
    
    readonly_fields = (
        'stripe_subscription_id',
        'created_at',
        'updated_at',
        'stripe_dashboard_link'
    )
    
    fieldsets = (
        ('基本情報', {
            'fields': ('user', 'plan_type', 'status')
        }),
        ('期間情報', {
            'fields': ('current_period_start', 'current_period_end', 'canceled_at')
        }),
        ('Stripe情報', {
            'fields': ('stripe_subscription_id', 'stripe_dashboard_link'),
            'classes': ('collapse',)
        }),
        ('タイムスタンプ', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def user_display(self, obj):
        """ユーザー情報を表示"""
        return format_html(
            '<strong>{}</strong><br><small>{}</small>',
            obj.user.username,
            obj.user.email
        )
    user_display.short_description = 'ユーザー'
    
    def plan_type_display(self, obj):
        """プランタイプを色付きで表示"""
        if obj.plan_type == 'premium':
            return format_html(
                '<span style="color: #ffd700; font-weight: bold;">💎 {}</span>',
                obj.get_plan_type_display()
            )
        return obj.get_plan_type_display()
    plan_type_display.short_description = 'プラン'
    
    def status_display(self, obj):
        """ステータスを色付きで表示"""
        status_colors = {
            'active': '#28a745',
            'inactive': '#6c757d',
            'canceled': '#dc3545',
            'past_due': '#ffc107'
        }
        color = status_colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_display.short_description = 'ステータス'
    
    def period_display(self, obj):
        """期間を表示"""
        if obj.current_period_start and obj.current_period_end:
            return format_html(
                '{}<br><small>〜 {}</small>',
                obj.current_period_start.strftime('%Y/%m/%d'),
                obj.current_period_end.strftime('%Y/%m/%d')
            )
        return '未設定'
    period_display.short_description = '期間'
    
    def stripe_dashboard_link(self, obj):
        """Stripeダッシュボードリンク"""
        if obj.stripe_subscription_id:
            # 実際の環境では適切なStripe URLを設定
            return format_html(
                '<a href="https://dashboard.stripe.com/subscriptions/{}" target="_blank" class="button">Stripeで確認</a>',
                obj.stripe_subscription_id
            )
        return 'Stripe ID未設定'
    stripe_dashboard_link.short_description = 'Stripe'

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'user_display',
        'amount_display',
        'status_display',
        'created_at'
    )
    
    list_filter = (
        'status',
        'currency',
        'created_at'
    )
    
    search_fields = (
        'user__username',
        'user__email',
        'stripe_payment_intent_id'
    )
    
    ordering = ('-created_at',)
    
    readonly_fields = (
        'stripe_payment_intent_id',
        'created_at',
        'stripe_dashboard_link'
    )
    
    def has_add_permission(self, request):
        """決済ログは追加不可"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """決済ログは変更不可"""
        return False
    
    def user_display(self, obj):
        """ユーザー情報を表示"""
        return format_html(
            '<strong>{}</strong><br><small>{}</small>',
            obj.user.username,
            obj.user.email
        )
    user_display.short_description = 'ユーザー'
    
    def amount_display(self, obj):
        """金額を表示"""
        return format_html(
            '<strong>¥{:,}</strong>',
            int(obj.amount)
        )
    amount_display.short_description = '金額'
    
    def status_display(self, obj):
        """ステータスを色付きで表示"""
        status_colors = {
            'succeeded': '#28a745',
            'pending': '#ffc107',
            'failed': '#dc3545'
        }
        color = status_colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.status.upper()
        )
    status_display.short_description = 'ステータス'
    
    def stripe_dashboard_link(self, obj):
        """Stripeダッシュボードリンク"""
        if obj.stripe_payment_intent_id:
            return format_html(
                '<a href="https://dashboard.stripe.com/payments/{}" target="_blank" class="button">Stripeで確認</a>',
                obj.stripe_payment_intent_id
            )
        return 'Stripe ID未設定'
    stripe_dashboard_link.short_description = 'Stripe'

# Django Admin のカスタマイズ
from django.contrib.admin import AdminSite
from django.template.response import TemplateResponse

class LocationReminderAdminSite(AdminSite):
    site_header = '位置情報リマインダー 管理画面'
    site_title = '位置情報リマインダー Admin'
    index_title = 'アプリ管理'
    
    def index(self, request, extra_context=None):
        """カスタムダッシュボード"""
        extra_context = extra_context or {}
        
        # 統計情報を追加
        from django.contrib.auth import get_user_model
        from stores.models import Store
        from reminders.models import Reminder
        from subscriptions.models import Subscription
        
        User = get_user_model()
        
        extra_context.update({
            'total_users': User.objects.count(),
            'premium_users': User.objects.filter(is_premium=True).count(),
            'total_stores': Store.objects.filter(is_active=True).count(),
            'convenience_stores': Store.objects.filter(store_type='convenience', is_active=True).count(),
            'pharmacies': Store.objects.filter(store_type='pharmacy', is_active=True).count(),
            'active_reminders': Reminder.objects.filter(is_active=True).count(),
            'total_reminders': Reminder.objects.count(),
        })
        
        return super().index(request, extra_context)

# デフォルトのadmin siteを置き換える場合（オプション）
# admin_site = LocationReminderAdminSite(name='admin')
# admin.site = admin_site