/**
 * 免費地理編碼服務
 * 整合多個免費地理編碼API，提供智能備援機制
 */

const axios = require('axios');

class FreeGeocodingService {
  constructor() {
    this.services = {
      nominatim: {
        name: 'Nominatim (OpenStreetMap)',
        baseUrl: 'https://nominatim.openstreetmap.org',
        rateLimit: 1000, // 1秒1次請求
        enabled: true
      },
      locationiq: {
        name: 'LocationIQ',
        baseUrl: 'https://us1.locationiq.com/v1',
        apiKey: process.env.LOCATIONIQ_API_KEY, // 免費額度：5000次/天
        rateLimit: 2000, // 2秒1次請求 (免費版限制)
        enabled: false // 需要API Key
      }
    };
    
    this.lastRequestTime = 0;
    this.cache = new Map(); // 內存快取
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      nominatimRequests: 0,
      locationiqRequests: 0,
      errors: 0,
      dailySavings: 0
    };
    
    console.log('🗺️ 免費地理編碼服務已初始化');
  }

  /**
   * 地理編碼主函數 - 智能選擇最佳服務
   * @param {string} address 地址
   * @param {Object} options 選項
   * @returns {Promise<Object>} 編碼結果
   */
  async geocodeAddress(address, options = {}) {
    let { 
      preferredService = 'nominatim',
      useCache = true,
      retryCount = 2 
    } = options;

    this.stats.totalRequests++;
    
    // 清理地址
    const cleanAddress = this.cleanAddress(address);
    const cacheKey = `geo:${cleanAddress}`;
    
    // 檢查快取
    if (useCache && this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      console.log(`📋 快取命中: ${cleanAddress}`);
      return { 
        success: true, 
        ...this.cache.get(cacheKey),
        source: 'cache'
      };
    }

    // 嘗試地理編碼
    let result = null;
    let attempts = 0;
    const maxAttempts = retryCount + 1;

    while (!result && attempts < maxAttempts) {
      try {
        // 選擇服務
        const service = preferredService === 'nominatim' ? 'nominatim' : 
                       (this.services.locationiq.enabled ? 'locationiq' : 'nominatim');
        
        result = await this.geocodeWithService(cleanAddress, service);
        
        if (result && result.success) {
          // 儲存到快取
          if (useCache) {
            this.cache.set(cacheKey, {
              lat: result.lat,
              lng: result.lng,
              formatted_address: result.formatted_address,
              place_id: result.place_id,
              timestamp: Date.now()
            });
          }
          
          // 更新節省統計
          this.stats.dailySavings += 0.005; // Google Geocoding API: $5/1000 requests
          
          return result;
        }
      } catch (error) {
        console.warn(`⚠️ 地理編碼嘗試 ${attempts + 1} 失敗:`, error.message);
        this.stats.errors++;
      }
      
      attempts++;
      
      // 如果第一個服務失敗，嘗試其他服務
      if (!result && attempts < maxAttempts) {
        preferredService = preferredService === 'nominatim' ? 'locationiq' : 'nominatim';
        await this.sleep(1000); // 等待1秒再重試
      }
    }

    // 所有嘗試都失敗
    console.error(`❌ 地理編碼完全失敗: ${cleanAddress}`);
    return {
      success: false,
      error: '所有地理編碼服務都無法處理此地址',
      address: cleanAddress
    };
  }

  /**
   * 使用特定服務進行地理編碼
   */
  async geocodeWithService(address, serviceName) {
    const service = this.services[serviceName];
    if (!service || !service.enabled) {
      throw new Error(`服務 ${serviceName} 不可用`);
    }

    // 速率限制
    await this.rateLimitCheck(service.rateLimit);

    switch (serviceName) {
      case 'nominatim':
        return await this.geocodeWithNominatim(address);
      case 'locationiq':
        return await this.geocodeWithLocationIQ(address);
      default:
        throw new Error(`未知的服務: ${serviceName}`);
    }
  }

  /**
   * 使用 Nominatim (OpenStreetMap) 進行地理編碼 - 逐步降級策略
   */
  async geocodeWithNominatim(address) {
    // 逐步降級查詢策略，從具體到抽象
    const queryLevels = this.generateQueryLevels(address);
    
    for (let i = 0; i < queryLevels.length; i++) {
      const query = queryLevels[i];
      console.log(`🗺️ Nominatim 地理編碼 (級別 ${i + 1}/${queryLevels.length}): ${query}`);
      
      try {
        const result = await this.performNominatimQuery(query);
        if (result.success) {
          // 如果不是第一級查詢，標記為近似結果
          if (i > 0) {
            result.approximateMatch = true;
            result.originalAddress = address;
            result.matchedQuery = query;
            console.log(`🎯 近似匹配: "${address}" → "${query}"`);
          }
          return result;
        }
      } catch (error) {
        console.warn(`⚠️ 級別 ${i + 1} 查詢失敗:`, error.message);
      }
      
      // 避免過快查詢
      if (i < queryLevels.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return {
      success: false,
      error: 'Nominatim 未找到結果',
      address
    };
  }

  /**
   * 執行單次 Nominatim 查詢
   */
  async performNominatimQuery(query) {
    const url = `${this.services.nominatim.baseUrl}/search`;
    const params = {
      format: 'json',
      q: query,
      limit: 1,
      countrycodes: 'tw', // 限制在台灣
      'accept-language': 'zh-TW,zh',
      addressdetails: 1
    };
    
    const response = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'chengyivegetable-delivery/1.0 (contact@example.com)'
      },
      timeout: 10000
    });

    this.stats.nominatimRequests++;

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        success: true,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formatted_address: result.display_name,
        place_id: result.place_id,
        confidence: this.calculateConfidence(result),
        source: 'nominatim',
        raw: result
      };
    }

    throw new Error('Nominatim 未找到結果');
  }

  /**
   * 使用 LocationIQ 進行地理編碼
   */
  async geocodeWithLocationIQ(address) {
    if (!this.services.locationiq.apiKey) {
      throw new Error('LocationIQ API Key 未設定');
    }

    const url = `${this.services.locationiq.baseUrl}/search.php`;
    const params = {
      key: this.services.locationiq.apiKey,
      q: address,
      format: 'json',
      countrycodes: 'tw',
      limit: 1,
      addressdetails: 1
    };

    console.log(`🗺️ LocationIQ 地理編碼: ${address}`);
    
    const response = await axios.get(url, {
      params,
      timeout: 10000
    });

    this.stats.locationiqRequests++;

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        success: true,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formatted_address: result.display_name,
        place_id: result.place_id,
        confidence: this.calculateConfidence(result),
        source: 'locationiq',
        raw: result
      };
    }

    throw new Error('LocationIQ 未找到結果');
  }

  /**
   * 批量地理編碼
   */
  async batchGeocode(addresses, options = {}) {
    const { 
      concurrency = 2, // 並發限制
      delayBetweenRequests = 1000 // 請求間隔
    } = options;

    console.log(`🗺️ 開始批量地理編碼: ${addresses.length} 個地址`);
    
    const results = [];
    const batches = this.chunkArray(addresses, concurrency);

    for (const batch of batches) {
      const batchPromises = batch.map(address => 
        this.geocodeAddress(address).catch(error => ({
          success: false,
          error: error.message,
          address
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 批次間延遲
      if (batch !== batches[batches.length - 1]) {
        await this.sleep(delayBetweenRequests);
      }
    }

    console.log(`✅ 批量地理編碼完成: ${results.filter(r => r.success).length}/${results.length} 成功`);
    return results;
  }

  /**
   * 地址清理和標準化
   */
  cleanAddress(address) {
    if (!address || typeof address !== 'string') {
      return '';
    }

    let cleaned = address
      .trim()
      .replace(/\s+/g, ' ') // 多個空格合併為一個
      .replace(/[,，]/g, '') // 移除逗號
      .replace(/台灣省?/g, '') // 移除台灣省
      .replace(/中華民國/g, '') // 移除中華民國
      .replace(/^\d{3,5}/, '') // 移除郵遞區號
      .trim();

    // 針對 Nominatim 的台灣地址優化
    // 移除詳細樓層和房號資訊，Nominatim 對這些辨識度不佳
    cleaned = cleaned
      .replace(/\d+樓之?\d*[室號]?/g, '') // 移除樓層和房號 "2樓之1", "15樓", "3樓甲室"
      .replace(/[B]\d*[F]?/gi, '') // 移除地下室 "B1F", "B1"
      .replace(/\d+巷\d+弄\d+號之?\d*/g, (match) => {
        // 保留主要街道，簡化巷弄號碼
        const parts = match.match(/(\d+)巷/);
        return parts ? `${parts[1]}巷` : '';
      })
      .replace(/台灣大道/g, '台中港路') // Nominatim 可能用舊名稱
      .trim();

    console.log(`🧹 地址清理: "${address}" → "${cleaned}"`);
    return cleaned;
  }

  /**
   * 產生逐步降級的查詢層級
   */
  generateQueryLevels(address) {
    const cleaned = this.cleanAddress(address);
    const queries = [];
    
    // 級別 1: 完整清理後地址
    queries.push(cleaned);
    
    // 級別 2: 移除門牌號碼，只留街道名稱
    const streetOnly = cleaned.replace(/\d+號.*$/, '').trim();
    if (streetOnly && streetOnly !== cleaned) {
      queries.push(streetOnly);
    }
    
    // 級別 3: 只留路段（如：敦化南路一段）
    const roadSection = streetOnly.replace(/.*?([^市區鄉鎮村里]+[路街道大道](?:[一二三四五六七八九十]+段)?)/g, '$1').trim();
    if (roadSection && roadSection !== streetOnly) {
      queries.push(roadSection);
    }
    
    // 級別 4: 只留行政區域
    const district = cleaned.match(/(.*?[市縣]).*?([區鄉鎮市])/);
    if (district) {
      const cityDistrict = `${district[1]}${district[2]}`;
      if (!queries.includes(cityDistrict)) {
        queries.push(cityDistrict);
      }
    }
    
    // 級別 5: 只留城市
    const city = cleaned.match(/(.*?[市縣])/);
    if (city) {
      const cityName = city[1];
      if (!queries.includes(cityName)) {
        queries.push(cityName);
      }
    }
    
    // 移除空白和重複項目
    const uniqueQueries = [...new Set(queries.filter(q => q && q.trim().length > 0))];
    
    console.log(`🔄 查詢層級: ${JSON.stringify(uniqueQueries)}`);
    return uniqueQueries;
  }

  /**
   * 計算結果信心度
   */
  calculateConfidence(result) {
    let confidence = 0.8; // 基礎信心度

    // 根據地址詳細程度調整
    if (result.address) {
      const address = result.address;
      if (address.house_number) confidence += 0.15;
      if (address.road) confidence += 0.1;
      if (address.city || address.town) confidence += 0.05;
    }

    // 根據重要性分數調整 (Nominatim 特有)
    if (result.importance) {
      confidence = Math.min(confidence + result.importance * 0.1, 1.0);
    }

    return Math.round(confidence * 100) / 100;
  }

  /**
   * 速率限制檢查
   */
  async rateLimitCheck(minInterval) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      console.log(`⏱️ 速率限制等待: ${waitTime}ms`);
      await this.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * 工具函數
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 清理快取 (移除過期項目)
   */
  cleanCache() {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
    
    let cleaned = 0;
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 快取清理完成: 移除 ${cleaned} 個過期項目`);
    }
  }

  /**
   * 獲取統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheHitRate: this.stats.totalRequests > 0 ? 
        Math.round(this.stats.cacheHits / this.stats.totalRequests * 100) : 0,
      estimatedMonthlySavings: Math.round(this.stats.dailySavings * 30 * 32), // 轉換為台幣
      services: Object.keys(this.services).map(name => ({
        name: this.services[name].name,
        enabled: this.services[name].enabled,
        requests: name === 'nominatim' ? this.stats.nominatimRequests : this.stats.locationiqRequests
      }))
    };
  }

  /**
   * 設定 LocationIQ API Key (可選)
   */
  setLocationIQKey(apiKey) {
    this.services.locationiq.apiKey = apiKey;
    this.services.locationiq.enabled = !!apiKey;
    console.log(`🔑 LocationIQ API Key 已${apiKey ? '設定' : '移除'}`);
  }
}

module.exports = FreeGeocodingService;