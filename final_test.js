const axios = require('axios');

async function finalComprehensiveTest() {
    console.log('🏁 最终综合测试：外送员系统功能验证\n');
    console.log('=' .repeat(60));
    
    const baseURL = 'https://chengyivegetable-production-7b4a.up.railway.app';
    let testResults = {
        login: false,
        redirect: false,
        orderCounts: false,
        myOrders: false,
        areaOrders: false,
        stats: false
    };
    
    try {
        // 1. 登录测试
        console.log('1️⃣  登录功能测试');
        console.log('-'.repeat(30));
        
        const loginData = {
            phone: '0912345678',
            password: 'driver123'
        };
        
        const loginResponse = await axios.post(`${baseURL}/driver/login`, loginData, {
            maxRedirects: 0,
            validateStatus: status => status < 400
        });
        
        if (loginResponse.status === 302) {
            console.log('✅ 登录成功');
            testResults.login = true;
            
            const redirectLocation = loginResponse.headers.location;
            console.log(`📍 重定向位置: ${redirectLocation}`);
            
            if (redirectLocation === '/driver') {
                console.log('✅ 重定向路径正确 (已从/driver/dashboard修复为/driver)');
                testResults.redirect = true;
            } else {
                console.log('❌ 重定向路径不正确');
            }
        } else {
            console.log('❌ 登录失败');
        }
        
        if (loginResponse.headers['set-cookie']) {
            const cookies = loginResponse.headers['set-cookie'].join('; ');
            
            // 2. API功能测试
            console.log('\n2️⃣  核心API功能测试');
            console.log('-'.repeat(30));
            
            // 订单统计API
            try {
                const orderCounts = await axios.get(`${baseURL}/api/driver/order-counts`, {
                    headers: { 'Cookie': cookies }
                });
                
                if (orderCounts.status === 200 && orderCounts.data.success) {
                    console.log('✅ 订单统计API正常');
                    console.log(`   区域订单数量: ${JSON.stringify(orderCounts.data.counts)}`);
                    testResults.orderCounts = true;
                } else {
                    console.log('❌ 订单统计API异常');
                }
            } catch (error) {
                console.log('❌ 订单统计API错误:', error.response?.data?.message || error.message);
            }
            
            // 我的订单API
            try {
                const myOrders = await axios.get(`${baseURL}/api/driver/my-orders`, {
                    headers: { 'Cookie': cookies }
                });
                
                if (myOrders.status === 200 && myOrders.data.success) {
                    console.log('✅ 我的订单API正常');
                    console.log(`   当前我的订单数量: ${myOrders.data.orders?.length || 0}`);
                    testResults.myOrders = true;
                } else {
                    console.log('❌ 我的订单API异常');
                }
            } catch (error) {
                console.log('❌ 我的订单API错误:', error.response?.data?.message || error.message);
            }
            
            // 区域订单API（使用正确的区域名称）
            const correctAreas = ['三峽區', '樹林區', '鶯歌區', '土城區', '北大特區'];
            let areaTestPassed = false;
            
            for (const area of correctAreas) {
                try {
                    const areaOrders = await axios.get(`${baseURL}/api/driver/area-orders/${encodeURIComponent(area)}`, {
                        headers: { 'Cookie': cookies }
                    });
                    
                    if (areaOrders.status === 200 && areaOrders.data.success) {
                        console.log(`✅ ${area}区域订单API正常 - 订单数: ${areaOrders.data.orders?.length || 0}`);
                        areaTestPassed = true;
                        
                        if (areaOrders.data.orders?.length > 0) {
                            const firstOrder = areaOrders.data.orders[0];
                            console.log(`   示例订单: ID=${firstOrder.id}, 状态=${firstOrder.status}, 地址=${firstOrder.address?.substring(0, 30)}...`);
                        }
                        break; // 只要有一个区域API正常就算通过
                    }
                } catch (error) {
                    // 继续尝试下一个区域
                }
            }
            
            if (areaTestPassed) {
                testResults.areaOrders = true;
            } else {
                console.log('❌ 所有区域订单API都无法正常工作');
            }
            
            // 统计API
            try {
                const stats = await axios.get(`${baseURL}/api/driver/stats`, {
                    headers: { 'Cookie': cookies }
                });
                
                if (stats.status === 200 && stats.data.success) {
                    console.log('✅ 统计API正常');
                    testResults.stats = true;
                } else {
                    console.log('❌ 统计API异常');
                }
            } catch (error) {
                console.log('❌ 统计API错误:', error.response?.data?.message || error.message);
            }
            
            // 3. 功能验证总结
            console.log('\n3️⃣  功能验证总结');
            console.log('=' .repeat(60));
            
            const passedTests = Object.values(testResults).filter(Boolean).length;
            const totalTests = Object.keys(testResults).length;
            
            console.log(`📊 测试通过率: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
            console.log('\n📋 详细测试结果:');
            console.log(`   登录功能: ${testResults.login ? '✅ 通过' : '❌ 失败'}`);
            console.log(`   重定向修复: ${testResults.redirect ? '✅ 通过' : '❌ 失败'}`);
            console.log(`   订单统计: ${testResults.orderCounts ? '✅ 通过' : '❌ 失败'}`);
            console.log(`   我的订单: ${testResults.myOrders ? '✅ 通过' : '❌ 失败'}`);
            console.log(`   区域订单: ${testResults.areaOrders ? '✅ 通过' : '❌ 失败'}`);
            console.log(`   统计功能: ${testResults.stats ? '✅ 通过' : '❌ 失败'}`);
            
            // 4. 实际使用建议
            console.log('\n4️⃣  实际使用建议');
            console.log('-'.repeat(30));
            console.log('🔗 登录地址: https://chengyivegetable-production-7b4a.up.railway.app/driver/login');
            console.log('📱 测试账号: 0912345678');
            console.log('🔐 密码: driver123');
            console.log('\n📝 预期行为:');
            console.log('   1. 使用上述账号登录');
            console.log('   2. 登录成功后自动跳转到 /driver 页面');
            console.log('   3. 页面显示可勾选的订单列表');
            console.log('   4. 勾选订单后订单进入"我的订单"栏');
            console.log('   5. 可以进行路线优化和完成配送等后续操作');
            
            if (passedTests >= 4) {
                console.log('\n🎉 系统修复基本成功！核心功能已可用');
            } else {
                console.log('\n⚠️  系统仍有一些问题需要进一步排查');
            }
            
        } else {
            console.log('❌ 未获取到session，无法进行API测试');
        }
        
    } catch (error) {
        console.error('❌ 测试过程出错:', error.message);
    }
}

// 执行最终测试
finalComprehensiveTest().catch(console.error);