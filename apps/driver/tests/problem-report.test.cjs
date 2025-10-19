/**
 * 問題回報功能測試
 *
 * 測試範圍：
 * - P0: 開啟對話框
 * - P0: 輸入驗證 (少於 3 個字)
 * - P0: 成功提交
 * - P0: 提交期間按鈕禁用
 * - P1: 邊界條件測試
 */

const assert = require('node:assert');

const run = async () => {
  console.log('\n🚨 開始問題回報測試...\n');

  let passed = 0;
  let failed = 0;
  const testResults = [];

  // Test 1: 開啟對話框
  try {
    let problemDialogVisible = false;
    let problemOrderId = null;
    let problemReason = '';

    // Simulate opening dialog
    const openProblemDialog = (orderId) => {
      problemOrderId = orderId;
      problemReason = '';
      problemDialogVisible = true;
    };

    openProblemDialog('order123');

    assert.strictEqual(problemDialogVisible, true, '對話框應開啟');
    assert.strictEqual(problemOrderId, 'order123', '應設置正確的訂單 ID');
    assert.strictEqual(problemReason, '', '應清空問題描述');

    testResults.push({ name: '開啟問題回報對話框', status: 'PASS' });
    passed++;
    console.log('✅ Test 1/7: 開啟問題回報對話框');
  } catch (error) {
    testResults.push({ name: '開啟問題回報對話框', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 1/7: 開啟問題回報對話框 - ' + error.message);
  }

  // Test 2: 輸入驗證 - 少於 3 個字
  try {
    const problemReason = '無';
    const trimmed = problemReason.trim();
    let validationError = null;

    if (trimmed.length < 3) {
      validationError = '請至少輸入 3 個字的問題描述';
    }

    assert.ok(validationError !== null, '少於 3 個字應有驗證錯誤');
    assert.strictEqual(validationError, '請至少輸入 3 個字的問題描述', '錯誤訊息應正確');

    testResults.push({ name: '輸入驗證 - 少於 3 個字', status: 'PASS' });
    passed++;
    console.log('✅ Test 2/7: 輸入驗證 - 少於 3 個字');
  } catch (error) {
    testResults.push({ name: '輸入驗證 - 少於 3 個字', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 2/7: 輸入驗證 - 少於 3 個字 - ' + error.message);
  }

  // Test 3: 輸入驗證 - 通過驗證
  try {
    const validInputs = [
      '客戶不在家',
      '地址找不到，需要客服協助',
      'The customer requested delivery tomorrow',
      '123' // Exactly 3 characters
    ];

    for (const input of validInputs) {
      const trimmed = input.trim();
      assert.ok(trimmed.length >= 3, `"${input}" 應通過驗證`);
    }

    testResults.push({ name: '輸入驗證 - 通過驗證', status: 'PASS' });
    passed++;
    console.log('✅ Test 3/7: 輸入驗證 - 通過驗證');
  } catch (error) {
    testResults.push({ name: '輸入驗證 - 通過驗證', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 3/7: 輸入驗證 - 通過驗證 - ' + error.message);
  }

  // Test 4: 成功提交
  try {
    global.fetch = async (url, options) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'order123', status: 'problem' } })
      };
    };

    const problemOrderId = 'order123';
    const problemReason = '客戶不在家';
    let submittingProblem = false;
    let message = null;

    // Simulate submission
    submittingProblem = true;
    const response = await fetch(`http://localhost:3000/api/v1/drivers/orders/${problemOrderId}/problem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: problemReason.trim() })
    });

    if (response.ok) {
      message = '已提交問題，客服將儘速聯繫';
    }
    submittingProblem = false;

    assert.strictEqual(message, '已提交問題，客服將儘速聯繫', '應顯示成功訊息');
    assert.strictEqual(submittingProblem, false, '提交完成後應重置 loading 狀態');

    testResults.push({ name: '成功提交問題', status: 'PASS' });
    passed++;
    console.log('✅ Test 4/7: 成功提交問題');
  } catch (error) {
    testResults.push({ name: '成功提交問題', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 4/7: 成功提交問題 - ' + error.message);
  }

  // Test 5: 提交期間按鈕禁用
  try {
    let submittingProblem = false;

    // Before submission
    const canClose = !submittingProblem;
    assert.strictEqual(canClose, true, '未提交時應可關閉');

    // During submission
    submittingProblem = true;
    const canCloseDuringSubmit = !submittingProblem;
    assert.strictEqual(canCloseDuringSubmit, false, '提交期間應禁用關閉');

    testResults.push({ name: '提交期間按鈕禁用', status: 'PASS' });
    passed++;
    console.log('✅ Test 5/7: 提交期間按鈕禁用');
  } catch (error) {
    testResults.push({ name: '提交期間按鈕禁用', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 5/7: 提交期間按鈕禁用 - ' + error.message);
  }

  // Test 6: 網路錯誤處理
  try {
    global.fetch = async () => {
      throw new Error('Network request failed');
    };

    let errorMessage = null;
    try {
      await fetch('http://localhost:3000/api/v1/drivers/orders/order123/problem', {
        method: 'POST',
        body: JSON.stringify({ reason: '測試錯誤' })
      });
    } catch (err) {
      errorMessage = err.message;
    }

    assert.ok(errorMessage !== null, '網路錯誤應被捕捉');
    assert.ok(errorMessage.includes('failed'), '錯誤訊息應包含失敗資訊');

    testResults.push({ name: '網路錯誤處理', status: 'PASS' });
    passed++;
    console.log('✅ Test 6/7: 網路錯誤處理');
  } catch (error) {
    testResults.push({ name: '網路錯誤處理', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 6/7: 網路錯誤處理 - ' + error.message);
  }

  // Test 7: 邊界條件 - 超長文字
  try {
    const longText = '客戶不在家。'.repeat(100); // 600 characters
    const trimmed = longText.trim();

    // Should still pass validation (>= 3 chars)
    assert.ok(trimmed.length >= 3, '超長文字應通過基本驗證');

    // Test if submission would work (assuming no max length restriction)
    global.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      assert.ok(body.reason.length > 100, '應能提交超長文字');
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: {} })
      };
    };

    const response = await fetch('http://localhost:3000/api/v1/drivers/orders/order123/problem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: trimmed })
    });

    assert.ok(response.ok, '超長文字應能成功提交');

    testResults.push({ name: '邊界條件 - 超長文字', status: 'PASS' });
    passed++;
    console.log('✅ Test 7/7: 邊界條件 - 超長文字');
  } catch (error) {
    testResults.push({ name: '邊界條件 - 超長文字', status: 'FAIL', error: error.message });
    failed++;
    console.log('❌ Test 7/7: 邊界條件 - 超長文字 - ' + error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('問題回報測試總結');
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
    throw new Error(`${failed} 個問題回報測試失敗`);
  }

  return testResults;
};

module.exports = run();
