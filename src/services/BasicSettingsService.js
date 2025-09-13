/**
 * 基本設定管理服務
 * 負責處理系統設定的載入、更新和管理
 */

class BasicSettingsService {
  constructor(pool) {
    this.pool = pool;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分鐘緩存
    this.lastCacheUpdate = null;
  }

  /**
   * 獲取所有設定值（帶緩存）
   * @returns {Promise<Object>} 扁平化的設定對象
   */
  async getAllSettings() {
    try {
      // 檢查緩存是否過期
      if (this.lastCacheUpdate && (Date.now() - this.lastCacheUpdate < this.cacheTimeout)) {
        return Object.fromEntries(this.cache);
      }

      let result = { rows: [] };
      try {
        const query = 'SELECT category, key, value, data_type FROM basic_settings ORDER BY category, key';
        result = await this.pool.query(query);
      } catch (error) {
        console.log('⚠️ basic_settings 表不存在，使用默認設定');
        result = { rows: [] };
      }
      
      // 清空緩存並重新載入
      this.cache.clear();
      const settings = {};
      
      for (const row of result.rows) {
        const settingKey = `${row.category}_${row.key}`;
        const value = this.parseSettingValue(row.value, row.data_type);
        settings[settingKey] = value;
        this.cache.set(settingKey, value);
      }

      this.lastCacheUpdate = Date.now();
      console.log(`✅ 載入 ${result.rows.length} 個設定項目`);
      
      return settings;
    } catch (error) {
      console.error('❌ 載入設定失敗:', error);
      // 返回空對象，讓系統使用預設值
      return {};
    }
  }

  /**
   * 根據分類獲取設定
   * @param {string} category 設定分類
   * @returns {Promise<Object>} 該分類下的所有設定
   */
  async getSettingsByCategory(category) {
    try {
      const query = 'SELECT key, value, display_name, data_type FROM basic_settings WHERE category = $1 ORDER BY key';
      const result = await this.pool.query(query, [category]);
      
      const settings = {};
      for (const row of result.rows) {
        settings[row.key] = {
          value: this.parseSettingValue(row.value, row.data_type),
          display_name: row.display_name,
          data_type: row.data_type
        };
      }
      
      return settings;
    } catch (error) {
      console.error(`❌ 載入分類 ${category} 設定失敗:`, error);
      return {};
    }
  }

  /**
   * 獲取單一設定值
   * @param {string} category 設定分類  
   * @param {string} key 設定鍵名
   * @param {*} defaultValue 預設值
   * @returns {Promise<*>} 設定值
   */
  async getSetting(category, key, defaultValue = null) {
    try {
      const query = 'SELECT value, data_type FROM basic_settings WHERE category = $1 AND key = $2';
      const result = await this.pool.query(query, [category, key]);
      
      if (result.rows.length === 0) {
        return defaultValue;
      }
      
      return this.parseSettingValue(result.rows[0].value, result.rows[0].data_type);
    } catch (error) {
      console.error(`❌ 獲取設定 ${category}.${key} 失敗:`, error);
      return defaultValue;
    }
  }

  /**
   * 更新設定值
   * @param {string} category 設定分類
   * @param {string} key 設定鍵名
   * @param {*} value 設定值
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateSetting(category, key, value) {
    try {
      const query = `
        UPDATE basic_settings 
        SET value = $3, updated_at = CURRENT_TIMESTAMP 
        WHERE category = $1 AND key = $2
      `;
      const result = await this.pool.query(query, [category, key, String(value)]);
      
      if (result.rowCount > 0) {
        // 清除緩存強制重新載入
        this.invalidateCache();
        console.log(`✅ 更新設定 ${category}.${key} = ${value}`);
        return true;
      } else {
        console.log(`⚠️ 設定 ${category}.${key} 不存在，嘗試插入`);
        return await this.createSetting(category, key, value);
      }
    } catch (error) {
      console.error(`❌ 更新設定 ${category}.${key} 失敗:`, error);
      return false;
    }
  }

  /**
   * 批量更新設定
   * @param {Object} settings 設定對象，格式為 { "category_key": value, ... }
   * @returns {Promise<Object>} 更新結果 { success: number, failed: number, errors: [] }
   */
  async updateMultipleSettings(settings) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const [settingKey, value] of Object.entries(settings)) {
      if (settingKey.includes('_')) {
        const parts = settingKey.split('_');
        const category = parts[0];
        const key = parts.slice(1).join('_');
        
        const updated = await this.updateSetting(category, key, value);
        if (updated) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`更新 ${settingKey} 失敗`);
        }
      } else {
        results.failed++;
        results.errors.push(`無效的設定鍵名: ${settingKey}`);
      }
    }

    return results;
  }

  /**
   * 創建新設定項目
   * @param {string} category 分類
   * @param {string} key 鍵名
   * @param {*} value 值
   * @param {string} displayName 顯示名稱
   * @param {string} dataType 資料類型
   * @returns {Promise<boolean>} 是否創建成功
   */
  async createSetting(category, key, value, displayName = '', dataType = 'text') {
    try {
      const query = `
        INSERT INTO basic_settings (category, key, value, display_name, data_type)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (category, key) 
        DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
      `;
      
      await this.pool.query(query, [category, key, String(value), displayName, dataType]);
      this.invalidateCache();
      console.log(`✅ 創建/更新設定 ${category}.${key}`);
      return true;
    } catch (error) {
      console.error(`❌ 創建設定 ${category}.${key} 失敗:`, error);
      return false;
    }
  }

  /**
   * 獲取所有設定分類
   * @returns {Promise<Array>} 分類列表
   */
  async getCategories() {
    try {
      const query = 'SELECT DISTINCT category FROM basic_settings ORDER BY category';
      const result = await this.pool.query(query);
      return result.rows.map(row => row.category);
    } catch (error) {
      console.error('❌ 獲取設定分類失敗:', error);
      return [];
    }
  }

  /**
   * 解析設定值根據資料類型
   * @param {string} value 原始值
   * @param {string} dataType 資料類型
   * @returns {*} 解析後的值
   */
  parseSettingValue(value, dataType) {
    if (value === null || value === undefined) {
      return null;
    }

    switch (dataType) {
      case 'boolean':
        return value === 'true' || value === true;
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      case 'array':
        try {
          return JSON.parse(value);
        } catch {
          return value.split(',').map(v => v.trim()).filter(v => v);
        }
      default:
        return String(value);
    }
  }

  /**
   * 清除緩存
   */
  invalidateCache() {
    this.cache.clear();
    this.lastCacheUpdate = null;
    console.log('🔄 設定緩存已清除');
  }

  /**
   * 初始化預設設定（如果資料表為空）
   * @returns {Promise<boolean>} 是否初始化成功
   */
  async initializeDefaultSettings() {
    try {
      const query = 'SELECT COUNT(*) as count FROM basic_settings';
      const result = await this.pool.query(query);
      
      if (parseInt(result.rows[0].count) === 0) {
        console.log('📝 資料表為空，正在初始化預設設定...');
        // 這裡可以執行SQL腳本或插入預設值
        // 實際部署時會透過SQL腳本初始化
        return true;
      }
      
      return true;
    } catch (error) {
      console.error('❌ 檢查設定表失敗:', error);
      return false;
    }
  }

  /**
   * 建立與預設設定對象兼容的設定對象
   * @param {Object} dbSettings 從資料庫載入的設定
   * @param {Object} defaultSettings 預設設定對象
   * @returns {Object} 合併後的設定對象
   */
  static mergeWithDefaults(dbSettings, defaultSettings) {
    const merged = { ...defaultSettings };
    
    // 將資料庫設定覆蓋到預設設定上
    for (const [key, value] of Object.entries(dbSettings)) {
      // 轉換資料庫格式 (category_key) 到預設格式
      const cleanKey = key.replace(/^[^_]+_/, ''); // 移除分類前綴
      if (cleanKey in merged) {
        merged[cleanKey] = value;
      }
      // 也保留原始格式供其他用途
      merged[key] = value;
    }
    
    return merged;
  }
}

module.exports = BasicSettingsService;