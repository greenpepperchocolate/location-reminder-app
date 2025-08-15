# subscriptions/models.py
from django.db import models
from django.conf import settings

class Subscription(models.Model):
    PLAN_TYPES = [
        ('free', '無料プラン'),
        ('premium', 'プレミアムプラン'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'アクティブ'),
        ('inactive', '非アクティブ'),
        ('canceled', 'キャンセル済み'),
        ('past_due', '支払い遅延'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    stripe_subscription_id = models.CharField(max_length=255, blank=True)
    plan_type = models.CharField(max_length=20, choices=PLAN_TYPES, default='free')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    canceled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.get_plan_type_display()}"

class Payment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    stripe_payment_intent_id = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='jpy')
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - ¥{self.amount}"