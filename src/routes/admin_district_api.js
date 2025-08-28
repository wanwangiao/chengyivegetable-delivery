const express = require('express');
const router = express.Router();

// 確保管理員登入的中間件
function ensureAdmin(req, res, next) {
    if (!req.session.adminId) {
        return res.status(401).json({ 
            success: false, 
            message: '請先登入管理員帳號' 
        });
    }
    next();
}

// 獲取所有區域映射配置
router.get('/district-mappings', ensureAdmin, async (req, res) => {
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                mappings: [
                    {
                        id: 1,
                        district: '三峽區',
                        keywords: ['三峽區', '三峽', '北大', '北大特區', '台北大學'],
                        priority: 1,
                        is_active: true,
                        created_at: new Date()
                    },
                    {
                        id: 2,
                        district: '樹林區',
                        keywords: ['樹林區', '樹林'],
                        priority: 2,
                        is_active: true,
                        created_at: new Date()
                    },
                    {
                        id: 3,
                        district: '土城區',
                        keywords: ['土城區', '土城'],
                        priority: 3,
                        is_active: true,
                        created_at: new Date()
                    },
                    {
                        id: 4,
                        district: '鶯歌區',
                        keywords: ['鶯歌區', '鶯歌'],
                        priority: 4,
                        is_active: true,
                        created_at: new Date()
                    }
                ]
            });
        }
        
        const { rows } = await req.app.locals.pool.query(`
            SELECT id, district, keywords, priority, is_active, created_at
            FROM address_district_mapping
            ORDER BY priority ASC, district ASC
        `);
        
        res.json({
            success: true,
            mappings: rows
        });
        
    } catch (error) {
        console.error('獲取區域映射失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取區域映射失敗',
            error: error.message
        });
    }
});

// 新增區域映射
router.post('/district-mappings', ensureAdmin, async (req, res) => {
    const { district, keywords, priority } = req.body;
    
    if (!district || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({
            success: false,
            message: '請提供區域名稱和關鍵字陣列'
        });
    }
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                message: '示範模式：區域映射已新增',
                id: Date.now()
            });
        }
        
        // 檢查區域是否已存在
        const existingCheck = await req.app.locals.pool.query(
            'SELECT id FROM address_district_mapping WHERE district = $1',
            [district]
        );
        
        if (existingCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: '此區域已存在'
            });
        }
        
        const result = await req.app.locals.pool.query(`
            INSERT INTO address_district_mapping (district, keywords, priority, is_active)
            VALUES ($1, $2, $3, true)
            RETURNING id
        `, [district, keywords, priority || 99]);
        
        res.json({
            success: true,
            message: '區域映射新增成功',
            id: result.rows[0].id
        });
        
    } catch (error) {
        console.error('新增區域映射失敗:', error);
        res.status(500).json({
            success: false,
            message: '新增區域映射失敗',
            error: error.message
        });
    }
});

// 更新區域映射
router.put('/district-mappings/:id', ensureAdmin, async (req, res) => {
    const { id } = req.params;
    const { district, keywords, priority, is_active } = req.body;
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                message: '示範模式：區域映射已更新'
            });
        }
        
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        if (district !== undefined) {
            updateFields.push(`district = $${paramIndex++}`);
            updateValues.push(district);
        }
        
        if (keywords !== undefined) {
            if (!Array.isArray(keywords)) {
                return res.status(400).json({
                    success: false,
                    message: '關鍵字必須是陣列格式'
                });
            }
            updateFields.push(`keywords = $${paramIndex++}`);
            updateValues.push(keywords);
        }
        
        if (priority !== undefined) {
            updateFields.push(`priority = $${paramIndex++}`);
            updateValues.push(priority);
        }
        
        if (is_active !== undefined) {
            updateFields.push(`is_active = $${paramIndex++}`);
            updateValues.push(is_active);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: '沒有提供要更新的欄位'
            });
        }
        
        updateValues.push(id);
        
        const result = await req.app.locals.pool.query(`
            UPDATE address_district_mapping
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
        `, updateValues);
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: '區域映射不存在'
            });
        }
        
        res.json({
            success: true,
            message: '區域映射更新成功'
        });
        
    } catch (error) {
        console.error('更新區域映射失敗:', error);
        res.status(500).json({
            success: false,
            message: '更新區域映射失敗',
            error: error.message
        });
    }
});

// 刪除區域映射
router.delete('/district-mappings/:id', ensureAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                message: '示範模式：區域映射已刪除'
            });
        }
        
        const result = await req.app.locals.pool.query(
            'DELETE FROM address_district_mapping WHERE id = $1',
            [id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: '區域映射不存在'
            });
        }
        
        res.json({
            success: true,
            message: '區域映射刪除成功'
        });
        
    } catch (error) {
        console.error('刪除區域映射失敗:', error);
        res.status(500).json({
            success: false,
            message: '刪除區域映射失敗',
            error: error.message
        });
    }
});

// 測試地址區域識別 (管理員版本，更詳細)
router.post('/test-address-detection', ensureAdmin, async (req, res) => {
    const { address, addresses } = req.body;
    
    if (!address && !addresses) {
        return res.status(400).json({
            success: false,
            message: '請提供地址或地址陣列'
        });
    }
    
    try {
        if (req.app.locals.demoMode) {
            const testAddress = address || addresses[0];
            let district = '其他區域';
            if (testAddress.includes('三峽') || testAddress.includes('北大')) district = '三峽區';
            else if (testAddress.includes('樹林')) district = '樹林區';
            else if (testAddress.includes('土城')) district = '土城區';
            else if (testAddress.includes('鶯歌')) district = '鶯歌區';
            
            return res.json({
                success: true,
                results: [{
                    address: testAddress,
                    detectedDistrict: district,
                    matchedKeywords: [district.replace('區', '')],
                    confidence: 'high'
                }]
            });
        }
        
        const testAddresses = addresses || [address];
        const results = [];
        
        for (const addr of testAddresses) {
            // 使用資料庫函數識別區域
            const districtResult = await req.app.locals.pool.query(
                'SELECT get_district_from_address($1) as district',
                [addr]
            );
            
            const detectedDistrict = districtResult.rows[0].district;
            
            // 獲取詳細匹配資訊
            const matchDetails = await getDetailedMatchInfo(addr, req.app.locals.pool);
            
            results.push({
                address: addr,
                detectedDistrict,
                matchDetails,
                confidence: matchDetails.length > 0 ? 'high' : 'low'
            });
        }
        
        res.json({
            success: true,
            results
        });
        
    } catch (error) {
        console.error('地址區域識別測試失敗:', error);
        res.status(500).json({
            success: false,
            message: '識別測試失敗',
            error: error.message
        });
    }
});

// 批次更新所有訂單的區域標記
router.post('/batch-update-all-orders', ensureAdmin, async (req, res) => {
    const { forceUpdate = false } = req.body;
    
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                message: '示範模式：已更新所有訂單區域',
                updatedCount: 50,
                details: {
                    '三峽區': 20,
                    '樹林區': 15,
                    '土城區': 10,
                    '鶯歌區': 3,
                    '其他區域': 2
                }
            });
        }
        
        const client = await req.app.locals.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 獲取需要更新的訂單
            const whereClause = forceUpdate ? '' : 'WHERE pool_district IS NULL OR pool_district = \'\'';
            const ordersToUpdate = await client.query(`
                SELECT id, address
                FROM orders
                ${whereClause}
            `);
            
            let updatedCount = 0;
            const districtCounts = {};
            
            for (const order of ordersToUpdate.rows) {
                const districtResult = await client.query(
                    'SELECT get_district_from_address($1) as district',
                    [order.address]
                );
                
                const district = districtResult.rows[0].district;
                
                await client.query(`
                    UPDATE orders 
                    SET pool_district = $1
                    WHERE id = $2
                `, [district, order.id]);
                
                updatedCount++;
                districtCounts[district] = (districtCounts[district] || 0) + 1;
            }
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                message: `已更新 ${updatedCount} 個訂單的區域標記`,
                updatedCount,
                details: districtCounts
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('批次更新訂單區域失敗:', error);
        res.status(500).json({
            success: false,
            message: '批次更新失敗',
            error: error.message
        });
    }
});

// 獲取區域統計資訊
router.get('/district-stats', ensureAdmin, async (req, res) => {
    try {
        if (req.app.locals.demoMode) {
            return res.json({
                success: true,
                stats: {
                    totalOrders: 100,
                    districtsDetected: 5,
                    districtBreakdown: {
                        '三峽區': { count: 40, percentage: 40 },
                        '樹林區': { count: 25, percentage: 25 },
                        '土城區': { count: 20, percentage: 20 },
                        '鶯歌區': { count: 10, percentage: 10 },
                        '其他區域': { count: 5, percentage: 5 }
                    },
                    recentActivity: {
                        today: 15,
                        thisWeek: 85
                    }
                }
            });
        }
        
        // 獲取總訂單數
        const totalResult = await req.app.locals.pool.query(
            'SELECT COUNT(*) as total FROM orders'
        );
        const totalOrders = parseInt(totalResult.rows[0].total);
        
        // 獲取區域分布
        const districtResult = await req.app.locals.pool.query(`
            SELECT 
                pool_district,
                COUNT(*) as count,
                ROUND((COUNT(*) * 100.0 / $1), 1) as percentage
            FROM orders
            WHERE pool_district IS NOT NULL
            GROUP BY pool_district
            ORDER BY count DESC
        `, [totalOrders]);
        
        const districtBreakdown = {};
        districtResult.rows.forEach(row => {
            districtBreakdown[row.pool_district] = {
                count: parseInt(row.count),
                percentage: parseFloat(row.percentage)
            };
        });
        
        // 獲取最近活動
        const recentResult = await req.app.locals.pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as this_week
            FROM orders
            WHERE pool_district IS NOT NULL
        `);
        
        const recentActivity = recentResult.rows[0];
        
        res.json({
            success: true,
            stats: {
                totalOrders,
                districtsDetected: Object.keys(districtBreakdown).length,
                districtBreakdown,
                recentActivity: {
                    today: parseInt(recentActivity.today),
                    thisWeek: parseInt(recentActivity.this_week)
                }
            }
        });
        
    } catch (error) {
        console.error('獲取區域統計失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取統計失敗',
            error: error.message
        });
    }
});

// 獲取詳細匹配資訊
async function getDetailedMatchInfo(address, pool) {
    try {
        const result = await pool.query(`
            SELECT district, keywords, priority
            FROM address_district_mapping
            WHERE is_active = true
            ORDER BY priority ASC
        `);
        
        const matchDetails = [];
        
        for (const mapping of result.rows) {
            const matchedKeywords = [];
            for (const keyword of mapping.keywords) {
                if (address.toLowerCase().includes(keyword.toLowerCase())) {
                    matchedKeywords.push(keyword);
                }
            }
            
            if (matchedKeywords.length > 0) {
                matchDetails.push({
                    district: mapping.district,
                    matchedKeywords,
                    priority: mapping.priority,
                    allKeywords: mapping.keywords
                });
            }
        }
        
        return matchDetails;
        
    } catch (error) {
        console.error('獲取詳細匹配資訊失敗:', error);
        return [];
    }
}

module.exports = router;