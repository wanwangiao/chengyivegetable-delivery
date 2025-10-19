import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  Portal,
  Snackbar,
  Text,
  TextInput
} from 'react-native-paper';
import { type Order } from '@chengyi/domain';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { getOfflineQueueService } from '../services/offline-queue';
import { clearToken, loadToken, persistToken } from '../services/token-storage';

const API_BASE = globalThis.process?.env?.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000';
const LOCATION_STALE_THRESHOLD_MS = 10 * 60 * 1000;

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

interface RoutePlanPickup {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface RoutePlanStop {
  orderId: string;
  sequence: number;
  address: string;
  contactName: string;
  latitude: number;
  longitude: number;
  estimatedDistanceMeters: number;
  estimatedDurationSeconds: number;
}

interface BatchRecommendationOrderSummary {
  id: string;
  address: string;
  contactName: string;
  status: string;
  totalAmount: number;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

interface BatchRecommendationPreview {
  pickup: RoutePlanPickup;
  stops: RoutePlanStop[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

interface BatchRecommendation {
  id: string;
  orderIds: string[];
  orderCount: number;
  totalAmount: number;
  orders: BatchRecommendationOrderSummary[];
  preview?: BatchRecommendationPreview;
}

interface BatchRecommendationResult {
  generatedAt: string;
  pickup: RoutePlanPickup;
  batches: BatchRecommendation[];
  leftovers: BatchRecommendationOrderSummary[];
}

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  skipAuth?: boolean;
};

type NativeUploadFile = {
  uri: string;
  name: string;
  type: string;
};

const statusOptions: Array<{ label: string; value: string; description: string }> = [
  { label: '上線可接單', value: 'available', description: '可以接收新的訂單' },
  { label: '配送中', value: 'busy', description: '目前正在配送' },
  { label: '下線休息', value: 'offline', description: '暫時不接訂單' }
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);

const formatTimeLabel = (timestamp: number | null) => {
  if (!timestamp) return '尚未回報位置';
  return new Date(timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
};

const formatDistanceLabel = (meters?: number) => {
  if (!Number.isFinite(meters)) {
    return '—';
  }
  const value = Number(meters);
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} 公里`;
  }
  return `${value.toFixed(0)} 公尺`;
};

const formatDurationLabel = (seconds?: number) => {
  if (!Number.isFinite(seconds)) {
    return '—';
  }
  const value = Number(seconds);
  const minutes = Math.round(value / 60);
  if (minutes < 60) {
    return `${minutes} 分鐘`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} 小時 ${mins} 分`;
};

const safeParseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const isNetworkError = (message: string) =>
  message.includes('Failed to fetch') ||
  message.includes('NetworkError') ||
  message.includes('Network request failed');

export default function DriverDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
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
  const [queueLength, setQueueLength] = useState(0);
  const [lastLocationSyncedAt, setLastLocationSyncedAt] = useState<number | null>(null);
  const [locationStale, setLocationStale] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<BatchRecommendationResult | null>(null);
  const [claimingBatchId, setClaimingBatchId] = useState<string | null>(null);
  const [problemDialogVisible, setProblemDialogVisible] = useState(false);
  const [problemReason, setProblemReason] = useState('');
  const [problemOrderId, setProblemOrderId] = useState<string | null>(null);
  const [submittingProblem, setSubmittingProblem] = useState(false);
  const batchRecommendations = batchData?.batches ?? [];
  const batchLeftovers = batchData?.leftovers ?? [];
  const offlineQueueService = useMemo(() => getOfflineQueueService(), []);

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const saveToken = useCallback((value: string | null) => {
    if (value) {
      void persistToken(value);
    } else {
      void clearToken();
    }
    setToken(value);
  }, []);

  const apiRequest = useCallback(
    async <T,>(path: string, options: FetchOptions = {}): Promise<T> => {
      const { skipAuth, method = 'GET', headers: extraHeaders, body } = options;
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(skipAuth ? {} : authHeader),
        ...(extraHeaders ?? {})
      };

      const isFormData =
        typeof globalThis.FormData !== 'undefined' && body instanceof globalThis.FormData;

      if (body && !isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const isOnline = typeof globalThis.navigator !== 'undefined' ? globalThis.navigator.onLine : true;

      if (!isOnline && method !== 'GET') {
        if (isFormData) {
          throw new Error('目前離線，請稍後再上傳附件');
        }
        offlineQueueService.enqueue({
          url: `${API_BASE}${path}`,
          method,
          body: safeParseJson(body),
          headers
        });
        setQueueLength(offlineQueueService.getQueueLength());
        throw new Error('網路中斷，請求已暫存，恢復後將自動補送');
      }

      try {
        const fetchFn = globalThis.fetch?.bind(globalThis);
        if (!fetchFn) {
          throw new Error('執行環境不支援網路請求');
        }
        const requestBody =
          body === undefined
            ? undefined
            : isFormData || typeof body === 'string'
            ? body
            : JSON.stringify(body);

        const response = await fetchFn(
          `${API_BASE}${path}`,
          {
            method,
            headers,
            body: requestBody
          } as Parameters<typeof fetchFn>[1]
        );

        if (response.status === 401 && !skipAuth) {
          // Token 過期或無效，將請求加入離線佇列（如果適用）
          // 這樣離線佇列補送失敗時不會直接清除 token
          if (method !== 'GET' && !isFormData) {
            offlineQueueService.enqueue({
              url: `${API_BASE}${path}`,
              method,
              body: safeParseJson(body),
              headers
            });
            setQueueLength(offlineQueueService.getQueueLength());
          }

          // 只在首次401時清除token（非佇列補送）
          saveToken(null);
          setProfile(null);
          throw new Error('登入憑證已過期，請重新登入後系統將自動補送離線請求');
        }

        if (!response.ok) {
          let errorMessage = `請求失敗 (${response.status})`;
          try {
            const payload = await response.json();
            if (payload?.error) errorMessage = payload.error;
            if (payload?.message) errorMessage = payload.message;
          } catch {
            // ignore
          }
          throw new Error(errorMessage);
        }

        if (response.status === 204) {
          return undefined as T;
        }

        return (await response.json()) as T;
      } catch (error: unknown) {
        const messageText =
          typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : '請求失敗';

        if (isNetworkError(messageText) && method !== 'GET') {
          if (body instanceof globalThis.FormData) {
            throw new Error('網路錯誤，附件未送出，請稍後再試');
          }
          offlineQueueService.enqueue({
            url: `${API_BASE}${path}`,
            method,
            body: safeParseJson(body),
            headers
          });
          setQueueLength(offlineQueueService.getQueueLength());
          throw new Error('網路錯誤，請求已暫存，恢復後將自動補送');
        }

        throw error;
      }
    },
    [authHeader, offlineQueueService, saveToken]
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
      setActiveOrders((active.data ?? []).sort((a, b) => (a.driverSequence ?? 9999) - (b.driverSequence ?? 9999)));
      setHistoryOrders(history.data ?? []);
      setProblemOrders(problem.data ?? []);
    } catch (error: unknown) {
      const messageText =
        typeof (error as { message?: string })?.message === 'string'
          ? (error as { message: string }).message
          : '載入訂單資料失敗';
      setMessage(messageText);
    } finally {
      setLoading(false);
    }
  }, [apiRequest, token]);

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      setMessage('請輸入帳號與密碼');
      return;
    }
    setLoading(true);
    try {
      const result = await apiRequest<{ accessToken: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
        skipAuth: true
      });
      saveToken(result.accessToken);
      setMessage('登入成功');
      setPassword('');
    } catch (error: unknown) {
      const messageText =
        typeof (error as { message?: string })?.message === 'string'
          ? (error as { message: string }).message
          : '登入失敗，請稍後再試';
      setMessage(messageText);
    } finally {
      setLoading(false);
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
      } catch (error: unknown) {
        const messageText =
          typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : '接單失敗';
        setMessage(messageText);
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
      } catch (error: unknown) {
        const messageText =
          typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : '標記送達失敗';
        setMessage(messageText);
      }
    },
    [apiRequest, fetchOrders]
  );

  const openProblemDialog = useCallback((orderId: string) => {
    setProblemOrderId(orderId);
    setProblemReason('');
    setProblemDialogVisible(true);
  }, []);

  const closeProblemDialog = useCallback(() => {
    if (submittingProblem) return;
    setProblemDialogVisible(false);
    setProblemOrderId(null);
    setProblemReason('');
  }, [submittingProblem]);

  const submitProblemReport = useCallback(async () => {
    if (!problemOrderId) {
      return;
    }

    const trimmed = problemReason.trim();
    if (trimmed.length < 3) {
      setMessage('請至少輸入 3 個字的問題描述');
      return;
    }

    try {
      setSubmittingProblem(true);
      await apiRequest<ApiResponse<Order>>(`/api/v1/drivers/orders/${problemOrderId}/problem`, {
        method: 'POST',
        body: { reason: trimmed }
      });
      setMessage('已提交問題，客服將儘速聯繫');
      setProblemDialogVisible(false);
      setProblemOrderId(null);
      setProblemReason('');
      await fetchOrders();
    } catch (error: unknown) {
      const messageText =
        typeof (error as { message?: string })?.message === 'string'
          ? (error as { message: string }).message
          : '回報問題失敗';
      setMessage(messageText);
    } finally {
      setSubmittingProblem(false);
    }
  }, [apiRequest, fetchOrders, problemOrderId, problemReason]);

  const handleUploadProof = useCallback(
    async (orderId: string) => {
      if (Platform.OS === 'web') {
        const doc = globalThis.document;
        if (!doc) {
          setMessage('瀏覽器環境異常，無法開啟上傳視窗');
          return;
        }
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          const formData = new (globalThis.FormData ?? FormData)();
          formData.append('proof', file);
          try {
            await apiRequest<ApiResponse<unknown>>(`/api/v1/drivers/orders/${orderId}/proof`, {
              method: 'POST',
              body: formData
            });
            setMessage('已成功送出交貨證明');
            await fetchOrders();
          } catch (error: unknown) {
            const messageText =
              typeof (error as { message?: string })?.message === 'string'
                ? (error as { message: string }).message
                : '上傳失敗';
            setMessage(messageText);
          }
        };
        input.click();
        return;
      }

      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        setMessage('需要相機權限才能拍攝交貨照片');
        return;
      }

      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        setMessage('需要相簿權限才能存取照片');
        return;
      }

      const capture = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6
      });

      if (capture.canceled || !capture.assets?.length) {
        setMessage('已取消上傳');
        return;
      }

      const asset = capture.assets[0];
      const formData = new (globalThis.FormData ?? FormData)();
      formData.append('proof', {
        uri: asset.uri,
        name: asset.fileName ?? `proof-${Date.now()}.jpg`,
        type: asset.mimeType ?? 'image/jpeg'
      } as NativeUploadFile);

      try {
        await apiRequest<ApiResponse<unknown>>(`/api/v1/drivers/orders/${orderId}/proof`, {
          method: 'POST',
          body: formData
        });
        setMessage('已成功送出交貨證明');
        await fetchOrders();
      } catch (error: unknown) {
        const messageText =
          typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : '上傳失敗';
        setMessage(messageText);
      }
    },
    [apiRequest, fetchOrders]
  );

  const fetchBatchRecommendations = useCallback(async () => {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const result = await apiRequest<ApiResponse<BatchRecommendationResult>>(
        '/api/v1/drivers/recommended-batches'
      );
      setBatchData(result.data);
    } catch (error: unknown) {
      const messageText =
        typeof (error as { message?: string })?.message === 'string'
          ? (error as { message: string }).message
          : '載入推薦批次失敗';
      setBatchError(messageText);
    } finally {
      setBatchLoading(false);
    }
  }, [apiRequest]);

  const handleClaimBatch = useCallback(
    async (batch: BatchRecommendation) => {
      if (claimingBatchId) return;
      setBatchError(null);
      setClaimingBatchId(batch.id);
      try {
        // 使用 Promise.allSettled 同時處理所有訂單，收集成功和失敗結果
        const results = await Promise.allSettled(
          batch.orderIds.map(orderId =>
            apiRequest<ApiResponse<Order>>(`/api/v1/drivers/orders/${orderId}/claim`, {
              method: 'POST'
            })
          )
        );

        // 統計成功和失敗數量
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        if (failed === 0) {
          // 全部成功
          setMessage(`已領取批次，共 ${batch.orderCount} 筆訂單`);
        } else if (succeeded === 0) {
          // 全部失敗
          const firstError = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
          const errorMsg =
            typeof (firstError.reason as { message?: string })?.message === 'string'
              ? (firstError.reason as { message: string }).message
              : '領取批次失敗';
          setMessage(`批次領取失敗：${errorMsg}`);
          setBatchError(errorMsg);
        } else {
          // 部分成功
          setMessage(`已領取 ${succeeded}/${batch.orderCount} 筆訂單，${failed} 筆失敗`);
          setBatchError(`部分訂單領取失敗 (${failed} 筆)`);
        }
      } catch (error: unknown) {
        const messageText =
          typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : '領取批次時發生未預期錯誤';
        setMessage(messageText);
        setBatchError(messageText);
      } finally {
        await Promise.allSettled([fetchOrders(), fetchBatchRecommendations()]);
        setClaimingBatchId(null);
      }
    },
    [apiRequest, claimingBatchId, fetchBatchRecommendations, fetchOrders]
  );

  const handleStatusChange = useCallback(
    async (status: string) => {
      if (!profile) return;
      try {
        await apiRequest<ApiResponse<unknown>>(`/api/v1/drivers/${profile.id}/status`, {
          method: 'PATCH',
          body: { status }
        });
        setProfile({ ...profile, status });
        setMessage('狀態已更新');
      } catch (error: unknown) {
        const messageText =
          typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : '狀態更新失敗';
        setMessage(messageText);
      }
    },
    [apiRequest, profile]
  );

  const handleStartNavigation = useCallback(() => {
    if (activeOrders.length === 0) {
      setMessage('目前沒有配送中的訂單');
      return;
    }
    const ids = activeOrders.map(order => order.id).join(',');
    router.push(`/navigation?orderIds=${ids}&token=${token ?? ''}`);
  }, [activeOrders, router, token]);

  const locationWatchId = useRef<number | null>(null);
  const lastTrackedAtRef = useRef<number>(0);
  const batchFetchedRef = useRef(false);

  const sendLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!profile) return;
      try {
        await apiRequest<ApiResponse<unknown>>(`/api/v1/drivers/${profile.id}/location`, {
          method: 'PATCH',
          body: { lat, lng }
        });
        setLastLocationSyncedAt(Date.now());
        setLocationError(null);
      } catch (error: unknown) {
        const messageText =
          typeof (error as { message?: string })?.message === 'string'
            ? (error as { message: string }).message
            : '上傳位置失敗';
        setLocationError(messageText);
      }
    },
    [apiRequest, profile]
  );

  useEffect(() => {
    let mounted = true;

    loadToken()
      .then(stored => {
        if (mounted && stored) {
          setToken(stored);
        }
      })
      .catch(error => {
        console.error('讀取登入憑證失敗:', error);
      })
      .finally(() => {
        if (mounted) {
          setHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile().catch(() => undefined);
      fetchOrders().catch(() => undefined);
    }
  }, [token, fetchProfile, fetchOrders]);

  useEffect(() => {
    offlineQueueService.setOnlineCallback(() => {
      setMessage('網路已恢復，正在同步離線請求…');
      offlineQueueService.processQueue().then(() => {
        setQueueLength(offlineQueueService.getQueueLength());
        setMessage('離線請求同步完成');
        fetchOrders().catch(() => undefined);
      });
    });

    setQueueLength(offlineQueueService.getQueueLength());

    const isOnline = typeof globalThis.navigator === 'undefined' || globalThis.navigator.onLine !== false;
    if (isOnline && offlineQueueService.hasPendingRequests()) {
      offlineQueueService.processQueue().then(() => {
        setQueueLength(offlineQueueService.getQueueLength());
      });
    }
  }, [fetchOrders, offlineQueueService]);

  useEffect(() => {
    if (token) {
      if (!batchFetchedRef.current) {
        batchFetchedRef.current = true;
        fetchBatchRecommendations().catch(() => undefined);
      }
    } else {
      batchFetchedRef.current = false;
      setBatchData(null);
    }
  }, [fetchBatchRecommendations, token]);

  useEffect(() => {
    if (!token || !profile) {
      if (locationWatchId.current && globalThis.navigator?.geolocation) {
        globalThis.navigator.geolocation.clearWatch(locationWatchId.current);
      }
      locationWatchId.current = null;
      return;
    }

    if (!globalThis.navigator?.geolocation) {
      setLocationError('此裝置不支援定位功能');
      return;
    }

    locationWatchId.current = globalThis.navigator.geolocation.watchPosition(
      position => {
        const now = Date.now();
        if (now - lastTrackedAtRef.current < LOCATION_STALE_THRESHOLD_MS / 2) {
          return;
        }
        lastTrackedAtRef.current = now;
        void sendLocation(position.coords.latitude, position.coords.longitude);
      },
      error => {
        setLocationError(error.message);
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 30_000 }
    );

    return () => {
      if (locationWatchId.current && globalThis.navigator?.geolocation) {
        globalThis.navigator.geolocation.clearWatch(locationWatchId.current);
      }
      locationWatchId.current = null;
    };
  }, [profile, sendLocation, token]);

  useEffect(() => {
    if (!lastLocationSyncedAt) {
      setLocationStale(false);
      return;
    }
    const evaluate = () => {
      setLocationStale(Date.now() - lastLocationSyncedAt > LOCATION_STALE_THRESHOLD_MS);
    };
    evaluate();
    const timer = globalThis.setInterval(evaluate, 60_000);
    return () => {
      globalThis.clearInterval(timer);
    };
  }, [lastLocationSyncedAt]);

  const renderOrderCard = (order: Order, actions?: ReactNode) => (
    <Card style={styles.card} key={order.id}>
      <Card.Title title={order.contactName} subtitle={`聯絡電話 ${order.contactPhone}`} />
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
        {order.status === 'delivered' && (!order.deliveryProofs || order.deliveryProofs.length === 0) ? (
          <>
            <Divider style={styles.divider} />
            <Text style={styles.warning}>尚未上傳交貨證明</Text>
          </>
        ) : null}
      </Card.Content>
      {actions ? <Card.Actions style={styles.actions}>{actions}</Card.Actions> : null}
    </Card>
  );

  if (!hydrated) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingHint}>正在載入</Text>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={styles.container}>
        <Card style={styles.loginCard}>
          <Card.Title title="外送員登入" subtitle="請輸入帳號與密碼" />
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
            <Button mode="contained" onPress={handleLogin} loading={loading} disabled={loading}>
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
            <Text variant="headlineSmall">您好，{profile?.name ?? '外送員'}！</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              隨時留意新的訂單與配送狀態
            </Text>
            {locationStale ? (
              <Text style={styles.warning}>
                已 {formatTimeLabel(lastLocationSyncedAt)} 未回報位置，請檢查定位或上傳狀態
              </Text>
            ) : null}
            {locationError ? <Text style={styles.warning}>{locationError}</Text> : null}
            {queueLength > 0 ? (
              <View style={styles.queueBadge}>
                <Text style={styles.queueText}>離線請求排程：{queueLength} 筆</Text>
              </View>
            ) : null}
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
          <Text variant="titleMedium">推薦批次</Text>
          <View style={styles.sectionHeaderActions}>
            <Button
              mode="text"
              onPress={fetchBatchRecommendations}
              disabled={batchLoading || claimingBatchId !== null}
            >
              {batchData ? '重新整理' : '取得推薦'}
            </Button>
          </View>
        </View>
        {batchError ? <Text style={styles.warning}>{batchError}</Text> : null}
        {batchLoading ? (
          <ActivityIndicator style={styles.loaderIndicator} />
        ) : batchRecommendations.length === 0 ? (
          <Text style={styles.empty}>尚未取得推薦批次</Text>
        ) : (
          batchRecommendations.map(batch => (
            <Card style={styles.batchCard} key={batch.id}>
              <Card.Content>
                <View style={styles.batchHeader}>
                  <Text variant="titleMedium" style={styles.batchTitle}>
                    建議批次 · {batch.orderCount} 筆訂單
                  </Text>
                  <Chip mode="outlined" style={styles.batchChip}>
                    {formatCurrency(batch.totalAmount)}
                  </Chip>
                </View>
                {batch.preview ? (
                  <View style={styles.batchMetaRow}>
                    <Text style={styles.batchMeta}>
                      預估距離 {formatDistanceLabel(batch.preview.totalDistanceMeters)}
                    </Text>
                    <Text style={styles.batchMeta}>
                      預估時間 {formatDurationLabel(batch.preview.totalDurationSeconds)}
                    </Text>
                  </View>
                ) : null}
                <Divider style={styles.divider} />
                <View style={styles.batchOrderList}>
                  {batch.orders.map(order => (
                    <View key={order.id} style={styles.batchOrderItem}>
                      <Text style={styles.batchOrderName}>{order.contactName}</Text>
                      <Text style={styles.batchOrderAddress} numberOfLines={1}>
                        {order.address}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card.Content>
              <Card.Actions style={styles.actions}>
                <Button
                  mode="contained"
                  onPress={() => handleClaimBatch(batch)}
                  loading={claimingBatchId === batch.id}
                  disabled={claimingBatchId !== null && claimingBatchId !== batch.id}
                >
                  領取整批
                </Button>
              </Card.Actions>
            </Card>
          ))
        )}
        {batchLeftovers.length > 0 ? (
          <Text style={styles.helperText}>尚有 {batchLeftovers.length} 筆訂單待湊成批次</Text>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">待接訂單</Text>
          <Button mode="text" onPress={fetchOrders} disabled={loading}>
            重新整理
          </Button>
        </View>
        {loading && availableOrders.length === 0 && activeOrders.length === 0 ? (
          <ActivityIndicator style={styles.loaderIndicator} />
        ) : null}
        {availableOrders.length === 0 ? (
          <Text style={styles.empty}>目前沒有待接訂單</Text>
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
            <Button mode="contained" onPress={handleStartNavigation} icon="navigation" buttonColor="#2C3E50">
              開啟導航
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
                  上傳證明
                </Button>
                <Button mode="text" onPress={() => openProblemDialog(order.id)}>
                  回報問題
                </Button>
              </View>
            )
          )
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          最近完成
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
          <Text style={styles.empty}>目前沒有待處理的問題單</Text>
        ) : (
          problemOrders.map(order => renderOrderCard(order))
        )}
      </ScrollView>

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
              style={styles.problemInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeProblemDialog} disabled={submittingProblem}>
              取消
            </Button>
            <Button onPress={submitProblemReport} loading={submittingProblem}>
              送出
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={4000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ECEFF1'
  },
  loadingHint: {
    marginTop: 12,
    color: '#546E7A'
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    rowGap: 16,
    gap: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerText: {
    flex: 1,
    rowGap: 6
  },
  subtitle: {
    color: '#546E7A'
  },
  warning: {
    marginTop: 6,
    color: '#D84315',
    fontSize: 12
  },
  queueBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#1B5E20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  queueText: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  statusChip: {
    marginBottom: 8
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    gap: 8
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
    color: '#37474F',
    fontWeight: '600'
  },
  card: {
    borderRadius: 12,
    marginBottom: 12
  },
  loginCard: {
    width: '100%',
    maxWidth: 420
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'transparent'
  },
  label: {
    color: '#546E7A',
    fontSize: 12,
    marginTop: 6
  },
  value: {
    color: '#263238',
    fontSize: 16,
    marginTop: 4
  },
  divider: {
    marginVertical: 12
  },
  actions: {
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  empty: {
    textAlign: 'center',
    color: '#90A4AE',
    marginVertical: 16
  },
  loaderIndicator: {
    marginVertical: 16
  },
  activeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  batchCard: {
    borderRadius: 12,
    marginBottom: 12
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  batchTitle: {
    flex: 1,
    fontWeight: '600',
    color: '#263238',
    marginRight: 12
  },
  batchChip: {
    alignSelf: 'flex-start'
  },
  batchMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8
  },
  batchMeta: {
    color: '#546E7A',
    fontSize: 12
  },
  batchOrderList: {
    rowGap: 8
  },
  batchOrderItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8
  },
  batchOrderName: {
    fontWeight: '600',
    color: '#37474F'
  },
  batchOrderAddress: {
    color: '#607D8B',
    fontSize: 12,
    marginTop: 2
  },
  helperText: {
    marginTop: 4,
    color: '#607D8B'
  },
  problemInput: {
    marginTop: 8
  }
});
