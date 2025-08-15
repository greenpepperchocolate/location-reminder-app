# reminders/serializers.py
from rest_framework import serializers
from .models import Reminder, ReminderLog

class ReminderSerializer(serializers.ModelSerializer):
    store_type_display = serializers.CharField(source='get_store_type_display', read_only=True)

    class Meta:
        model = Reminder
        fields = ('id', 'store_type', 'store_type_display', 'title', 'memo', 'is_active', 
                 'trigger_distance', 'last_triggered', 'created_at', 'updated_at')
        read_only_fields = ('id', 'last_triggered', 'created_at', 'updated_at')

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class ReminderLogSerializer(serializers.ModelSerializer):
    reminder_title = serializers.CharField(source='reminder.title', read_only=True)
    store_type_display = serializers.CharField(source='reminder.get_store_type_display', read_only=True)

    class Meta:
        model = ReminderLog
        fields = ('id', 'reminder', 'reminder_title', 'store_type_display', 'triggered_at', 
                 'distance_to_store')
        read_only_fields = ('id', 'triggered_at')