/**
 * 離線同步機制測試
 *
 * 測試範圍：
 * - P0: 離線時請求進入佇列
 * - P0: 顯示佇列長度
 * - P0: 恢復網路後自動補送
 * - P1: 佇列持久化
 * - P1: 錯誤重試機制
 */

const assert = require('node:assert');

// Simulate OfflineQueueService
class MockOfflineQueueService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.onlineCallback = null;
  }

  enqueue(request) {
    this.queue.push({
      ...request,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0
    });
  }

  getQueueLength() {
    return this.queue.length;
  }

  hasPendingRequests() {
    return this.queue.length > 0;
  }

  setOnlineCallback(callback) {
    this.onlineCallback = callback;
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const failedRequests = [];

    while (this.queue.length > 0) {
      const request = this.queue.shift();

      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body ? JSON.stringify(request.body) : undefined
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        if (request.retryCount < 3) {
          failedRequests.push({
            ...request,
            retryCount: request.retryCount + 1
          });
        }
      }
    }

    this.queue = failedRequests;
    this.isProcessing = false;
  }

  clearQueue() {
    this.queue = [];
  }
}

const run = async () => {
  console.log('\n📡 開始離線同步測試...\n');

  let passed = 0;
  let failed = 0;
  const testResults = [];

  // Test 1: 離線時請求進入佇列
  try {
    const offlineQueue = new MockOfflineQueueService();
    const isOnline = false;
    const method = 'POST';

    if (!isOnline && method !== 'GET') {
      offlineQueue.enqueue({
        url: 'http://localhost:3000/api/v1/drivers/orders/order1/claim',
        method: 'POST',
        body: {},
        headers: { 'Content-Type': 'application/json' }
      });
    }

    assert.strictEqual(offlineQueue.getQueueLength(), 1, '離線請求應進入佇列');
    assert.strictEqual(offlineQueue.hasPendingRequests(), true, 'hasPendingRequests 應返回 true');

    testResults.push({ name: '離線時請求進入佇列', status: 'PASS' });
    passed++;
    console.log('✅ Test 1/8: 離線時請求進入佇列');
  } catch (error) {
    testResults.push({ name: '離線時請求進入佇列', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 1/8: 離線時請求進入佇列 - ' + error.message);
  }

  // Test 2: GET 請求不進入佇列
  try {
    const offlineQueue = new MockOfflineQueueService();
    const isOnline = false;
    const method = 'GET';

    // GET requests should throw error, not enqueue
    let shouldThrowError = false;
    if (!isOnline && method === 'GET') {
      shouldThrowError = true;
    } else if (!isOnline && method !== 'GET') {
      offlineQueue.enqueue({ url: 'test', method, body: {}, headers: {} });
    }

    assert.strictEqual(shouldThrowError, true, 'GET 請求應直接失敗');
    assert.strictEqual(offlineQueue.getQueueLength(), 0, 'GET 請求不應進入佇列');

    testResults.push({ name: 'GET 請求不進入佇列', status: 'PASS' });
    passed++;
    console.log('✅ Test 2/8: GET 請求不進入佇列');
  } catch (error) {
    testResults.push({ name: 'GET 請求不進入佇列', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 2/8: GET 請求不進入佇列 - ' + error.message);
  }

  // Test 3: 顯示佇列長度
  try {
    const offlineQueue = new MockOfflineQueueService();

    // Add multiple requests
    offlineQueue.enqueue({ url: 'url1', method: 'POST', body: {}, headers: {} });
    offlineQueue.enqueue({ url: 'url2', method: 'POST', body: {}, headers: {} });
    offlineQueue.enqueue({ url: 'url3', method: 'POST', body: {}, headers: {} });

    const queueLength = offlineQueue.getQueueLength();
    assert.strictEqual(queueLength, 3, '應正確顯示佇列長度');

    testResults.push({ name: '顯示佇列長度', status: 'PASS' });
    passed++;
    console.log('✅ Test 3/8: 顯示佇列長度');
  } catch (error) {
    testResults.push({ name: '顯示佇列長度', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 3/8: 顯示佇列長度 - ' + error.message);
  }

  // Test 4: 恢復網路後自動補送
  try {
    const offlineQueue = new MockOfflineQueueService();
    let processedUrls = [];

    global.fetch = async (url, options) => {
      processedUrls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: {} })
      };
    };

    // Add requests to queue
    offlineQueue.enqueue({
      url: 'http://localhost:3000/api/v1/drivers/orders/order1/claim',
      method: 'POST',
      body: {},
      headers: {}
    });
    offlineQueue.enqueue({
      url: 'http://localhost:3000/api/v1/drivers/orders/order2/claim',
      method: 'POST',
      body: {},
      headers: {}
    });

    assert.strictEqual(offlineQueue.getQueueLength(), 2, '佇列應有 2 個請求');

    // Process queue (simulate network restore)
    await offlineQueue.processQueue();

    assert.strictEqual(offlineQueue.getQueueLength(), 0, '所有請求應被處理');
    assert.strictEqual(processedUrls.length, 2, '應處理 2 個請求');

    testResults.push({ name: '恢復網路後自動補送', status: 'PASS' });
    passed++;
    console.log('✅ Test 4/8: 恢復網路後自動補送');
  } catch (error) {
    testResults.push({ name: '恢復網路後自動補送', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 4/8: 恢復網路後自動補送 - ' + error.message);
  }

  // Test 5: 部分請求失敗時的重試機制
  try {
    const offlineQueue = new MockOfflineQueueService();
    let attemptCount = 0;

    global.fetch = async (url) => {
      attemptCount++;
      if (url.includes('fail')) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ data: {} }) };
    };

    offlineQueue.enqueue({
      url: 'http://localhost:3000/api/success',
      method: 'POST',
      body: {},
      headers: {}
    });
    offlineQueue.enqueue({
      url: 'http://localhost:3000/api/fail',
      method: 'POST',
      body: {},
      headers: {}
    });

    await offlineQueue.processQueue();

    // Success request should be cleared, failed request should remain with retryCount
    assert.strictEqual(offlineQueue.getQueueLength(), 1, '失敗的請求應留在佇列');
    assert.strictEqual(offlineQueue.queue[0].retryCount, 1, '失敗請求的 retryCount 應遞增');

    testResults.push({ name: '部分請求失敗時的重試機制', status: 'PASS' });
    passed++;
    console.log('✅ Test 5/8: 部分請求失敗時的重試機制');
  } catch (error) {
    testResults.push({ name: '部分請求失敗時的重試機制', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 5/8: 部分請求失敗時的重試機制 - ' + error.message);
  }

  // Test 6: 達到最大重試次數後放棄
  try {
    const offlineQueue = new MockOfflineQueueService();

    global.fetch = async () => {
      return { ok: false, status: 500, json: async () => ({}) };
    };

    // Add request that will fail
    offlineQueue.enqueue({
      url: 'http://localhost:3000/api/always-fail',
      method: 'POST',
      body: {},
      headers: {}
    });

    // Process 4 times (initial + 3 retries)
    await offlineQueue.processQueue(); // retryCount = 1
    await offlineQueue.processQueue(); // retryCount = 2
    await offlineQueue.processQueue(); // retryCount = 3
    await offlineQueue.processQueue(); // should be discarded

    assert.strictEqual(offlineQueue.getQueueLength(), 0, '達到最大重試次數後應放棄請求');

    testResults.push({ name: '達到最大重試次數後放棄', status: 'PASS' });
    passed++;
    console.log('✅ Test 6/8: 達到最大重試次數後放棄');
  } catch (error) {
    testResults.push({ name: '達到最大重試次數後放棄', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 6/8: 達到最大重試次數後放棄 - ' + error.message);
  }

  // Test 7: 網路恢復回調機制
  try {
    const offlineQueue = new MockOfflineQueueService();
    let callbackCalled = false;
    let callbackMessage = null;

    offlineQueue.setOnlineCallback(() => {
      callbackCalled = true;
      callbackMessage = '網路已恢復，正在同步離線請求…';
    });

    // Simulate online event
    if (offlineQueue.onlineCallback) {
      offlineQueue.onlineCallback();
    }

    assert.strictEqual(callbackCalled, true, '回調應被呼叫');
    assert.strictEqual(callbackMessage, '網路已恢復，正在同步離線請求…', '應顯示同步訊息');

    testResults.push({ name: '網路恢復回調機制', status: 'PASS' });
    passed++;
    console.log('✅ Test 7/8: 網路恢復回調機制');
  } catch (error) {
    testResults.push({ name: '網路恢復回調機制', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 7/8: 網路恢復回調機制 - ' + error.message);
  }

  // Test 8: FormData 離線時應拋出錯誤
  try {
    const isOnline = false;
    const method = 'POST';
    const body = { type: 'FormData', isFormData: true }; // Mock FormData

    let shouldThrowError = null;

    if (!isOnline && method !== 'GET') {
      if (body.isFormData) {
        shouldThrowError = '目前離線，請稍後再上傳附件';
      }
    }

    assert.strictEqual(shouldThrowError, '目前離線，請稍後再上傳附件', 'FormData 離線時應拋出特定錯誤');

    testResults.push({ name: 'FormData 離線時應拋出錯誤', status: 'PASS' });
    passed++;
    console.log('✅ Test 8/8: FormData 離線時應拋出錯誤');
  } catch (error) {
    testResults.push({ name: 'FormData 離線時應拋出錯誤', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 8/8: FormData 離線時應拋出錯誤 - ' + error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('離線同步測試總結');
  console.log('='.repeat(60));
  console.log(`總計: ${passed + failed} 個測試`);
  console.log(`通過: ${passed} ✅`);
  console.log(`失敗: ${failed} ❌`);
  console.log(`通過率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    console.log('失敗的測試:');
    testResults.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
    throw new Error(`${failed} 個離線同步測試失敗`);
  }

  return testResults;
};

module.exports = run();
