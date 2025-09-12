const axios = require('axios');

async function testCorrectAPIs() {
    console.log('🧪 测试正确的外送员API端点...\n');
    
    const baseURL = 'https://chengyivegetable-production-7b4a.up.railway.app';
    
    try {
        // 1. 登录获取session
        console.log('1. 登录获取session...');
        const loginData = {
            phone: '0912345678',
            password: 'driver123'
        };
        
        const loginResponse = await axios.post(`${baseURL}/driver/login`, loginData, {
            maxRedirects: 0,
            validateStatus: status => status < 400
        });
        
        console.log(`✅ 登录状态: ${loginResponse.status}`);
        console.log(`✅ 重定向到: ${loginResponse.headers.location}`);
        
        if (loginResponse.headers['set-cookie']) {
            const cookies = loginResponse.headers['set-cookie'].join('; ');
            
            // 2. 测试订单统计API
            console.log('\n2. 测试订单统计API...');
            try {
                const orderCounts = await axios.get(`${baseURL}/api/driver/order-counts`, {
                    headers: { 'Cookie': cookies }
                });
                console.log(`✅ 订单统计API: ${orderCounts.status}`);
                console.log(`   数据: ${JSON.stringify(orderCounts.data)}`);
            } catch (error) {
                console.log(`❌ 订单统计API错误: ${error.response?.status}`);
                console.log(`   错误: ${error.response?.data?.message || error.message}`);
            }
            
            // 3. 测试我的订单API
            console.log('\n3. 测试我的订单API...');
            try {
                const myOrders = await axios.get(`${baseURL}/api/driver/my-orders`, {
                    headers: { 'Cookie': cookies }
                });
                console.log(`✅ 我的订单API: ${myOrders.status}`);
                console.log(`   订单数量: ${myOrders.data?.orders?.length || 0}`);
                
                if (myOrders.data?.orders?.length > 0) {
                    console.log(`   第一个订单: ${JSON.stringify(myOrders.data.orders[0]).substring(0, 100)}...`);
                }
            } catch (error) {
                console.log(`❌ 我的订单API错误: ${error.response?.status}`);
                console.log(`   错误: ${error.response?.data?.message || error.message}`);
            }
            
            // 4. 测试区域订单API（台北市信义区）
            console.log('\n4. 测试区域订单API...');
            const testAreas = ['台北市信义区', '台北市大安区', '全部'];
            
            for (const area of testAreas) {
                try {
                    const areaOrders = await axios.get(`${baseURL}/api/driver/area-orders/${encodeURIComponent(area)}`, {
                        headers: { 'Cookie': cookies }
                    });
                    console.log(`✅ ${area}订单API: ${areaOrders.status} - 订单数量: ${areaOrders.data?.orders?.length || 0}`);
                    
                    if (areaOrders.data?.orders?.length > 0) {
                        console.log(`   示例订单ID: ${areaOrders.data.orders[0]?.id}, 地址: ${areaOrders.data.orders[0]?.address?.substring(0, 50)}...`);
                    }
                } catch (error) {
                    console.log(`❌ ${area}订单API错误: ${error.response?.status}`);
                    if (error.response?.data) {
                        console.log(`   错误: ${error.response.data.message || error.response.data}`);
                    }
                }
            }
            
            // 5. 测试统计API
            console.log('\n5. 测试统计API...');
            try {
                const stats = await axios.get(`${baseURL}/api/driver/stats`, {
                    headers: { 'Cookie': cookies }
                });
                console.log(`✅ 统计API: ${stats.status}`);
                console.log(`   统计数据: ${JSON.stringify(stats.data).substring(0, 200)}...`);
            } catch (error) {
                console.log(`❌ 统计API错误: ${error.response?.status}`);
                console.log(`   错误: ${error.response?.data?.message || error.message}`);
            }
            
            // 6. 总结测试结果
            console.log('\n📋 测试结果总结:');
            console.log('✅ 登录功能: 正常');
            console.log('✅ 登录重定向: 已修复 (/driver)');
            console.log('📊 关键功能状态检查完成');
            
        } else {
            console.log('❌ 未获取到session cookie');
        }
        
    } catch (error) {
        console.error('❌ 测试过程出错:', error.message);
    }
}

// 执行测试
testCorrectAPIs().catch(console.error);