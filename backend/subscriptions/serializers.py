# subscriptions/serializers.py
from rest_framework import serializers
from .models import Subscription, Payment

class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ('id', 'plan_type', 'status', 'current_period_start', 
                 'current_period_end', 'canceled_at', 'created_at')
        read_only_fields = ('id', 'created_at')

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ('id', 'amount', 'currency', 'status', 'created_at')
        read_only_fields = ('id', 'created_at')