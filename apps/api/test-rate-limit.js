/**
 * 速率限制測試腳本
 * 用於測試 API 的速率限制功能
 */

const API_URL = 'http://localhost:3000';

async function testLoginRateLimit() {
  console.log('=== 測試登入速率限制 (每 15 分鐘 5 次) ===\n');

  for (let i = 1; i <= 7; i++) {
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
      });

      console.log(`嘗試 ${i}: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        const data = await response.text();
        console.log(`限制訊息: ${data}\n`);
      }
    } catch (error) {
      console.error(`嘗試 ${i} 失敗:`, error.message);
    }
  }
}

async function testOrderRateLimit() {
  console.log('\n=== 測試訂單建立速率限制 (每分鐘 3 次) ===\n');

  for (let i = 1; i <= 5; i++) {
    try {
      const response = await fetch(`${API_URL}/api/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Test User',
          phone: '0912345678',
          items: []
        })
      });

      console.log(`嘗試 ${i}: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        const data = await response.text();
        console.log(`限制訊息: ${data}\n`);
      }
    } catch (error) {
      console.error(`嘗試 ${i} 失敗:`, error.message);
    }
  }
}

async function testGlobalRateLimit() {
  console.log('\n=== 測試全域速率限制 (每 15 分鐘 100 次) ===\n');
  console.log('發送 10 個請求作為範例...\n');

  for (let i = 1; i <= 10; i++) {
    try {
      const response = await fetch(`${API_URL}/api/v1/health`);
      console.log(`請求 ${i}: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.error(`請求 ${i} 失敗:`, error.message);
    }
  }
}

async function main() {
  console.log('開始測試 API 速率限制功能\n');
  console.log('請確保 API 服務器正在運行在 http://localhost:3000\n');
  console.log('========================================\n');

  // 先測試全域限制
  await testGlobalRateLimit();

  // 等待一秒
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 測試登入限制
  await testLoginRateLimit();

  // 等待一秒
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 測試訂單限制
  await testOrderRateLimit();

  console.log('\n========================================');
  console.log('測試完成！');
  console.log('\n預期結果:');
  console.log('1. 登入第 6-7 次嘗試應該返回 429 錯誤');
  console.log('2. 訂單建立第 4-5 次嘗試應該返回 429 錯誤');
  console.log('3. 全域請求在 100 次內應該都正常');
}

main().catch(console.error);
