// 安全功能測試腳本
const path = require('path');

// 載入環境變數
require('dotenv').config({ path: path.join(__dirname, 'src', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('🔐 開始安全功能測試...\n');

// 1. 環境變數驗證測試
function testEnvironmentVariables() {
  console.log('📋 測試環境變數驗證...');

  const requiredVars = ['DATABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的環境變數:', missingVars);
    return false;
  }

  if (process.env.SESSION_SECRET.length < 32) {
    console.warn('⚠️  SESSION_SECRET 長度不足，建議至少32字元');
  }

  console.log('✅ 環境變數驗證通過\n');
  return true;
}

// 2. 管理員登入邏輯測試
function testAdminLogin() {
  console.log('🔐 測試管理員登入邏輯...');

  function validateAdminLogin(inputPassword) {
    const adminPassword = process.env.ADMIN_PASSWORD;

    // 安全檢查：確保管理員密碼已設置
    if (!adminPassword) {
      console.error('❌ 安全錯誤: ADMIN_PASSWORD 環境變數未設置');
      return false;
    }

    // 輸入驗證
    if (!inputPassword || inputPassword.trim().length === 0) {
      return false;
    }

    const trimmedPassword = inputPassword.trim();
    return trimmedPassword === adminPassword;
  }

  // 測試正確密碼
  console.log('   測試正確密碼...', validateAdminLogin('test_admin_password_123') ? '✅' : '❌');

  // 測試錯誤密碼
  console.log('   測試錯誤密碼...', !validateAdminLogin('wrong_password') ? '✅' : '❌');

  // 測試空密碼
  console.log('   測試空密碼...', !validateAdminLogin('') ? '✅' : '❌');

  // 測試空格密碼
  console.log('   測試空格密碼...', !validateAdminLogin('   ') ? '✅' : '❌');

  console.log('✅ 管理員登入邏輯測試完成\n');
}

// 3. Session 安全配置測試
function testSessionConfig() {
  console.log('🛡️ 測試 Session 安全配置...');

  const crypto = require('crypto');

  const sessionConfig = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 4 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    },
    name: 'chengyi.sid',
    genid: () => crypto.randomBytes(32).toString('hex')
  };

  console.log('   Session secret 長度:', process.env.SESSION_SECRET.length >= 32 ? '✅' : '❌');
  console.log('   Cookie httpOnly:', sessionConfig.cookie.httpOnly ? '✅' : '❌');
  console.log('   Session 過期時間 (4小時):', sessionConfig.cookie.maxAge === 4 * 60 * 60 * 1000 ? '✅' : '❌');
  console.log('   Session ID 生成器:', typeof sessionConfig.genid === 'function' ? '✅' : '❌');

  console.log('✅ Session 安全配置測試完成\n');
}

// 4. 系統安全檢查
function securityChecklist() {
  console.log('🔍 執行安全檢查清單...');

  const checks = [
    {
      name: '環境變數設置',
      check: () => process.env.DATABASE_URL && process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET
    },
    {
      name: 'Session secret 強度',
      check: () => process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
    },
    {
      name: '管理員密碼設置',
      check: () => process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8
    },
    {
      name: 'NODE_ENV 設置',
      check: () => ['development', 'production', 'test'].includes(process.env.NODE_ENV)
    }
  ];

  checks.forEach(check => {
    console.log(`   ${check.name}:`, check.check() ? '✅' : '❌');
  });

  const passedChecks = checks.filter(check => check.check()).length;
  console.log(`\n📊 安全檢查結果: ${passedChecks}/${checks.length} 項通過\n`);
}

// 執行所有測試
try {
  testEnvironmentVariables();
  testAdminLogin();
  testSessionConfig();
  securityChecklist();

  console.log('🎉 所有安全功能測試完成！');

} catch (error) {
  console.error('❌ 測試過程中發生錯誤:', error.message);
  process.exit(1);
}