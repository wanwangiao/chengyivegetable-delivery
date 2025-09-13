/**
 * 修復外送員API的SQL查詢問題
 * 根據錯誤日誌分析，需要修復customers表和product_name欄位問題
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 修復外送員API查詢問題');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

// 讀取外送員API檔案
const apiFilePath = path.join(__dirname, 'src/routes/driver_simplified_api.js');

if (!fs.existsSync(apiFilePath)) {
    console.log('❌ 找不到外送員API檔案:', apiFilePath);
    process.exit(1);
}

console.log('📖 讀取外送員API檔案...');
let apiContent = fs.readFileSync(apiFilePath, 'utf8');

// 修復1: customers表查詢問題
// 將JOIN customers改為直接使用orders表的客戶資訊欄位
const oldCustomerQuery = `JOIN customers c ON o.customer_id = c.id`;
const newCustomerQuery = `-- 直接使用orders表的客戶資訊`;

const oldCustomerSelect = `c.name as customer_name, 
               c.phone as customer_phone,
               c.address,`;
const newCustomerSelect = `o.customer_name, 
               o.customer_phone,
               o.address,`;

// 修復2: product_name欄位問題
// 將oi.product_name改為p.name或其他正確欄位
const oldProductQuery = `oi.product_name`;
const newProductQuery = `COALESCE(p.name, '商品') as product_name`;

console.log('🔄 執行修復...');

// 執行替換
if (apiContent.includes(oldCustomerQuery)) {
    apiContent = apiContent.replace(oldCustomerQuery, newCustomerQuery);
    console.log('✅ 修復customers表查詢');
}

if (apiContent.includes(oldCustomerSelect)) {
    apiContent = apiContent.replace(oldCustomerSelect, newCustomerSelect);
    console.log('✅ 修復customer欄位選擇');
}

// 修復product_name相關查詢
apiContent = apiContent.replace(/oi\.product_name/g, 'COALESCE(p.name, \'商品\') as product_name');
console.log('✅ 修復product_name欄位查詢');

// 備份原檔案
const backupPath = apiFilePath + '.backup.' + Date.now();
fs.writeFileSync(backupPath, fs.readFileSync(apiFilePath, 'utf8'));
console.log('💾 原檔案已備份至:', backupPath);

// 寫入修復後的內容
fs.writeFileSync(apiFilePath, apiContent);
console.log('✅ 外送員API查詢修復完成');

console.log('\n🎯 修復摘要:');
console.log('1. 移除對不存在的customers表的依賴');
console.log('2. 使用orders表的客戶資訊欄位');
console.log('3. 修復product_name欄位查詢');
console.log('4. 原檔案已備份保存');

console.log('\n🚀 下一步:');
console.log('1. 提交修復到Git');
console.log('2. 推送到Railway觸發部署');
console.log('3. 重新測試外送員勾選訂單功能');