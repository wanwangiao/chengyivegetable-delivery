// =====================================
// Google Maps 服務
// 提供地理編碼、距離計算、路線規劃等功能
// =====================================

const axios = require('axios');

class GoogleMapsService {
  constructor(pool = null) {
    this.name = 'GoogleMapsService';
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';
    this.pool = pool; // 資料庫連線池
    
    if (!this.apiKey || this.apiKey === 'your_google_maps_key_here') {
      console.warn('⚠️ Google Maps API Key 未設定，將使用模擬資料');
      this.useMockData = true;
    } else {
      this.useMockData = false;
      console.log('✅ Google Maps API 已配置，Key: ' + this.apiKey.substr(0, 20) + '...');
    }
  }
  
  /**
   * 設定資料庫連線池
   */
  setDatabasePool(pool) {
    this.pool = pool;
    console.log('📊 GoogleMapsService 已連接資料庫');
  }

  /**
   * 批量地理編碼
   * @param {Array} orders - 需要地理編碼的訂單
   */
  async batchGeocode(orders) {
    console.log(`📍 開始批量地理編碼 ${orders.length} 個地址...`);
    
    if (!this.apiKey) {
      return this.mockBatchGeocode(orders);
    }

    const results = [];
    const batchSize = 25; // Google Maps API 每次請求限制
    
    try {
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        
        // 並行處理批次內的地址
        const batchPromises = batch.map(order => this.geocodeAddress(order.address));
        const batchResults = await Promise.all(batchPromises);
        
        // 更新訂單的地理位置
        for (let j = 0; j < batch.length; j++) {
          const result = batchResults[j];
          if (result.success) {
            // 更新資料庫中的訂單位置
            await this.updateOrderLocation(batch[j].id, result);
            results.push({ orderId: batch[j].id, ...result });
          } else {
            console.error(`地理編碼失敗: ${batch[j].address} - ${result.error}`);
            results.push({ orderId: batch[j].id, success: false, error: result.error });
          }
        }
        
        // 避免超過 API 配額限制
        if (i + batchSize < orders.length) {
          await this.delay(100); // 100ms 延遲
        }
      }
      
      console.log(`✅ 批量地理編碼完成，成功 ${results.filter(r => r.success).length}/${results.length}`);
      return results;
      
    } catch (error) {
      console.error('批量地理編碼錯誤:', error);
      throw new Error(`批量地理編碼失敗: ${error.message}`);
    }
  }

  /**
   * 單個地址地理編碼
   * @param {string} address - 地址
   */
  async geocodeAddress(address) {
    if (!address || typeof address !== 'string') {
      return { success: false, error: '無效的地址' };
    }

    // 檢查快取
    const cachedResult = await this.getCachedGeocode(address);
    if (cachedResult) {
      await this.updateCacheHitCount(address);
      return { success: true, ...cachedResult };
    }

    if (!this.apiKey) {
      return this.mockGeocode(address);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          address: address,
          key: this.apiKey,
          language: 'zh-TW',
          region: 'tw'
        },
        timeout: 10000
      });

      const data = response.data;
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;
        
        const geocodeResult = {
          lat: location.lat,
          lng: location.lng,
          coordinates: [location.lng, location.lat], // 添加 coordinates 字段 [lng, lat] 格式
          formatted_address: result.formatted_address,
          place_id: result.place_id,
          address_components: result.address_components,
          geometry_type: result.geometry.location_type,
          location_type: result.types
        };

        // 儲存到快取
        await this.cacheGeocodeResult(address, geocodeResult);
        
        return { success: true, ...geocodeResult };
      } else {
        const error = `地理編碼失敗: ${data.status}`;
        console.warn(error, address);
        return { success: false, error };
      }
      
    } catch (error) {
      console.error('Google Maps API 錯誤:', error.message);
      
      // API 失敗時使用模擬資料
      if (error.response?.status === 429) {
        console.warn('API 配額已用完，使用模擬資料');
        return this.mockGeocode(address);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * 計算距離矩陣
   * @param {Array} origins - 起點列表
   * @param {Array} destinations - 終點列表
   */
  async getDistanceMatrix(origins, destinations) {
    console.log(`🗺️ 計算距離矩陣：${origins.length}x${destinations.length}`);
    
    if (!this.apiKey) {
      return this.mockDistanceMatrix(origins, destinations);
    }

    try {
      // Google Maps API 限制每次最多25個起點和25個終點
      const maxBatchSize = 25;
      const results = [];
      
      for (let i = 0; i < origins.length; i += maxBatchSize) {
        const originsBatch = origins.slice(i, i + maxBatchSize);
        
        for (let j = 0; j < destinations.length; j += maxBatchSize) {
          const destinationsBatch = destinations.slice(j, j + maxBatchSize);
          
          const batchResult = await this.getDistanceMatrixBatch(originsBatch, destinationsBatch);
          results.push(batchResult);
          
          // API 限制延遲
          await this.delay(100);
        }
      }
      
      return this.mergeDistanceMatrixResults(results);
      
    } catch (error) {
      console.error('距離矩陣計算錯誤:', error);
      throw new Error(`距離矩陣計算失敗: ${error.message}`);
    }
  }

  /**
   * 單批次距離矩陣計算
   */
  async getDistanceMatrixBatch(origins, destinations) {
    const originsStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
    const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');
    
    const response = await axios.get(`${this.baseUrl}/distancematrix/json`, {
      params: {
        origins: originsStr,
        destinations: destinationsStr,
        key: this.apiKey,
        units: 'metric',
        mode: 'driving',
        language: 'zh-TW',
        avoid: 'tolls' // 避免收費路段
      },
      timeout: 15000
    });

    const data = response.data;
    
    if (data.status !== 'OK') {
      throw new Error(`Distance Matrix API 錯誤: ${data.status}`);
    }

    return data;
  }

  /**
   * 合併距離矩陣結果
   */
  mergeDistanceMatrixResults(results) {
    // 簡化版本，實際應用中需要更複雜的邏輯來合併多個批次的結果
    return results[0];
  }

  /**
   * 規劃路線
   * @param {Object} origin - 起點
   * @param {Object} destination - 終點
   * @param {Array} waypoints - 途徑點
   */
  async planRoute(origin, destination, waypoints = []) {
    console.log(`🛣️ 規劃路線：起點到終點，${waypoints.length} 個途徑點`);
    
    if (!this.apiKey) {
      return this.mockRouteResult(origin, destination, waypoints);
    }

    try {
      const waypointsStr = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
      
      const response = await axios.get(`${this.baseUrl}/directions/json`, {
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          waypoints: waypointsStr,
          optimize: true, // 自動優化途徑點順序
          key: this.apiKey,
          mode: 'driving',
          language: 'zh-TW',
          alternatives: false
        },
        timeout: 15000
      });

      const data = response.data;
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        
        return {
          success: true,
          totalDistance: this.parseDistance(route.legs.reduce((sum, leg) => sum + leg.distance.value, 0)),
          totalDuration: Math.round(route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60), // 轉換為分鐘
          optimizedOrder: route.waypoint_order || [],
          polyline: route.overview_polyline.points,
          legs: route.legs.map(leg => ({
            distance: this.parseDistance(leg.distance.value),
            duration: Math.round(leg.duration.value / 60),
            start_location: leg.start_location,
            end_location: leg.end_location
          }))
        };
      } else {
        throw new Error(`路線規劃失敗: ${data.status}`);
      }
      
    } catch (error) {
      console.error('路線規劃錯誤:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 獲取快取的地理編碼結果
   */
  async getCachedGeocode(address) {
    try {
      if (!this.pool) {
        return null;
      }
      
      const result = await this.pool.query(
        'SELECT * FROM geocoding_cache WHERE address = $1 AND expires_at > NOW()',
        [address]
      );
      
      if (result.rows.length > 0) {
        const cached = result.rows[0];
        return {
          lat: parseFloat(cached.lat),
          lng: parseFloat(cached.lng),
          formatted_address: cached.formatted_address,
          place_id: cached.place_id,
          address_components: JSON.parse(cached.address_components || '[]'),
          geometry_type: cached.geometry_type,
          location_type: JSON.parse(cached.location_type || '[]')
        };
      }
      
      return null;
    } catch (error) {
      console.error('獲取地理編碼快取錯誤:', error);
      return null;
    }
  }

  /**
   * 快取地理編碼結果
   */
  async cacheGeocodeResult(address, result) {
    try {
      if (!this.pool) {
        console.log(`💾 快取地理編碼結果 (無資料庫): ${address}`);
        return;
      }
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30天後過期
      
      await this.pool.query(`
        INSERT INTO geocoding_cache (
          address, lat, lng, formatted_address, place_id, 
          address_components, geometry_type, location_type, 
          expires_at, hit_count, last_used_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (address) DO UPDATE SET
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          formatted_address = EXCLUDED.formatted_address,
          place_id = EXCLUDED.place_id,
          address_components = EXCLUDED.address_components,
          geometry_type = EXCLUDED.geometry_type,
          location_type = EXCLUDED.location_type,
          expires_at = EXCLUDED.expires_at,
          updated_at = CURRENT_TIMESTAMP
      `, [
        address, result.lat, result.lng, result.formatted_address,
        result.place_id, JSON.stringify(result.address_components || []),
        result.geometry_type, JSON.stringify(result.location_type || []),
        expiresAt, 0, new Date()
      ]);
      
      console.log(`💾 已快取地理編碼結果: ${address}`);
    } catch (error) {
      console.error('快取地理編碼結果錯誤:', error);
    }
  }

  /**
   * 更新快取使用次數
   */
  async updateCacheHitCount(address) {
    try {
      if (!this.pool) {
        return;
      }
      
      await this.pool.query(
        'UPDATE geocoding_cache SET hit_count = hit_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE address = $1',
        [address]
      );
    } catch (error) {
      console.error('更新快取使用次數錯誤:', error);
    }
  }

  /**
   * 更新訂單位置資訊
   */
  async updateOrderLocation(orderId, geocodeResult) {
    try {
      if (!this.pool) {
        console.log(`📍 更新訂單 ${orderId} 的位置資訊 (無資料庫)`);
        return;
      }
      
      await this.pool.query(`
        UPDATE orders 
        SET lat = $1, lng = $2, geocoded_at = CURRENT_TIMESTAMP, 
            geocode_status = $3, formatted_address = $4
        WHERE id = $5
      `, [
        geocodeResult.lat, 
        geocodeResult.lng, 
        'OK',
        geocodeResult.formatted_address,
        orderId
      ]);
      
      console.log(`📍 已更新訂單 ${orderId} 的位置資訊`);
    } catch (error) {
      console.error('更新訂單位置錯誤:', error);
    }
  }

  /**
   * 模擬地理編碼（當 API Key 不可用時）
   */
  mockGeocode(address) {
    console.log(`🎭 模擬地理編碼: ${address}`);
    
    // 台灣常見地區的模擬座標
    const mockCoordinates = {
      '台北': { lat: 25.0330, lng: 121.5654 },
      '新北': { lat: 25.0173, lng: 121.4467 },
      '三峽': { lat: 24.9347, lng: 121.3681 },
      '樹林': { lat: 24.9939, lng: 121.4208 },
      '鶯歌': { lat: 24.9542, lng: 121.3508 },
      '桃園': { lat: 24.9937, lng: 121.2958 },
      '新竹': { lat: 24.8015, lng: 120.9685 },
      '台中': { lat: 24.1477, lng: 120.6736 }
    };
    
    // 從地址中找到匹配的區域
    for (const [area, coords] of Object.entries(mockCoordinates)) {
      if (address.includes(area)) {
        // 添加一些隨機偏移來模擬不同的具體地址
        const offset = 0.01; // 約1公里範圍內的隨機偏移
        return {
          success: true,
          lat: coords.lat + (Math.random() - 0.5) * offset,
          lng: coords.lng + (Math.random() - 0.5) * offset,
          formatted_address: `模擬地址: ${address}`,
          place_id: `mock_${Date.now()}_${Math.random()}`,
          address_components: [],
          geometry_type: 'APPROXIMATE',
          location_type: ['establishment']
        };
      }
    }
    
    // 預設台北地區
    return {
      success: true,
      lat: 25.0330 + (Math.random() - 0.5) * 0.1,
      lng: 121.5654 + (Math.random() - 0.5) * 0.1,
      formatted_address: `模擬地址: ${address}`,
      place_id: `mock_${Date.now()}_${Math.random()}`,
      address_components: [],
      geometry_type: 'APPROXIMATE',
      location_type: ['establishment']
    };
  }

  /**
   * 模擬批量地理編碼
   */
  mockBatchGeocode(orders) {
    console.log(`🎭 模擬批量地理編碼 ${orders.length} 個地址`);
    
    return orders.map(order => {
      const result = this.mockGeocode(order.address);
      return { orderId: order.id, ...result };
    });
  }

  /**
   * 模擬距離矩陣
   */
  mockDistanceMatrix(origins, destinations) {
    console.log(`🎭 模擬距離矩陣計算`);
    
    const elements = [];
    
    for (const origin of origins) {
      const row = [];
      for (const destination of destinations) {
        // 計算直線距離並添加一些變動
        const distance = this.calculateHaversineDistance(origin, destination);
        const drivingDistance = distance * (1.2 + Math.random() * 0.4); // 1.2-1.6倍直線距離
        const duration = drivingDistance * (2 + Math.random() * 2); // 每公里2-4分鐘
        
        row.push({
          distance: {
            text: `${drivingDistance.toFixed(1)} 公里`,
            value: Math.round(drivingDistance * 1000) // 轉換為公尺
          },
          duration: {
            text: `${Math.round(duration)} 分鐘`,
            value: Math.round(duration * 60) // 轉換為秒
          },
          status: 'OK'
        });
      }
      elements.push(row);
    }
    
    return {
      status: 'OK',
      origin_addresses: origins.map(o => `${o.lat},${o.lng}`),
      destination_addresses: destinations.map(d => `${d.lat},${d.lng}`),
      rows: elements.map(row => ({ elements: row }))
    };
  }

  /**
   * 模擬路線規劃結果
   */
  mockRouteResult(origin, destination, waypoints) {
    const allPoints = [origin, ...waypoints, destination];
    let totalDistance = 0;
    let totalDuration = 0;
    
    for (let i = 0; i < allPoints.length - 1; i++) {
      const distance = this.calculateHaversineDistance(allPoints[i], allPoints[i + 1]);
      totalDistance += distance * 1.3; // 道路距離比直線距離長30%
      totalDuration += distance * 3; // 每公里3分鐘
    }
    
    return {
      success: true,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration: Math.round(totalDuration),
      optimizedOrder: waypoints.map((_, idx) => idx), // 保持原順序
      polyline: 'mock_polyline_data',
      legs: allPoints.slice(0, -1).map((point, idx) => {
        const nextPoint = allPoints[idx + 1];
        const distance = this.calculateHaversineDistance(point, nextPoint) * 1.3;
        const duration = distance * 3;
        
        return {
          distance: Math.round(distance * 100) / 100,
          duration: Math.round(duration),
          start_location: point,
          end_location: nextPoint
        };
      })
    };
  }

  /**
   * 計算兩點間直線距離（公里）
   */
  calculateHaversineDistance(point1, point2) {
    const R = 6371; // 地球半徑（公里）
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLon = this.toRad(point2.lng - point1.lng);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * 將距離從公尺轉換為公里
   */
  parseDistance(meters) {
    return Math.round(meters / 10) / 100; // 保留兩位小數
  }

  /**
   * 角度轉弧度
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 計算路線（供外送員使用）
   * @param {Array} waypoints - 途經點陣列 [{lat, lng}, ...]
   */
  async calculateRoute(waypoints) {
    if (!waypoints || waypoints.length < 2) {
      return { success: false, error: '至少需要2個途經點' };
    }

    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const waypointsList = waypoints.slice(1, -1); // 中間的途經點

    return await this.planRoute(origin, destination, waypointsList);
  }

  /**
   * 優化路線順序（供外送員使用）
   * @param {Array} addresses - 地址陣列
   */
  async optimizeRoute(addresses) {
    console.log(`🚀 開始優化 ${addresses.length} 個地址的路線`);

    try {
      // 第一步：地理編碼所有地址
      const geocodePromises = addresses.map(address => this.geocodeAddress(address));
      const geocodeResults = await Promise.all(geocodePromises);
      
      // 過濾出成功的座標
      const validPoints = [];
      const addressMapping = [];
      
      for (let i = 0; i < geocodeResults.length; i++) {
        if (geocodeResults[i].success) {
          validPoints.push({
            lat: geocodeResults[i].lat,
            lng: geocodeResults[i].lng
          });
          addressMapping.push({
            originalIndex: i,
            address: addresses[i],
            coordinates: [geocodeResults[i].lng, geocodeResults[i].lat]
          });
        }
      }

      if (validPoints.length < 2) {
        return {
          success: false,
          message: '可用地址數量不足，無法計算路線'
        };
      }

      // 第二步：規劃最佳路線
      const origin = validPoints[0];
      const destination = validPoints[validPoints.length - 1];
      const waypoints = validPoints.slice(1, -1);

      const routeResult = await this.planRoute(origin, destination, waypoints);
      
      if (routeResult.success) {
        return {
          success: true,
          optimizedAddresses: addressMapping,
          totalDistance: routeResult.totalDistance,
          totalDuration: routeResult.totalDuration,
          routeGeometry: routeResult.polyline,
          optimizedOrder: routeResult.optimizedOrder,
          mapUrl: this.generateGoogleMapsUrl(validPoints),
          directions: routeResult.legs
        };
      } else {
        return {
          success: false,
          message: routeResult.error || '路線優化失敗'
        };
      }
      
    } catch (error) {
      console.error('路線優化錯誤:', error);
      return {
        success: false,
        message: `路線優化失敗: ${error.message}`
      };
    }
  }

  /**
   * 生成Google Maps URL
   * @param {Array} coordinates - 座標陣列
   */
  generateGoogleMapsUrl(coordinates) {
    if (!coordinates || coordinates.length === 0) return null;
    
    const waypoints = coordinates.map(coord => `${coord.lat},${coord.lng}`).join('/');
    return `https://www.google.com/maps/dir/${waypoints}`;
  }

  /**
   * 延遲函數
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GoogleMapsService;