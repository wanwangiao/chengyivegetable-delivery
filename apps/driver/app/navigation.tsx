import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  Divider,
  IconButton,
  Portal,
  Text,
  TextInput
} from 'react-native-paper';
import {
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type Order } from '@chengyi/domain';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { getOfflineQueueService } from '../services/offline-queue';
import OrderSequenceModal from './order-sequence';

const API_BASE = globalThis.process?.env?.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: '#2C3E50',
  secondary: '#546E7A',
  background: '#ECEFF1',
  white: '#FFFFFF',
  success: '#66BB6A',
  warning: '#FFA726',
  error: '#EF5350',
  info: '#42A5F5',
  routeLine: '#546E7A'
};

interface NavigationParams {
  orderIds: string;
  token: string;
}

interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  polyline: Array<{ latitude: number; longitude: number }>;
  steps?: Array<{ instruction: string; distance: number; duration: number }>;
}

interface ApiResponse<T> {
  data: T;
}

type ApiRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

const isNetworkError = (message: string) =>
  message.includes('Failed to fetch') ||
  message.includes('NetworkError') ||
  message.includes('Network request failed');

const safeParseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
  if (!encoded) return [];
  const coordinates: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5
    });
  }

  return coordinates;
};

const formatDistance = (meters?: number): string => {
  if (meters === undefined || Number.isNaN(meters)) {
    return 'N/A';
  }
  if (meters < 1000) {
    return `${meters.toFixed(0)} 公尺`;
  }
  return `${(meters / 1000).toFixed(1)} 公里`;
};

const formatDuration = (seconds?: number): string => {
  if (seconds === undefined || Number.isNaN(seconds)) {
    return 'N/A';
  }
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} 分`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} 小時 ${minutes} 分`;
};

const calculateHaversineDistance = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number => {
  const R = 6371000;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default function NavigationPage() {
  const router = useRouter();
  const params = useLocalSearchParams<NavigationParams>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [problemDialogVisible, setProblemDialogVisible] = useState(false);
  const [problemReason, setProblemReason] = useState('');
  const [submittingProblem, setSubmittingProblem] = useState(false);
  const mapRef = useRef<MapView>(null);
  const locationWatchId = useRef<number | null>(null);
  const offlineQueue = useMemo(() => getOfflineQueueService(), []);

  const orderIds = useMemo(() => params.orderIds?.split(',') ?? [], [params.orderIds]);
  const token = params.token;
  const currentOrder = orders[currentIndex];

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const apiRequest = useCallback(
    async <T,>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
      const method = options.method ?? 'GET';
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...authHeader,
        ...(options.headers ?? {})
      };

      const isFormData =
        typeof globalThis.FormData !== 'undefined' && options.body instanceof globalThis.FormData;

      if (options.body && !isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const isOnline =
        typeof globalThis.navigator !== 'undefined' ? globalThis.navigator.onLine : true;

      if (!isOnline && method !== 'GET') {
        if (isFormData) {
          throw new Error('目前離線，請稍後再上傳附件');
        }
        const queuedBody = options.body ? safeParseJson(options.body) : undefined;
        offlineQueue.enqueue({
          url: `${API_BASE}${path}`,
          method,
          body: queuedBody,
          headers
        });
        throw new Error('網路中斷，請稍後再試');
      }

      try {
        const fetchFn = globalThis.fetch?.bind(globalThis);
        if (!fetchFn) {
          throw new Error('執行環境不支援網路請求');
        }
        const requestBody =
          options.body === undefined
            ? undefined
            : isFormData || typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body);
        const response = await fetchFn(
          `${API_BASE}${path}`,
          {
            method,
            headers,
            body: requestBody
          } as Parameters<typeof fetchFn>[1]
        );

        if (!response.ok) {
          let messageText = `請求失敗 (${response.status})`;
          try {
            const payload = await response.json();
            if (payload?.error) messageText = payload.error;
            if (payload?.message) messageText = payload.message;
          } catch {
            // ignore
          }
          throw new Error(messageText);
        }

        if (response.status === 204) {
          return undefined as T;
        }

        return (await response.json()) as T;
      } catch (err: unknown) {
        const messageText =
          typeof (err as { message?: string })?.message === 'string'
            ? (err as { message: string }).message
            : '請求失敗';

        if (isNetworkError(messageText) && method !== 'GET') {
          if (options.body instanceof globalThis.FormData) {
            throw new Error('網路錯誤，附件未送出，請稍後再試');
          }
          const queuedBody = options.body ? safeParseJson(options.body) : undefined;
          offlineQueue.enqueue({
            url: `${API_BASE}${path}`,
            method,
            body: queuedBody,
            headers
          });
          throw new Error('網路錯誤，請求已暫存，恢復後將自動補送');
        }

        throw err;
      }
    },
    [authHeader, offlineQueue]
  );

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiRequest<ApiResponse<Order[]>>('/api/v1/drivers/me/orders/active');
      const filtered = result.data.filter(order => orderIds.includes(order.id));
      filtered.sort((a, b) => (a.driverSequence ?? 9999) - (b.driverSequence ?? 9999));
      setOrders(filtered);
    } catch (err: unknown) {
      const messageText =
        typeof (err as { message?: string })?.message === 'string'
          ? (err as { message: string }).message
          : '載入訂單失敗';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, orderIds]);

  const fetchRoute = useCallback(
    async (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
      if (!Number.isFinite(from.latitude) || !Number.isFinite(from.longitude) || !Number.isFinite(to.latitude) || !Number.isFinite(to.longitude)) {
        return;
      }

      try {
        const response = await apiRequest<ApiResponse<{
          distance: number;
          duration: number;
          polyline: string;
          steps?: Array<{ instruction: string; distance: number; duration: number }>;
        }>>('/api/v1/drivers/routes/optimize', {
          method: 'POST',
          body: {
            origin: { lat: from.latitude, lng: from.longitude },
            destination: { lat: to.latitude, lng: to.longitude }
          }
        });

        const payload = response.data;
        const polylinePoints = decodePolyline(payload.polyline);
        setRouteInfo({
          distanceMeters: payload.distance ?? 0,
          durationSeconds: payload.duration ?? 0,
          polyline: polylinePoints.length > 0 ? polylinePoints : [from, to],
          steps: payload.steps
        });
      } catch (err: unknown) {
        const distanceMeters = calculateHaversineDistance(from, to);
        setRouteInfo({
          distanceMeters,
          durationSeconds: distanceMeters / (30_000 / 60),
          polyline: [from, to]
        });

        const messageText =
          typeof (err as { message?: string })?.message === 'string'
            ? (err as { message: string }).message
            : undefined;

        if (messageText && !isNetworkError(messageText) && !messageText.includes('MAPS_SERVICE_UNAVAILABLE')) {
          setError(messageText);
        }
      }
    },
    [apiRequest]
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
    } catch (err: unknown) {
      const messageText =
        typeof (err as { message?: string })?.message === 'string'
          ? (err as { message: string }).message
          : '標記已送達失敗';
      setError(messageText);
    }
  }, [apiRequest, currentOrder, currentIndex, orders.length, router]);

  const handleSkipToNext = useCallback(() => {
    if (currentIndex < orders.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, orders.length]);

  const handleCallCustomer = useCallback(() => {
    if (!currentOrder?.contactPhone) return;
    Linking.openURL(`tel:${currentOrder.contactPhone}`).catch(() => setError('無法啟動電話程式'));
  }, [currentOrder]);

  const handleOpenExternalMap = useCallback(() => {
    if (!currentOrder) return;

    if (currentOrder.latitude && currentOrder.longitude) {
      const destination = `${currentOrder.latitude},${currentOrder.longitude}`;
      const url = Platform.select({
        ios: `http://maps.apple.com/?daddr=${destination}`,
        android: `google.navigation:q=${destination}`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${destination}`
      });
      if (url) {
        Linking.openURL(url).catch(() => setError('無法開啟地圖程式'));
      }
    } else if (currentOrder.address) {
      const encoded = encodeURIComponent(currentOrder.address);
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
      Linking.openURL(url).catch(() => setError('無法開啟地圖程式'));
    }
  }, [currentOrder]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleReorderOrders = useCallback(
    async (newOrders: Order[]) => {
      setOrders(newOrders);
      try {
        const sequences = newOrders.map((order, index) => ({
          orderId: order.id,
          sequence: index + 1
        }));
        const result = await apiRequest<ApiResponse<Order[]>>('/api/v1/drivers/me/orders/reorder', {
          method: 'POST',
          body: { sequences }
        });
        const updated = result.data ?? newOrders;
        updated.sort((a, b) => (a.driverSequence ?? 9999) - (b.driverSequence ?? 9999));
        setOrders(updated);
        setCurrentIndex(prev => Math.min(prev, updated.length - 1));
      } catch (err: unknown) {
        const messageText =
          typeof (err as { message?: string })?.message === 'string'
            ? (err as { message: string }).message
            : '同步順序時發生錯誤';
        setError(messageText);
        await fetchOrders();
      }
    },
    [apiRequest, fetchOrders]
  );

  const handleSelectOrder = useCallback((index: number) => {
    setPanelExpanded(false);
    setCurrentIndex(index);
  }, []);

  const openProblemDialog = useCallback(() => {
    setProblemReason('');
    setProblemDialogVisible(true);
  }, []);

  const closeProblemDialog = useCallback(() => {
    if (submittingProblem) return;
    setProblemDialogVisible(false);
  }, [submittingProblem]);

  const confirmProblem = useCallback(async () => {
    if (!currentOrder || !problemReason.trim()) {
      setError('請輸入問題描述');
      return;
    }
    try {
      setSubmittingProblem(true);
      await apiRequest(`/api/v1/drivers/orders/${currentOrder.id}/problem`, {
        method: 'POST',
        body: { reason: problemReason.trim() }
      });
      setProblemDialogVisible(false);
      setProblemReason('');
      await fetchOrders();
    } catch (err: unknown) {
      const messageText =
        typeof (err as { message?: string })?.message === 'string'
          ? (err as { message: string }).message
          : '問題回報失敗';
      setError(messageText);
    } finally {
      setSubmittingProblem(false);
    }
  }, [apiRequest, currentOrder, fetchOrders, problemReason]);

  useEffect(() => {
    if (!currentOrder?.latitude || !currentOrder?.longitude || !currentLocation) {
      return;
    }
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: currentOrder.latitude,
          longitude: currentOrder.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01
        },
        500
      );
    }
  }, [currentOrder, currentLocation, fetchRoute]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (globalThis.navigator?.geolocation) {
        locationWatchId.current = globalThis.navigator.geolocation.watchPosition(
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
          err => globalThis.console?.error?.('定位失敗:', err),
          { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
        );
      }
      return () => {
        if (locationWatchId.current && globalThis.navigator?.geolocation) {
          globalThis.navigator.geolocation.clearWatch(locationWatchId.current);
        }
      };
    }

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
      err => globalThis.console?.error?.('定位失敗:', err),
      { enableHighAccuracy: true, distanceFilter: 10, interval: 10_000 }
    );

    return () => {
      if (locationWatchId.current !== null) {
        Geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, [currentOrder, fetchRoute]);

  if (loading && orders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>正在載入配送路線…</Text>
      </View>
    );
  }

  if (!currentOrder) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>目前沒有配送中的訂單</Text>
        <Button mode="contained" onPress={handleGoBack} style={styles.errorButton}>
          返回列表
        </Button>
      </View>
    );
  }

  const remainingCount = orders.length - currentIndex;

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          initialRegion={{
            latitude: currentOrder.latitude ?? 25.0478,
            longitude: currentOrder.longitude ?? 121.5319,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02
          }}
        >
          {orders.map((order, index) =>
            order.latitude && order.longitude ? (
              <Marker
                key={order.id}
                coordinate={{ latitude: order.latitude, longitude: order.longitude }}
                title={`${index + 1}. ${order.contactName}`}
                description={order.address}
                pinColor={index === currentIndex ? COLORS.success : COLORS.info}
              />
            ) : null
          )}
          {routeInfo?.polyline && routeInfo.polyline.length > 1 ? (
            <Polyline coordinates={routeInfo.polyline} strokeColor={COLORS.routeLine} strokeWidth={4} />
          ) : null}
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
      </View>

      <View
        style={[
          styles.bottomPanel,
          panelExpanded ? styles.panelExpanded : styles.panelCollapsed
        ]}
      >
        <TouchableOpacity style={styles.panelGripContainer} onPress={() => setPanelExpanded(prev => !prev)}>
          <View style={styles.panelGrip} />
        </TouchableOpacity>

        <View style={styles.panelContent}>
          <View style={styles.headerRow}>
            <View style={styles.orderSummary}>
              <Text variant="titleMedium" style={styles.orderTitle}>
                第 {currentIndex + 1} / {orders.length} 單 · {currentOrder.contactName}
              </Text>
              <Text variant="bodyMedium" style={styles.orderAddress} numberOfLines={1}>
                {currentOrder.address}
              </Text>
              <View style={styles.chipRow}>
                <Chip icon="list-status" compact>
                  剩餘 {remainingCount} 單
                </Chip>
                <Chip icon="map-marker-distance" compact>
                  {formatDistance(routeInfo?.distanceMeters)}
                </Chip>
                <Chip icon="clock-outline" compact>
                  {formatDuration(routeInfo?.durationSeconds)}
                </Chip>
              </View>
            </View>

            <View style={styles.primaryActions}>
              <Button
                mode="contained"
                onPress={handleMarkDelivered}
                buttonColor={COLORS.success}
                textColor={COLORS.white}
                style={styles.primaryButton}
              >
                已送達
              </Button>
              {currentIndex < orders.length - 1 ? (
                <Button
                  mode="outlined"
                  onPress={handleSkipToNext}
                  textColor={COLORS.secondary}
                  style={styles.primaryButton}
                >
                  下一單
                </Button>
              ) : null}
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.quickActions}>
            <Button icon="phone" mode="text" onPress={handleCallCustomer} textColor={COLORS.primary}>
              撥打電話
            </Button>
            <Button icon="map" mode="text" onPress={handleOpenExternalMap} textColor={COLORS.primary}>
              開啟導航
            </Button>
            <Button icon="alert" mode="text" onPress={openProblemDialog} textColor={COLORS.warning}>
              回報問題
            </Button>
            <Button icon="format-list-numbered" mode="text" onPress={() => setShowSequenceModal(true)} textColor={COLORS.primary}>
              調整順序
            </Button>
          </View>

          {error ? (
            <Chip icon="alert-circle" style={styles.errorChip} onClose={() => setError(null)}>
              {error}
            </Chip>
          ) : null}

          {panelExpanded ? (
            <ScrollView style={styles.orderList} contentContainerStyle={styles.orderListContent}>
              {orders.map((order, index) => (
                <TouchableOpacity key={order.id} onPress={() => handleSelectOrder(index)} activeOpacity={0.7}>
                  <View
                    style={[
                      styles.orderItem,
                      index === currentIndex && styles.orderItemActive
                    ]}
                  >
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderBadgeText}>{index + 1}</Text>
                    </View>
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderName}>{order.contactName}</Text>
                      <Text style={styles.orderAddressSmall} numberOfLines={1}>
                        {order.address}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>

      <OrderSequenceModal
        visible={showSequenceModal}
        orders={orders}
        currentIndex={currentIndex}
        onDismiss={() => setShowSequenceModal(false)}
        onReorder={handleReorderOrders}
        onSelectOrder={handleSelectOrder}
      />

      <Portal>
        <Dialog visible={problemDialogVisible} onDismiss={closeProblemDialog}>
          <Dialog.Title>回報配送問題</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="請描述問題細節"
              value={problemReason}
              onChangeText={setProblemReason}
              multiline
              numberOfLines={3}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeProblemDialog} disabled={submittingProblem}>
              取消
            </Button>
            <Button onPress={confirmProblem} loading={submittingProblem}>
              送出
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  mapContainer: {
    flex: 1
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
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: COLORS.white,
    paddingBottom: 16,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12
  },
  panelCollapsed: {
    height: SCREEN_HEIGHT * 0.22
  },
  panelExpanded: {
    height: SCREEN_HEIGHT * 0.4
  },
  panelGripContainer: {
    alignItems: 'center',
    paddingVertical: 8
  },
  panelGrip: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: `${COLORS.secondary}55`
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: 16
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  orderSummary: {
    flex: 1
  },
  orderTitle: {
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 4
  },
  orderAddress: {
    color: COLORS.secondary
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  primaryActions: {
    justifyContent: 'flex-start',
    gap: 8
  },
  primaryButton: {
    minWidth: 110
  },
  divider: {
    marginVertical: 8
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  errorChip: {
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  orderList: {
    marginTop: 12
  },
  orderListContent: {
    paddingBottom: 24,
    gap: 10
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F5F7FA'
  },
  orderItemActive: {
    borderWidth: 1,
    borderColor: COLORS.success,
    backgroundColor: '#E2F4EC'
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  orderBadgeText: {
    color: COLORS.white,
    fontWeight: '600'
  },
  orderInfo: {
    flex: 1
  },
  orderName: {
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2
  },
  orderAddressSmall: {
    color: COLORS.secondary,
    fontSize: 12
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background
  },
  loadingText: {
    marginTop: 12,
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
