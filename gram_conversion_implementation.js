
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
