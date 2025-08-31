// 公克單位換算測試與實作建議
const fs = require('fs');

// 完整的單位換算常數
const UNIT_CONVERSION = {
    // 基礎換算關係
    GRAM_TO_KG: 0.001,        // 1克 = 0.001公斤
    KG_TO_GRAM: 1000,          // 1公斤 = 1000克
    JIN_TO_GRAM: 600,          // 1斤 = 600克
    GRAM_TO_JIN: 1/600,        // 1克 = 0.00167斤
    TAIWAN_TO_GRAM: 600,       // 1台斤 = 600克
    GRAM_TO_TAIWAN: 1/600,     // 1克 = 0.00167台斤
    
    // 衍生換算關係
    JIN_TO_KG: 0.6,            // 1斤 = 0.6公斤
    KG_TO_JIN: 1.67,           // 1公斤 = 1.67斤
    TAIWAN_TO_KG: 0.6,         // 1台斤 = 0.6公斤
    KG_TO_TAIWAN: 1.67         // 1公斤 = 1.67台斤
};

// 單位換算函數（建議實作）
class UnitConverter {
    // 將任何單位轉換為克（基準單位）
    static toGrams(value, unit) {
        switch(unit.toLowerCase()) {
            case '克':
            case 'g':
            case 'gram':
            case '公克':
                return value;
            case '公斤':
            case 'kg':
            case 'kilogram':
                return value * UNIT_CONVERSION.KG_TO_GRAM;
            case '斤':
            case 'jin':
                return value * UNIT_CONVERSION.JIN_TO_GRAM;
            case '台斤':
            case 'taiwan_jin':
                return value * UNIT_CONVERSION.TAIWAN_TO_GRAM;
            default:
                throw new Error(`不支援的單位: ${unit}`);
        }
    }
    
    // 從克轉換為其他單位
    static fromGrams(grams, targetUnit) {
        switch(targetUnit.toLowerCase()) {
            case '克':
            case 'g':
            case 'gram':
            case '公克':
                return grams;
            case '公斤':
            case 'kg':
            case 'kilogram':
                return grams * UNIT_CONVERSION.GRAM_TO_KG;
            case '斤':
            case 'jin':
                return grams * UNIT_CONVERSION.GRAM_TO_JIN;
            case '台斤':
            case 'taiwan_jin':
                return grams * UNIT_CONVERSION.GRAM_TO_TAIWAN;
            default:
                throw new Error(`不支援的單位: ${targetUnit}`);
        }
    }
    
    // 通用轉換函數
    static convert(value, fromUnit, toUnit) {
        const grams = this.toGrams(value, fromUnit);
        return this.fromGrams(grams, toUnit);
    }
}

// 測試案例
console.log('\n=====================================');
console.log('🧪 公克單位換算測試');
console.log('=====================================\n');

const testCases = [
    // 公克 → 其他單位
    { value: 100, from: '公克', to: '公斤', expected: 0.1 },
    { value: 500, from: '公克', to: '公斤', expected: 0.5 },
    { value: 1200, from: '公克', to: '公斤', expected: 1.2 },
    { value: 600, from: '公克', to: '斤', expected: 1 },
    { value: 300, from: '公克', to: '斤', expected: 0.5 },
    { value: 900, from: '公克', to: '斤', expected: 1.5 },
    { value: 600, from: '公克', to: '台斤', expected: 1 },
    { value: 1800, from: '公克', to: '台斤', expected: 3 },
    
    // 其他單位 → 公克
    { value: 1, from: '公斤', to: '公克', expected: 1000 },
    { value: 0.5, from: '公斤', to: '公克', expected: 500 },
    { value: 2.3, from: '公斤', to: '公克', expected: 2300 },
    { value: 1, from: '斤', to: '公克', expected: 600 },
    { value: 2, from: '斤', to: '公克', expected: 1200 },
    { value: 0.5, from: '斤', to: '公克', expected: 300 },
    { value: 1, from: '台斤', to: '公克', expected: 600 },
    { value: 1.5, from: '台斤', to: '公克', expected: 900 },
    
    // 特殊測試：小數點精度
    { value: 250, from: '公克', to: '斤', expected: 0.417 },
    { value: 333, from: '公克', to: '公斤', expected: 0.333 },
    { value: 123, from: '公克', to: '台斤', expected: 0.205 }
];

let passedTests = 0;
let failedTests = 0;
const testResults = [];

console.log('📐 測試單位換算：\n');
for (const test of testCases) {
    const result = UnitConverter.convert(test.value, test.from, test.to);
    const roundedResult = Math.round(result * 1000) / 1000; // 保留3位小數
    const roundedExpected = Math.round(test.expected * 1000) / 1000;
    const passed = Math.abs(roundedResult - roundedExpected) < 0.001;
    
    if (passed) {
        passedTests++;
        console.log(`✅ ${test.value} ${test.from} = ${roundedResult} ${test.to}`);
    } else {
        failedTests++;
        console.log(`❌ ${test.value} ${test.from} = ${roundedResult} ${test.to} (預期: ${roundedExpected})`);
    }
    
    testResults.push({
        input: `${test.value} ${test.from}`,
        output: `${roundedResult} ${test.to}`,
        expected: `${roundedExpected} ${test.to}`,
        passed: passed
    });
}

// 實際應用範例
console.log('\n=====================================');
console.log('💼 實際應用範例');
console.log('=====================================\n');

const practicalExamples = [
    {
        scenario: '小包裝蔬菜（250克）',
        conversions: [
            { value: 250, from: '公克', to: '斤', desc: '約0.42斤' },
            { value: 250, from: '公克', to: '公斤', desc: '0.25公斤' }
        ]
    },
    {
        scenario: '精緻調味料（50克）',
        conversions: [
            { value: 50, from: '公克', to: '斤', desc: '約0.08斤' },
            { value: 50, from: '公克', to: '台斤', desc: '約0.08台斤' }
        ]
    },
    {
        scenario: '大包裝米（5公斤）',
        conversions: [
            { value: 5, from: '公斤', to: '公克', desc: '5000克' },
            { value: 5, from: '公斤', to: '斤', desc: '約8.33斤' }
        ]
    },
    {
        scenario: '茶葉（150克）',
        conversions: [
            { value: 150, from: '公克', to: '斤', desc: '0.25斤（四兩）' },
            { value: 150, from: '公克', to: '台斤', desc: '0.25台斤' }
        ]
    }
];

for (const example of practicalExamples) {
    console.log(`📦 ${example.scenario}`);
    for (const conv of example.conversions) {
        const result = UnitConverter.convert(conv.value, conv.from, conv.to);
        console.log(`   ${conv.value} ${conv.from} = ${result.toFixed(2)} ${conv.to} (${conv.desc})`);
    }
    console.log('');
}

// 建議的實作程式碼
const implementationSuggestion = `
// ===== 建議加入到系統的程式碼 =====

// 1. 在 src/utils/unitConverter.js 新增檔案：

class UnitConverter {
    static CONVERSION_RATES = {
        GRAM_TO_KG: 0.001,
        KG_TO_GRAM: 1000,
        JIN_TO_GRAM: 600,
        GRAM_TO_JIN: 1/600,
        TAIWAN_TO_GRAM: 600,
        GRAM_TO_TAIWAN: 1/600
    };
    
    static convert(value, fromUnit, toUnit) {
        // 先轉換為克（基準單位）
        let grams;
        switch(fromUnit) {
            case '克':
            case '公克':
                grams = value;
                break;
            case '公斤':
                grams = value * 1000;
                break;
            case '斤':
            case '台斤':
                grams = value * 600;
                break;
            default:
                return value; // 無法識別的單位，返回原值
        }
        
        // 從克轉換為目標單位
        switch(toUnit) {
            case '克':
            case '公克':
                return grams;
            case '公斤':
                return grams / 1000;
            case '斤':
            case '台斤':
                return grams / 600;
            default:
                return value; // 無法識別的單位，返回原值
        }
    }
}

module.exports = UnitConverter;

// 2. 在商品管理頁面加入單位選項：
const SUPPORTED_UNITS = [
    { value: '公克', label: '公克(g)' },
    { value: '公斤', label: '公斤(kg)' },
    { value: '斤', label: '斤' },
    { value: '台斤', label: '台斤' }
];

// 3. 在訂單處理時自動換算：
function processOrderItem(product, quantity, unit) {
    // 將客戶訂購單位轉換為庫存單位
    const stockUnit = product.stock_unit || '斤';
    const convertedQuantity = UnitConverter.convert(quantity, unit, stockUnit);
    
    // 扣除庫存
    product.stock -= convertedQuantity;
    
    // 計算價格（假設價格是以stockUnit為基準）
    const price = product.price * convertedQuantity;
    
    return {
        originalQuantity: quantity,
        originalUnit: unit,
        convertedQuantity: convertedQuantity,
        stockUnit: stockUnit,
        price: price
    };
}
`;

// 生成測試報告
const report = {
    timestamp: new Date().toISOString(),
    summary: {
        total: testCases.length,
        passed: passedTests,
        failed: failedTests,
        successRate: ((passedTests / testCases.length) * 100).toFixed(1) + '%'
    },
    testResults: testResults,
    recommendation: '建議在系統中加入公克單位支援，特別是對於小包裝商品、調味料、茶葉等精緻商品。',
    implementationFiles: [
        'src/utils/unitConverter.js - 單位換算工具類',
        'views/admin_products.ejs - 商品管理頁面加入公克選項',
        'src/routes/orders.js - 訂單處理加入單位換算邏輯'
    ]
};

// 儲存報告
fs.writeFileSync('gram_conversion_test_report.json', JSON.stringify(report, null, 2));

// 儲存實作建議
fs.writeFileSync('gram_conversion_implementation.js', implementationSuggestion);

console.log('\n=====================================');
console.log('📊 測試總結');
console.log('=====================================\n');
console.log(`總測試數: ${testCases.length}`);
console.log(`✅ 通過: ${passedTests}`);
console.log(`❌ 失敗: ${failedTests}`);
console.log(`成功率: ${report.summary.successRate}`);
console.log('\n📄 測試報告已儲存至: gram_conversion_test_report.json');
console.log('📝 實作建議已儲存至: gram_conversion_implementation.js');

console.log('\n🎯 結論：');
console.log('系統目前【未實作】公克單位換算功能。');
console.log('建議加入公克支援，特別適用於：');
console.log('  1. 小包裝蔬菜（100-500克）');
console.log('  2. 調味料、香料（50-200克）');
console.log('  3. 茶葉、乾貨（50-300克）');
console.log('  4. 精緻水果（按克計價）');