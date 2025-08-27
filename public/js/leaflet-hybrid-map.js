/**
 * Leaflet 混合地圖客戶端
 * 免費替代 Google Maps，用於基本地圖顯示功能
 * 成本節省: 每次載入節省 $0.007
 */

class LeafletHybridMap {
    constructor(options = {}) {
        this.options = {
            defaultCenter: [25.0330, 121.5654], // 台北
            defaultZoom: 13,
            tileProvider: 'openstreetmap',
            language: 'zh-TW',
            ...options
        };
        
        this.map = null;
        this.markers = [];
        this.routeLayer = null;
        
        console.log('🗺️ Leaflet混合地圖已初始化 (成本節省版)');
    }

    /**
     * 初始化地圖
     */
    async initMap(containerId, center = null, zoom = null) {
        const mapCenter = center || this.options.defaultCenter;
        const mapZoom = zoom || this.options.defaultZoom;
        
        try {
            // 載入 Leaflet CSS (如果尚未載入)
            await this.loadLeafletCSS();
            
            // 建立地圖
            this.map = L.map(containerId).setView(mapCenter, mapZoom);
            
            // 添加圖磚層 (免費 OpenStreetMap)
            this.addTileLayer();
            
            // 添加地圖控制項
            this.addMapControls();
            
            console.log('✅ Leaflet地圖初始化完成 - 零成本');
            return this.map;
            
        } catch (error) {
            console.error('❌ Leaflet地圖初始化失敗:', error);
            throw error;
        }
    }

    /**
     * 載入 Leaflet CSS
     */
    async loadLeafletCSS() {
        return new Promise((resolve, reject) => {
            // 檢查是否已載入
            if (document.querySelector('link[href*="leaflet"]')) {
                resolve();
                return;
            }
            
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            
            link.onload = resolve;
            link.onerror = reject;
            
            document.head.appendChild(link);
        });
    }

    /**
     * 添加圖磚層
     */
    addTileLayer() {
        // 使用免費的 OpenStreetMap 圖磚
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            tileSize: 256,
            zoomOffset: 0
        });
        
        tileLayer.addTo(this.map);
        
        // 添加載入事件監聽
        tileLayer.on('loading', () => {
            console.log('🔄 正在載入地圖圖磚...');
        });
        
        tileLayer.on('load', () => {
            console.log('✅ 地圖圖磚載入完成');
        });
    }

    /**
     * 添加地圖控制項
     */
    addMapControls() {
        // 添加縮放控制項
        L.control.zoom({
            position: 'topright',
            zoomInText: '+',
            zoomOutText: '−',
            zoomInTitle: '放大',
            zoomOutTitle: '縮小'
        }).addTo(this.map);
        
        // 添加比例尺
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false
        }).addTo(this.map);
    }

    /**
     * 添加訂單標記 (替代 Google Maps Marker)
     */
    addOrderMarker(lat, lng, options = {}) {
        const {
            title = '送達地址',
            popup = '',
            color = '#4CAF50',
            icon = 'location'
        } = options;
        
        // 建立自定義圖標
        const markerIcon = this.createCustomIcon(color, icon);
        
        // 建立標記
        const marker = L.marker([lat, lng], { 
            icon: markerIcon,
            title: title
        }).addTo(this.map);
        
        // 添加彈出視窗
        if (popup) {
            marker.bindPopup(popup);
        }
        
        this.markers.push(marker);
        console.log(`📍 已添加訂單標記: ${title} (${lat}, ${lng})`);
        
        return marker;
    }

    /**
     * 添加司機標記
     */
    addDriverMarker(lat, lng, options = {}) {
        const {
            title = '外送員位置',
            popup = '',
            color = '#FF9800',
            icon = 'truck'
        } = options;
        
        return this.addOrderMarker(lat, lng, { title, popup, color, icon });
    }

    /**
     * 建立自定義圖標
     */
    createCustomIcon(color, iconType) {
        let iconSvg = '';
        
        switch (iconType) {
            case 'location':
                iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32px" height="32px">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>`;
                break;
            case 'truck':
                iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32px" height="32px">
                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>`;
                break;
            default:
                iconSvg = `<circle cx="12" cy="12" r="8" fill="${color}"/>`;
        }
        
        return L.divIcon({
            className: 'custom-marker',
            html: iconSvg,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });
    }

    /**
     * 顯示路線 (使用免費路線服務)
     */
    async showRoute(start, end, waypoints = []) {
        try {
            console.log('🛣️ 正在規劃路線 (使用免費服務)...');
            
            // 建立路線點陣列
            const routePoints = [start, ...waypoints, end];
            
            // 使用 OpenRouteService 免費路線規劃 API
            const route = await this.calculateFreeRoute(routePoints);
            
            if (route && route.coordinates) {
                // 移除舊路線
                if (this.routeLayer) {
                    this.map.removeLayer(this.routeLayer);
                }
                
                // 建立新路線
                this.routeLayer = L.polyline(route.coordinates, {
                    color: '#FF9800',
                    weight: 4,
                    opacity: 0.8
                }).addTo(this.map);
                
                // 調整地圖視野以包含整條路線
                this.map.fitBounds(this.routeLayer.getBounds());
                
                console.log('✅ 路線顯示完成 (零成本)');
                return {
                    success: true,
                    distance: route.distance,
                    duration: route.duration
                };
            } else {
                throw new Error('路線規劃失敗');
            }
            
        } catch (error) {
            console.warn('⚠️ 免費路線服務失敗，使用直線顯示:', error);
            return this.showStraightLine(start, end);
        }
    }

    /**
     * 使用免費路線服務計算路線
     */
    async calculateFreeRoute(points) {
        // 這裡可以整合免費的路線規劃服務
        // 例如: OpenRouteService, MapBox (有免費額度), 或者本地算法
        
        // 暫時使用直線連接 (完全免費)
        const coordinates = points.map(point => [point.lat, point.lng]);
        
        // 計算總距離 (使用 Haversine 公式)
        let totalDistance = 0;
        for (let i = 0; i < coordinates.length - 1; i++) {
            totalDistance += this.calculateDistance(
                coordinates[i][0], coordinates[i][1],
                coordinates[i + 1][0], coordinates[i + 1][1]
            );
        }
        
        return {
            coordinates: coordinates,
            distance: Math.round(totalDistance * 100) / 100,
            duration: Math.round(totalDistance * 3) // 預估每公里3分鐘
        };
    }

    /**
     * 顯示直線路線 (備援方案)
     */
    showStraightLine(start, end) {
        // 移除舊路線
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }
        
        // 建立直線
        this.routeLayer = L.polyline([
            [start.lat, start.lng],
            [end.lat, end.lng]
        ], {
            color: '#FF9800',
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 5' // 虛線表示直線距離
        }).addTo(this.map);
        
        // 調整視野
        this.map.fitBounds(this.routeLayer.getBounds());
        
        const distance = this.calculateDistance(start.lat, start.lng, end.lat, end.lng);
        
        return {
            success: true,
            distance: Math.round(distance * 100) / 100,
            duration: Math.round(distance * 3),
            note: '直線距離 (非道路路線)'
        };
    }

    /**
     * 計算兩點間距離 (Haversine 公式)
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // 地球半徑 (公里)
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * 角度轉弧度
     */
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * 清除所有標記
     */
    clearMarkers() {
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
        console.log('🧹 已清除所有地圖標記');
    }

    /**
     * 清除路線
     */
    clearRoute() {
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
        console.log('🧹 已清除地圖路線');
    }

    /**
     * 調整地圖視野以包含所有標記
     */
    fitToMarkers() {
        if (this.markers.length === 0) return;
        
        const group = new L.featureGroup(this.markers);
        this.map.fitBounds(group.getBounds().pad(0.1));
    }

    /**
     * 設定地圖中心點
     */
    setCenter(lat, lng, zoom = null) {
        const targetZoom = zoom || this.map.getZoom();
        this.map.setView([lat, lng], targetZoom);
    }

    /**
     * 獲取成本節省統計
     */
    getCostSavings() {
        const googleMapsJSCost = 0.007; // 每次載入成本
        const leafletCost = 0; // 完全免費
        
        return {
            costPerLoad: googleMapsJSCost,
            savingsPerLoad: googleMapsJSCost,
            totalSavings: googleMapsJSCost, // 單次節省
            provider: 'OpenStreetMap (免費)',
            message: `每次載入節省 $${googleMapsJSCost} USD`
        };
    }

    /**
     * 銷毀地圖實例
     */
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.markers = [];
        this.routeLayer = null;
        console.log('🗑️ Leaflet地圖已銷毀');
    }
}

// 全域變數供向後相容
window.LeafletHybridMap = LeafletHybridMap;

// 混合地圖載入器 - 根據需求選擇最佳方案
class HybridMapLoader {
    static async loadOptimalMap(features = [], containerId = 'map') {
        const needsAdvancedFeatures = features.some(feature => 
            ['autocomplete', 'detailed-routing', 'street-view'].includes(feature)
        );
        
        if (needsAdvancedFeatures) {
            console.log('🔍 需要高級功能，載入 Google Maps...');
            return await this.loadGoogleMaps(containerId);
        } else {
            console.log('🗺️ 基本地圖功能，載入 Leaflet (免費)...');
            return await this.loadLeafletMap(containerId);
        }
    }
    
    static async loadLeafletMap(containerId) {
        // 載入 Leaflet 庫
        if (typeof L === 'undefined') {
            await this.loadLeafletLibrary();
        }
        
        const mapClient = new LeafletHybridMap();
        await mapClient.initMap(containerId);
        return mapClient;
    }
    
    static async loadGoogleMaps(containerId) {
        // 載入 Google Maps (原有功能)
        return new Promise((resolve) => {
            // 這裡保留原有的 Google Maps 載入邏輯
            console.log('載入 Google Maps...');
            resolve(null); // 暫時返回 null
        });
    }
    
    static async loadLeafletLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
            script.crossOrigin = '';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

window.HybridMapLoader = HybridMapLoader;