const axios = require('axios');

async function debugAPIErrors() {
    console.log('🔍 调试API错误...\n');
    
    const baseURL = 'https://chengyivegetable-production-7b4a.up.railway.app';
    
    try {
        // 1. 先登录获取session
        console.log('1. 登录获取session...');
        const loginData = {
            phone: '0912345678',
            password: 'driver123'
        };
        
        const loginResponse = await axios.post(`${baseURL}/driver/login`, loginData, {
            maxRedirects: 0,
            validateStatus: status => status < 400
        });
        
        console.log(`登录状态: ${loginResponse.status}`);
        
        if (loginResponse.headers['set-cookie']) {
            const cookies = loginResponse.headers['set-cookie'].join('; ');
            console.log('✅ 获取到session cookie');
            
            // 2. 测试具体API端点并获取详细错误信息
            const endpoints = [
                '/api/driver/available-orders',
                '/api/driver/my-orders',
                '/api/driver/status'
            ];
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`\n测试端点: ${endpoint}`);
                    const response = await axios.get(`${baseURL}${endpoint}`, {
                        headers: {
                            'Cookie': cookies,
                            'Content-Type': 'application/json'
                        }
                    });
                    console.log(`✅ ${endpoint}: ${response.status} - ${JSON.stringify(response.data).substring(0, 200)}`);
                } catch (error) {
                    console.log(`❌ ${endpoint}: ${error.response?.status}`);
                    if (error.response?.data) {
                        console.log(`   错误详情: ${JSON.stringify(error.response.data).substring(0, 300)}`);
                    }
                }
            }
            
            // 3. 测试数据库连接
            console.log('\n3. 测试数据库连接状态...');
            try {
                const dbTest = await axios.get(`${baseURL}/api/driver/test-db`, {
                    headers: { 'Cookie': cookies }
                });
                console.log(`✅ 数据库连接测试: ${dbTest.status}`);
            } catch (error) {
                console.log(`❌ 数据库连接测试失败: ${error.response?.status}`);
            }
            
        } else {
            console.log('❌ 未获取到session cookie');
        }
        
    } catch (error) {
        console.error('❌ 调试过程出错:', error.message);
    }
}

// 执行调试
debugAPIErrors().catch(console.error);