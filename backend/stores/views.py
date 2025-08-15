# stores/views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Q
from geopy.distance import geodesic
from .models import Store
from .serializers import StoreSerializer
import logging

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([AllowAny])
def nearby_stores(request):
    latitude = request.GET.get('lat')
    longitude = request.GET.get('lng')
    store_type = request.GET.get('type', '')  # 'convenience' or 'pharmacy'
    radius = float(request.GET.get('radius', 1.0))  # km単位

    print(f"=== 店舗検索API呼び出し ===")
    print(f"パラメータ: lat={latitude}, lng={longitude}, radius={radius}, type={store_type}")

    if not latitude or not longitude:
        return Response({'error': '緯度経度が必要です'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_location = (float(latitude), float(longitude))
        print(f"ユーザー位置: {user_location}")
    except ValueError:
        return Response({'error': '無効な緯度経度です'}, status=status.HTTP_400_BAD_REQUEST)

    # 基本的な範囲フィルタ（パフォーマンス向上のため）
    lat_range = radius / 111.0  # 緯度1度 ≈ 111km
    lng_range = radius / (111.0 * abs(geodesic((float(latitude), 0), (float(latitude), 1)).kilometers))
    
    print(f"範囲フィルタ: lat_range={lat_range}, lng_range={lng_range}")
    print(f"検索範囲: lat {float(latitude) - lat_range} ~ {float(latitude) + lat_range}")
    print(f"検索範囲: lng {float(longitude) - lng_range} ~ {float(longitude) + lng_range}")

    stores_query = Store.objects.filter(
        latitude__range=(float(latitude) - lat_range, float(latitude) + lat_range),
        longitude__range=(float(longitude) - lng_range, float(longitude) + lng_range),
        is_active=True
    )

    if store_type:
        stores_query = stores_query.filter(store_type=store_type)
    
    print(f"範囲内の店舗数: {stores_query.count()}")

    # 距離計算と絞り込み
    nearby_stores = []
    for store in stores_query:
        store_location = (float(store.latitude), float(store.longitude))
        distance = geodesic(user_location, store_location).kilometers
        print(f"店舗 {store.name}: 距離={distance:.3f}km")
        
        if distance <= radius:
            store.distance = distance
            nearby_stores.append(store)
            print(f"  -> 範囲内に追加")

    # 距離でソート
    nearby_stores.sort(key=lambda x: x.distance)
    
    print(f"最終結果: {len(nearby_stores)}件の店舗を返します")

    serializer = StoreSerializer(nearby_stores[:20], many=True, context={'request': request})
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def search_stores(request):
    query = request.GET.get('q', '')
    store_type = request.GET.get('type', '')
    
    if not query:
        return Response({'error': '検索クエリが必要です'}, status=status.HTTP_400_BAD_REQUEST)

    stores_query = Store.objects.filter(
        Q(name__icontains=query) | Q(address__icontains=query) | Q(chain_name__icontains=query),
        is_active=True
    )

    if store_type:
        stores_query = stores_query.filter(store_type=store_type)

    serializer = StoreSerializer(stores_query[:20], many=True)
    return Response(serializer.data)