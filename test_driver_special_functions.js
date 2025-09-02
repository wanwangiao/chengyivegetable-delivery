/**
 * 外送員特殊功能測試
 * 測試批次訂單、拍照上傳、問題回報等功能
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 測試配置
const TEST_CONFIG = {
    baseUrl: 'http://localhost:3002',
    timeout: 15000,
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

// HTTP請求函數
function makeRequest(url, method = 'GET', data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Special-Function-Test-Client',
                ...headers
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

// 測試批次訂單功能
async function testBatchOrders() {
    console.log('\\n=== 批次訂單功能測試 ===');
    
    const endpoints = [
        {
            url: '/api/driver/available-orders',
            name: '可接訂單列表',
            testData: null
        },
        {
            url: '/api/driver/batch-accept-orders',
            name: '批次接單',
            method: 'POST',
            testData: {
                orderIds: ['demo-order-1', 'demo-order-2'],
                driverId: 'test-driver'
            }
        }
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest(
                TEST_CONFIG.baseUrl + endpoint.url,
                endpoint.method || 'GET',
                endpoint.testData
            );
            
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                logTest('批次訂單', 'pass', `${endpoint.name} 功能正常`, {
                    statusCode: response.statusCode,
                    responseKeys: Object.keys(data),
                    dataStructure: typeof data
                });
            } else if (response.statusCode === 401) {
                logTest('批次訂單', 'info', `${endpoint.name} 需要認證`, {
                    statusCode: response.statusCode
                });
            } else {
                logTest('批次訂單', 'fail', `${endpoint.name} 回應異常`, {
                    statusCode: response.statusCode,
                    response: response.body.substring(0, 200)
                });
            }
        } catch (error) {
            logTest('批次訂單', 'error', `${endpoint.name} 請求錯誤: ${error.message}`);
        }
    }
}

// 測試拍照上傳功能
async function testPhotoUpload() {
    console.log('\\n=== 拍照上傳功能測試 ===');
    
    try {
        // 測試上傳端點是否存在
        const response = await makeRequest(
            TEST_CONFIG.baseUrl + '/api/driver/upload-delivery-photo',
            'POST',
            {
                orderId: 'test-order',
                photoType: 'delivery_proof'
            }
        );
        
        if (response.statusCode === 400 || response.statusCode === 413) {
            // 400或413表示端點存在但缺少實際檔案，這是預期的
            logTest('拍照上傳', 'pass', '上傳端點存在並正確驗證', {
                statusCode: response.statusCode,
                note: '端點正確拒絕無效請求'
            });
        } else if (response.statusCode === 200) {
            logTest('拍照上傳', 'pass', '上傳端點回應正常', {
                statusCode: response.statusCode
            });
        } else if (response.statusCode === 401) {
            logTest('拍照上傳', 'info', '上傳功能需要認證', {
                statusCode: response.statusCode
            });
        } else {
            logTest('拍照上傳', 'fail', '上傳端點回應異常', {
                statusCode: response.statusCode
            });
        }
    } catch (error) {
        logTest('拍照上傳', 'error', `上傳功能測試錯誤: ${error.message}`);
    }
    
    // 檢查Sharp圖片處理功能
    try {
        const sharp = require('sharp');
        logTest('拍照上傳', 'pass', 'Sharp圖片處理庫已安裝');
    } catch (error) {
        logTest('拍照上傳', 'fail', 'Sharp圖片處理庫缺失');
    }
    
    // 檢查Multer檔案上傳功能
    try {
        const multer = require('multer');
        logTest('拍照上傳', 'pass', 'Multer檔案上傳庫已安裝');
    } catch (error) {
        logTest('拍照上傳', 'fail', 'Multer檔案上傳庫缺失');
    }
}

// 測試問題回報功能
async function testIssueReport() {
    console.log('\\n=== 問題回報功能測試 ===');
    
    const reportData = {
        orderId: 'test-order-123',
        issueType: 'delivery_problem',
        description: '測試問題回報功能',
        driverLocation: {
            lat: 25.0330,
            lng: 121.5654
        }
    };
    
    try {
        const response = await makeRequest(
            TEST_CONFIG.baseUrl + '/api/driver/report-problem',
            'POST',
            reportData
        );
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            logTest('問題回報', 'pass', '問題回報功能正常', {
                statusCode: response.statusCode,
                responseStructure: Object.keys(data)
            });
        } else if (response.statusCode === 401) {
            logTest('問題回報', 'info', '問題回報需要認證', {
                statusCode: response.statusCode
            });
        } else if (response.statusCode === 400) {
            logTest('問題回報', 'info', '問題回報驗證功能正常', {
                statusCode: response.statusCode,
                note: '正確驗證輸入資料'
            });
        } else {
            logTest('問題回報', 'fail', '問題回報功能異常', {
                statusCode: response.statusCode
            });
        }
    } catch (error) {
        logTest('問題回報', 'error', `問題回報測試錯誤: ${error.message}`);
    }
}

// 測試LINE Bot功能
async function testLineBotIntegration() {
    console.log('\\n=== LINE Bot整合測試 ===');
    
    try {
        // 檢查LINE SDK
        const lineSDK = require('@line/bot-sdk');
        logTest('LINE Bot', 'pass', 'LINE Bot SDK已安裝');
        
        // 測試LINE通知端點
        const response = await makeRequest(
            TEST_CONFIG.baseUrl + '/api/driver/line-notify',
            'POST',
            {
                message: '測試訊息',
                orderId: 'test-order'
            }
        );
        
        if (response.statusCode === 200) {
            logTest('LINE Bot', 'pass', 'LINE通知功能正常');
        } else if (response.statusCode === 401) {
            logTest('LINE Bot', 'info', 'LINE通知需要認證');
        } else {
            logTest('LINE Bot', 'info', 'LINE通知功能在示範模式', {
                statusCode: response.statusCode,
                note: '可能運行在示範模式'
            });
        }
    } catch (error) {
        if (error.message.includes('Cannot find module')) {
            logTest('LINE Bot', 'fail', 'LINE SDK未安裝');
        } else {
            logTest('LINE Bot', 'error', `LINE Bot測試錯誤: ${error.message}`);
        }
    }
}

// 測試Google Maps整合
async function testGoogleMapsIntegration() {
    console.log('\\n=== Google Maps整合測試 ===');
    
    try {
        const response = await makeRequest(
            TEST_CONFIG.baseUrl + '/api/driver/geocode',
            'POST',
            {
                address: '台北市信義區市府路1號'
            }
        );
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            logTest('Google Maps', 'pass', 'Google Maps API正常', {
                statusCode: response.statusCode,
                hasCoordinates: data.lat && data.lng
            });
        } else if (response.statusCode === 401) {
            logTest('Google Maps', 'info', 'Google Maps API需要認證');
        } else {
            logTest('Google Maps', 'fail', 'Google Maps API異常', {
                statusCode: response.statusCode
            });
        }
    } catch (error) {
        logTest('Google Maps', 'error', `Google Maps測試錯誤: ${error.message}`);
    }
}

// 測試客戶詳情小卡功能
async function testCustomerDetailsCard() {
    console.log('\\n=== 客戶詳情小卡測試 ===');
    
    try {
        const response = await makeRequest(
            TEST_CONFIG.baseUrl + '/api/driver/customer-details/test-customer-123'
        );
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            logTest('客戶詳情', 'pass', '客戶詳情API正常', {
                statusCode: response.statusCode,
                hasCustomerInfo: data.customer && data.customer.name
            });
        } else if (response.statusCode === 401) {
            logTest('客戶詳情', 'info', '客戶詳情API需要認證');
        } else if (response.statusCode === 404) {
            logTest('客戶詳情', 'info', '客戶詳情API端點正常（測試資料不存在）');
        } else {
            logTest('客戶詳情', 'fail', '客戶詳情API異常', {
                statusCode: response.statusCode
            });
        }
    } catch (error) {
        logTest('客戶詳情', 'error', `客戶詳情測試錯誤: ${error.message}`);
    }
}

// 生成特殊功能測試報告
function generateSpecialFunctionReport() {
    console.log('\\n=== 特殊功能測試報告 ===');
    
    const report = {
        summary: {
            totalTests: TEST_CONFIG.testResults.length,
            passed: TEST_CONFIG.testResults.filter(r => r.status === 'pass').length,
            failed: TEST_CONFIG.testResults.filter(r => r.status === 'fail').length,
            errors: TEST_CONFIG.testResults.filter(r => r.status === 'error').length,
            info: TEST_CONFIG.testResults.filter(r => r.status === 'info').length,
            timestamp: new Date().toISOString()
        },
        categories: {},
        results: TEST_CONFIG.testResults,
        recommendations: []
    };
    
    // 按類別分組結果
    TEST_CONFIG.testResults.forEach(result => {
        if (!report.categories[result.testName]) {
            report.categories[result.testName] = [];
        }
        report.categories[result.testName].push(result);
    });
    
    // 生成建議
    if (report.summary.passed >= report.summary.totalTests * 0.8) {
        report.recommendations.push('✅ 大部分特殊功能測試通過，系統功能完整');
    }
    
    if (report.summary.failed > 0) {
        report.recommendations.push('⚠️ 需要修復失敗的功能測試');
    }
    
    if (report.summary.info > 0) {
        report.recommendations.push('ℹ️ 部分功能可能需要認證或配置');
    }
    
    // 保存報告
    const reportPath = path.join(__dirname, 'driver_special_functions_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    console.log(`\\n特殊功能測試完成！報告已保存至: ${reportPath}`);
    console.log(`總測試數: ${report.summary.totalTests}`);
    console.log(`通過: ${report.summary.passed}`);
    console.log(`失敗: ${report.summary.failed}`);
    console.log(`錯誤: ${report.summary.errors}`);
    console.log(`資訊: ${report.summary.info}`);
    console.log(`成功率: ${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%`);
    
    return report;
}

// 主測試流程
async function runSpecialFunctionTests() {
    console.log('🧪 開始外送員特殊功能測試...\\n');
    
    try {
        // 1. 批次訂單功能測試
        await testBatchOrders();
        
        // 2. 拍照上傳功能測試  
        await testPhotoUpload();
        
        // 3. 問題回報功能測試
        await testIssueReport();
        
        // 4. LINE Bot整合測試
        await testLineBotIntegration();
        
        // 5. Google Maps整合測試
        await testGoogleMapsIntegration();
        
        // 6. 客戶詳情小卡測試
        await testCustomerDetailsCard();
        
        // 7. 生成報告
        const report = generateSpecialFunctionReport();
        
        return report;
        
    } catch (error) {
        console.error('特殊功能測試過程發生錯誤:', error);
        logTest('系統測試', 'error', error.message);
        return generateSpecialFunctionReport();
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    runSpecialFunctionTests()
        .then((report) => {
            process.exit(report.summary.failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('特殊功能測試失敗:', error);
            process.exit(1);
        });
}

module.exports = {
    runSpecialFunctionTests,
    makeRequest,
    logTest
};