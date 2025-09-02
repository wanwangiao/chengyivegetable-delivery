/**
 * 最終部署前檢查腳本
 * 執行全面的系統驗證，確保部署就緒
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 檢查配置
const CHECK_CONFIG = {
    baseUrl: 'http://localhost:3002',
    timeout: 10000,
    results: []
};

function logCheck(category, test, status, message, details = null) {
    const result = {
        category,
        test,
        status,
        message,
        details,
        timestamp: new Date().toISOString()
    };
    
    CHECK_CONFIG.results.push(result);
    console.log(`[${category.toUpperCase()}] ${status.toUpperCase()}: ${test} - ${message}`);
    if (details) {
        console.log(`    ${JSON.stringify(details, null, 2)}`);
    }
}

async function makeRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Deployment-Check-Client'
            },
            timeout: CHECK_CONFIG.timeout
        };
        
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

// 檢查系統服務狀態
async function checkSystemServices() {
    console.log('\\n=== 系統服務狀態檢查 ===');
    
    try {
        const response = await makeRequest(CHECK_CONFIG.baseUrl + '/');
        
        if (response.statusCode === 200) {
            logCheck('服務', '主服務', 'pass', '服務正常運行');
        } else {
            logCheck('服務', '主服務', 'fail', '服務回應異常', {
                statusCode: response.statusCode
            });
        }
    } catch (error) {
        logCheck('服務', '主服務', 'fail', '無法連接服務', {
            error: error.message
        });
    }
    
    // 檢查WebSocket狀態（透過主頁面確認）
    try {
        const response = await makeRequest(CHECK_CONFIG.baseUrl + '/');
        if (response.body.includes('websocket') || response.body.includes('socket.io')) {
            logCheck('服務', 'WebSocket', 'pass', 'WebSocket服務已配置');
        } else {
            logCheck('服務', 'WebSocket', 'info', 'WebSocket狀態未明');
        }
    } catch (error) {
        logCheck('服務', 'WebSocket', 'fail', 'WebSocket檢查失敗');
    }
}

// 檢查核心功能端點
async function checkCoreEndpoints() {
    console.log('\\n=== 核心功能端點檢查 ===');
    
    const endpoints = [
        { path: '/driver/login', name: '外送員登入', expectedStatus: 200 },
        { path: '/api/driver/available-orders', name: '可接訂單API', expectedStatus: 200 },
        { path: '/api/driver/stats', name: '統計API', expectedStatus: 200 },
        { path: '/api/driver/batch-accept-orders', name: '批次接單API', expectedStatus: [200, 400] },
        { path: '/api/driver/upload-delivery-photo', name: '照片上傳API', expectedStatus: [200, 400, 413] }
    ];
    
    for (const endpoint of endpoints) {
        try {
            const response = await makeRequest(CHECK_CONFIG.baseUrl + endpoint.path);
            const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
                ? endpoint.expectedStatus 
                : [endpoint.expectedStatus];
            
            if (expectedStatuses.includes(response.statusCode)) {
                logCheck('端點', endpoint.name, 'pass', '端點回應正常', {
                    statusCode: response.statusCode
                });
            } else if (response.statusCode === 302) {
                logCheck('端點', endpoint.name, 'info', '端點重定向（可能需要認證）', {
                    statusCode: response.statusCode,
                    location: response.headers.location
                });
            } else {
                logCheck('端點', endpoint.name, 'fail', '端點回應異常', {
                    statusCode: response.statusCode
                });
            }
        } catch (error) {
            logCheck('端點', endpoint.name, 'fail', '端點請求失敗', {
                error: error.message
            });
        }
    }
}

// 檢查檔案結構
async function checkFileStructure() {
    console.log('\\n=== 檔案結構檢查 ===');
    
    const requiredFiles = [
        { path: 'views/driver_dashboard_simplified.ejs', type: 'view' },
        { path: 'views/driver_mobile_interface.ejs', type: 'view' },
        { path: 'src/routes/driver_simplified_api.js', type: 'api' },
        { path: 'src/server.js', type: 'server' },
        { path: 'package.json', type: 'config' }
    ];
    
    const deletedFiles = [
        'views/driver_dashboard.ejs',
        'views/driver_dashboard_enhanced.ejs',
        'views/driver_dashboard_modern.ejs',
        'views/driver_dashboard_gps.ejs',
        'src/routes/driver_api.js',
        'src/routes/driver_mobile_api.js'
    ];
    
    // 檢查必要檔案
    requiredFiles.forEach(file => {
        const fullPath = path.join(__dirname, file.path);
        if (fs.existsSync(fullPath)) {
            logCheck('檔案', file.type, 'pass', `必要檔案存在: ${file.path}`);
        } else {
            logCheck('檔案', file.type, 'fail', `必要檔案缺失: ${file.path}`);
        }
    });
    
    // 檢查舊檔案清理
    let cleanupSuccess = 0;
    deletedFiles.forEach(file => {
        const fullPath = path.join(__dirname, file);
        if (!fs.existsSync(fullPath)) {
            cleanupSuccess++;
        }
    });
    
    if (cleanupSuccess === deletedFiles.length) {
        logCheck('檔案', '清理', 'pass', `所有舊檔案已清理 (${cleanupSuccess}個)`);
    } else {
        logCheck('檔案', '清理', 'fail', `部分舊檔案未清理 (${deletedFiles.length - cleanupSuccess}個殘留)`);
    }
}

// 檢查依賴安裝
async function checkDependencies() {
    console.log('\\n=== 依賴安裝檢查 ===');
    
    const criticalDependencies = [
        'express',
        'ejs',
        'pg',
        'multer',
        'sharp',
        '@line/bot-sdk',
        'socket.io',
        'axios'
    ];
    
    criticalDependencies.forEach(dep => {
        try {
            require.resolve(dep);
            logCheck('依賴', dep, 'pass', '依賴已安裝');
        } catch (error) {
            logCheck('依賴', dep, 'fail', '依賴缺失');
        }
    });
}

// 檢查配置檔案
async function checkConfiguration() {
    console.log('\\n=== 配置檢查 ===');
    
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        // 檢查腳本配置
        if (packageJson.scripts && packageJson.scripts.start) {
            logCheck('配置', '啟動腳本', 'pass', 'npm start 已配置');
        } else {
            logCheck('配置', '啟動腳本', 'fail', 'npm start 未配置');
        }
        
        // 檢查依賴版本
        const deps = packageJson.dependencies || {};
        const criticalVersions = [
            { name: 'express', version: deps.express },
            { name: 'pg', version: deps.pg },
            { name: 'sharp', version: deps.sharp }
        ];
        
        criticalVersions.forEach(dep => {
            if (dep.version) {
                logCheck('配置', '版本', 'pass', `${dep.name}: ${dep.version}`);
            } else {
                logCheck('配置', '版本', 'fail', `${dep.name}: 版本未定義`);
            }
        });
        
    } catch (error) {
        logCheck('配置', 'package.json', 'fail', 'package.json 讀取失敗', {
            error: error.message
        });
    }
}

// 檢查85%/15%版面配置
async function checkLayoutConfiguration() {
    console.log('\\n=== 版面配置檢查 ===');
    
    try {
        const dashboardPath = path.join(__dirname, 'views/driver_dashboard_simplified.ejs');
        const content = fs.readFileSync(dashboardPath, 'utf8');
        
        const has85vh = content.includes('85vh');
        const has15vh = content.includes('15vh');
        const hasViewport = content.includes('viewport');
        const hasResponsive = content.includes('mobile');
        
        if (has85vh && has15vh) {
            logCheck('版面', '85/15比例', 'pass', '85%/15%比例配置正確');
        } else {
            logCheck('版面', '85/15比例', 'fail', '85%/15%比例配置缺失');
        }
        
        if (hasViewport && hasResponsive) {
            logCheck('版面', '響應式', 'pass', '響應式設計配置正確');
        } else {
            logCheck('版面', '響應式', 'info', '響應式設計部分配置');
        }
        
    } catch (error) {
        logCheck('版面', '配置讀取', 'fail', '版面配置檔案讀取失敗');
    }
}

// 生成部署就緒報告
function generateDeploymentReport() {
    console.log('\\n=== 部署就緒評估 ===');
    
    const summary = {
        total: CHECK_CONFIG.results.length,
        pass: CHECK_CONFIG.results.filter(r => r.status === 'pass').length,
        fail: CHECK_CONFIG.results.filter(r => r.status === 'fail').length,
        info: CHECK_CONFIG.results.filter(r => r.status === 'info').length
    };
    
    const passRate = (summary.pass / summary.total * 100).toFixed(1);
    const criticalFailures = CHECK_CONFIG.results.filter(r => 
        r.status === 'fail' && ['服務', '檔案', '依賴'].includes(r.category)
    ).length;
    
    let deploymentStatus;
    let riskLevel;
    
    if (criticalFailures === 0 && summary.fail <= 2) {
        deploymentStatus = 'READY';
        riskLevel = 'LOW';
    } else if (criticalFailures <= 1 && summary.fail <= 5) {
        deploymentStatus = 'CAUTION';
        riskLevel = 'MEDIUM';
    } else {
        deploymentStatus = 'NOT_READY';
        riskLevel = 'HIGH';
    }
    
    const report = {
        timestamp: new Date().toISOString(),
        summary,
        passRate: parseFloat(passRate),
        deploymentStatus,
        riskLevel,
        criticalFailures,
        results: CHECK_CONFIG.results,
        recommendations: []
    };
    
    // 生成建議
    if (deploymentStatus === 'READY') {
        report.recommendations.push('✅ 系統準備就緒，可以立即部署');
        report.recommendations.push('🔍 建議進行生產環境最終測試');
    } else if (deploymentStatus === 'CAUTION') {
        report.recommendations.push('⚠️ 系統基本就緒，但需要解決幾個問題');
        report.recommendations.push('🔧 優先修復失敗的檢查項目');
    } else {
        report.recommendations.push('❌ 系統尚未準備就緒，需要修復關鍵問題');
        report.recommendations.push('🚨 請修復所有關鍵失敗項目後重新檢查');
    }
    
    if (summary.info > 0) {
        report.recommendations.push(`ℹ️ 有 ${summary.info} 個項目需要關注但不影響部署`);
    }
    
    // 保存報告
    fs.writeFileSync(
        path.join(__dirname, 'deployment_readiness_report.json'),
        JSON.stringify(report, null, 2)
    );
    
    // 輸出結果
    console.log(`\\n🎯 部署就緒評估結果:`);
    console.log(`   狀態: ${deploymentStatus}`);
    console.log(`   風險等級: ${riskLevel}`);
    console.log(`   總檢查項: ${summary.total}`);
    console.log(`   通過: ${summary.pass}`);
    console.log(`   失敗: ${summary.fail}`);
    console.log(`   資訊: ${summary.info}`);
    console.log(`   成功率: ${passRate}%`);
    console.log(`   關鍵失敗: ${criticalFailures}`);
    
    if (report.recommendations.length > 0) {
        console.log(`\\n📋 建議:`);
        report.recommendations.forEach(rec => console.log(`   ${rec}`));
    }
    
    return report;
}

// 主檢查流程
async function runDeploymentCheck() {
    console.log('🚀 開始最終部署前檢查...\\n');
    
    try {
        // 1. 系統服務檢查
        await checkSystemServices();
        
        // 2. 核心端點檢查
        await checkCoreEndpoints();
        
        // 3. 檔案結構檢查
        await checkFileStructure();
        
        // 4. 依賴安裝檢查
        await checkDependencies();
        
        // 5. 配置檢查
        await checkConfiguration();
        
        // 6. 版面配置檢查
        await checkLayoutConfiguration();
        
        // 7. 生成部署報告
        const report = generateDeploymentReport();
        
        return report;
        
    } catch (error) {
        console.error('部署檢查過程發生錯誤:', error);
        return {
            deploymentStatus: 'ERROR',
            error: error.message
        };
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    runDeploymentCheck()
        .then((report) => {
            process.exit(report.deploymentStatus === 'READY' ? 0 : 1);
        })
        .catch((error) => {
            console.error('部署檢查失敗:', error);
            process.exit(1);
        });
}

module.exports = {
    runDeploymentCheck
};