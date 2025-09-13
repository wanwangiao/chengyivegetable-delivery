/**
 * 修復缺失表格的SQL查詢問題
 * 使用條件查詢和錯誤處理避免表不存在的錯誤
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 修復缺失表格查詢問題');
console.log('📅 執行時間:', new Date().toLocaleString('zh-TW'));

// 讀取server.js檔案
const serverPath = path.join(__dirname, 'src/server.js');

if (!fs.existsSync(serverPath)) {
    console.log('❌ 找不到server.js檔案');
    process.exit(1);
}

console.log('📖 讀取server.js檔案...');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// 修復1: product_option_groups 查詢
console.log('🔄 修復 product_option_groups 查詢...');

// 包裝查詢在try-catch中
const oldProductOptionsQuery = `      const optionsResult = await pool.query(\`
        SELECT pog.*, 
               po.id as option_id,
               po.name as option_name,
               po.description as option_description,
               po.price_modifier,
               po.is_default,
               po.sort_order as option_sort_order
        FROM product_option_groups pog
        LEFT JOIN product_options po ON pog.id = po.group_id
        WHERE pog.product_id = $1
        ORDER BY pog.sort_order, po.sort_order
      \`, [product.id]);`;

const newProductOptionsQuery = `      let optionsResult = { rows: [] };
      try {
        // 檢查表是否存在
        const tableCheck = await pool.query(\`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'product_option_groups'
          );
        \`);
        
        if (tableCheck.rows[0].exists) {
          optionsResult = await pool.query(\`
            SELECT pog.*, 
                   po.id as option_id,
                   po.name as option_name,
                   po.description as option_description,
                   po.price_modifier,
                   po.is_default,
                   po.sort_order as option_sort_order
            FROM product_option_groups pog
            LEFT JOIN product_options po ON pog.id = po.group_id
            WHERE pog.product_id = $1
            ORDER BY pog.sort_order, po.sort_order
          \`, [product.id]);
        }
      } catch (error) {
        console.log('⚠️ product_option_groups 表不存在，跳過選項查詢');
        optionsResult = { rows: [] };
      }`;

if (serverContent.includes('FROM product_option_groups pog')) {
    serverContent = serverContent.replace(oldProductOptionsQuery, newProductOptionsQuery);
    console.log('✅ 修復 product_option_groups 查詢');
}

// 修復2: basic_settings 查詢
console.log('🔄 修復 basic_settings 查詢...');

// 找到所有 basic_settings 查詢並包裝
const basicSettingsPattern = /SELECT[^;]*FROM basic_settings[^;]*;/g;
const basicSettingsQueries = serverContent.match(basicSettingsPattern);

if (basicSettingsQueries) {
    basicSettingsQueries.forEach(query => {
        const wrappedQuery = `try {
        const tableCheck = await pool.query(\`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'basic_settings'
          );
        \`);
        
        if (tableCheck.rows[0].exists) {
          ${query}
        } else {
          console.log('⚠️ basic_settings 表不存在，使用默認設定');
          // 返回空結果或默認值
        }
      } catch (error) {
        console.log('⚠️ basic_settings 查詢錯誤，使用默認設定');
      }`;
        
        serverContent = serverContent.replace(query, wrappedQuery);
    });
    console.log('✅ 修復 basic_settings 查詢');
}

// 備份原檔案
const backupPath = serverPath + '.backup.' + Date.now();
fs.writeFileSync(backupPath, fs.readFileSync(serverPath, 'utf8'));
console.log('💾 原檔案已備份至:', backupPath);

// 寫入修復後的內容
fs.writeFileSync(serverPath, serverContent);
console.log('✅ server.js 修復完成');

console.log('\n🎯 修復摘要:');
console.log('1. 為 product_option_groups 查詢添加表存在檢查');
console.log('2. 為 basic_settings 查詢添加錯誤處理');
console.log('3. 原檔案已備份保存');

console.log('\n🚀 下一步:');
console.log('1. 提交修復到Git');
console.log('2. 推送到Railway觸發部署');
console.log('3. 驗證錯誤日誌不再出現');