import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Order } from '@chengyi/domain';
import 'leaflet/dist/leaflet.css';
import './NavigationView.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://chengyivegetable-api-production.up.railway.app';

interface NavigationViewProps {
  orders: Order[];
  token: string;
  onBack: () => void;
  onOrderComplete: () => void;
}

interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  polyline: Array<{ latitude: number; longitude: number }>;
}

// 修復 Leaflet 預設圖標問題
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
});

// 當前訂單圖標（綠色）
const currentMarkerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36">
      <path fill="#66BB6A" stroke="#2E7D32" stroke-width="2" d="M12 0C7.58 0 4 3.58 4 8c0 4.42 8 20 8 20s8-15.58 8-20c0-4.42-3.58-8-8-8z"/>
      <circle fill="white" cx="12" cy="9" r="3"/>
    </svg>
  `),
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [0, -45]
});

// 其他訂單圖標（藍色）
const otherMarkerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36">
      <path fill="#42A5F5" stroke="#1976D2" stroke-width="2" d="M12 0C7.58 0 4 3.58 4 8c0 4.42 8 20 8 20s8-15.58 8-20c0-4.42-3.58-8-8-8z"/>
      <text x="12" y="13" fill="white" font-size="10" font-weight="bold" text-anchor="middle"></text>
    </svg>
  `),
  iconSize: [30, 45],
  iconAnchor: [15, 45],
  popupAnchor: [0, -45]
});

const formatDistance = (meters?: number): string => {
  if (!meters || Number.isNaN(meters)) return '—';
  if (meters < 1000) return `${meters.toFixed(0)} 公尺`;
  return `${(meters / 1000).toFixed(1)} 公里`;
};

const formatDuration = (seconds?: number): string => {
  if (!seconds || Number.isNaN(seconds)) return '—';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} 小時 ${mins} 分`;
};

// Haversine 公式計算兩點間距離（公尺）
const calculateHaversineDistance = (
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number => {
  const R = 6371000; // 地球半徑（公尺）
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const lat1 = toRadians(point1.latitude);
  const lat2 = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLng = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15);
  }, [center, map]);
  return null;
}

export default function NavigationView({ orders, token, onBack, onOrderComplete }: NavigationViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [fullRoute, setFullRoute] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showProblemDialog, setShowProblemDialog] = useState(false);
  const [problemReason, setProblemReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locationWatchId = useRef<number | null>(null);

  const currentOrder = orders[currentIndex];
  const remainingCount = orders.length - currentIndex;

  // 公司地址（取貨點）
  const PICKUP_LOCATION = {
    latitude: 24.9346,
    longitude: 121.3689
  };

  const apiRequest = useCallback(async (path: string, options: RequestInit = {}) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    const json = await response.json();
    return json.data ?? json;
  }, [token]);

  // GPS 追蹤
  useEffect(() => {
    if (!navigator.geolocation) return;

    locationWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => console.error('定位失敗:', error),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
    );

    return () => {
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, []);

  // 計算整個批次的完整路線（只在初始載入時執行一次）
  useEffect(() => {
    const calculateSimpleRoute = () => {
      // 過濾出有座標的訂單
      const validOrders = orders.filter(order => order.latitude && order.longitude);
      if (validOrders.length === 0) return;

      // 使用簡單的貪婪演算法規劃路線：從取貨點開始，每次選擇最近的下一個點
      const remaining = [...validOrders];
      const route: Array<{ latitude: number; longitude: number }> = [PICKUP_LOCATION];
      let currentPoint = PICKUP_LOCATION;

      while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        // 找出最近的訂單
        for (let i = 0; i < remaining.length; i++) {
          const order = remaining[i];
          const distance = calculateHaversineDistance(
            currentPoint,
            { latitude: order.latitude!, longitude: order.longitude! }
          );
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }

        // 移除並添加最近的點
        const nextOrder = remaining.splice(nearestIndex, 1)[0];
        const nextPoint = { latitude: nextOrder.latitude!, longitude: nextOrder.longitude! };
        route.push(nextPoint);
        currentPoint = nextPoint;
      }

      setFullRoute(route);

      // 計算到當前訂單的距離
      if (currentOrder?.latitude && currentOrder?.longitude) {
        const origin = currentLocation || PICKUP_LOCATION;
        const distance = calculateHaversineDistance(
          origin,
          { latitude: currentOrder.latitude, longitude: currentOrder.longitude }
        );
        setRouteInfo({
          distanceMeters: distance,
          durationSeconds: distance / 7, // 假設平均速度 25 km/h (約 7 m/s)
          polyline: []
        });
      }
    };

    calculateSimpleRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在初始載入時執行

  // 當切換訂單時更新路線資訊
  useEffect(() => {
    if (!currentOrder || fullRoute.length === 0) return;

    const currentOrderIndex = orders.findIndex(o => o.id === currentOrder.id);
    if (currentOrderIndex === -1) return;

    // 計算從當前位置（或上一個訂單）到當前訂單的距離
    const prevPoint = currentLocation || (currentOrderIndex > 0 && fullRoute[currentOrderIndex]) || PICKUP_LOCATION;
    const currentPoint = { latitude: currentOrder.latitude!, longitude: currentOrder.longitude! };

    if (prevPoint && currentPoint.latitude && currentPoint.longitude) {
      const distance = calculateHaversineDistance(prevPoint, currentPoint);
      setRouteInfo({
        distanceMeters: distance,
        durationSeconds: distance / 7, // 假設平均速度 25 km/h
        polyline: []
      });
    }
  }, [currentOrder, currentLocation, fullRoute, orders]);

  const handleMarkDelivered = useCallback(() => {
    if (!currentOrder) return;

    // 建立文件選擇器
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment'; // 優先使用後置鏡頭

    fileInput.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      setSubmitting(true);
      try {
        const formData = new FormData();
        formData.append('proof', file);

        await apiRequest(`/api/v1/drivers/orders/${currentOrder.id}/complete`, {
          method: 'POST',
          body: formData
        });

        if (currentIndex < orders.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setMessage('已完成，前往下一站');
        } else {
          setMessage('全部配送完成！');
          setTimeout(() => {
            onOrderComplete();
            onBack();
          }, 1500);
        }
      } catch (error: any) {
        setMessage(`完成失敗: ${error.message}`);
      } finally {
        setSubmitting(false);
      }
    };

    fileInput.click();
  }, [currentOrder, currentIndex, orders.length, apiRequest, onOrderComplete, onBack]);

  const handleReportProblem = useCallback(async () => {
    if (!currentOrder || !problemReason.trim()) {
      setMessage('請輸入問題描述');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/drivers/orders/${currentOrder.id}/problem`, {
        method: 'POST',
        body: JSON.stringify({ reason: problemReason.trim() })
      });
      setMessage('問題已回報');
      setShowProblemDialog(false);
      setProblemReason('');
    } catch (error: any) {
      setMessage(`回報失敗: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }, [currentOrder, problemReason, apiRequest]);

  const handleCallCustomer = useCallback(() => {
    if (currentOrder?.contactPhone) {
      window.open(`tel:${currentOrder.contactPhone}`, '_self');
    }
  }, [currentOrder]);

  const handleOpenNavigation = useCallback(() => {
    if (!currentOrder) return;
    // 在地圖上聚焦目標訂單，不跳轉外部應用
    // 直接在 PWA 內顯示導航，保留下方操作欄和狀態列
    setMessage('目前位置聚焦在配送目標 - ' + currentOrder.contactName);
  }, [currentOrder]);

  if (!currentOrder) {
    return (
      <div className="navigation-view">
        <div className="error-state">
          <p>目前沒有配送中的訂單</p>
          <button onClick={onBack} className="btn-primary">返回列表</button>
        </div>
      </div>
    );
  }

  const mapCenter: [number, number] = currentOrder.latitude && currentOrder.longitude
    ? [currentOrder.latitude, currentOrder.longitude]
    : [25.0478, 121.5319]; // 台北市政府

  return (
    <div className="navigation-view">
      {/* 地圖 */}
      <div className="map-container">
        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapController center={mapCenter} />

          {/* 當前位置標記 */}
          {currentLocation && (
            <Marker
              position={[currentLocation.latitude, currentLocation.longitude]}
              icon={new L.Icon({
                iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2196F3" stroke="white" stroke-width="3"/></svg>'),
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}
            />
          )}

          {/* 訂單標記 */}
          {orders.map((order, index) =>
            order.latitude && order.longitude ? (
              <Marker
                key={order.id}
                position={[order.latitude, order.longitude]}
                icon={index === currentIndex ? currentMarkerIcon : otherMarkerIcon}
              />
            ) : null
          )}

          {/* 完整配送路線 */}
          {fullRoute.length > 1 && (
            <Polyline
              positions={fullRoute.map(p => [p.latitude, p.longitude])}
              color="#4CAF50"
              weight={5}
              opacity={0.7}
            />
          )}

          {/* 取貨點標記 */}
          <Marker
            position={[PICKUP_LOCATION.latitude, PICKUP_LOCATION.longitude]}
            icon={new L.Icon({
              iconUrl: 'data:image/svg+xml;base64,' + btoa(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36">
                  <path fill="#FF5722" stroke="#BF360C" stroke-width="2" d="M12 0C7.58 0 4 3.58 4 8c0 4.42 8 20 8 20s8-15.58 8-20c0-4.42-3.58-8-8-8z"/>
                  <circle fill="white" cx="12" cy="9" r="3"/>
                </svg>
              `),
              iconSize: [30, 45],
              iconAnchor: [15, 45],
              popupAnchor: [0, -45]
            })}
          />
        </MapContainer>

        {/* 返回按鈕 */}
        <button className="back-button" onClick={onBack}>
          ← 返回
        </button>
      </div>

      {/* 底部面板 */}
      <div className={`bottom-panel ${panelExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="panel-grip" onClick={() => setPanelExpanded(!panelExpanded)}>
          <div className="grip-bar"></div>
        </div>

        <div className="panel-content">
          {/* 訂單資訊 */}
          <div className="order-info-header">
            <div className="order-summary">
              <h3>第 {currentIndex + 1} / {orders.length} 單 · {currentOrder.contactName}</h3>
              <p className="order-address">{currentOrder.shippingAddress}</p>
              <div className="info-chips">
                <span className="chip">剩餘 {remainingCount} 單</span>
                <span className="chip">{formatDistance(routeInfo?.distanceMeters)}</span>
                <span className="chip">{formatDuration(routeInfo?.durationSeconds)}</span>
              </div>
            </div>

            <div className="primary-actions">
              <button
                className="btn-success"
                onClick={handleMarkDelivered}
                disabled={submitting}
              >
                {submitting ? '處理中...' : '✓ 已送達'}
              </button>
              {currentIndex < orders.length - 1 && (
                <button
                  className="btn-secondary"
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                >
                  下一單 →
                </button>
              )}
            </div>
          </div>

          {/* 快速操作 */}
          <div className="quick-actions">
            <button className="action-btn" onClick={handleCallCustomer}>
              📞 撥打電話
            </button>
            <button className="action-btn" onClick={handleOpenNavigation}>
              🗺 開啟導航
            </button>
            <button className="action-btn" onClick={() => setShowProblemDialog(true)}>
              ⚠ 回報問題
            </button>
          </div>

          {/* 展開時顯示所有訂單 */}
          {panelExpanded && (
            <div className="orders-list-expanded">
              <h4>配送清單</h4>
              {orders.map((order, index) => (
                <div
                  key={order.id}
                  className={`order-item-mini ${index === currentIndex ? 'active' : ''}`}
                  onClick={() => setCurrentIndex(index)}
                >
                  <span className="order-number">{index + 1}</span>
                  <div className="order-info-mini">
                    <strong>{order.contactName}</strong>
                    <span>{order.shippingAddress}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 問題回報對話框 */}
      {showProblemDialog && (
        <div className="dialog-overlay" onClick={() => setShowProblemDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>回報配送問題</h3>
            <textarea
              value={problemReason}
              onChange={(e) => setProblemReason(e.target.value)}
              placeholder="請描述遇到的問題..."
              rows={5}
              disabled={submitting}
            />
            <div className="dialog-actions">
              <button
                onClick={() => setShowProblemDialog(false)}
                disabled={submitting}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleReportProblem}
                disabled={submitting || !problemReason.trim()}
                className="btn-primary"
              >
                {submitting ? '提交中...' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 訊息 */}
      {message && (
        <div className="toast" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
    </div>
  );
}

// Polyline 解碼函數
function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  if (!encoded) return [];
  const coordinates: Array<{ latitude: number; longitude: number }> = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
}
