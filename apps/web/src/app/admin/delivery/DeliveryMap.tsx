'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 簡約配色
const COLORS = {
  primary: '#2C3E50',
  secondary: '#546E7A',
  success: '#66BB6A',
  warning: '#FFA726',
  info: '#42A5F5',
  routeLine: '#546E7A'
};

interface MapDriver {
  id: string;
  name: string;
  status: string;
  currentLat: number;
  currentLng: number;
  lastLocationUpdate: string;
}

interface MapOrder {
  id: string;
  contactName: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
  driverId?: string;
}

interface DeliveryMapProps {
  drivers: MapDriver[];
  readyOrders: MapOrder[];
  deliveringOrders: MapOrder[];
}

// 建立自訂 icon
const createIcon = (color: string, label: string) => {
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        ${label}
      </div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// 地圖自動適配組件
function MapBounds({ drivers, readyOrders, deliveringOrders }: DeliveryMapProps) {
  const map = useMap();

  useEffect(() => {
    const allPoints: Array<[number, number]> = [];

    drivers.forEach(driver => {
      if (driver.currentLat && driver.currentLng) {
        allPoints.push([driver.currentLat, driver.currentLng]);
      }
    });

    readyOrders.forEach(order => {
      if (order.latitude && order.longitude) {
        allPoints.push([order.latitude, order.longitude]);
      }
    });

    deliveringOrders.forEach(order => {
      if (order.latitude && order.longitude) {
        allPoints.push([order.latitude, order.longitude]);
      }
    });

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      // 預設台北市中心
      map.setView([25.033, 121.5654], 13);
    }
  }, [map, drivers, readyOrders, deliveringOrders]);

  return null;
}

export default function DeliveryMap({ drivers, readyOrders, deliveringOrders }: DeliveryMapProps) {
  // 預設中心點（台北市）
  const defaultCenter: [number, number] = [25.033, 121.5654];

  // 為配送中的訂單繪製路線
  const deliveryRoutes = useMemo(() => {
    const routes: Array<{
      driverId: string;
      driverPos: [number, number];
      orderPos: [number, number];
    }> = [];

    deliveringOrders.forEach(order => {
      if (!order.driverId) return;

      const driver = drivers.find(d => d.id === order.driverId);
      if (!driver || !driver.currentLat || !driver.currentLng) return;

      routes.push({
        driverId: driver.id,
        driverPos: [driver.currentLat, driver.currentLng],
        orderPos: [order.latitude, order.longitude]
      });
    });

    return routes;
  }, [drivers, deliveringOrders]);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      style={{ height: '600px', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapBounds
        drivers={drivers}
        readyOrders={readyOrders}
        deliveringOrders={deliveringOrders}
      />

      {/* 外送員標記 */}
      {drivers.map(driver => {
        if (!driver.currentLat || !driver.currentLng) return null;

        const isOnline = driver.status === 'available' || driver.status === 'busy';
        const icon = createIcon(
          isOnline ? COLORS.success : COLORS.secondary + '80',
          '🚗'
        );

        return (
          <Marker
            key={`driver-${driver.id}`}
            position={[driver.currentLat, driver.currentLng]}
            icon={icon}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <h6 style={{ margin: '0 0 8px 0', color: COLORS.primary }}>
                  {driver.name}
                </h6>
                <p style={{ margin: '4px 0', fontSize: '13px', color: COLORS.secondary }}>
                  狀態：
                  <span
                    style={{
                      color:
                        driver.status === 'available'
                          ? COLORS.success
                          : driver.status === 'busy'
                          ? COLORS.info
                          : COLORS.secondary
                    }}
                  >
                    {driver.status === 'available'
                      ? '可接單'
                      : driver.status === 'busy'
                      ? '配送中'
                      : '離線'}
                  </span>
                </p>
                {driver.lastLocationUpdate && (
                  <p style={{ margin: '4px 0', fontSize: '12px', color: COLORS.secondary }}>
                    更新：{new Date(driver.lastLocationUpdate).toLocaleString('zh-TW')}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* 待配送訂單標記 */}
      {readyOrders.map((order, index) => {
        if (!order.latitude || !order.longitude) return null;

        const icon = createIcon(COLORS.warning, '📦');

        return (
          <Marker
            key={`ready-${order.id}`}
            position={[order.latitude, order.longitude]}
            icon={icon}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <h6 style={{ margin: '0 0 8px 0', color: COLORS.primary }}>
                  待配送 - {order.contactName}
                </h6>
                <p style={{ margin: '4px 0', fontSize: '13px', color: COLORS.secondary }}>
                  {order.address}
                </p>
                <p
                  style={{
                    margin: '8px 0 0 0',
                    fontSize: '12px',
                    color: COLORS.warning,
                    fontWeight: 600
                  }}
                >
                  尚未分配外送員
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* 配送中訂單標記 */}
      {deliveringOrders.map((order, index) => {
        if (!order.latitude || !order.longitude) return null;

        const icon = createIcon(COLORS.info, '🎯');
        const driver = order.driverId ? drivers.find(d => d.id === order.driverId) : null;

        return (
          <Marker
            key={`delivering-${order.id}`}
            position={[order.latitude, order.longitude]}
            icon={icon}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <h6 style={{ margin: '0 0 8px 0', color: COLORS.primary }}>
                  配送中 - {order.contactName}
                </h6>
                <p style={{ margin: '4px 0', fontSize: '13px', color: COLORS.secondary }}>
                  {order.address}
                </p>
                {driver && (
                  <p
                    style={{
                      margin: '8px 0 0 0',
                      fontSize: '12px',
                      color: COLORS.info,
                      fontWeight: 600
                    }}
                  >
                    外送員：{driver.name}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* 配送路線 */}
      {deliveryRoutes.map((route, index) => (
        <Polyline
          key={`route-${index}`}
          positions={[route.driverPos, route.orderPos]}
          pathOptions={{
            color: COLORS.routeLine,
            weight: 3,
            opacity: 0.6,
            dashArray: '10, 10'
          }}
        />
      ))}
    </MapContainer>
  );
}
