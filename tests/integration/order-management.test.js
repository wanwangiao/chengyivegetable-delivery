/**
 * 訂單管理 API 測試
 * 測試所有訂單相關的操作
 */

import {
  request,
  login,
  Assert,
  runTest,
  printSummary,
  resetResults,
  randomString,
} from './test-utils.js';

// 測試數據
let adminToken;
let driverToken;
let testOrderId;
let testProductId;
let testProduct;

/**
 * 前置準備
 */
async function setup() {
  console.log('\n🔧 Setting up Order Management Tests...\n');
  try {
    // 登入管理員和司機
    adminToken = await login('admin@chengyi.tw', 'Admin123456');
    driverToken = await login('driver@chengyi.tw', 'Driver123456');
    console.log('✓ Admin and Driver logged in successfully');

    // 建立測試用商品
    const productData = {
      name: `測試訂單商品_${randomString()}`,
      category: '測試分類',
      unit: '包',
      price: 100,
      stock: 1000, // 足夠的庫存
      isAvailable: true,
      isPricedItem: false,
      options: [],
    };

    const productResponse = await request('POST', '/products', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: productData,
    });

    testProduct = productResponse.data.data;
    testProductId = testProduct.id;
    console.log(`✓ Test product created: ${testProductId}\n`);
  } catch (error) {
    console.error('✗ Setup failed:', error.message);
    process.exit(1);
  }
}

/**
 * 測試 1: 客戶下單
 */
async function testCreateOrder() {
  const orderData = {
    contactName: '測試客戶',
    contactPhone: '0912345678',
    address: '台北市中正區測試路123號',
    paymentMethod: 'cash',
    items: [
      {
        productId: testProductId,
        name: testProduct.name,
        quantity: 2,
        unit: testProduct.unit,
        unitPrice: testProduct.price,
        lineTotal: testProduct.price * 2,
      },
    ],
    subtotal: testProduct.price * 2,
    deliveryFee: 0, // 假設超過200免運
    totalAmount: testProduct.price * 2,
  };

  const response = await request('POST', '/orders', {
    body: orderData,
  });

  Assert.assertEquals(response.status, 201, 'Status should be 201');
  Assert.assertNotNull(response.data.data, 'Response should have data');
  Assert.assertEquals(
    response.data.data.contactName,
    orderData.contactName,
    'Contact name should match'
  );
  Assert.assertEquals(response.data.data.status, 'pending', 'Initial status should be pending');
  Assert.assertNotNull(response.data.data.id, 'Should have order ID');

  testOrderId = response.data.data.id;
}

/**
 * 測試 2: 查詢訂單詳情
 */
async function testGetOrderStatus() {
  const response = await request('GET', `/orders/${testOrderId}`);

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertNotNull(response.data.data, 'Response should have data');
  Assert.assertEquals(response.data.data.id, testOrderId, 'Order ID should match');
}

/**
 * 測試 3: 依電話號碼搜尋訂單
 */
async function testSearchOrdersByPhone() {
  const response = await request('GET', '/orders/search?phone=0912345678');

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertTrue(Array.isArray(response.data.data), 'Should return an array');
  Assert.assertGreaterThan(response.data.data.length, 0, 'Should find at least one order');
}

/**
 * 測試 4: 查詢訂單歷史
 */
async function testGetOrderHistory() {
  const response = await request('GET', `/orders/${testOrderId}/history`);

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertTrue(Array.isArray(response.data.data), 'Should return an array');
  Assert.assertGreaterThan(response.data.data.length, 0, 'Should have at least one history entry');
}

/**
 * 測試 5: 管理員查詢所有訂單
 */
async function testAdminListOrders() {
  const response = await request('GET', '/admin/orders', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertTrue(Array.isArray(response.data.data), 'Should return an array');
}

/**
 * 測試 6: 管理員/司機更新訂單狀態 - pending to preparing
 */
async function testUpdateOrderStatusToPreparing() {
  const response = await request('PATCH', `/orders/${testOrderId}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'preparing',
      reason: '開始準備訂單',
    },
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertEquals(response.data.data.status, 'preparing', 'Status should be preparing');
}

/**
 * 測試 7: 更新訂單狀態 - preparing to ready
 */
async function testUpdateOrderStatusToReady() {
  const response = await request('PATCH', `/orders/${testOrderId}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'ready',
      reason: '訂單已備妥',
    },
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertEquals(response.data.data.status, 'ready', 'Status should be ready');
}

/**
 * 測試 8: 司機接單並更新狀態 - ready to delivering
 */
async function testDriverClaimAndDeliver() {
  const response = await request('PATCH', `/orders/${testOrderId}/status`, {
    headers: { Authorization: `Bearer ${driverToken}` },
    body: {
      status: 'delivering',
      reason: '司機已接單開始配送',
    },
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertEquals(response.data.data.status, 'delivering', 'Status should be delivering');
  Assert.assertNotNull(response.data.data.driverId, 'Should have driver assigned');
}

/**
 * 測試 9: 司機標記訂單已送達 - delivering to delivered
 */
async function testDriverMarkDelivered() {
  const response = await request('PATCH', `/orders/${testOrderId}/status`, {
    headers: { Authorization: `Bearer ${driverToken}` },
    body: {
      status: 'delivered',
      reason: '訂單已送達',
    },
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertEquals(response.data.data.status, 'delivered', 'Status should be delivered');
}

/**
 * 測試 10: 建立訂單並測試庫存扣減
 */
async function testOrderCreationReducesStock() {
  // 先查詢當前庫存
  const productBefore = await request('GET', `/admin/products`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const product = productBefore.data.data.products.find(p => p.id === testProductId);
  const stockBefore = product.stock;

  // 下單
  const orderData = {
    contactName: '庫存測試客戶',
    contactPhone: '0987654321',
    address: '台北市測試區',
    paymentMethod: 'cash',
    items: [
      {
        productId: testProductId,
        name: testProduct.name,
        quantity: 5,
        unit: testProduct.unit,
        unitPrice: testProduct.price,
        lineTotal: testProduct.price * 5,
      },
    ],
    subtotal: testProduct.price * 5,
    deliveryFee: 0,
    totalAmount: testProduct.price * 5,
  };

  await request('POST', '/orders', {
    body: orderData,
  });

  // 再次查詢庫存
  const productAfter = await request('GET', `/admin/products`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const productUpdated = productAfter.data.data.products.find(p => p.id === testProductId);
  const stockAfter = productUpdated.stock;

  Assert.assertEquals(stockAfter, stockBefore - 5, 'Stock should be reduced by order quantity');
}

/**
 * 錯誤場景測試
 */

/**
 * 測試 E1: 訂單金額計算錯誤
 */
async function testOrderWithWrongTotalAmount() {
  const orderData = {
    contactName: '錯誤金額測試',
    contactPhone: '0911111111',
    address: '測試地址',
    paymentMethod: 'cash',
    items: [
      {
        productId: testProductId,
        name: testProduct.name,
        quantity: 1,
        unit: testProduct.unit,
        unitPrice: testProduct.price,
        lineTotal: testProduct.price,
      },
    ],
    subtotal: testProduct.price,
    deliveryFee: 0,
    totalAmount: 9999, // 錯誤的總金額
  };

  const response = await request('POST', '/orders', {
    body: orderData,
  });

  Assert.assertEquals(response.status, 400, 'Should return 400 for wrong total amount');
  Assert.assertEquals(
    response.data.error,
    'TOTAL_AMOUNT_MISMATCH',
    'Should indicate total amount mismatch'
  );
}

/**
 * 測試 E2: 商品價格不符
 */
async function testOrderWithWrongPrice() {
  const orderData = {
    contactName: '錯誤價格測試',
    contactPhone: '0922222222',
    address: '測試地址',
    paymentMethod: 'cash',
    items: [
      {
        productId: testProductId,
        name: testProduct.name,
        quantity: 1,
        unit: testProduct.unit,
        unitPrice: 99999, // 錯誤的價格
        lineTotal: 99999,
      },
    ],
    subtotal: 99999,
    deliveryFee: 0,
    totalAmount: 99999,
  };

  const response = await request('POST', '/orders', {
    body: orderData,
  });

  Assert.assertEquals(response.status, 400, 'Should return 400 for wrong price');
  Assert.assertEquals(response.data.error, 'PRICE_MISMATCH', 'Should indicate price mismatch');
}

/**
 * 測試 E3: 庫存不足
 */
async function testOrderWithInsufficientStock() {
  const orderData = {
    contactName: '庫存不足測試',
    contactPhone: '0933333333',
    address: '測試地址',
    paymentMethod: 'cash',
    items: [
      {
        productId: testProductId,
        name: testProduct.name,
        quantity: 999999, // 超過庫存
        unit: testProduct.unit,
        unitPrice: testProduct.price,
        lineTotal: testProduct.price * 999999,
      },
    ],
    subtotal: testProduct.price * 999999,
    deliveryFee: 0,
    totalAmount: testProduct.price * 999999,
  };

  const response = await request('POST', '/orders', {
    body: orderData,
  });

  Assert.assertEquals(response.status, 409, 'Should return 409 for insufficient stock');
  Assert.assertEquals(
    response.data.error,
    'INSUFFICIENT_STOCK',
    'Should indicate insufficient stock'
  );
}

/**
 * 測試 E4: 無效的訂單狀態轉換
 */
async function testInvalidStatusTransition() {
  // 創建一個新訂單
  const orderData = {
    contactName: '狀態轉換測試',
    contactPhone: '0944444444',
    address: '測試地址',
    paymentMethod: 'cash',
    items: [
      {
        productId: testProductId,
        name: testProduct.name,
        quantity: 1,
        unit: testProduct.unit,
        unitPrice: testProduct.price,
        lineTotal: testProduct.price,
      },
    ],
    subtotal: testProduct.price,
    deliveryFee: 60,
    totalAmount: testProduct.price + 60,
  };

  const createResponse = await request('POST', '/orders', {
    body: orderData,
  });

  const orderId = createResponse.data.data.id;

  // 嘗試從 pending 直接跳到 delivered（無效）
  const response = await request('PATCH', `/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'delivered',
      reason: '嘗試無效的狀態轉換',
    },
  });

  Assert.assertEquals(response.status, 400, 'Should return 400 for invalid transition');
  Assert.assertEquals(
    response.data.error,
    'INVALID_STATUS_TRANSITION',
    'Should indicate invalid transition'
  );
}

/**
 * 測試 E5: 運費計算錯誤
 */
async function testOrderWithWrongDeliveryFee() {
  const orderData = {
    contactName: '運費錯誤測試',
    contactPhone: '0955555555',
    address: '測試地址',
    paymentMethod: 'cash',
    items: [
      {
        productId: testProductId,
        name: testProduct.name,
        quantity: 1,
        unit: testProduct.unit,
        unitPrice: testProduct.price,
        lineTotal: testProduct.price,
      },
    ],
    subtotal: testProduct.price, // 假設 100
    deliveryFee: 999, // 錯誤的運費（應該是 60 或 0）
    totalAmount: testProduct.price + 999,
  };

  const response = await request('POST', '/orders', {
    body: orderData,
  });

  Assert.assertEquals(response.status, 400, 'Should return 400 for wrong delivery fee');
  Assert.assertEquals(
    response.data.error,
    'DELIVERY_FEE_MISMATCH',
    'Should indicate delivery fee mismatch'
  );
}

/**
 * 測試 E6: 訂單不存在
 */
async function testOrderNotFound() {
  const fakeOrderId = '00000000-0000-0000-0000-000000000000';
  const response = await request('GET', `/orders/${fakeOrderId}`);

  Assert.assertEquals(response.status, 404, 'Should return 404 for non-existent order');
}

/**
 * 主測試執行函數
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        訂單管理 API 測試 (Order Management Tests)          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  resetResults();
  await setup();

  console.log('📋 Running Order Management Tests...\n');

  // 基本訂單流程測試
  await runTest('Create order', testCreateOrder);
  await runTest('Get order status', testGetOrderStatus);
  await runTest('Search orders by phone', testSearchOrdersByPhone);
  await runTest('Get order history', testGetOrderHistory);
  await runTest('Admin list all orders', testAdminListOrders);

  // 訂單狀態流程測試
  await runTest('Update order status to preparing', testUpdateOrderStatusToPreparing);
  await runTest('Update order status to ready', testUpdateOrderStatusToReady);
  await runTest('Driver claim and deliver', testDriverClaimAndDeliver);
  await runTest('Driver mark delivered', testDriverMarkDelivered);

  // 庫存整合測試
  await runTest('Order creation reduces stock', testOrderCreationReducesStock);

  // 錯誤場景測試
  await runTest('Order with wrong total amount [FAIL]', testOrderWithWrongTotalAmount);
  await runTest('Order with wrong price [FAIL]', testOrderWithWrongPrice);
  await runTest('Order with insufficient stock [FAIL]', testOrderWithInsufficientStock);
  await runTest('Invalid status transition [FAIL]', testInvalidStatusTransition);
  await runTest('Order with wrong delivery fee [FAIL]', testOrderWithWrongDeliveryFee);
  await runTest('Order not found [FAIL]', testOrderNotFound);

  printSummary();
}

// 執行測試
main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
