import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Google Places API (New) のエンドポイント
const PLACES_API_BASE_URL = 'https://places.googleapis.com/v1/places';

class PlacesService {
  constructor() {
    this.apiKey = null;
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30分キャッシュ
  }

  /**
   * APIキーの設定
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * 近隣の店舗を検索 (Google Places API New)
   */
  async searchNearbyStores(latitude, longitude, radius = 2000) {
    if (!this.apiKey) {
      console.warn('⚠️ Google Places API key not set, using fallback');
      return [];
    }

    const cacheKey = `${latitude.toFixed(4)}_${longitude.toFixed(4)}_${radius}`;
    
    // キャッシュチェック
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('📋 Places API キャッシュから返却');
        return cached.data;
      }
    }

    try {
      console.log('=== Google Places API (New) 検索開始 ===');
      console.log(`位置: ${latitude}, ${longitude}, 半径: ${radius}m`);

      // Nearby Search (New) を使用
      const response = await axios.post(
        `${PLACES_API_BASE_URL}:searchNearby`,
        {
          includedTypes: ['convenience_store', 'pharmacy'],
          locationRestriction: {
            circle: {
              center: {
                latitude: latitude,
                longitude: longitude
              },
              radius: radius
            }
          },
          maxResultCount: 20,
          languageCode: 'ja',
          regionCode: 'JP'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.rating,places.userRatingCount'
          }
        }
      );

      const places = response.data.places || [];
      console.log(`✅ Places API: ${places.length}件の店舗を取得`);

      // 結果を正規化
      const normalizedStores = places.map((place, index) => ({
        id: `places_${place.id}`,
        name: place.displayName?.text || `店舗${index + 1}`,
        store_type: this.determineStoreType(place.types),
        address: place.formattedAddress || '',
        latitude: place.location?.latitude || 0,
        longitude: place.location?.longitude || 0,
        rating: place.rating || 0,
        user_rating_count: place.userRatingCount || 0,
        business_status: place.businessStatus || 'OPERATIONAL',
        source: 'google_places',
        distance: this.calculateDistance(
          latitude, 
          longitude, 
          place.location?.latitude || 0, 
          place.location?.longitude || 0
        )
      }));

      // 距離順にソート
      normalizedStores.sort((a, b) => a.distance - b.distance);

      // キャッシュに保存
      this.cache.set(cacheKey, {
        data: normalizedStores,
        timestamp: Date.now()
      });

      console.log(`🏪 正規化済み店舗データ: ${normalizedStores.length}件`);
      return normalizedStores;

    } catch (error) {
      console.error('❌ Google Places API エラー:', error.response?.data || error.message);
      
      // API制限やエラーの場合は空配列を返す
      if (error.response?.status === 429) {
        console.warn('⚠️ Places API 制限に達しました');
      }
      
      return [];
    }
  }

  /**
   * 店舗タイプの判定
   */
  determineStoreType(types) {
    if (types.includes('convenience_store')) {
      return 'convenience';
    } else if (types.includes('pharmacy')) {
      return 'pharmacy';
    }
    // その他の場合はconvenienceとして扱う
    return 'convenience';
  }

  /**
   * 距離計算 (Haversine公式)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球の半径（メートル）
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * キャッシュクリア
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Places APIキャッシュをクリアしました');
  }

  /**
   * 統計情報取得
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout
    };
  }
}

// シングルトンインスタンス
const placesService = new PlacesService();

export default placesService;