/**
 * 資料庫設置 API 路由
 * 提供基本設定表的初始化和管理功能
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

let pool = null;
let basicSettingsService = null;

// 設置資料庫連接池和服務
function setDatabasePool(dbPool) {
  pool = dbPool;
}

function setBasicSettingsService(service) {
  basicSettingsService = service;
}

// 管理員驗證中間件
function ensureAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.status(401).json({ success: false, message: '需要管理員權限' });
}

// 檢查資料庫連接
router.get('/check-db', ensureAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        success: false,
        message: '資料庫連接池未初始化',
        status: 'no_pool'
      });
    }

    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    res.json({
      success: true,
      message: '資料庫連接正常',
      data: result.rows[0],
      pool_status: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
  } catch (error) {
    res.json({
      success: false,
      message: '資料庫連接失敗: ' + error.message,
      error: error.code
    });
  }
});

// 檢查表格狀態
router.get('/check-tables', ensureAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        success: false,
        message: '資料庫連接池未初始化'
      });
    }

    // 檢查所有表格
    const tablesResult = await pool.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    // 檢查 basic_settings 表是否存在
    const basicSettingsExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'basic_settings'
      )
    `);

    let basicSettingsInfo = null;
    if (basicSettingsExists.rows[0].exists) {
      const columnInfo = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'basic_settings' 
        ORDER BY ordinal_position
      `);
      
      const rowCount = await pool.query('SELECT COUNT(*) as count FROM basic_settings');
      
      basicSettingsInfo = {
        exists: true,
        columns: columnInfo.rows,
        row_count: parseInt(rowCount.rows[0].count)
      };
    } else {
      basicSettingsInfo = { exists: false };
    }

    res.json({
      success: true,
      tables: tablesResult.rows,
      basic_settings: basicSettingsInfo
    });
  } catch (error) {
    res.json({
      success: false,
      message: '檢查表格失敗: ' + error.message
    });
  }
});

// 初始化 basic_settings 表
router.post('/init-basic-settings', ensureAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        success: false,
        message: '資料庫連接池未初始化'
      });
    }

    // 讀取 SQL 腳本
    const sqlPath = path.join(__dirname, '../../basic_settings_schema.sql');
    
    if (!fs.existsSync(sqlPath)) {
      return res.json({
        success: false,
        message: 'SQL 腳本檔案不存在: ' + sqlPath
      });
    }

    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    
    // 執行 SQL 腳本
    await pool.query(sqlScript);
    
    // 檢查結果
    const checkResult = await pool.query('SELECT COUNT(*) as count FROM basic_settings');
    
    res.json({
      success: true,
      message: 'basic_settings 表初始化完成',
      row_count: parseInt(checkResult.rows[0].count)
    });
    
  } catch (error) {
    res.json({
      success: false,
      message: '初始化失敗: ' + error.message,
      error: error.code
    });
  }
});

// 插入預設資料
router.post('/insert-defaults', ensureAdmin, async (req, res) => {
  try {
    if (!basicSettingsService) {
      return res.json({
        success: false,
        message: 'BasicSettingsService 未初始化'
      });
    }

    // 檢查表格是否存在且為空
    const exists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'basic_settings'
      )
    `);
    
    if (!exists.rows[0].exists) {
      return res.json({
        success: false,
        message: 'basic_settings 表不存在，請先執行表格初始化'
      });
    }

    const count = await pool.query('SELECT COUNT(*) as count FROM basic_settings');
    
    res.json({
      success: true,
      message: `資料已存在，預設資料插入已完成`,
      row_count: parseInt(count.rows[0].count),
      note: 'SQL 腳本已包含預設資料插入邏輯'
    });

  } catch (error) {
    res.json({
      success: false,
      message: '插入預設資料失敗: ' + error.message
    });
  }
});

// 測試設定載入
router.get('/test-settings', ensureAdmin, async (req, res) => {
  try {
    if (!basicSettingsService) {
      return res.json({
        success: false,
        message: 'BasicSettingsService 未初始化'
      });
    }

    const allSettings = await basicSettingsService.getAllSettings();
    const categories = await basicSettingsService.getCategories();
    const websiteSettings = await basicSettingsService.getSettingsByCategory('website_content');

    res.json({
      success: true,
      message: '設定載入測試完成',
      data: {
        total_settings: Object.keys(allSettings).length,
        categories: categories,
        sample_settings: {
          store_name: allSettings['website_content_store_name'] || allSettings['store_name'],
          primary_color: allSettings['theme_primary_color'],
          banner_url: allSettings['website_content_banner_image_url']
        },
        website_content_category: websiteSettings
      }
    });

  } catch (error) {
    res.json({
      success: false,
      message: '測試設定載入失敗: ' + error.message
    });
  }
});

// 測試設定更新
router.post('/test-update', ensureAdmin, async (req, res) => {
  try {
    if (!basicSettingsService) {
      return res.json({
        success: false,
        message: 'BasicSettingsService 未初始化'
      });
    }

    const testSettings = req.body;
    const updateResult = await basicSettingsService.updateMultipleSettings(testSettings);

    // 驗證更新結果
    const updatedSettings = {};
    for (const [key, value] of Object.entries(testSettings)) {
      const parts = key.split('_');
      const category = parts[0];
      const settingKey = parts.slice(1).join('_');
      updatedSettings[key] = await basicSettingsService.getSetting(category, settingKey);
    }

    res.json({
      success: true,
      message: '設定更新測試完成',
      update_result: updateResult,
      verified_values: updatedSettings
    });

  } catch (error) {
    res.json({
      success: false,
      message: '測試設定更新失敗: ' + error.message
    });
  }
});

// 刪除 basic_settings 表
router.post('/drop-basic-settings', ensureAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        success: false,
        message: '資料庫連接池未初始化'
      });
    }

    await pool.query('DROP TABLE IF EXISTS basic_settings CASCADE');
    
    res.json({
      success: true,
      message: 'basic_settings 表已刪除'
    });

  } catch (error) {
    res.json({
      success: false,
      message: '刪除表格失敗: ' + error.message
    });
  }
});

// 重設所有設定
router.post('/reset-all', ensureAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        success: false,
        message: '資料庫連接池未初始化'
      });
    }

    // 刪除所有資料並重新插入預設值
    await pool.query('TRUNCATE TABLE basic_settings');
    
    // 重新讀取並執行 SQL 腳本中的 INSERT 部分
    const sqlPath = path.join(__dirname, '../../basic_settings_schema.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    
    // 只執行 INSERT 語句部分
    const insertSection = sqlScript.split('-- 初始化預設設定值')[1];
    if (insertSection) {
      await pool.query(insertSection);
    }

    const count = await pool.query('SELECT COUNT(*) as count FROM basic_settings');
    
    res.json({
      success: true,
      message: '所有設定已重設為預設值',
      row_count: parseInt(count.rows[0].count)
    });

  } catch (error) {
    res.json({
      success: false,
      message: '重設設定失敗: ' + error.message
    });
  }
});

module.exports = {
  router,
  setDatabasePool,
  setBasicSettingsService
};