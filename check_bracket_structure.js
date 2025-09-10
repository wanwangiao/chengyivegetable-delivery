/**
 * 檢查 server.js 的括弧結構
 */

const fs = require('fs');

try {
  const content = fs.readFileSync('./src/server.js', 'utf8');
  const lines = content.split('\n');
  
  let braceStack = [];
  let parenStack = [];
  let errors = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // 檢查每個字符
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '{') {
        braceStack.push({ line: lineNum, pos: j });
      } else if (char === '}') {
        if (braceStack.length === 0) {
          errors.push(`第 ${lineNum} 行第 ${j} 位：多餘的 '}'`);
        } else {
          braceStack.pop();
        }
      } else if (char === '(') {
        parenStack.push({ line: lineNum, pos: j });
      } else if (char === ')') {
        if (parenStack.length === 0) {
          errors.push(`第 ${lineNum} 行第 ${j} 位：多餘的 ')'`);
        } else {
          parenStack.pop();
        }
      }
    }
  }
  
  // 檢查未配對的括弧
  if (braceStack.length > 0) {
    braceStack.forEach(brace => {
      errors.push(`第 ${brace.line} 行第 ${brace.pos} 位：未配對的 '{'`);
    });
  }
  
  if (parenStack.length > 0) {
    parenStack.forEach(paren => {
      errors.push(`第 ${paren.line} 行第 ${paren.pos} 位：未配對的 '('`);
    });
  }
  
  console.log('📋 括弧結構檢查結果：');
  console.log('=======================');
  
  if (errors.length === 0) {
    console.log('✅ 所有括弧都正確配對');
  } else {
    console.log(`❌ 發現 ${errors.length} 個括弧錯誤：\n`);
    errors.forEach(error => {
      console.log(`   ${error}`);
    });
  }
  
  // 特別檢查 createDatabasePool 附近的區域
  console.log('\n🔍 檢查 createDatabasePool 區域：');
  const startLine = 225;
  const endLine = 240;
  
  for (let i = startLine; i <= Math.min(endLine, lines.length - 1); i++) {
    console.log(`${String(i+1).padStart(3)}: ${lines[i]}`);
  }
  
  // 檢查檔案末尾
  console.log('\n🔍 檢查檔案末尾 (5560-5580)：');
  for (let i = 5559; i < Math.min(5579, lines.length); i++) {
    console.log(`${String(i+1).padStart(4)}: ${lines[i]}`);
  }
  
} catch (error) {
  console.error('檢查過程發生錯誤:', error.message);
}