/**
 * 端到端業務流程測試
 * 測試完整的業務場景從頭到尾的運作
 */

import {
  request,
  login,
  Assert,
  runTest,
  printSummary,
  resetResults,
  randomString,
  sleep,
} from './test-utils.js';

// 測試數據
let adminToken;
let driverToken;
const testData = {
  products: [],
  orders: [],
  customers: [],
};

/**
 * 前置準備
 */
async function setup() {
  console.log('\n🔧 Setting up E2E Flow Tests...\n');
  try {
    adminToken = await login('admin@chengyi.tw', 'Admin123456');
    driverToken = await login('driver@chengyi.tw', 'Driver123456');
    console.log('✓ Admin and Driver logged in successfully\n');
  } catch (error) {
    console.error('✗ Setup failed:', error.message);
    process.exit(1);
  }
}

/**
 * 流程 1: 完整的商品上架流程
 * 步驟：
 * 1. 管理員新增商品
 * 2. 設定商品選項
 * 3. 設定初始庫存
 * 4. 上架商品
 * 5. 驗證客戶端可見
 */
async function testFlow1_ProductOnboarding() {
  console.log('\n  📦 Flow 1: Product Onboarding\n');

  // Step 1: 管理員新增商品
  const productData = {
    name: `精選有機蔬菜_${randomString()}`,
    description: '新鮮有機，產地直送',
    category: '有機蔬菜',
    unit: '包',
    price: 150,
    stock: 50,
    isAvailable: false, // 先設為不可用
    isPricedItem: false,
    sortOrder: 1,
    options: [
      { name: '小包（500g）', price: 120 },
      { name: '中包（1kg）', price: 150 },
      { name: '大包（2kg）', price: 280 },
    ],
  };

  const createResponse = await request('POST', '/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: productData,
  });

  Assert.assertEquals(createResponse.status, 201, 'Product should be created');
  const product = createResponse.data.data;
  testData.products.push(product);

  console.log(`    ✓ Step 1: Product created (ID: ${product.id})`);

  // Step 2: 驗證商品選項
  Assert.assertEquals(product.options.length, 3, 'Should have 3 options');
  console.log('    ✓ Step 2: Product options configured');

  // Step 3: 驗證初始庫存
  Assert.assertEquals(product.stock, 50, 'Initial stock should be 50');
  console.log('    ✓ Step 3: Initial stock set');

  // Step 4: 上架商品
  const toggleResponse = await request('PATCH', `/admin/products/${product.id}/toggle`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { isAvailable: true },
  });

  Assert.assertTrue(toggleResponse.data.data.isAvailable, 'Product should be available');
  console.log('    ✓ Step 4: Product published');

  // Step 5: 驗證客戶端可見
  const customerView = await request('GET', '/products?onlyAvailable=true');
  const visibleProduct = customerView.data.data.find(p => p.id === product.id);

  Assert.assertNotNull(visibleProduct, 'Product should be visible to customers');
  console.log('    ✓ Step 5: Product visible to customers\n');
}

/**
 * 流程 2: 完整的客戶下單流程
 * 步驟：
 * 1. 客戶瀏覽商品列表
 * 2. 選擇商品和數量
 * 3. 確認價格和運費
 * 4. 提交訂單
 * 5. 驗證訂單建立成功
 * 6. 驗證庫存減少
 */
async function testFlow2_CustomerCheckout() {
  console.log('\n  🛒 Flow 2: Customer Checkout\n');

  // Step 1: 客戶瀏覽商品
  const browseResponse = await request('GET', '/products?onlyAvailable=true');
  Assert.assertTrue(browseResponse.data.data.length > 0, 'Should have available products');
  console.log(`    ✓ Step 1: Customer browsed ${browseResponse.data.data.length} products`);

  // 選擇一個測試商品
  const selectedProduct =
    testData.products.length > 0 ? testData.products[0] : browseResponse.data.data[0];

  // Step 2: 選擇商品和數量
  const quantity = 3;
  const unitPrice = selectedProduct.price;
  const lineTotal = unitPrice * quantity;
  console.log(`    ✓ Step 2: Selected ${quantity}x ${selectedProduct.name}`);

  // Step 3: 計算價格和運費
  const subtotal = lineTotal;
  const deliveryFee = subtotal >= 200 ? 0 : 60;
  const totalAmount = subtotal + deliveryFee;
  console.log(
    `    ✓ Step 3: Calculated total: $${totalAmount} (Subtotal: $${subtotal}, Delivery: $${deliveryFee})`
  );

  // Step 4: 提交訂單
  const orderData = {
    contactName: `客戶_${randomString()}`,
    contactPhone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    address: `台北市大安區測試路${Math.floor(Math.random() * 500)}號`,
    paymentMethod: 'cash',
    items: [
      {
        productId: selectedProduct.id,
        name: selectedProduct.name,
        quantity,
        unit: selectedProduct.unit,
        unitPrice,
        lineTotal,
      },
    ],
    subtotal,
    deliveryFee,
    totalAmount,
  };

  const orderResponse = await request('POST', '/orders', {
    body: orderData,
  });

  Assert.assertEquals(orderResponse.status, 201, 'Order should be created');
  const order = orderResponse.data.data;
  testData.orders.push(order);
  console.log(`    ✓ Step 4: Order submitted (ID: ${order.id})`);

  // Step 5: 驗證訂單建立成功
  Assert.assertEquals(order.status, 'pending', 'Order status should be pending');
  Assert.assertEquals(order.totalAmount, totalAmount, 'Total amount should match');
  console.log('    ✓ Step 5: Order created successfully');

  // Step 6: 驗證庫存減少
  const productAfter = await request('GET', `/admin/products`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const updatedProduct = productAfter.data.data.products.find(p => p.id === selectedProduct.id);
  Assert.assertEquals(
    updatedProduct.stock,
    selectedProduct.stock - quantity,
    'Stock should be reduced'
  );
  console.log(`    ✓ Step 6: Stock reduced (${selectedProduct.stock} → ${updatedProduct.stock})\n`);
}

/**
 * 流程 3: 完整的訂單處理流程
 * 步驟：
 * 1. 管理員查看新訂單
 * 2. 管理員確認訂單（pending → preparing）
 * 3. 備貨完成（preparing → ready）
 * 4. 司機接單（ready → delivering）
 * 5. 司機送達（delivering → delivered）
 * 6. 驗證訂單歷史記錄
 */
async function testFlow3_OrderProcessing() {
  console.log('\n  📋 Flow 3: Order Processing\n');

  // 先建立一個測試訂單
  const product = testData.products[0];
  const orderData = {
    contactName: '流程測試客戶',
    contactPhone: '0912121212',
    address: '新北市中和區測試路321號',
    paymentMethod: 'transfer',
    items: [
      {
        productId: product.id,
        name: product.name,
        quantity: 2,
        unit: product.unit,
        unitPrice: product.price,
        lineTotal: product.price * 2,
      },
    ],
    subtotal: product.price * 2,
    deliveryFee: 0,
    totalAmount: product.price * 2,
  };

  const createResponse = await request('POST', '/orders', { body: orderData });
  const orderId = createResponse.data.data.id;
  console.log(`    ✓ Test order created (ID: ${orderId})`);

  // Step 1: 管理員查看新訂單
  const allOrders = await request('GET', '/admin/orders', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const newOrder = allOrders.data.data.find(o => o.id === orderId);
  Assert.assertNotNull(newOrder, 'Admin should see the new order');
  console.log('    ✓ Step 1: Admin viewed new orders');

  // Step 2: 確認訂單
  await sleep(100);
  const confirmResponse = await request('PATCH', `/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'preparing', reason: '訂單已確認，開始備貨' },
  });
  Assert.assertEquals(confirmResponse.data.data.status, 'preparing', 'Status should be preparing');
  console.log('    ✓ Step 2: Order confirmed (pending → preparing)');

  // Step 3: 備貨完成
  await sleep(100);
  const readyResponse = await request('PATCH', `/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'ready', reason: '備貨完成，等待配送' },
  });
  Assert.assertEquals(readyResponse.data.data.status, 'ready', 'Status should be ready');
  console.log('    ✓ Step 3: Order ready (preparing → ready)');

  // Step 4: 司機接單
  await sleep(100);
  const deliverResponse = await request('PATCH', `/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${driverToken}` },
    body: { status: 'delivering', reason: '司機已接單，配送中' },
  });
  Assert.assertEquals(
    deliverResponse.data.data.status,
    'delivering',
    'Status should be delivering'
  );
  Assert.assertNotNull(deliverResponse.data.data.driverId, 'Should have driver assigned');
  console.log('    ✓ Step 4: Driver claimed order (ready → delivering)');

  // Step 5: 送達完成
  await sleep(100);
  const deliveredResponse = await request('PATCH', `/orders/${orderId}/status`, {
    headers: { Authorization: `Bearer ${driverToken}` },
    body: { status: 'delivered', reason: '訂單已送達客戶手中' },
  });
  Assert.assertEquals(
    deliveredResponse.data.data.status,
    'delivered',
    'Status should be delivered'
  );
  console.log('    ✓ Step 5: Order delivered (delivering → delivered)');

  // Step 6: 驗證訂單歷史
  const historyResponse = await request('GET', `/orders/${orderId}/history`);
  const history = historyResponse.data.data;
  Assert.assertGreaterThan(history.length, 4, 'Should have at least 5 history entries');

  const statuses = history.map(h => h.status);
  Assert.assertContains(statuses, 'pending', 'History should contain pending');
  Assert.assertContains(statuses, 'preparing', 'History should contain preparing');
  Assert.assertContains(statuses, 'ready', 'History should contain ready');
  Assert.assertContains(statuses, 'delivering', 'History should contain delivering');
  Assert.assertContains(statuses, 'delivered', 'History should contain delivered');
  console.log(`    ✓ Step 6: Order history verified (${history.length} entries)\n`);
}

/**
 * 流程 4: 庫存管理流程
 * 步驟：
 * 1. 檢查當前庫存
 * 2. 下單扣減庫存
 * 3. 驗證庫存更新
 * 4. 補充庫存
 * 5. 驗證庫存補充成功
 */
async function testFlow4_InventoryManagement() {
  console.log('\n  📊 Flow 4: Inventory Management\n');

  const product = testData.products[0];

  // Step 1: 檢查當前庫存
  const checkResponse = await request('GET', '/admin/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const currentProduct = checkResponse.data.data.products.find(p => p.id === product.id);
  const initialStock = currentProduct.stock;
  console.log(`    ✓ Step 1: Current stock checked: ${initialStock}`);

  // Step 2: 下單扣減庫存
  const orderQuantity = 5;
  const orderData = {
    contactName: '庫存測試客戶',
    contactPhone: '0913131313',
    address: '測試地址',
    paymentMethod: 'cash',
    items: [
      {
        productId: product.id,
        name: product.name,
        quantity: orderQuantity,
        unit: product.unit,
        unitPrice: product.price,
        lineTotal: product.price * orderQuantity,
      },
    ],
    subtotal: product.price * orderQuantity,
    deliveryFee: 0,
    totalAmount: product.price * orderQuantity,
  };

  await request('POST', '/orders', { body: orderData });
  console.log(`    ✓ Step 2: Order placed (quantity: ${orderQuantity})`);

  // Step 3: 驗證庫存更新
  const afterOrderResponse = await request('GET', '/admin/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const afterOrderProduct = afterOrderResponse.data.data.products.find(p => p.id === product.id);
  const stockAfterOrder = afterOrderProduct.stock;
  Assert.assertEquals(
    stockAfterOrder,
    initialStock - orderQuantity,
    'Stock should be reduced by order quantity'
  );
  console.log(`    ✓ Step 3: Stock reduced (${initialStock} → ${stockAfterOrder})`);

  // Step 4: 補充庫存
  const replenishQuantity = 20;
  const updateResponse = await request('PATCH', `/admin/products/${product.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { stock: stockAfterOrder + replenishQuantity },
  });
  console.log(`    ✓ Step 4: Stock replenished (+${replenishQuantity})`);

  // Step 5: 驗證庫存補充成功
  const finalStock = updateResponse.data.data.stock;
  Assert.assertEquals(finalStock, stockAfterOrder + replenishQuantity, 'Stock should be increased');
  console.log(`    ✓ Step 5: Final stock verified: ${finalStock}\n`);
}

/**
 * 流程 5: 多商品訂單流程
 * 步驟：
 * 1. 客戶選擇多個商品
 * 2. 計算總金額和運費
 * 3. 提交訂單
 * 4. 驗證所有商品庫存都被扣減
 * 5. 驗證訂單詳情正確
 */
async function testFlow5_MultiProductOrder() {
  console.log('\n  🛍️ Flow 5: Multi-Product Order\n');

  // Step 1: 選擇多個商品
  const productsResponse = await request('GET', '/products?onlyAvailable=true');
  const availableProducts = productsResponse.data.data;

  if (availableProducts.length < 2) {
    console.log('    ⚠ Need at least 2 products for this test');
    return;
  }

  const selectedProducts = availableProducts.slice(0, 3);
  console.log(`    ✓ Step 1: Selected ${selectedProducts.length} products`);

  // 記錄初始庫存
  const initialStocks = {};
  for (const product of selectedProducts) {
    initialStocks[product.id] = product.stock;
  }

  // Step 2: 計算總金額
  const items = selectedProducts.map(product => ({
    productId: product.id,
    name: product.name,
    quantity: 2,
    unit: product.unit,
    unitPrice: product.price,
    lineTotal: product.price * 2,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = subtotal >= 200 ? 0 : 60;
  const totalAmount = subtotal + deliveryFee;
  console.log(`    ✓ Step 2: Calculated total: $${totalAmount} (${items.length} items)`);

  // Step 3: 提交訂單
  const orderData = {
    contactName: '多商品測試客戶',
    contactPhone: '0914141414',
    address: '台北市信義區測試路456號',
    paymentMethod: 'line_pay',
    items,
    subtotal,
    deliveryFee,
    totalAmount,
  };

  const orderResponse = await request('POST', '/orders', { body: orderData });
  Assert.assertEquals(orderResponse.status, 201, 'Order should be created');
  console.log(`    ✓ Step 3: Multi-product order created`);

  // Step 4: 驗證所有商品庫存都被扣減
  const afterResponse = await request('GET', '/admin/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  let allStocksReduced = true;
  for (const product of selectedProducts) {
    const updated = afterResponse.data.data.products.find(p => p.id === product.id);
    if (updated.stock !== initialStocks[product.id] - 2) {
      allStocksReduced = false;
    }
  }
  Assert.assertTrue(allStocksReduced, 'All product stocks should be reduced');
  console.log('    ✓ Step 4: All product stocks reduced correctly');

  // Step 5: 驗證訂單詳情
  const order = orderResponse.data.data;
  Assert.assertEquals(order.items.length, items.length, 'Order should have all items');
  Assert.assertEquals(order.totalAmount, totalAmount, 'Total amount should match');
  console.log(`    ✓ Step 5: Order details verified (${order.items.length} items)\n`);
}

/**
 * 流程 6: 訂單搜尋和查詢流程
 * 步驟：
 * 1. 客戶建立訂單
 * 2. 依電話號碼搜尋訂單
 * 3. 查詢訂單詳情
 * 4. 查詢訂單歷史
 * 5. 驗證所有資訊一致
 */
async function testFlow6_OrderQueryFlow() {
  console.log('\n  🔍 Flow 6: Order Query Flow\n');

  const product = testData.products[0];
  const phoneNumber = '0915151515';

  // Step 1: 建立訂單
  const orderData = {
    contactName: '查詢測試客戶',
    contactPhone: phoneNumber,
    address: '台北市松山區測試路789號',
    paymentMethod: 'credit',
    items: [
      {
        productId: product.id,
        name: product.name,
        quantity: 1,
        unit: product.unit,
        unitPrice: product.price,
        lineTotal: product.price,
      },
    ],
    subtotal: product.price,
    deliveryFee: 60,
    totalAmount: product.price + 60,
  };

  const createResponse = await request('POST', '/orders', { body: orderData });
  const orderId = createResponse.data.data.id;
  console.log(`    ✓ Step 1: Order created (ID: ${orderId})`);

  // Step 2: 依電話號碼搜尋
  const searchResponse = await request('GET', `/orders/search?phone=${phoneNumber}`);
  Assert.assertTrue(searchResponse.data.data.length > 0, 'Should find orders');
  const foundOrder = searchResponse.data.data.find(o => o.id === orderId);
  Assert.assertNotNull(foundOrder, 'Should find the created order');
  console.log(`    ✓ Step 2: Order found by phone (${searchResponse.data.data.length} results)`);

  // Step 3: 查詢訂單詳情
  const detailResponse = await request('GET', `/orders/${orderId}`);
  Assert.assertEquals(detailResponse.data.data.id, orderId, 'Order ID should match');
  Assert.assertEquals(detailResponse.data.data.contactPhone, phoneNumber, 'Phone should match');
  console.log('    ✓ Step 3: Order details retrieved');

  // Step 4: 查詢訂單歷史
  const historyResponse = await request('GET', `/orders/${orderId}/history`);
  Assert.assertTrue(historyResponse.data.data.length > 0, 'Should have history');
  console.log(
    `    ✓ Step 4: Order history retrieved (${historyResponse.data.data.length} entries)`
  );

  // Step 5: 驗證資訊一致性
  Assert.assertEquals(foundOrder.id, detailResponse.data.data.id, 'IDs should match');
  Assert.assertEquals(
    foundOrder.totalAmount,
    detailResponse.data.data.totalAmount,
    'Amounts should match'
  );
  console.log('    ✓ Step 5: All information consistent\n');
}

/**
 * 主測試執行函數
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        端到端業務流程測試 (E2E Flow Tests)                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  resetResults();
  await setup();

  console.log('🔄 Running End-to-End Flow Tests...\n');

  await runTest('Flow 1: Product Onboarding', testFlow1_ProductOnboarding);
  await runTest('Flow 2: Customer Checkout', testFlow2_CustomerCheckout);
  await runTest('Flow 3: Order Processing', testFlow3_OrderProcessing);
  await runTest('Flow 4: Inventory Management', testFlow4_InventoryManagement);
  await runTest('Flow 5: Multi-Product Order', testFlow5_MultiProductOrder);
  await runTest('Flow 6: Order Query Flow', testFlow6_OrderQueryFlow);

  printSummary();

  console.log('\n📊 Test Data Summary:');
  console.log(`   Products Created: ${testData.products.length}`);
  console.log(`   Orders Created: ${testData.orders.length}`);
  console.log('');
}

// 執行測試
main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
