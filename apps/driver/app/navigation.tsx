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
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [problemDialogVisible, setProblemDialogVisible] = useState(false);
  const [problemReason, setProblemReason] = useState('');
  const [submittingProblem, setSubmittingProblem] = useState(false);
  const mapRef = useRef<MapView>(null);
  const locationWatchId = useRef<number | null>(null);

  const orderIds = useMemo(() => params.orderIds?.split(',') ?? [], [params.orderIds]);
  const token = params.token;
  const currentOrder = orders[currentIndex];

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const apiRequest = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const response = await (globalThis.fetch as typeof fetch)(`${API_BASE}${path}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': options.body instanceof FormData ? undefined : 'application/json',
          ...authHeader,
          ...(options.headers as Record<string, string> | undefined)
        }
      });

      if (!response.ok) {
        let message = `請求失敗 (${response.status})`;
        try {
          const payload = await response.json();
          if (payload?.message) message = payload.message;
          if (payload?.error) message = payload.error;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    },
    [authHeader]
  );

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiRequest<ApiResponse<Order[]>>('/api/v1/drivers/me/orders/active');
      const filtered = result.data.filter(order => orderIds.includes(order.id));
      setOrders(filtered);
    } catch (err: any) {
      setError(err?.message ?? '載入訂單失敗');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, orderIds]);

  const fetchRoute = useCallback(
    async (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
      try {
        setRouteInfo({
          distance: 0,
          duration: 0,
          polyline: [from, to]
        });
      } catch (err) {
        globalThis.console?.error?.('計算路線失敗:', err);
      }
    },
    []
  );

  const handleMarkDelivered = useCallback(async () => {
    if (!currentOrder) return;

    try {
      await apiRequest(`/api/v1/drivers/orders/${currentOrder.id}/deliver`, { method: 'POST' });
      if (currentIndex < orders.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        router.back();
      }
    } catch (err: any) {
      setError(err?.message ?? '標記已送達失敗');
    }
  }, [apiRequest, currentOrder, currentIndex, orders.length, router]);

  const handleSkipToNext = useCallback(() => {
    if (currentIndex < orders.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, orders.length]);

  const handleCallCustomer = useCallback(() => {
    if (!currentOrder?.contactPhone) return;
    Linking.openURL(`tel:${currentOrder.contactPhone}`).catch(() => setError('無法開啟電話程式'));
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

  const handleReorderOrders = useCallback((newOrders: Order[]) => {
    setOrders(newOrders);
  }, []);

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
        body: JSON.stringify({ reason: problemReason.trim() })
      });
      setProblemDialogVisible(false);
      setProblemReason('');
      await fetchOrders();
    } catch (err: any) {
      setError(err?.message ?? '問題回報失敗');
    } finally {
      setSubmittingProblem(false);
    }
  }, [apiRequest, currentOrder, fetchOrders, problemReason]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!currentOrder || !currentOrder.latitude || !currentOrder.longitude) return;
    if (currentLocation) {
      fetchRoute(currentLocation, { latitude: currentOrder.latitude, longitude: currentOrder.longitude });
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
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
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
      { enableHighAccuracy: true, distanceFilter: 10, interval: 10000 }
    );

    return () => {
      if (locationWatchId.current !== null) {
        Geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, [currentOrder, fetchRoute]);

  if (loading) {
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
          返回指派頁
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
          {routeInfo?.polyline ? (
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
                {routeInfo?.distance ? (
                  <Chip icon="map-marker-distance" compact>
                    距離 {routeInfo.distance.toFixed(1)} km
                  </Chip>
                ) : null}
                {currentOrder.contactPhone ? (
                  <Chip icon="phone" compact>
                    {currentOrder.contactPhone}
                  </Chip>
                ) : null}
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
    backgroundColor: COLORS.secondary + '55'
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
