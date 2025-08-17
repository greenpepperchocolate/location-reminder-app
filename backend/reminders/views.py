# reminders/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from geopy.distance import geodesic
from .models import Reminder, ReminderLog
from .serializers import ReminderSerializer, ReminderLogSerializer
from stores.models import Store

class ReminderViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderSerializer

    def get_queryset(self):
        return Reminder.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def check_triggers(self, request):
        """現在位置をチェックして、トリガーされるリマインダーを返す"""
        latitude = request.data.get('lat')
        longitude = request.data.get('lng')

        if not latitude or not longitude:
            return Response({'error': '緯度経度が必要です'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_location = (float(latitude), float(longitude))
        except ValueError:
            return Response({'error': '無効な緯度経度です'}, status=status.HTTP_400_BAD_REQUEST)

        triggered_reminders = []
        active_reminders = self.get_queryset().filter(is_active=True)

        for reminder in active_reminders:
            # 指定された店舗タイプの近くの店舗を検索
            nearby_stores = Store.objects.filter(
                store_type=reminder.store_type
            )
            
            # 現在位置から最も近い店舗を見つける
            closest_store = None
            min_distance = float('inf')
            
            for store in nearby_stores:
                store_location = (float(store.latitude), float(store.longitude))
                distance = geodesic(user_location, store_location).meters
                
                if distance < min_distance:
                    min_distance = distance
                    closest_store = store

            # 最も近い店舗がトリガー距離内の場合
            if closest_store and min_distance <= reminder.trigger_distance:
                now = timezone.now()
                if (not reminder.last_triggered or 
                    (now - reminder.last_triggered).total_seconds() > 3600):  # 1時間
                    
                    # ログを記録
                    ReminderLog.objects.create(
                        reminder=reminder,
                        user_latitude=latitude,
                        user_longitude=longitude,
                        distance_to_store=min_distance
                    )
                    
                    # 最後のトリガー時間を更新し、リマインダーを無効化
                    reminder.last_triggered = now
                    reminder.is_active = False  # アラート後にリマインダーを無効化
                    reminder.save()
                    
                    triggered_reminders.append(reminder)

        serializer = ReminderSerializer(triggered_reminders, many=True)
        return Response({
            'triggered_reminders': serializer.data,
            'count': len(triggered_reminders)
        })

    @action(detail=False, methods=['get'])
    def logs(self, request):
        """リマインダーのトリガーログを取得"""
        logs = ReminderLog.objects.filter(reminder__user=request.user)
        serializer = ReminderLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """リマインダーの統計情報を取得"""
        from django.db.models import Count, Q
        
        # 一度のクエリで統計を取得
        stats = Reminder.objects.filter(user=request.user).aggregate(
            total_reminders=Count('id'),
            active_reminders=Count('id', filter=Q(is_active=True))
        )
        
        return Response({
            'total_reminders': stats['total_reminders'] or 0,
            'active_reminders': stats['active_reminders'] or 0
        })