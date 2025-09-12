const axios = require('axios');

async function testDriverSystem() {
    console.log('🧪 开始测试外送员系统...\n');
    
    const baseURL = 'https://chengyivegetable-production-7b4a.up.railway.app';
    
    try {
        // 1. 检查登录页面
        console.log('1. 检查登录页面...');
        const loginPage = await axios.get(`${baseURL}/driver/login`);
        console.log(`✅ 登录页面状态: ${loginPage.status}`);
        
        // 2. 尝试登录
        console.log('\n2. 尝试登录...');
        const loginData = {
            phone: '0912345678',
            password: 'driver123'
        };
        
        const loginResponse = await axios.post(`${baseURL}/driver/login`, loginData, {
            maxRedirects: 0,
            validateStatus: function (status) {
                return status < 400; // 接受所有小于400的状态码
            }
        });
        
        console.log(`登录响应状态: ${loginResponse.status}`);
        
        if (loginResponse.status === 302) {
            const redirectLocation = loginResponse.headers.location;
            console.log(`✅ 登录成功，重定向到: ${redirectLocation}`);
            
            if (redirectLocation === '/driver') {
                console.log('✅ 重定向路径修复成功！');
            } else {
                console.log(`⚠️  重定向到: ${redirectLocation}`);
            }
        } else {
            console.log(`登录响应状态: ${loginResponse.status}`);
        }
        
        // 3. 检查API端点
        console.log('\n3. 检查外送员API端点...');
        
        // 创建带cookie的axios实例
        const axiosWithCookies = axios.create({
            baseURL: baseURL,
            withCredentials: true
        });
        
        // 设置session cookie (如果登录成功的话)
        if (loginResponse.headers['set-cookie']) {
            axiosWithCookies.defaults.headers.Cookie = loginResponse.headers['set-cookie'].join('; ');
        }
        
        try {
            const availableOrders = await axiosWithCookies.get('/api/driver/available-orders');
            console.log(`✅ 可用订单API: ${availableOrders.status} - 订单数量: ${availableOrders.data?.orders?.length || 0}`);
        } catch (apiError) {
            console.log(`❌ 可用订单API错误: ${apiError.response?.status} - ${apiError.message}`);
        }
        
        try {
            const myOrders = await axiosWithCookies.get('/api/driver/my-orders');
            console.log(`✅ 我的订单API: ${myOrders.status} - 订单数量: ${myOrders.data?.orders?.length || 0}`);
        } catch (apiError) {
            console.log(`❌ 我的订单API错误: ${apiError.response?.status} - ${apiError.message}`);
        }
        
    } catch (error) {
        console.error('❌ 测试过程出错:', error.message);
        if (error.response) {
            console.log(`响应状态: ${error.response.status}`);
            console.log('响应数据:', error.response.data?.substring(0, 200));
        }
    }
}

// 执行测试
testDriverSystem().catch(console.error);