#!/usr/bin/env python
# add_test_stores.py - 新宿・渋谷・原宿エリアのコンビニと薬局のテストデータを追加

import os
import django

# Django設定の初期化
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'location_reminder.settings')
django.setup()

from stores.models import Store

# テストデータ（新宿・渋谷・原宿エリア）
test_stores = [
    # 新宿エリアのコンビニ
    {
        'name': 'ローソン 新宿東口店',
        'store_type': 'convenience',
        'address': '東京都新宿区新宿3-25-1',
        'latitude': 35.6896,
        'longitude': 139.7036,
        'chain_name': 'ローソン',
        'opening_hours': '24時間営業'
    },
    {
        'name': 'ファミリーマート 新宿南口店',
        'store_type': 'convenience',
        'address': '東京都新宿区新宿3-36-10',
        'latitude': 35.6894,
        'longitude': 139.7005,
        'chain_name': 'ファミリーマート',
        'opening_hours': '24時間営業'
    },
    {
        'name': 'ミニストップ 新宿西口店',
        'store_type': 'convenience',
        'address': '東京都新宿区西新宿1-15-3',
        'latitude': 35.6912,
        'longitude': 139.6983,
        'chain_name': 'ミニストップ',
        'opening_hours': '24時間営業'
    },
    
    # 渋谷エリアのコンビニ
    {
        'name': 'セブン-イレブン 渋谷駅前店',
        'store_type': 'convenience',
        'address': '東京都渋谷区渋谷1-24-7',
        'latitude': 35.6598,
        'longitude': 139.7026,
        'chain_name': 'セブン-イレブン',
        'opening_hours': '24時間営業'
    },
    {
        'name': 'ローソン 渋谷センター街店',
        'store_type': 'convenience',
        'address': '東京都渋谷区宇田川町23-3',
        'latitude': 35.6605,
        'longitude': 139.6983,
        'chain_name': 'ローソン',
        'opening_hours': '24時間営業'
    },
    
    # 原宿エリアのコンビニ
    {
        'name': 'ファミリーマート 原宿駅前店',
        'store_type': 'convenience',
        'address': '東京都渋谷区神宮前1-19-11',
        'latitude': 35.6704,
        'longitude': 139.7027,
        'chain_name': 'ファミリーマート',
        'opening_hours': '24時間営業'
    },
    {
        'name': 'セブン-イレブン 表参道店',
        'store_type': 'convenience',
        'address': '東京都港区北青山3-6-12',
        'latitude': 35.6657,
        'longitude': 139.7109,
        'chain_name': 'セブン-イレブン',
        'opening_hours': '24時間営業'
    },
    
    # 新宿エリアの薬局
    {
        'name': 'マツモトキヨシ 新宿東口店',
        'store_type': 'pharmacy',
        'address': '東京都新宿区新宿3-26-5',
        'latitude': 35.6902,
        'longitude': 139.7042,
        'chain_name': 'マツモトキヨシ',
        'opening_hours': '9:00-22:00',
        'phone_number': '03-3350-1234'
    },
    {
        'name': 'ココカラファイン 新宿南口店',
        'store_type': 'pharmacy',
        'address': '東京都新宿区新宿3-35-7',
        'latitude': 35.6888,
        'longitude': 139.7001,
        'chain_name': 'ココカラファイン',
        'opening_hours': '8:00-21:00',
        'phone_number': '03-3354-5678'
    },
    {
        'name': 'ウエルシア 新宿西口店',
        'store_type': 'pharmacy',
        'address': '東京都新宿区西新宿1-17-2',
        'latitude': 35.6915,
        'longitude': 139.6975,
        'chain_name': 'ウエルシア',
        'opening_hours': '9:00-22:00',
        'phone_number': '03-3348-9012'
    },
    
    # 渋谷エリアの薬局
    {
        'name': 'ツルハドラッグ 渋谷店',
        'store_type': 'pharmacy',
        'address': '東京都渋谷区渋谷1-25-8',
        'latitude': 35.6595,
        'longitude': 139.7035,
        'chain_name': 'ツルハドラッグ',
        'opening_hours': '9:00-22:00',
        'phone_number': '03-3463-2345'
    },
    {
        'name': 'サンドラッグ 渋谷センター街店',
        'store_type': 'pharmacy',
        'address': '東京都渋谷区宇田川町25-7',
        'latitude': 35.6610,
        'longitude': 139.6980,
        'chain_name': 'サンドラッグ',
        'opening_hours': '10:00-23:00',
        'phone_number': '03-3464-6789'
    },
    
    # 原宿エリアの薬局
    {
        'name': 'マツモトキヨシ 原宿店',
        'store_type': 'pharmacy',
        'address': '東京都渋谷区神宮前1-20-12',
        'latitude': 35.6708,
        'longitude': 139.7032,
        'chain_name': 'マツモトキヨシ',
        'opening_hours': '9:00-21:00',
        'phone_number': '03-3405-3456'
    },
    {
        'name': 'ココカラファイン 表参道店',
        'store_type': 'pharmacy',
        'address': '東京都港区北青山3-5-15',
        'latitude': 35.6661,
        'longitude': 139.7115,
        'chain_name': 'ココカラファイン',
        'opening_hours': '10:00-20:00',
        'phone_number': '03-3406-7890'
    }
]

def add_test_stores():
    print("テストデータを追加中...")
    
    for store_data in test_stores:
        # 既存のチェック（名前と座標で重複を避ける）
        existing = Store.objects.filter(
            name=store_data['name'],
            latitude=store_data['latitude'],
            longitude=store_data['longitude']
        ).first()
        
        if not existing:
            store = Store.objects.create(**store_data)
            print(f"追加: {store.name} ({store.get_store_type_display()})")
        else:
            print(f"既存: {store_data['name']}")
    
    # 統計を表示
    total_stores = Store.objects.count()
    convenience_count = Store.objects.filter(store_type='convenience').count()
    pharmacy_count = Store.objects.filter(store_type='pharmacy').count()
    
    print(f"\n=== データベース統計 ===")
    print(f"総店舗数: {total_stores}")
    print(f"コンビニ: {convenience_count}")
    print(f"薬局: {pharmacy_count}")

if __name__ == '__main__':
    add_test_stores()