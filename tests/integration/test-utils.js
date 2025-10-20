/**
 * 測試工具模組
 * 提供測試所需的通用功能
 */

const API_BASE_URL = 'http://localhost:3000/api/v1';

// 測試結果收集器
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

// 顏色輸出（終端機）
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * HTTP 請求工具
 */
async function request(method, endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config = {
    method,
    headers,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');

    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: response.headers,
    };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

/**
 * 登入並取得 token
 */
async function login(email, password) {
  const response = await request('POST', '/auth/login', {
    body: { email, password },
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${JSON.stringify(response.data)}`);
  }

  return response.data.accessToken;
}

/**
 * 測試斷言
 */
class Assert {
  static assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Assertion failed'}\nExpected: ${expected}\nActual: ${actual}`);
    }
  }

  static assertTrue(value, message) {
    if (!value) {
      throw new Error(message || 'Expected true but got false');
    }
  }

  static assertFalse(value, message) {
    if (value) {
      throw new Error(message || 'Expected false but got true');
    }
  }

  static assertNotNull(value, message) {
    if (value === null || value === undefined) {
      throw new Error(message || 'Expected non-null value');
    }
  }

  static assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(
        `${message || 'Assertion failed'}\nExpected > ${expected}\nActual: ${actual}`
      );
    }
  }

  static assertContains(array, item, message) {
    if (!array.includes(item)) {
      throw new Error(`${message || 'Assertion failed'}\nArray does not contain: ${item}`);
    }
  }

  static assertDeepEquals(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(
        `${message || 'Assertion failed'}\nExpected: ${expectedStr}\nActual: ${actualStr}`
      );
    }
  }
}

/**
 * 測試執行器
 */
async function runTest(name, testFn) {
  testResults.total++;
  const startTime = Date.now();

  try {
    await testFn();
    const duration = Date.now() - startTime;
    testResults.passed++;
    testResults.tests.push({
      name,
      status: 'PASSED',
      duration,
      error: null,
    });
    console.log(`${colors.green}✓${colors.reset} ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    testResults.failed++;
    testResults.tests.push({
      name,
      status: 'FAILED',
      duration,
      error: error.message,
    });
    console.log(`${colors.red}✗${colors.reset} ${name} (${duration}ms)`);
    console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
  }
}

/**
 * 列印測試總結
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.cyan}Test Summary${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`Total:  ${testResults.total}`);
  console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * 取得測試結果
 */
function getResults() {
  return testResults;
}

/**
 * 重設測試結果
 */
function resetResults() {
  testResults.total = 0;
  testResults.passed = 0;
  testResults.failed = 0;
  testResults.tests = [];
}

/**
 * 延遲執行
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 產生隨機字串
 */
function randomString(length = 8) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

export {
  request,
  login,
  Assert,
  runTest,
  printSummary,
  getResults,
  resetResults,
  sleep,
  randomString,
  API_BASE_URL,
};
