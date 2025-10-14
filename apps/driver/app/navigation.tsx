import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, Dimensions } from 'react-native';
import { Button, Card, IconButton, Text } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { type Order } from '@chengyi/domain';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import OrderSequenceModal from './order-sequence';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// 簡約配色（低彩度、專業感）
const COLORS = {
  primary: '#2C3E50',      // 深灰
  secondary: '#546E7A',    // 中灰
  background: '#ECEFF1',   // 淺灰
  white: '#FFFFFF',        // 白色
  success: '#66BB6A',      // 柔和綠
  warning: '#FFA726',      // 柔和橘
  error: '#EF5350',        // 柔和紅
  info: '#42A5F5',         // 柔和藍
  routeLine: '#546E7A',    // 路線顏色
};

interface NavigationParams {
  orderIds: string;
  token: string;
}

interface RouteInfo {
  distance: number;
  duration: number;
  polyline: Array<{ latitude: number; longitude: number }>;
}

interface ApiResponse<T> {
  data: T;
}

export default function NavigationPage() {
  const router = useRouter();
  const params = useLocalSearchParams<NavigationParams>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const mapRef = useRef<MapView>(null);
  const locationWatchId = useRef<number | null>(null);

  const orderIds = useMemo(() => params.orderIds?.split(',') ?? [], [params.orderIds]);
  const token = params.token;
  const currentOrder = orders[currentIndex];

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const apiRequest = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...authHeader,
          ...(options.headers as Record<string, string> | undefined)
        }
      });

      if (!response.ok) {
        throw new Error(`請求失敗: ${response.status}`);
      }

      return (await response.json()) as T;
    },
    [authHeader]
  );

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiRequest<ApiResponse<Order[]>>('/api/v1/drivers/me/orders/active');
      const filteredOrders = result.data.filter(order => orderIds.includes(order.id));
      setOrders(filteredOrders);
    } catch (err: any) {
      setError(err?.message ?? '取得訂單失敗');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, orderIds]);

  const fetchRoute = useCallback(
    async (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
      try {
        // 簡化版：使用直線路徑（實際應串接 Google Maps Directions API）
        setRouteInfo({
          distance: 0,
          duration: 0,
          polyline: [from, to]
        });
      } catch (err) {
        console.error('取得路線失敗:', err);
      }
    },
    []
  );

  const handleMarkDelivered = useCallback(async () => {
    if (!currentOrder) return;

    try {
      await apiRequest(`/api/v1/drivers/orders/${currentOrder.id}/deliver`, {
        method: 'POST'
      });

      if (currentIndex < orders.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        router.back();
      }
    } catch (err: any) {
      setError(err?.message ?? '標記送達失敗');
    }
  }, [apiRequest, currentOrder, currentIndex, orders.length, router]);

  const handleSkipToNext = useCallback(() => {
    if (currentIndex < orders.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, orders.length]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleReorderOrders = useCallback((newOrders: Order[]) => {
    setOrders(newOrders);
  }, []);

  const handleSelectOrder = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
      locationWatchId.current = navigator.geolocation.watchPosition(
        position => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setCurrentLocation(location);

          if (currentOrder?.latitude && currentOrder?.longitude) {
            fetchRoute(location, { latitude: currentOrder.latitude, longitude: currentOrder.longitude });
          }
        },
        err => console.error('定位失敗:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );

      return () => {
        if (locationWatchId.current && navigator.geolocation) {
          navigator.geolocation.clearWatch(locationWatchId.current);
        }
      };
    } else if (Platform.OS !== 'web') {
      locationWatchId.current = Geolocation.watchPosition(
        position => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setCurrentLocation(location);

          if (currentOrder?.latitude && currentOrder?.longitude) {
            fetchRoute(location, { latitude: currentOrder.latitude, longitude: currentOrder.longitude });
          }
        },
        err => console.error('定位失敗:', err),
        { enableHighAccuracy: true, distanceFilter: 10, interval: 10000 }
      );

      return () => {
        if (locationWatchId.current !== null) {
          Geolocation.clearWatch(locationWatchId.current);
        }
      };
    }
  }, [currentOrder, fetchRoute]);

  useEffect(() => {
    if (currentLocation && mapRef.current && currentOrder?.latitude && currentOrder?.longitude) {
      mapRef.current.fitToCoordinates(
        [currentLocation, { latitude: currentOrder.latitude, longitude: currentOrder.longitude }],
        {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true
        }
      );
    }
  }, [currentLocation, currentOrder]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text variant="bodyLarge" style={styles.loadingText}>
            載入中...
          </Text>
        </View>
      </View>
    );
  }

  if (error || orders.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text variant="bodyLarge" style={styles.errorText}>
            {error || '沒有可配送的訂單'}
          </Text>
          <Button mode="contained" onPress={handleGoBack} style={styles.errorButton}>
            返回
          </Button>
        </View>
      </View>
    );
  }

  const initialRegion =
    currentLocation && currentOrder?.latitude && currentOrder?.longitude
      ? {
          latitude: (currentLocation.latitude + currentOrder.latitude) / 2,
          longitude: (currentLocation.longitude + currentOrder.longitude) / 2,
          latitudeDelta: Math.abs(currentLocation.latitude - currentOrder.latitude) * 2 || 0.01,
          longitudeDelta: Math.abs(currentLocation.longitude - currentOrder.longitude) * 2 || 0.01
        }
      : {
          latitude: currentOrder?.latitude ?? 25.033,
          longitude: currentOrder?.longitude ?? 121.5654,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        };

  return (
    <View style={styles.container}>
      {/* 85% 地圖區域 */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {currentLocation && (
            <Marker coordinate={currentLocation} title="您的位置" pinColor={COLORS.info} />
          )}

          {currentOrder?.latitude && currentOrder?.longitude && (
            <Marker
              coordinate={{ latitude: currentOrder.latitude, longitude: currentOrder.longitude }}
              title={`${currentIndex + 1}. ${currentOrder.contactName}`}
              description={currentOrder.address}
              pinColor={COLORS.success}
            />
          )}

          {routeInfo?.polyline && (
            <Polyline
              coordinates={routeInfo.polyline}
              strokeColor={COLORS.routeLine}
              strokeWidth={4}
            />
          )}
        </MapView>

        <IconButton
          icon="arrow-left"
          mode="contained"
          containerColor={COLORS.white}
          iconColor={COLORS.primary}
          size={24}
          style={styles.backButton}
          onPress={handleGoBack}
        />

        {orders.length > 1 && (
          <IconButton
            icon="format-list-numbered"
            mode="contained"
            containerColor={COLORS.white}
            iconColor={COLORS.primary}
            size={24}
            style={styles.sequenceButton}
            onPress={() => setShowSequenceModal(true)}
          />
        )}
      </View>

      {/* 15% 狀態列 */}
      <View style={styles.statusBar}>
        <Card style={styles.statusCard}>
          <Card.Content style={styles.statusContent}>
            <View style={styles.orderInfo}>
              <Text variant="titleMedium" style={styles.orderTitle}>
                {currentIndex + 1} / {orders.length} - {currentOrder?.contactName}
              </Text>
              <Text variant="bodyMedium" style={styles.orderAddress} numberOfLines={1}>
                {currentOrder?.address}
              </Text>
              <Text variant="bodySmall" style={styles.orderPhone}>
                {currentOrder?.contactPhone}
              </Text>
            </View>

            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                onPress={handleMarkDelivered}
                style={styles.deliveredButton}
                buttonColor={COLORS.success}
                textColor={COLORS.white}
              >
                已送達
              </Button>
              {currentIndex < orders.length - 1 && (
                <Button
                  mode="outlined"
                  onPress={handleSkipToNext}
                  style={styles.skipButton}
                  textColor={COLORS.secondary}
                >
                  跳過
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>
      </View>

      <OrderSequenceModal
        visible={showSequenceModal}
        orders={orders}
        currentIndex={currentIndex}
        onDismiss={() => setShowSequenceModal(false)}
        onReorder={handleReorderOrders}
        onSelectOrder={handleSelectOrder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.85,
    position: 'relative'
  },
  map: {
    width: '100%',
    height: '100%'
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  sequenceButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  statusBar: {
    height: SCREEN_HEIGHT * 0.15,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.secondary + '30',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  statusCard: {
    margin: 0,
    borderRadius: 0,
    backgroundColor: COLORS.white,
    elevation: 0
  },
  statusContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  orderInfo: {
    flex: 1,
    marginRight: 12
  },
  orderTitle: {
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 4
  },
  orderAddress: {
    color: COLORS.secondary,
    marginBottom: 2
  },
  orderPhone: {
    color: COLORS.secondary
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8
  },
  deliveredButton: {
    minWidth: 80
  },
  skipButton: {
    minWidth: 60,
    borderColor: COLORS.secondary
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background
  },
  loadingText: {
    color: COLORS.secondary
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 24
  },
  errorText: {
    color: COLORS.error,
    marginBottom: 16,
    textAlign: 'center'
  },
  errorButton: {
    backgroundColor: COLORS.primary
  }
});
