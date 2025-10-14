import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Snackbar,
  Text,
  TextInput,
  Badge
} from 'react-native-paper';
import { type Order } from '@chengyi/domain';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { getOfflineQueueService } from '../services/offline-queue';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000';
const TOKEN_STORAGE_KEY = 'chengyi_driver_token';

interface DriverProfile {
  id: string;
  name: string;
  phone?: string;
  status: string;
  currentLat?: number;
  currentLng?: number;
}

interface ApiResponse<T> {
  data: T;
}

const statusOptions: Array<{ label: string; value: string; description: string }> = [
  { label: '上線接單', value: 'available', description: '可接收新訂單' },
  { label: '配送中', value: 'busy', description: '僅可處理現有訂單' },
  { label: '離線', value: 'offline', description: '暫停接單' }
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);

type FetchOptions = RequestInit & { skipAuth?: boolean };

export default function DriverDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [problemOrders, setProblemOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const offlineQueueService = useMemo(() => getOfflineQueueService(), []);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const saveToken = useCallback((value: string | null) => {
    if (typeof window !== 'undefined') {
      if (value) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
    setToken(value);
  }, []);

  const apiRequest = useCallback(
    async <T,>(path: string, options: FetchOptions = {}): Promise<T> => {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(!options.skipAuth ? (authHeader as Record<string, string>) : {})
      };

      if (options.body && !(options.body instanceof FormData) && options.headers?.['Content-Type'] === undefined) {
        headers['Content-Type'] = 'application/json';
      }

      // 檢查網路狀態
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      if (!isOnline && options.method && options.method !== 'GET') {
        // 離線時將非 GET 請求加入佇列
        offlineQueueService.enqueue({
          url: `${API_BASE}${path}`,
          method: options.method,
          body: options.body && !(options.body instanceof FormData) ? JSON.parse(options.body as string) : undefined,
          headers
        });
        setQueueLength(offlineQueueService.getQueueLength());
        throw new Error('目前離線，請求已加入佇列，網路恢復後將自動重試');
      }

      try {
        const response = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers: {
            ...headers,
            ...(options.headers as Record<string, string> | undefined)
          }
        });

        if (response.status === 401 && !options.skipAuth) {
          saveToken(null);
          setProfile(null);
          throw new Error('未授權或登入逾期，請重新登入');
        }

        if (!response.ok) {
          let errorMessage = `操作失敗 (${response.status})`;
          try {
            const payload = await response.json();
            if (payload?.error) {
              errorMessage = payload.error;
            }
            if (payload?.message) {
              errorMessage = payload.message;
            }
          } catch {
            // ignore json parse error
          }
          throw new Error(errorMessage);
        }

        if (response.status === 204) {
          return undefined as T;
        }

        return (await response.json()) as T;
      } catch (error: any) {
        // 網路錯誤時加入佇列（非 HTTP 錯誤）
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          if (options.method && options.method !== 'GET') {
            offlineQueueService.enqueue({
              url: `${API_BASE}${path}`,
              method: options.method,
              body: options.body && !(options.body instanceof FormData) ? JSON.parse(options.body as string) : undefined,
              headers
            });
            setQueueLength(offlineQueueService.getQueueLength());
            throw new Error('網路錯誤，請求已加入佇列，網路恢復後將自動重試');
          }
        }
        throw error;
      }
    },
    [authHeader, saveToken, offlineQueueService]
  );

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    const result = await apiRequest<ApiResponse<DriverProfile>>('/api/v1/drivers/me');
    setProfile(result.data);
  }, [apiRequest, token]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [available, active, history, problem] = await Promise.all([
        apiRequest<ApiResponse<Order[]>>('/api/v1/drivers/available-orders'),
        apiRequest<ApiResponse<Order[]>>('/api/v1/drivers/me/orders/active'),
        apiRequest<ApiResponse<Order[]>>('/api/v1/drivers/me/orders/history?limit=15'),
        apiRequest<ApiResponse<Order[]>>('/api/v1/drivers/me/orders/problem?limit=10')
      ]);
      setAvailableOrders(available.data ?? []);
      setActiveOrders(active.data ?? []);
      setHistoryOrders(history.data ?? []);
      setProblemOrders(problem.data ?? []);
    } catch (error: any) {
      setMessage(error?.message ?? '取得訂單資料失敗');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, token]);

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      setMessage('請輸入帳號與密碼');
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiRequest<{ accessToken: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
        skipAuth: true
      });
      saveToken(result.accessToken);
      setMessage('登入成功');
      setPassword('');
    } catch (error: any) {
      setMessage(error?.message ?? '登入失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }, [apiRequest, email, password, saveToken]);

  const handleLogout = useCallback(() => {
    saveToken(null);
    setProfile(null);
    setAvailableOrders([]);
    setActiveOrders([]);
    setHistoryOrders([]);
    setProblemOrders([]);
  }, [saveToken]);

  const handleClaimOrder = useCallback(
    async (orderId: string) => {
      try {
        await apiRequest<ApiResponse<Order>>(`/api/v1/drivers/orders/${orderId}/claim`, {
          method: 'POST'
        });
        setMessage('已成功接下訂單');
        await fetchOrders();
      } catch (error: any) {
        setMessage(error?.message ?? '接單失敗');
      }
    },
    [apiRequest, fetchOrders]
  );

  const handleMarkDelivered = useCallback(
    async (orderId: string) => {
      try {
        await apiRequest<ApiResponse<Order>>(`/api/v1/drivers/orders/${orderId}/deliver`, {
          method: 'POST'
        });
        setMessage('已標記為送達');
        await fetchOrders();
      } catch (error: any) {
        setMessage(error?.message ?? '操作失敗');
      }
    },
    [apiRequest, fetchOrders]
  );

  const handleSubmitProblem = useCallback(
    async (orderId: string) => {
      if (!globalThis.prompt) {
        setMessage('此裝置不支援即時輸入，請聯絡客服或於網頁版回報。');
        return;
      }
      const reason = globalThis.prompt('請輸入問題描述（至少 3 個字）');
      if (!reason) return;
      try {
        await apiRequest<ApiResponse<Order>>(`/api/v1/drivers/orders/${orderId}/problem`, {
          method: 'POST',
          body: JSON.stringify({ reason })
        });
        setMessage('已回報問題，請留意客服通知');
        await fetchOrders();
      } catch (error: any) {
        setMessage(error?.message ?? '回報失敗');
      }
    },
    [apiRequest, fetchOrders]
  );

  const handleUploadProof = useCallback(
    async (orderId: string) => {
      if (Platform.OS === 'web') {
        const doc = globalThis.document as Document | undefined;
        if (!doc) {
          setMessage('瀏覽器環境異常，無法選擇檔案');
          return;
        }
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          const formData = new FormData();
          formData.append('proof', file);
          try {
            await apiRequest<ApiResponse<any>>(`/api/v1/drivers/orders/${orderId}/proof`, {
              method: 'POST',
              body: formData
            });
            setMessage('已上傳送達照片');
            await fetchOrders();
          } catch (error: any) {
            setMessage(error?.message ?? '上傳失敗');
          }
        };
        input.click();
        return;
        return;
      }

      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        setMessage('需要相機權限才能拍攝送達照片');
        return;
      }

      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        setMessage('需要媒體庫權限才能儲存照片');
        return;
      }

      const capture = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6
      });

      if (capture.canceled || !capture.assets?.length) {
        setMessage('已取消拍照');
        return;
      }

      const asset = capture.assets[0];
      const formData = new FormData();
      formData.append('proof', {
        uri: asset.uri,
        name: asset.fileName ?? `proof-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg'
      } as any);

      try {
        await apiRequest<ApiResponse<any>>(`/api/v1/drivers/orders/${orderId}/proof`, {
          method: 'POST',
          body: formData
        });
        setMessage('已上傳送達照片');
        await fetchOrders();
      } catch (error: any) {
        setMessage(error?.message ?? '上傳失敗');
      }
    },
    [apiRequest, fetchOrders]
  );

  const handleStatusChange = useCallback(
    async (status: string) => {
      if (!profile) return;
      try {
        await apiRequest<ApiResponse<any>>(`/api/v1/drivers/${profile.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status })
        });
        setProfile({ ...profile, status });
        setMessage('狀態已更新');
      } catch (error: any) {
        setMessage(error?.message ?? '狀態更新失敗');
      }
    },
    [apiRequest, profile]
  );

  const handleStartNavigation = useCallback(() => {
    if (activeOrders.length === 0) {
      setMessage('沒有配送中的訂單');
      return;
    }

    const orderIds = activeOrders.map(o => o.id).join(',');
    router.push(`/navigation?orderIds=${orderIds}&token=${token}`);
  }, [activeOrders, router, token]);

  useEffect(() => {
    if (token) {
      fetchProfile().catch(error => setMessage(error?.message ?? '取得外送員資料失敗'));
      fetchOrders();
    }
  }, [token, fetchProfile, fetchOrders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      setToken(stored);
    }

    // 設定網路恢復回調
    offlineQueueService.setOnlineCallback(() => {
      setMessage('網路已恢復，正在同步離線資料...');
      offlineQueueService.processQueue().then(() => {
        setQueueLength(offlineQueueService.getQueueLength());
        setMessage('離線資料同步完成');
        fetchOrders();
      });
    });

    // 初始佇列長度
    setQueueLength(offlineQueueService.getQueueLength());

    // 如果有待處理請求且現在線上，立即處理
    if (navigator.onLine && offlineQueueService.hasPendingRequests()) {
      offlineQueueService.processQueue().then(() => {
        setQueueLength(offlineQueueService.getQueueLength());
      });
    }
  }, [offlineQueueService]);

  const locationWatchId = useRef<number | null>(null);
  const lastLocationSentAt = useRef<number>(0);

  const sendLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!profile) return;
      try {
        await apiRequest<ApiResponse<any>>(`/api/v1/drivers/${profile.id}/location`, {
          method: 'PATCH',
          body: JSON.stringify({ lat, lng })
        });
        setLocationError(null);
      } catch (error: any) {
        setLocationError(error?.message ?? '上傳位置失敗');
      }
    },
    [apiRequest, profile]
  );

  useEffect(() => {
    if (!token || !profile) {
      if (locationWatchId.current && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
      locationWatchId.current = null;
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('此裝置不支援定位功能');
      return;
    }

    locationWatchId.current = navigator.geolocation.watchPosition(
      position => {
        const now = Date.now();
        if (now - lastLocationSentAt.current < 300000) {
          return;
        }
        lastLocationSentAt.current = now;
        void sendLocation(position.coords.latitude, position.coords.longitude);
      },
      error => {
        setLocationError(error.message);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 30000 }
    );

    return () => {
      if (locationWatchId.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
      locationWatchId.current = null;
    };
  }, [profile, sendLocation, token]);

  const renderOrderCard = (order: Order, actions?: React.ReactNode) => (
    <Card style={styles.card} key={order.id}>
      <Card.Title title={order.contactName} subtitle={`電話：${order.contactPhone}`} />
      <Card.Content>
        <Text style={styles.label}>配送地址</Text>
        <Text style={styles.value}>{order.address}</Text>
        <Divider style={styles.divider} />
        <Text style={styles.label}>訂單金額</Text>
        <Text style={styles.value}>{formatCurrency(order.totalAmount)}</Text>
        {order.notes ? (
          <>
            <Divider style={styles.divider} />
            <Text style={styles.label}>備註</Text>
            <Text style={styles.value}>{order.notes}</Text>
          </>
        ) : null}
      </Card.Content>
      {actions ? <Card.Actions style={styles.actions}>{actions}</Card.Actions> : null}
    </Card>
  );

  if (!token) {
    return (
      <View style={styles.container}>
        <Card style={styles.loginCard}>
          <Card.Title title="外送員登入" subtitle="請輸入帳號密碼" />
          <Card.Content>
            <TextInput
              label="Email"
              value={email}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              style={styles.input}
            />
            <TextInput
              label="密碼"
              value={password}
              secureTextEntry
              onChangeText={setPassword}
              style={styles.input}
            />
            <Button mode="contained" onPress={handleLogin} loading={submitting} disabled={submitting}>
              登入
            </Button>
          </Card.Content>
        </Card>
        <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={4000}>
          {message}
        </Snackbar>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="headlineSmall">嗨，{profile?.name ?? '外送員'} 👋</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              狀態：{profile?.status === 'available' ? '可接單' : profile?.status === 'busy' ? '配送中' : '離線'}
            </Text>
            {locationError ? <Text style={styles.warning}>定位警告：{locationError}</Text> : null}
            {queueLength > 0 && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueText}>
                  {queueLength} 個請求待同步
                </Text>
              </View>
            )}
          </View>
          <Button mode="outlined" onPress={handleLogout}>
            登出
          </Button>
        </View>

        <View style={styles.statusRow}>
          {statusOptions.map(option => (
            <Chip
              key={option.value}
              selected={profile?.status === option.value}
              onPress={() => handleStatusChange(option.value)}
              style={styles.statusChip}
            >
              {option.label}
            </Chip>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">待領訂單</Text>
          <Button mode="text" onPress={fetchOrders} disabled={loading}>
            重新整理
          </Button>
        </View>
        {loading && availableOrders.length === 0 && activeOrders.length === 0 ? (
          <ActivityIndicator style={{ marginVertical: 24 }} />
        ) : null}
        {availableOrders.length === 0 ? (
          <Text style={styles.empty}>目前沒有待領訂單</Text>
        ) : (
          availableOrders.map(order =>
            renderOrderCard(
              order,
              <Button mode="contained" onPress={() => handleClaimOrder(order.id)}>
                接單
              </Button>
            )
          )
        )}

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">配送中訂單</Text>
          {activeOrders.length > 0 && (
            <Button
              mode="contained"
              onPress={handleStartNavigation}
              icon="navigation"
              buttonColor="#2C3E50"
            >
              開始導航
            </Button>
          )}
        </View>
        {activeOrders.length === 0 ? (
          <Text style={styles.empty}>尚無配送中的訂單</Text>
        ) : (
          activeOrders.map(order =>
            renderOrderCard(
              order,
              <View style={styles.activeActions}>
                <Button mode="contained" onPress={() => handleMarkDelivered(order.id)}>
                  已送達
                </Button>
                <Button mode="outlined" onPress={() => handleUploadProof(order.id)}>
                  上傳照片
                </Button>
                <Button mode="text" onPress={() => handleSubmitProblem(order.id)}>
                  回報問題
                </Button>
              </View>
            )
          )
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          最近完成訂單
        </Text>
        {historyOrders.length === 0 ? (
          <Text style={styles.empty}>尚無完成紀錄</Text>
        ) : (
          historyOrders.map(order => renderOrderCard(order))
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          問題待處理
        </Text>
        {problemOrders.length === 0 ? (
          <Text style={styles.empty}>目前沒有回報中的訂單</Text>
        ) : (
          problemOrders.map(order => renderOrderCard(order))
        )}
      </ScrollView>

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={4000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb'
  },
  scroll: {
    padding: 16,
    paddingBottom: 80
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  headerText: {
    flex: 1,
    marginRight: 12
  },
  subtitle: {
    marginTop: 4,
    color: '#5e6a7d'
  },
  warning: {
    marginTop: 4,
    color: '#d9534f'
  },
  queueBadge: {
    marginTop: 6,
    backgroundColor: '#FFA726',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start'
  },
  queueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16
  },
  statusChip: {
    backgroundColor: '#ffffff'
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8
  },
  card: {
    marginBottom: 12
  },
  actions: {
    justifyContent: 'flex-end'
  },
  activeActions: {
    flexDirection: 'row',
    columnGap: 8,
    flexWrap: 'wrap'
  },
  label: {
    fontSize: 12,
    color: '#6c7a89'
  },
  value: {
    fontSize: 16,
    marginTop: 4,
    marginBottom: 4
  },
  divider: {
    marginVertical: 8
  },
  empty: {
    color: '#8a96a3',
    marginBottom: 8
  },
  loginCard: {
    width: '90%',
    maxWidth: 420
  },
  input: {
    marginBottom: 12
  }
});
