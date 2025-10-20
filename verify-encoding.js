const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/driver/app/index.tsx');

console.log('=== 檢查文件編碼 ===\n');

// 讀取文件內容
const content = fs.readFileSync(filePath, 'utf8');

// 檢查特定的中文字串
const testStrings = ['上線可接單', '配送中', '下線休息', '請輸入帳號與密碼', '目前沒有待接訂單'];

console.log('檢查關鍵中文字串：\n');
let allCorrect = true;

testStrings.forEach(str => {
  const found = content.includes(str);
  const status = found ? '✅ 正確' : '❌ 找不到或損壞';
  console.log(`${status}: "${str}"`);
  if (!found) allCorrect = false;
});

console.log('\n=== 檢查結果 ===');
if (allCorrect) {
  console.log('✅ 文件編碼正確，所有中文字串都正常！');
  console.log('\n如果您在編輯器中看到亂碼，請：');
  console.log('1. 關閉文件');
  console.log('2. 在 VSCode 中：右下角點擊編碼 → "Reopen with Encoding" → "UTF-8"');
  console.log('3. 或在設置中添加："files.encoding": "utf-8"');
} else {
  console.log('❌ 文件損壞，需要修復');
}

console.log('\n=== 文件前 100 個字符 ===');
console.log(content.substring(0, 100));

process.exit(allCorrect ? 0 : 1);
