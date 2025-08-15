# reminders/models.py
from django.db import models
from django.conf import settings

class Reminder(models.Model):
    STORE_TYPE_CHOICES = [
        ('convenience', 'コンビニ'),
        ('pharmacy', '薬局'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    store_type = models.CharField(max_length=20, choices=STORE_TYPE_CHOICES, default='convenience')
    title = models.CharField(max_length=200)
    memo = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    trigger_distance = models.IntegerField(default=30)  # メートル単位
    last_triggered = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title}"

class ReminderLog(models.Model):
    reminder = models.ForeignKey(Reminder, on_delete=models.CASCADE)
    triggered_at = models.DateTimeField(auto_now_add=True)
    user_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    user_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    distance_to_store = models.FloatField()  # メートル単位

    class Meta:
        ordering = ['-triggered_at']