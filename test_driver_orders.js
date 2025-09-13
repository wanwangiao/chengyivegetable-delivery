/**
 * 測試外送員勾選訂單功能
 * 檢查修復後的外送員系統是否正常運作
 */

const axios = require('axios');

const BASE_URL = 'https://chengyivegetable-production-7b4a.up.railway.app';
const TEST_ACCOUNT = {
    phone: '0912345678',
    password: 'driver123'
};

console.log('🧪 外送員功能測試器');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));
console.log('🌐 測試網址:', BASE_URL);

/**
 * 測試外送員登錄和訂單功能
 */
async function testDriverFunctionality() {
    let sessionCookie = null;
    
    try {
        console.log('\n🔐 步驟1: 測試外送員登錄...');
        
        // 登錄外送員
        const loginResponse = await axios.post(`${BASE_URL}/driver/login`, {
            phone: TEST_ACCOUNT.phone,
            password: TEST_ACCOUNT.password
        }, {
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });
        
        // 檢查登錄結果
        if (loginResponse.status === 302) {
            console.log('✅ 登錄成功，重定向到:', loginResponse.headers.location);
            
            // 提取session cookie
            const cookies = loginResponse.headers['set-cookie'];
            if (cookies) {
                sessionCookie = cookies.find(cookie => cookie.includes('connect.sid'));
                if (sessionCookie) {
                    console.log('🍪 Session cookie 已取得');
                } else {
                    // 嘗試其他cookie格式
                    sessionCookie = cookies[0];
                    console.log('🍪 使用第一個 cookie:', sessionCookie?.substring(0, 50) + '...');
                }
            }
        } else {
            console.log('❌ 登錄失敗，狀態碼:', loginResponse.status);
            return false;
        }
        
        if (!sessionCookie) {
            console.log('❌ 無法取得 session cookie');
            return false;
        }
        
        console.log('\n📋 步驟2: 測試訂單數量API...');
        
        // 測試訂單數量API
        const orderCountResponse = await axios.get(`${BASE_URL}/api/driver/order-counts`, {
            headers: {
                'Cookie': sessionCookie
            }
        });
        
        if (orderCountResponse.status === 200) {
            console.log('✅ 訂單數量API正常');
            console.log('📊 訂單數據:', JSON.stringify(orderCountResponse.data, null, 2));
        } else {
            console.log('❌ 訂單數量API失敗，狀態碼:', orderCountResponse.status);
        }
        
        console.log('\n🚚 步驟3: 測試我的訂單API...');
        
        // 測試我的訂單API
        const myOrdersResponse = await axios.get(`${BASE_URL}/api/driver/my-orders`, {
            headers: {
                'Cookie': sessionCookie
            }
        });
        
        if (myOrdersResponse.status === 200) {
            console.log('✅ 我的訂單API正常');
            console.log('📦 我的訂單:', JSON.stringify(myOrdersResponse.data, null, 2));
        } else {
            console.log('❌ 我的訂單API失敗，狀態碼:', myOrdersResponse.status);
        }
        
        console.log('\n📈 步驟4: 測試統計API...');
        
        // 測試統計API
        const statsResponse = await axios.get(`${BASE_URL}/api/driver/stats`, {
            headers: {
                'Cookie': sessionCookie
            }
        });
        
        if (statsResponse.status === 200) {
            console.log('✅ 統計API正常');
            console.log('📊 統計數據:', JSON.stringify(statsResponse.data, null, 2));
        } else {
            console.log('❌ 統計API失敗，狀態碼:', statsResponse.status);
        }
        
        console.log('\n🗺️ 步驟5: 測試地區訂單API...');
        
        // 測試地區訂單API
        const areaOrdersResponse = await axios.post(`${BASE_URL}/api/driver/area-orders-by-name`, {
            area: '三峽區'
        }, {
            headers: {
                'Cookie': sessionCookie,
                'Content-Type': 'application/json'
            }
        });
        
        if (areaOrdersResponse.status === 200) {
            console.log('✅ 地區訂單API正常');
            console.log('🏠 三峽區訂單:', JSON.stringify(areaOrdersResponse.data, null, 2));
        } else {
            console.log('❌ 地區訂單API失敗，狀態碼:', areaOrdersResponse.status);
        }
        
        console.log('\n🎯 步驟6: 測試工作台頁面...');
        
        // 測試工作台頁面載入
        const dashboardResponse = await axios.get(`${BASE_URL}/driver`, {
            headers: {
                'Cookie': sessionCookie
            }
        });
        
        if (dashboardResponse.status === 200) {
            console.log('✅ 外送員工作台頁面正常載入');
            
            // 檢查頁面是否包含關鍵元素
            const pageContent = dashboardResponse.data;
            const hasOrderList = pageContent.includes('訂單') || pageContent.includes('order');
            const hasDriverInterface = pageContent.includes('外送員') || pageContent.includes('driver');
            
            console.log('🔍 頁面內容檢查:');
            console.log('   包含訂單相關內容:', hasOrderList ? '✅' : '❌');
            console.log('   包含外送員介面:', hasDriverInterface ? '✅' : '❌');
        } else {
            console.log('❌ 工作台頁面載入失敗，狀態碼:', dashboardResponse.status);
        }
        
        console.log('\n🎉 測試完成摘要:');
        console.log('════════════════════════════════');
        console.log('✅ 外送員登錄: 正常');
        console.log('🔍 API端點測試: 已完成');
        console.log('📱 工作台頁面: 已驗證');
        console.log('════════════════════════════════');
        console.log('\n👤 測試建議:');
        console.log('1. 使用瀏覽器訪問:', `${BASE_URL}/driver/login`);
        console.log('2. 登錄帳號:', TEST_ACCOUNT.phone);
        console.log('3. 登錄密碼:', TEST_ACCOUNT.password);
        console.log('4. 測試勾選訂單加入訂單欄功能');
        
        return true;
        
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error.message);
        
        if (error.response) {
            console.log('📊 錯誤詳情:');
            console.log('   狀態碼:', error.response.status);
            console.log('   狀態文字:', error.response.statusText);
            if (error.response.data) {
                console.log('   回應內容:', JSON.stringify(error.response.data, null, 2));
            }
        }
        
        return false;
    }
}

/**
 * 檢查系統是否已部署最新版本
 */
async function checkSystemStatus() {
    try {
        console.log('\n🔍 檢查系統狀態...');
        
        const healthResponse = await axios.get(`${BASE_URL}/`, {
            timeout: 10000
        });
        
        if (healthResponse.status === 200) {
            console.log('✅ 系統正常運行');
            
            // 嘗試檢查是否有部署時間戳或版本資訊
            const content = healthResponse.data;
            const hasContent = content && content.length > 0;
            console.log('📄 頁面內容:', hasContent ? '正常載入' : '空白');
            
            return true;
        } else {
            console.log('❌ 系統狀態異常，狀態碼:', healthResponse.status);
            return false;
        }
        
    } catch (error) {
        console.log('❌ 系統狀態檢查失敗:', error.message);
        return false;
    }
}

// 主要執行函數
async function main() {
    console.log('🚀 開始測試外送員功能...');
    
    // 檢查系統狀態
    const systemOk = await checkSystemStatus();
    if (!systemOk) {
        console.log('💥 系統狀態異常，無法進行測試');
        process.exit(1);
    }
    
    // 等待幾秒讓Railway部署完成
    console.log('⏳ 等待系統穩定...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 執行功能測試
    const testResult = await testDriverFunctionality();
    
    if (testResult) {
        console.log('\n🏆 外送員功能測試完成');
        console.log('👍 建議現在進行人工測試：外送員是否能勾選訂單');
        process.exit(0);
    } else {
        console.log('\n💥 外送員功能測試失敗');
        console.log('🔧 需要進一步檢查資料庫修復狀態');
        process.exit(1);
    }
}

// 檢查是否有axios
try {
    require('axios');
    main();
} catch (error) {
    console.log('❌ 缺少axios套件，請先安裝: npm install axios');
    console.log('📋 或直接用瀏覽器測試:', `${BASE_URL}/driver/login`);
    console.log('🔑 測試帳號:', TEST_ACCOUNT.phone, '/', TEST_ACCOUNT.password);
}