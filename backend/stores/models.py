# stores/models.py
from django.db import models

class Store(models.Model):
    STORE_TYPES = [
        ('convenience', 'コンビニ'),
        ('pharmacy', '薬局'),
    ]
    
    name = models.CharField(max_length=255)
    store_type = models.CharField(max_length=20, choices=STORE_TYPES)
    address = models.TextField()
    latitude = models.DecimalField(max_digits=20, decimal_places=16)
    longitude = models.DecimalField(max_digits=20, decimal_places=16)
    phone_number = models.CharField(max_length=15, blank=True)
    opening_hours = models.TextField(blank=True)
    chain_name = models.CharField(max_length=100, blank=True)  # セブンイレブン、ローソンなど
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['latitude', 'longitude']),
            models.Index(fields=['store_type']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_store_type_display()})"