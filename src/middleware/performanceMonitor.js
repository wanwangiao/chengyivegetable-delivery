// 系統性能監控中間件
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            requests: 0,
            errors: 0,
            responseTime: [],
            memoryUsage: [],
            uptime: process.uptime()
        };
        
        // 每5分鐘記錄一次系統指標
        setInterval(() => {
            this.recordSystemMetrics();
        }, 5 * 60 * 1000);
    }

    // 請求性能監控中間件
    requestMonitor() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // 計算請求數
            this.metrics.requests++;
            
            // 監控響應時間
            res.on('finish', () => {
                const responseTime = Date.now() - startTime;
                this.metrics.responseTime.push(responseTime);
                
                // 只保留最近1000次請求的響應時間
                if (this.metrics.responseTime.length > 1000) {
                    this.metrics.responseTime = this.metrics.responseTime.slice(-1000);
                }
                
                // 記錄錯誤
                if (res.statusCode >= 400) {
                    this.metrics.errors++;
                }
                
                // 記錄慢請求
                if (responseTime > 5000) {
                    console.warn(`⚠️ 慢請求警告: ${req.method} ${req.path} - ${responseTime}ms`);
                }
            });
            
            next();
        };
    }

    // 記錄系統指標
    recordSystemMetrics() {
        const memUsage = process.memoryUsage();
        this.metrics.memoryUsage.push({
            timestamp: new Date(),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            rss: Math.round(memUsage.rss / 1024 / 1024) // MB
        });
        
        // 只保留最近24小時的記錄 (每5分鐘一次，288個記錄)
        if (this.metrics.memoryUsage.length > 288) {
            this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-288);
        }
    }

    // 獲取性能報告
    getPerformanceReport() {
        const avgResponseTime = this.metrics.responseTime.length > 0 
            ? Math.round(this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length)
            : 0;
        
        const recentMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
        const errorRate = this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2) : 0;
        
        return {
            uptime: Math.round(process.uptime()),
            totalRequests: this.metrics.requests,
            totalErrors: this.metrics.errors,
            errorRate: `${errorRate}%`,
            averageResponseTime: `${avgResponseTime}ms`,
            currentMemory: recentMemory ? {
                heapUsed: `${recentMemory.heapUsed}MB`,
                heapTotal: `${recentMemory.heapTotal}MB`,
                rss: `${recentMemory.rss}MB`
            } : null,
            healthStatus: this.getHealthStatus()
        };
    }

    // 系統健康狀態評估
    getHealthStatus() {
        const avgResponseTime = this.metrics.responseTime.length > 0 
            ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
            : 0;
        
        const errorRate = this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) : 0;
        const recentMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
        
        let status = 'healthy';
        let issues = [];
        
        // 檢查響應時間
        if (avgResponseTime > 3000) {
            status = 'warning';
            issues.push('平均響應時間過長');
        }
        
        // 檢查錯誤率
        if (errorRate > 0.05) { // 5%
            status = 'warning';
            issues.push('錯誤率偏高');
        }
        
        // 檢查記憶體使用
        if (recentMemory && recentMemory.heapUsed > 400) { // 400MB
            status = 'warning';
            issues.push('記憶體使用偏高');
        }
        
        // 嚴重問題
        if (avgResponseTime > 10000 || errorRate > 0.1 || (recentMemory && recentMemory.heapUsed > 800)) {
            status = 'critical';
        }
        
        return {
            status,
            issues: issues.length > 0 ? issues : ['系統運行正常']
        };
    }

    // 重置統計
    resetMetrics() {
        this.metrics = {
            requests: 0,
            errors: 0,
            responseTime: [],
            memoryUsage: [],
            uptime: process.uptime()
        };
    }
}

// 創建全局實例
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;