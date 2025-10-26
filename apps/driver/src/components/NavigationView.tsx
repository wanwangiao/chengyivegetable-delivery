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
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showProblemDialog, setShowProblemDialog] = useState(false);
  const [problemReason, setProblemReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locationWatchId = useRef<number | null>(null);

  const currentOrder = orders[currentIndex];
  const remainingCount = orders.length - currentIndex;

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

  // 計算路線
  useEffect(() => {
    if (!currentLocation || !currentOrder?.latitude || !currentOrder?.longitude) return;

    const fetchRoute = async () => {
      try {
        const data = await apiRequest('/api/v1/drivers/routes/optimize', {
          method: 'POST',
          body: JSON.stringify({
            origin: { lat: currentLocation.latitude, lng: currentLocation.longitude },
            destination: { lat: currentOrder.latitude, lng: currentOrder.longitude }
          })
        });

        setRouteInfo({
          distanceMeters: data.distance ?? 0,
          durationSeconds: data.duration ?? 0,
          polyline: data.polyline ? decodePolyline(data.polyline) : []
        });
      } catch (error) {
        console.error('路線計算失敗:', error);
      }
    };

    fetchRoute();
  }, [currentLocation, currentOrder, apiRequest]);

  const handleMarkDelivered = useCallback(async () => {
    if (!currentOrder) return;
    setSubmitting(true);

    try {
      await apiRequest(`/api/v1/drivers/orders/${currentOrder.id}/complete`, {
        method: 'POST'
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
    if (currentOrder.latitude && currentOrder.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${currentOrder.latitude},${currentOrder.longitude}`;
      window.open(url, '_blank');
    } else {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentOrder.shippingAddress)}`;
      window.open(url, '_blank');
    }
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

          {/* 路線 */}
          {routeInfo?.polyline && routeInfo.polyline.length > 1 && (
            <Polyline
              positions={routeInfo.polyline.map(p => [p.latitude, p.longitude])}
              color="#546E7A"
              weight={4}
            />
          )}
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
