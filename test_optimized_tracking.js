/**
 * 測試優化後的訂單追蹤功能
 * 比較 Google Maps 與 Leaflet 的成本和功能差異
 */

const express = require('express');
const app = express();
const PORT = 3001;

// 模擬訂單數據
const mockOrder = {
    id: 12345,
    status: 'delivering',
    address: '新北市三峽區中山路123號',
    lat: 24.9347,
    lng: 121.3681,
    phone: '0912-345-678',
    total_amount: 850,
    estimated_delivery_time: '2024-08-26 20:30',
    driver_id: 1,
    driver_name: '張小明',
    created_at: '2024-08-26 19:00:00',
    updated_at: '2024-08-26 19:45:00'
};

// 設置靜態文件
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

/**
 * 測試原版訂單追蹤 (Google Maps)
 */
app.get('/tracking-original/:id', (req, res) => {
    console.log(`📍 載入原版訂單追蹤 (Google Maps) - 訂單 ${req.params.id}`);
    console.log(`💰 預估成本: $0.007 USD (地圖載入)`);
    
    res.render('order_tracking', { 
        order: mockOrder,
        costInfo: {
            provider: 'Google Maps',
            costPerLoad: 0.007,
            description: '每次載入收費'
        }
    });
});

/**
 * 測試優化版訂單追蹤 (Leaflet)
 */
app.get('/tracking-optimized/:id', (req, res) => {
    console.log(`🗺️ 載入優化版訂單追蹤 (Leaflet) - 訂單 ${req.params.id}`);
    console.log(`💚 實際成本: $0.000 USD (完全免費)`);
    
    res.render('order_tracking_optimized', { 
        order: mockOrder,
        costInfo: {
            provider: 'Leaflet + OpenStreetMap',
            costPerLoad: 0.000,
            description: '完全免費'
        }
    });
});

/**
 * 成本對比測試頁面
 */
app.get('/cost-comparison', (req, res) => {
    res.sendFile(__dirname + '/test_leaflet_optimization.html');
});

/**
 * 測試原版管理地圖 (Google Maps)
 */
app.get('/admin-map-original', (req, res) => {
    console.log('🔍 載入原版管理地圖 (Google Maps)');
    console.log('💰 預估成本: $0.007/載入 + 高 API 使用量');
    
    res.render('admin_map', { 
        costInfo: {
            provider: 'Google Maps Full',
            costPerLoad: 0.007,
            additionalCosts: 'Distance Matrix, Directions API',
            description: '完整 Google Maps 功能'
        }
    });
});

/**
 * 測試優化版管理地圖 (混合模式)
 */
app.get('/admin-map-optimized', (req, res) => {
    console.log('🗺️ 載入優化版管理地圖 (混合模式)');
    console.log('💚 實際成本: 基本功能免費，高級功能按需付費');
    
    res.render('admin_map_optimized', { 
        costInfo: {
            provider: 'Hybrid: Leaflet + Google',
            costPerLoad: 0.000,
            additionalCosts: 'Only when needed',
            description: '智能混合模式 - 節省80-90%成本'
        }
    });
});

/**
 * API: 獲取司機位置 (模擬)
 */
app.get('/api/orders/:id/driver-location', (req, res) => {
    console.log(`🚚 獲取司機位置 - 訂單 ${req.params.id}`);
    
    // 模擬司機在移動中的位置
    const baseLocation = { lat: 24.9347, lng: 121.3681 };
    const randomOffset = 0.01;
    
    res.json({
        success: true,
        location: {
            lat: baseLocation.lat + (Math.random() - 0.5) * randomOffset,
            lng: baseLocation.lng + (Math.random() - 0.5) * randomOffset
        },
        driver_name: mockOrder.driver_name,
        updated_at: new Date().toISOString()
    });
});

/**
 * API: 獲取訂單狀態 (模擬)
 */
app.get('/api/orders/:id/status', (req, res) => {
    console.log(`📦 獲取訂單狀態 - 訂單 ${req.params.id}`);
    
    res.json({
        success: true,
        order: mockOrder
    });
});

/**
 * 首頁 - 測試導覽
 */
app.get('/', (req, res) => {
    const testPages = [
        {
            title: '原版訂單追蹤 (Google Maps)',
            url: '/tracking-original/12345',
            cost: '$0.007/次載入',
            description: '使用 Google Maps JavaScript API',
            color: '#ff6b6b'
        },
        {
            title: '優化版訂單追蹤 (Leaflet)',
            url: '/tracking-optimized/12345', 
            cost: '$0.000/次載入',
            description: '使用免費的 Leaflet + OpenStreetMap',
            color: '#4ecdc4'
        },
        {
            title: '原版管理地圖 (Google Maps)',
            url: '/admin-map-original',
            cost: '$0.007/載入 + API費用',
            description: '完整 Google Maps 管理功能',
            color: '#e74c3c'
        },
        {
            title: '優化版管理地圖 (混合模式)',
            url: '/admin-map-optimized',
            cost: '基本免費 + 按需付費',
            description: '智能混合模式，節省80-90%成本',
            color: '#27ae60'
        },
        {
            title: '成本對比分析',
            url: '/cost-comparison',
            cost: '節省分析',
            description: '詳細的成本節省分析和功能對比',
            color: '#45b7d1'
        }
    ];
    
    res.send(`
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>地圖API成本優化測試</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                }
                .container { 
                    max-width: 800px; 
                    margin: 0 auto; 
                    background: white; 
                    border-radius: 12px; 
                    padding: 30px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                .header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #eee;
                }
                .test-grid {
                    display: grid;
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .test-card {
                    padding: 25px;
                    border-radius: 10px;
                    color: white;
                    text-decoration: none;
                    transition: transform 0.3s, box-shadow 0.3s;
                    display: block;
                }
                .test-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    text-decoration: none;
                    color: white;
                }
                .cost-highlight {
                    background: rgba(255,255,255,0.2);
                    padding: 10px;
                    border-radius: 6px;
                    margin: 15px 0;
                    font-weight: bold;
                    font-size: 1.2rem;
                }
                .stats-section {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 30px;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }
                .stat-item {
                    text-align: center;
                    padding: 15px;
                    background: white;
                    border-radius: 6px;
                    border-left: 4px solid #4CAF50;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🗺️ 地圖 API 成本優化測試</h1>
                    <p style="color: #666; font-size: 1.1rem;">
                        比較 Google Maps 與 Leaflet 的成本和功能差異
                    </p>
                </div>
                
                <div class="test-grid">
                    ${testPages.map(page => `
                        <a href="${page.url}" class="test-card" style="background: linear-gradient(135deg, ${page.color}, ${page.color}dd);">
                            <h3 style="margin: 0 0 15px 0; font-size: 1.3rem;">${page.title}</h3>
                            <p style="margin: 10px 0; opacity: 0.9;">${page.description}</p>
                            <div class="cost-highlight">${page.cost}</div>
                        </a>
                    `).join('')}
                </div>
                
                <div class="stats-section">
                    <h3>📊 成本節省預估 (每日100張訂單)</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div style="font-size: 1.5rem; color: #d32f2f; font-weight: bold;">$0.70</div>
                            <div style="color: #666;">Google Maps 每日成本</div>
                        </div>
                        <div class="stat-item">
                            <div style="font-size: 1.5rem; color: #2e7d32; font-weight: bold;">$0.00</div>
                            <div style="color: #666;">Leaflet 每日成本</div>
                        </div>
                        <div class="stat-item">
                            <div style="font-size: 1.5rem; color: #ff6f00; font-weight: bold;">$0.70</div>
                            <div style="color: #666;">每日節省金額</div>
                        </div>
                        <div class="stat-item">
                            <div style="font-size: 1.5rem; color: #7b1fa2; font-weight: bold;">$255</div>
                            <div style="color: #666;">每年節省金額</div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #56ab2f, #a8e6cf); color: white; border-radius: 8px;">
                    <h3 style="margin: 0 0 10px 0;">🎉 優化效果</h3>
                    <p style="margin: 0; font-size: 1.1rem;">
                        使用 Leaflet 替代 Google Maps 可節省 <strong>100%</strong> 的地圖顯示成本！
                    </p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// 錯誤處理
app.use((err, req, res, next) => {
    console.error('❌ 測試服務器錯誤:', err);
    res.status(500).json({
        error: '測試服務器錯誤',
        message: err.message
    });
});

// 啟動測試服務器
app.listen(PORT, () => {
    console.log('🚀 地圖優化測試服務器已啟動!');
    console.log(`📍 訪問: http://localhost:${PORT}`);
    console.log('');
    console.log('📋 可用的測試頁面:');
    console.log(`   原版追蹤: http://localhost:${PORT}/tracking-original/12345`);
    console.log(`   優化追蹤: http://localhost:${PORT}/tracking-optimized/12345`);
    console.log(`   成本對比: http://localhost:${PORT}/cost-comparison`);
    console.log('');
    console.log('💡 這個測試展示了如何從每日 $0.70 的成本降至 $0.00');
    console.log('🎯 目標: 在不影響功能的前提下節省 100% 地圖 API 成本');
});

module.exports = app;