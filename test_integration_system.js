/**
 * 系統整合測試腳本
 * 測試清理後的檔案架構和功能
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 測試配置
const TEST_CONFIG = {
    baseUrl: 'http://localhost:3002',
    timeout: 10000,
    testResults: []
};

// 記錄測試結果
function logTest(testName, status, message, details = null) {
    const result = {
        testName,
        status,
        message,
        details,
        timestamp: new Date().toISOString()
    };
    
    TEST_CONFIG.testResults.push(result);
    console.log(`[${status.toUpperCase()}] ${testName}: ${message}`);
    if (details) {
        console.log(`  詳情: ${JSON.stringify(details, null, 2)}`);
    }
}

// 檔案存在性測試
function testFileStructure() {
    console.log('\n=== 檔案結構測試 ===');
    
    const requiredFiles = [
        'views/driver_dashboard_simplified.ejs',
        'views/driver_mobile_interface.ejs', 
        'src/routes/driver_simplified_api.js'
    ];
    
    const deletedFiles = [
        'views/driver_dashboard.ejs',
        'views/driver_dashboard_enhanced.ejs',
        'views/driver_dashboard_modern.ejs',
        'views/driver_dashboard_gps.ejs',
        'src/routes/driver_api.js',
        'src/routes/driver_mobile_api.js'
    ];
    
    // 檢查必要檔案存在
    requiredFiles.forEach(file => {
        const fullPath = path.join(__dirname, file);
        if (fs.existsSync(fullPath)) {
            logTest('檔案存在性', 'pass', `必要檔案存在: ${file}`);
        } else {
            logTest('檔案存在性', 'fail', `必要檔案缺失: ${file}`);
        }
    });
    
    // 檢查舊檔案已刪除
    deletedFiles.forEach(file => {
        const fullPath = path.join(__dirname, file);
        if (!fs.existsSync(fullPath)) {
            logTest('檔案清理', 'pass', `舊檔案已清理: ${file}`);
        } else {
            logTest('檔案清理', 'fail', `舊檔案仍存在: ${file}`);
        }
    });
}

// HTTP請求測試函數
function makeRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Integration-Test-Client'
            },
            timeout: TEST_CONFIG.timeout
        };
        
        if (data && method !== 'GET') {
            const postData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }
        
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('請求超時')));
        
        if (data && method !== 'GET') {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// 測試前端頁面載入
async function testFrontendLoading() {
    console.log('\n=== 前端頁面載入測試 ===');
    
    const pages = [
        { url: '/driver/login', name: '外送員登入頁面' },
        { url: '/driver/dashboard', name: '外送員工作台' },
        { url: '/driver/mobile', name: '行動版介面' }
    ];
    
    for (const page of pages) {
        try {
            const response = await makeRequest(TEST_CONFIG.baseUrl + page.url);
            
            if (response.statusCode === 200) {
                logTest('頁面載入', 'pass', `${page.name} 載入成功`, {
                    statusCode: response.statusCode,
                    contentLength: response.body.length
                });
            } else if (response.statusCode === 302) {
                logTest('頁面載入', 'info', `${page.name} 重定向`, {
                    statusCode: response.statusCode,
                    location: response.headers.location
                });
            } else {
                logTest('頁面載入', 'fail', `${page.name} 載入失敗`, {
                    statusCode: response.statusCode
                });
            }
        } catch (error) {
            logTest('頁面載入', 'error', `${page.name} 請求錯誤: ${error.message}`);
        }
    }
}

// 測試API端點
async function testAPIEndpoints() {
    console.log('\n=== API端點測試 ===');
    
    const endpoints = [
        { url: '/api/driver/available-orders', name: '可接訂單API' },
        { url: '/api/driver/stats', name: '外送員統計API' },
        { url: '/api/driver/today-stats', name: '今日統計API' }
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest(TEST_CONFIG.baseUrl + endpoint.url);
            
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                logTest('API測試', 'pass', `${endpoint.name} 回應正常`, {
                    statusCode: response.statusCode,
                    responseType: typeof data,
                    hasData: Object.keys(data).length > 0
                });
            } else if (response.statusCode === 401) {
                logTest('API測試', 'info', `${endpoint.name} 需要認證`, {
                    statusCode: response.statusCode
                });
            } else {
                logTest('API測試', 'fail', `${endpoint.name} 回應異常`, {
                    statusCode: response.statusCode
                });
            }
        } catch (error) {
            logTest('API測試', 'error', `${endpoint.name} 請求錯誤: ${error.message}`);
        }
    }
}

// 測試85%/15%比例配置
async function testLayoutRatio() {
    console.log('\n=== 版面比例測試 ===');
    
    try {
        const response = await makeRequest(TEST_CONFIG.baseUrl + '/driver/dashboard');
        
        if (response.statusCode === 200 || response.statusCode === 302) {
            const bodyContent = response.body.toLowerCase();
            
            // 檢查是否有85%/15%的配置
            const has85Percent = bodyContent.includes('85%') || bodyContent.includes('85vh');
            const has15Percent = bodyContent.includes('15%') || bodyContent.includes('15vh');
            
            if (has85Percent && has15Percent) {
                logTest('版面比例', 'pass', '85%/15%比例配置正確');
            } else if (has85Percent || has15Percent) {
                logTest('版面比例', 'info', '部分比例配置存在');
            } else {
                logTest('版面比例', 'fail', '未找到85%/15%比例配置');
            }
            
            // 檢查responsive design
            const hasResponsive = bodyContent.includes('viewport') && bodyContent.includes('mobile');
            logTest('響應式設計', hasResponsive ? 'pass' : 'fail', 
                   hasResponsive ? '響應式設計配置正確' : '響應式設計配置缺失');
            
        } else {
            logTest('版面比例', 'fail', '無法取得頁面內容進行測試');
        }
    } catch (error) {
        logTest('版面比例', 'error', `版面比例測試錯誤: ${error.message}`);
    }
}

// 生成測試報告
function generateTestReport() {
    console.log('\n=== 測試報告生成 ===');
    
    const report = {
        summary: {
            totalTests: TEST_CONFIG.testResults.length,
            passed: TEST_CONFIG.testResults.filter(r => r.status === 'pass').length,
            failed: TEST_CONFIG.testResults.filter(r => r.status === 'fail').length,
            errors: TEST_CONFIG.testResults.filter(r => r.status === 'error').length,
            info: TEST_CONFIG.testResults.filter(r => r.status === 'info').length,
            timestamp: new Date().toISOString()
        },
        results: TEST_CONFIG.testResults,
        recommendations: []
    };
    
    // 生成建議
    if (report.summary.failed > 0) {
        report.recommendations.push('需要修復失敗的測試項目');
    }
    
    if (report.summary.errors > 0) {
        report.recommendations.push('需要檢查系統連接和配置');
    }
    
    if (report.summary.passed === report.summary.totalTests) {
        report.recommendations.push('所有測試通過，系統準備就緒');
    }
    
    // 保存報告
    const reportPath = path.join(__dirname, 'integration_test_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    console.log(`\n測試完成！報告已保存至: ${reportPath}`);
    console.log(`總測試數: ${report.summary.totalTests}`);
    console.log(`通過: ${report.summary.passed}`);
    console.log(`失敗: ${report.summary.failed}`);
    console.log(`錯誤: ${report.summary.errors}`);
    console.log(`資訊: ${report.summary.info}`);
    
    return report;
}

// 主測試流程
async function runIntegrationTests() {
    console.log('🚀 開始系統整合測試...\n');
    
    try {
        // 1. 檔案結構測試
        testFileStructure();
        
        // 2. 前端頁面測試
        await testFrontendLoading();
        
        // 3. API端點測試
        await testAPIEndpoints();
        
        // 4. 版面比例測試
        await testLayoutRatio();
        
        // 5. 生成報告
        const report = generateTestReport();
        
        return report;
        
    } catch (error) {
        console.error('測試過程發生錯誤:', error);
        logTest('系統測試', 'error', error.message);
        return generateTestReport();
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    runIntegrationTests()
        .then((report) => {
            process.exit(report.summary.failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('測試失敗:', error);
            process.exit(1);
        });
}

module.exports = {
    runIntegrationTests,
    makeRequest,
    logTest
};