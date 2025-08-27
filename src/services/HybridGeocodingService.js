/**
 * 混合地理編碼服務
 * 智能選擇免費服務或Google服務，提供最佳的成本效益平衡
 */

const FreeGeocodingService = require('./FreeGeocodingService');

class HybridGeocodingService {
  constructor(googleMapsService = null) {
    this.freeService = new FreeGeocodingService();
    this.googleService = googleMapsService;
    
    // 智能策略配置
    this.strategy = {
      // 第二階段：優先使用免費服務
      preferFree: true,
      
      // 在以下情況使用Google備援：
      useGoogleBackup: true,
      googleFallbackConditions: {
        complexAddress: true,    // 複雜地址 (包含巷弄號之類)
        freeServiceFailed: true, // 免費服務失敗
        lowConfidence: true,     // 免費服務信心度過低
        importantOrder: false    // 重要訂單 (暫時關閉)
      },
      
      // 成本控制
      maxGoogleRequestsPerDay: 50, // 每日Google API使用上限
      currentGoogleRequests: 0,
      
      // 品質控制
      minConfidenceThreshold: 0.7, // 最低信心度閾值
      
      // 統計追蹤
      stats: {
        totalRequests: 0,
        freeServiceUsed: 0,
        googleServiceUsed: 0,
        dailySavings: 0,
        errors: 0
      }
    };
    
    // 重置日計數器 (每天午夜)
    this.scheduleDailyReset();
    
    console.log('🔀 混合地理編碼服務已初始化 (優先免費服務)');
  }

  /**
   * 主要地理編碼函數 - 智能選擇服務
   */
  async geocodeAddress(address, options = {}) {
    const {
      forceGoogle = false,
      forceFree = false,
      isImportant = false
    } = options;

    this.strategy.stats.totalRequests++;
    
    // 檢查強制選項
    if (forceGoogle && this.googleService) {
      return await this.useGoogleService(address, 'forced');
    }
    
    if (forceFree) {
      return await this.useFreeService(address, 'forced');
    }

    // 智能策略決策
    const shouldUseGoogle = await this.shouldUseGoogleService(address, isImportant);
    
    if (shouldUseGoogle && this.googleService) {
      console.log(`🔄 選擇策略: Google (${shouldUseGoogle.reason})`);
      return await this.useGoogleService(address, shouldUseGoogle.reason);
    } else {
      console.log(`🆓 選擇策略: 免費服務`);
      return await this.useFreeServiceWithFallback(address);
    }
  }

  /**
   * 決策邏輯：是否使用Google服務
   */
  async shouldUseGoogleService(address, isImportant = false) {
    const conditions = this.strategy.googleFallbackConditions;
    
    // 檢查Google API每日使用額度
    if (this.strategy.currentGoogleRequests >= this.strategy.maxGoogleRequestsPerDay) {
      return false;
    }

    // 重要訂單優先使用Google (如果啟用)
    if (isImportant && conditions.importantOrder) {
      return { use: true, reason: '重要訂單' };
    }

    // 檢查地址複雜度
    if (conditions.complexAddress && this.isComplexAddress(address)) {
      return { use: true, reason: '複雜地址' };
    }

    // 預設使用免費服務
    return false;
  }

  /**
   * 使用免費服務 + 智能備援
   */
  async useFreeServiceWithFallback(address) {
    try {
      // 嘗試免費服務
      const result = await this.useFreeService(address, 'primary');
      
      // 檢查結果品質
      if (result.success) {
        // 檢查信心度是否足夠
        if (result.confidence >= this.strategy.minConfidenceThreshold) {
          return result;
        }
        
        // 信心度不足，考慮使用Google備援
        if (this.strategy.googleFallbackConditions.lowConfidence && 
            this.strategy.currentGoogleRequests < this.strategy.maxGoogleRequestsPerDay) {
          
          console.log(`⚠️ 免費服務信心度不足 (${result.confidence}), 嘗試Google備援`);
          
          const googleResult = await this.useGoogleService(address, '信心度不足備援');
          if (googleResult.success) {
            return googleResult;
          }
        }
        
        // Google備援失敗或不可用，返回免費服務結果
        return result;
      }
      
      // 免費服務失敗，嘗試Google備援
      if (this.strategy.googleFallbackConditions.freeServiceFailed &&
          this.strategy.currentGoogleRequests < this.strategy.maxGoogleRequestsPerDay) {
        
        console.log(`⚠️ 免費服務失敗，嘗試Google備援`);
        return await this.useGoogleService(address, '免費服務失敗備援');
      }
      
      // 所有選項都不可用，返回失敗
      return result;
      
    } catch (error) {
      console.error(`❌ 免費地理編碼異常:`, error);
      
      // 異常情況，嘗試Google備援
      if (this.strategy.googleFallbackConditions.freeServiceFailed &&
          this.strategy.currentGoogleRequests < this.strategy.maxGoogleRequestsPerDay) {
        
        return await this.useGoogleService(address, '異常備援');
      }
      
      return {
        success: false,
        error: `地理編碼失敗: ${error.message}`,
        address
      };
    }
  }

  /**
   * 使用免費服務
   */
  async useFreeService(address, reason) {
    console.log(`🆓 使用免費地理編碼: ${address} (${reason})`);
    
    const result = await this.freeService.geocodeAddress(address);
    
    if (result.success) {
      this.strategy.stats.freeServiceUsed++;
      this.strategy.stats.dailySavings += 0.16; // Google Geocoding: $5/1000 = NT$0.16
      
      // 添加混合服務標記
      result.hybridSource = 'free';
      result.reason = reason;
    }
    
    return result;
  }

  /**
   * 使用Google服務
   */
  async useGoogleService(address, reason) {
    console.log(`🔍 使用Google地理編碼: ${address} (${reason})`);
    
    if (!this.googleService) {
      return {
        success: false,
        error: 'Google地理編碼服務未配置',
        address
      };
    }

    try {
      // 這裡需要調用您現有的Google服務
      // 調用GoogleMapsService的geocodeAddress方法
      const result = await this.googleService.geocodeAddress(address);
      
      if (result.success) {
        this.strategy.stats.googleServiceUsed++;
        this.strategy.currentGoogleRequests++;
        
        // 添加混合服務標記
        result.hybridSource = 'google';
        result.reason = reason;
        result.confidence = 0.95; // Google通常有較高的信心度
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Google地理編碼失敗:`, error);
      return {
        success: false,
        error: `Google地理編碼失敗: ${error.message}`,
        address
      };
    }
  }

  /**
   * 批量地理編碼 - 智能分配策略
   */
  async batchGeocode(addresses, options = {}) {
    const {
      maxGoogleRequests = 5, // 批量處理中Google請求上限
      prioritizeImportant = false
    } = options;

    console.log(`🗺️ 開始混合批量地理編碼: ${addresses.length} 個地址`);

    const results = [];
    let googleUsedInBatch = 0;

    for (const address of addresses) {
      const isComplex = this.isComplexAddress(address);
      const shouldUseGoogle = isComplex && 
                             googleUsedInBatch < maxGoogleRequests &&
                             this.strategy.currentGoogleRequests < this.strategy.maxGoogleRequestsPerDay;

      let result;
      if (shouldUseGoogle) {
        result = await this.useGoogleService(address, '批量處理複雜地址');
        googleUsedInBatch++;
      } else {
        result = await this.useFreeServiceWithFallback(address);
      }

      results.push(result);

      // 批次間延遲 (避免速率限制)
      await this.sleep(500);
    }

    const successCount = results.filter(r => r.success).length;
    const freeCount = results.filter(r => r.hybridSource === 'free').length;
    
    console.log(`✅ 混合批量地理編碼完成: ${successCount}/${results.length} 成功`);
    console.log(`💰 成本分配: ${freeCount} 免費, ${results.length - freeCount} Google`);

    return results;
  }

  /**
   * 判斷是否為複雜地址
   */
  isComplexAddress(address) {
    if (!address) return false;
    
    // 🚀 Phase 2 優化：大幅減少複雜地址判定
    // 基於測試結果，免費服務通過逐步降級可以處理大部分地址
    const veryComplexPatterns = [
      // 只有極度複雜的特殊格式才需要 Google
      /工業區.*[A-Z]\d+廠/, // 工業區特殊編號
      /科學園區.*區\d+.*號/, // 科學園區複雜編號
      /港區.*碼頭.*號/, // 港口碼頭地址
      // 移除了原本的大部分模式，因為免費服務已能處理
    ];

    const isVeryComplex = veryComplexPatterns.some(pattern => pattern.test(address));
    
    if (isVeryComplex) {
      console.log(`🔍 極度複雜地址檢測: ${address}`);
    }
    
    return isVeryComplex;
  }

  /**
   * 每日重置計數器
   */
  scheduleDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyCounters();
      
      // 設置每24小時重置一次
      setInterval(() => {
        this.resetDailyCounters();
      }, 24 * 60 * 60 * 1000);
      
    }, msUntilMidnight);
  }

  /**
   * 重置每日計數器
   */
  resetDailyCounters() {
    console.log(`🔄 重置每日地理編碼計數器`);
    this.strategy.currentGoogleRequests = 0;
    this.strategy.stats.dailySavings = 0;
    
    // 清理快取
    this.freeService.cleanCache();
  }

  /**
   * 獲取服務統計資訊
   */
  getStats() {
    const freeStats = this.freeService.getStats();
    
    return {
      hybrid: {
        ...this.strategy.stats,
        currentGoogleRequests: this.strategy.currentGoogleRequests,
        maxGoogleRequestsPerDay: this.strategy.maxGoogleRequestsPerDay,
        googleRequestsRemaining: this.strategy.maxGoogleRequestsPerDay - this.strategy.currentGoogleRequests,
        costEfficiency: this.strategy.stats.totalRequests > 0 ?
          Math.round(this.strategy.stats.freeServiceUsed / this.strategy.stats.totalRequests * 100) : 0
      },
      free: freeStats,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * 生成優化建議
   */
  generateRecommendations() {
    const stats = this.strategy.stats;
    const recommendations = [];

    if (stats.googleServiceUsed > stats.freeServiceUsed * 0.2) {
      recommendations.push('考慮提高免費服務使用比例以節省成本');
    }

    if (this.strategy.currentGoogleRequests > this.strategy.maxGoogleRequestsPerDay * 0.8) {
      recommendations.push('Google API使用量接近每日限額，建議調整策略');
    }

    if (stats.errors > stats.totalRequests * 0.1) {
      recommendations.push('錯誤率較高，建議檢查網路連線或服務狀態');
    }

    return recommendations;
  }

  /**
   * 動態調整策略
   */
  adjustStrategy(newStrategy) {
    this.strategy = { ...this.strategy, ...newStrategy };
    console.log('🔧 地理編碼策略已調整:', newStrategy);
  }

  /**
   * 工具函數
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = HybridGeocodingService;