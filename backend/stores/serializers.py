# stores/serializers.py
from rest_framework import serializers
from .models import Store

class StoreSerializer(serializers.ModelSerializer):
    distance = serializers.SerializerMethodField()

    class Meta:
        model = Store
        fields = ('id', 'name', 'store_type', 'address', 'latitude', 'longitude', 
                 'phone_number', 'opening_hours', 'chain_name', 'distance')

    def get_distance(self, obj):
        # リクエストコンテキストから距離を取得
        request = self.context.get('request')
        if request and hasattr(obj, 'distance'):
            return round(obj.distance, 2)
        return None