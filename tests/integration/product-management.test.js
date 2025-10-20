/**
 * 商品管理 API 測試
 * 測試所有商品相關的 CRUD 操作
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
let testProductId;
let createdProductIds = [];

/**
 * 前置準備：登入並取得管理員 token
 */
async function setup() {
  console.log('\n🔧 Setting up Product Management Tests...\n');
  try {
    adminToken = await login('admin@chengyi.tw', 'Admin123456');
    console.log('✓ Admin logged in successfully\n');
  } catch (error) {
    console.error('✗ Setup failed:', error.message);
    process.exit(1);
  }
}

/**
 * 清理測試數據
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...\n');
  // 清理所有測試建立的商品
  for (const id of createdProductIds) {
    try {
      // 注意：根據路由檔案，沒有 DELETE endpoint，所以我們只標記為不可用
      await request('PATCH', `/admin/products/${id}/toggle`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { isAvailable: false },
      });
    } catch (error) {
      console.log(`Warning: Could not clean up product ${id}`);
    }
  }
}

/**
 * 測試 1: 查詢商品列表（管理員）
 */
async function testListProducts() {
  const response = await request('GET', '/admin/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertNotNull(response.data.data, 'Response should have data');
  Assert.assertTrue(Array.isArray(response.data.data.products), 'Products should be an array');
  Assert.assertNotNull(response.data.data.stats, 'Should include stats');
}

/**
 * 測試 2: 新增商品（固定價格商品）
 */
async function testCreateFixedPriceProduct() {
  const productData = {
    name: `測試商品_${randomString()}`,
    description: '這是一個測試商品',
    category: '測試分類',
    unit: '包',
    price: 100,
    stock: 50,
    isAvailable: true,
    isPricedItem: false,
    sortOrder: 1,
    options: [],
  };

  const response = await request('POST', '/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: productData,
  });

  Assert.assertEquals(response.status, 201, 'Status should be 201');
  Assert.assertNotNull(response.data.data, 'Response should have data');
  Assert.assertEquals(response.data.data.name, productData.name, 'Product name should match');
  Assert.assertEquals(response.data.data.price, productData.price, 'Product price should match');

  testProductId = response.data.data.id;
  createdProductIds.push(testProductId);
}

/**
 * 測試 3: 新增商品（秤重商品）
 */
async function testCreateWeightBasedProduct() {
  const productData = {
    name: `秤重商品_${randomString()}`,
    description: '秤重計價商品',
    category: '葉菜類',
    unit: '斤',
    isPricedItem: true,
    weightPricePerUnit: 120,
    stock: 100,
    isAvailable: true,
    options: [],
  };

  const response = await request('POST', '/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: productData,
  });

  Assert.assertEquals(response.status, 201, 'Status should be 201');
  Assert.assertNotNull(response.data.data, 'Response should have data');
  Assert.assertTrue(response.data.data.isPricedItem, 'Should be a priced item');
  Assert.assertEquals(
    response.data.data.weightPricePerUnit,
    productData.weightPricePerUnit,
    'Weight price should match'
  );

  createdProductIds.push(response.data.data.id);
}

/**
 * 測試 4: 新增商品（含選項）
 */
async function testCreateProductWithOptions() {
  const productData = {
    name: `商品含選項_${randomString()}`,
    description: '包含多種規格選項',
    category: '熱門精選',
    unit: '包',
    price: 180,
    stock: 30,
    isAvailable: true,
    isPricedItem: false,
    options: [
      { name: '小包裝', price: 150 },
      { name: '中包裝', price: 180 },
      { name: '大包裝', price: 250 },
    ],
  };

  const response = await request('POST', '/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: productData,
  });

  Assert.assertEquals(response.status, 201, 'Status should be 201');
  Assert.assertNotNull(response.data.data.options, 'Should have options');
  Assert.assertEquals(response.data.data.options.length, 3, 'Should have 3 options');

  createdProductIds.push(response.data.data.id);
}

/**
 * 測試 5: 更新商品資訊
 */
async function testUpdateProduct() {
  const updateData = {
    name: `已更新商品_${randomString()}`,
    price: 150,
    stock: 60,
    description: '已更新的描述',
  };

  const response = await request('PATCH', `/admin/products/${testProductId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: updateData,
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertEquals(response.data.data.name, updateData.name, 'Name should be updated');
  Assert.assertEquals(response.data.data.price, updateData.price, 'Price should be updated');
  Assert.assertEquals(response.data.data.stock, updateData.stock, 'Stock should be updated');
}

/**
 * 測試 6: 商品上架/下架
 */
async function testToggleProductAvailability() {
  // 下架商品
  let response = await request('PATCH', `/admin/products/${testProductId}/toggle`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { isAvailable: false },
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertFalse(response.data.data.isAvailable, 'Product should be unavailable');

  // 上架商品
  response = await request('PATCH', `/admin/products/${testProductId}/toggle`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { isAvailable: true },
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertTrue(response.data.data.isAvailable, 'Product should be available');
}

/**
 * 測試 7: 批次更新商品（Bulk Upsert）
 */
async function testBulkUpsertProducts() {
  const bulkData = [
    {
      name: `批次商品1_${randomString()}`,
      category: '測試分類',
      unit: '個',
      price: 80,
      stock: 40,
      isAvailable: true,
      isPricedItem: false,
      options: [],
    },
    {
      name: `批次商品2_${randomString()}`,
      category: '測試分類',
      unit: '包',
      price: 120,
      stock: 25,
      isAvailable: true,
      isPricedItem: false,
      options: [],
    },
  ];

  const response = await request('POST', '/admin/products/bulk', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: bulkData,
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertTrue(Array.isArray(response.data.data), 'Response should be an array');
  Assert.assertEquals(response.data.data.length, 2, 'Should create 2 products');

  // 記錄 ID 以便清理
  response.data.data.forEach(product => createdProductIds.push(product.id));
}

/**
 * 測試 8: 商品排序
 */
async function testReorderProducts() {
  // 取得現有商品列表
  const listResponse = await request('GET', '/admin/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const products = listResponse.data.data.products;
  if (products.length < 2) {
    console.log('⚠ Skipping reorder test - need at least 2 products');
    return;
  }

  // 建立新的排序
  const reorderData = products.slice(0, 3).map((p, index) => ({
    id: p.id,
    sortOrder: index + 1,
  }));

  const response = await request('POST', '/admin/products/reorder', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: reorderData,
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
}

/**
 * 測試 9: 同步隔日價格
 */
async function testSyncNextDayPrices() {
  const response = await request('POST', '/admin/products/sync-next-day-prices', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertNotNull(response.data.data, 'Response should have data');
  Assert.assertNotNull(response.data.data.updated, 'Should return updated count');
}

/**
 * 測試 10: 客戶端查詢可用商品
 */
async function testCustomerListAvailableProducts() {
  const response = await request('GET', '/products?onlyAvailable=true');

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertNotNull(response.data.data, 'Response should have data');
  Assert.assertTrue(Array.isArray(response.data.data), 'Products should be an array');

  // 驗證所有商品都是可用的
  const allAvailable = response.data.data.every(p => p.isAvailable === true);
  Assert.assertTrue(allAvailable, 'All products should be available');
}

/**
 * 測試 11: 依分類篩選商品
 */
async function testFilterProductsByCategory() {
  const response = await request('GET', '/products?category=測試分類');

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertTrue(Array.isArray(response.data.data), 'Products should be an array');

  // 驗證所有商品都屬於指定分類
  if (response.data.data.length > 0) {
    const allMatchCategory = response.data.data.every(p => p.category === '測試分類');
    Assert.assertTrue(allMatchCategory, 'All products should match category');
  }
}

/**
 * 測試 12: 關鍵字搜尋商品
 */
async function testSearchProducts() {
  const response = await request('GET', '/products?keyword=測試');

  Assert.assertEquals(response.status, 200, 'Status should be 200');
  Assert.assertTrue(Array.isArray(response.data.data), 'Products should be an array');
}

/**
 * 錯誤場景測試
 */

/**
 * 測試 E1: 新增商品缺少必填欄位
 */
async function testCreateProductMissingFields() {
  const invalidData = {
    name: '無效商品',
    // 缺少 category, unit 等必填欄位
  };

  const response = await request('POST', '/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: invalidData,
  });

  Assert.assertEquals(response.status, 400, 'Should return 400 for invalid data');
}

/**
 * 測試 E2: 固定價商品未提供價格
 */
async function testCreateFixedPriceProductWithoutPrice() {
  const invalidData = {
    name: `無價格商品_${randomString()}`,
    category: '測試',
    unit: '個',
    isPricedItem: false,
    stock: 10,
    options: [],
    // 缺少 price
  };

  const response = await request('POST', '/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: invalidData,
  });

  Assert.assertEquals(response.status, 400, 'Should return 400 for missing price');
}

/**
 * 測試 E3: 秤重商品未提供單位價格
 */
async function testCreateWeightProductWithoutUnitPrice() {
  const invalidData = {
    name: `無單位價商品_${randomString()}`,
    category: '測試',
    unit: '斤',
    isPricedItem: true,
    stock: 10,
    options: [],
    // 缺少 weightPricePerUnit
  };

  const response = await request('POST', '/products', {
    headers: { Authorization: `Bearer ${adminToken}` },
    body: invalidData,
  });

  Assert.assertEquals(response.status, 400, 'Should return 400 for missing weight price');
}

/**
 * 測試 E4: 未授權訪問管理員端點
 */
async function testUnauthorizedAccess() {
  const response = await request('GET', '/admin/products');
  // 沒有提供 token

  Assert.assertEquals(response.status, 401, 'Should return 401 for unauthorized access');
}

/**
 * 主測試執行函數
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        商品管理 API 測試 (Product Management Tests)        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  resetResults();
  await setup();

  console.log('📋 Running Product Management Tests...\n');

  // 基本 CRUD 測試
  await runTest('List products (Admin)', testListProducts);
  await runTest('Create fixed price product', testCreateFixedPriceProduct);
  await runTest('Create weight-based product', testCreateWeightBasedProduct);
  await runTest('Create product with options', testCreateProductWithOptions);
  await runTest('Update product', testUpdateProduct);
  await runTest('Toggle product availability', testToggleProductAvailability);

  // 批次操作測試
  await runTest('Bulk upsert products', testBulkUpsertProducts);
  await runTest('Reorder products', testReorderProducts);
  await runTest('Sync next day prices', testSyncNextDayPrices);

  // 客戶端查詢測試
  await runTest('Customer list available products', testCustomerListAvailableProducts);
  await runTest('Filter products by category', testFilterProductsByCategory);
  await runTest('Search products by keyword', testSearchProducts);

  // 錯誤場景測試
  await runTest('Create product with missing fields [FAIL]', testCreateProductMissingFields);
  await runTest(
    'Create fixed price product without price [FAIL]',
    testCreateFixedPriceProductWithoutPrice
  );
  await runTest(
    'Create weight product without unit price [FAIL]',
    testCreateWeightProductWithoutUnitPrice
  );
  await runTest('Unauthorized access [FAIL]', testUnauthorizedAccess);

  await cleanup();
  printSummary();
}

// 執行測試
main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
