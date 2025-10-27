import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Order } from '@chengyi/domain';
import { getOfflineQueueService } from './services/offline-queue';
import { clearToken, loadToken, persistToken } from './services/token-storage';
import NavigationView from './components/NavigationView';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://chengyivegetable-api-production.up.railway.app';
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

export default function App() {
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
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history' | 'problem'>('available');
  const [showNavigationView, setShowNavigationView] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [expandedBatch, setExpandedBatch] = useState(false);
  const [nearbyOrders, setNearbyOrders] = useState<BatchRecommendationOrderSummary[]>([]);
  const [showNearbyDialog, setShowNearbyDialog] = useState(false);
  const [claimingNearbyId, setClaimingNearbyId] = useState<string | null>(null);

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
        typeof FormData !== 'undefined' && body instanceof FormData;

      if (body && !isFormData && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

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
        const requestBody =
          body === undefined
            ? undefined
            : isFormData || typeof body === 'string'
            ? body
            : JSON.stringify(body);

        const response = await fetch(`${API_BASE}${path}`, {
          method,
          headers,
          body: requestBody
        });

        if (response.status === 401 && !skipAuth) {
          saveToken(null);
          throw new Error('請重新登入');
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || `HTTP ${response.status}`);
        }

        const text = await response.text();
        if (!text) return undefined as T;

        const parsed = JSON.parse(text);
        return (parsed as ApiResponse<T>).data ?? (parsed as T);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (isNetworkError(errorMessage) && method !== 'GET') {
          if (!isFormData) {
            offlineQueueService.enqueue({
              url: `${API_BASE}${path}`,
              method,
              body: safeParseJson(body),
              headers
            });
            setQueueLength(offlineQueueService.getQueueLength());
          }
        }
        throw error;
      }
    },
    [authHeader, offlineQueueService, saveToken]
  );

  // Load token on mount
  useEffect(() => {
    loadToken()
      .then((storedToken) => {
        if (storedToken) {
          setToken(storedToken);
        }
        setHydrated(true);
      })
      .catch((err) => {
        console.error('Failed to load token:', err);
        setHydrated(true);
      });
  }, []);

  // Process offline queue when online
  useEffect(() => {
    const handleOnline = () => {
      const len = offlineQueueService.getQueueLength();
      if (len > 0) {
        void offlineQueueService.processQueue((url, opts) =>
          fetch(url, opts).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
          })
        );
        setQueueLength(offlineQueueService.getQueueLength());
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [offlineQueueService]);

  // Track GPS location
  useEffect(() => {
    if (!token || !profile) return;

    let watchId: number | null = null;

    const startTracking = () => {
      if (!navigator.geolocation) {
        setLocationError('此裝置不支援定位功能');
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          apiRequest('/api/v1/drivers/location', {
            method: 'PUT',
            body: { latitude, longitude }
          })
            .then(() => {
              setLastLocationSyncedAt(Date.now());
              setLocationError(null);
            })
            .catch((err) => {
              const msg = err instanceof Error ? err.message : String(err);
              setLocationError(msg);
            });
        },
        (error) => {
          setLocationError(`定位失敗: ${error.message}`);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000
        }
      );
    };

    startTracking();

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [token, profile, apiRequest]);

  // Check location staleness
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastLocationSyncedAt) {
        const now = Date.now();
        setLocationStale(now - lastLocationSyncedAt > LOCATION_STALE_THRESHOLD_MS);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [lastLocationSyncedAt]);

  // Fetch profile when logged in
  useEffect(() => {
    if (!token) return;
    apiRequest<DriverProfile>('/api/v1/drivers/me')
      .then((data) => setProfile(data))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setMessage(`載入個人資料失敗: ${msg}`);
      });
  }, [token, apiRequest]);

  // Fetch orders periodically
  useEffect(() => {
    if (!token) return;

    const fetchOrders = () => {
      // Fetch available orders
      apiRequest<Order[]>('/api/v1/drivers/orders/available')
        .then((data) => setAvailableOrders(data))
        .catch(() => {});

      // Fetch active orders
      apiRequest<Order[]>('/api/v1/drivers/orders/active')
        .then((data) => setActiveOrders(data))
        .catch(() => {});

      // Fetch history orders
      apiRequest<Order[]>('/api/v1/drivers/orders/history')
        .then((data) => setHistoryOrders(data))
        .catch(() => {});

      // Fetch problem orders
      apiRequest<Order[]>('/api/v1/drivers/orders/problem')
        .then((data) => setProblemOrders(data))
        .catch(() => {});
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [token, apiRequest]);

  const handleLogin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiRequest<{ accessToken: string; tokenType: string }>('/api/v1/drivers/login', {
        method: 'POST',
        body: { phone: email, password },
        skipAuth: true
      });
      saveToken(response.accessToken);
      setMessage('登入成功！');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setMessage(`登入失敗: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    saveToken(null);
    setProfile(null);
    setAvailableOrders([]);
    setActiveOrders([]);
    setHistoryOrders([]);
    setProblemOrders([]);
    setEmail('');
    setPassword('');
    setMessage('已登出');
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      await apiRequest('/api/v1/drivers/status', {
        method: 'PUT',
        body: { status: newStatus }
      });
      setProfile({ ...profile, status: newStatus });
      setMessage('狀態更新成功');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setMessage(`狀態更新失敗: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimOrder = async (orderId: string) => {
    setLoading(true);
    try {
      await apiRequest(`/api/v1/drivers/orders/${orderId}/claim`, {
        method: 'POST'
      });
      setMessage('領取訂單成功');

      // Refresh orders
      const [available, active] = await Promise.all([
        apiRequest<Order[]>('/api/v1/drivers/orders/available'),
        apiRequest<Order[]>('/api/v1/drivers/orders/active')
      ]);
      setAvailableOrders(available);
      setActiveOrders(active);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setMessage(`領取訂單失敗: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment';

    fileInput.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('proof', file);

        await apiRequest(`/api/v1/drivers/orders/${orderId}/complete`, {
          method: 'POST',
          body: formData
        });

        setMessage('訂單完成！');

        // Refresh orders
        const [active, history] = await Promise.all([
          apiRequest<Order[]>('/api/v1/drivers/orders/active'),
          apiRequest<Order[]>('/api/v1/drivers/orders/history')
        ]);
        setActiveOrders(active);
        setHistoryOrders(history);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setMessage(`完成訂單失敗: ${msg}`);
      } finally {
        setLoading(false);
      }
    };

    fileInput.click();
  };

  const handleReportProblem = (orderId: string) => {
    setProblemOrderId(orderId);
    setProblemReason('');
    setProblemDialogVisible(true);
  };

  const handleSubmitProblem = async () => {
    if (!problemOrderId || !problemReason.trim()) return;

    setSubmittingProblem(true);
    try {
      await apiRequest(`/api/v1/drivers/orders/${problemOrderId}/problem`, {
        method: 'POST',
        body: { reason: problemReason }
      });

      setMessage('問題回報成功');
      setProblemDialogVisible(false);

      // Refresh orders
      const [active, problem] = await Promise.all([
        apiRequest<Order[]>('/api/v1/drivers/orders/active'),
        apiRequest<Order[]>('/api/v1/drivers/orders/problem')
      ]);
      setActiveOrders(active);
      setProblemOrders(problem);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setMessage(`回報問題失敗: ${msg}`);
    } finally {
      setSubmittingProblem(false);
    }
  };

  const fetchBatchRecommendations = async () => {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const data = await apiRequest<BatchRecommendationResult>('/api/v1/drivers/orders/batch-recommendations');
      setBatchData(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setBatchError(msg);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleClaimBatch = async (batchId: string) => {
    setClaimingBatchId(batchId);
    try {
      // Find the batch by ID
      const batch = batchData?.batches.find(b => b.id === batchId);
      if (!batch) {
        throw new Error('批次不存在');
      }

      // Claim all orders in the batch
      await apiRequest(`/api/v1/drivers/orders/batch-claim`, {
        method: 'POST',
        body: { orderIds: batch.orderIds }
      });
      setMessage('批次領取成功');

      // Refresh orders
      const [available, active] = await Promise.all([
        apiRequest<Order[]>('/api/v1/drivers/orders/available'),
        apiRequest<Order[]>('/api/v1/drivers/orders/active')
      ]);
      setAvailableOrders(available);
      setActiveOrders(active);
      setBatchData(null);
      setCurrentBatchIndex(0);

      // 獲取額外順路訂單推薦
      try {
        const nearby = await apiRequest<BatchRecommendationOrderSummary[]>('/api/v1/drivers/orders/nearby-recommendations');
        if (nearby.length > 0) {
          setNearbyOrders(nearby);
          setShowNearbyDialog(true);
        }
      } catch (nearbyError) {
        console.error('獲取額外推薦失敗:', nearbyError);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setMessage(`批次領取失敗: ${msg}`);
    } finally {
      setClaimingBatchId(null);
    }
  };

  const handleRejectBatch = () => {
    setMessage('已拒絕此批次');
    handleNextBatch();
  };

  const handleNextBatch = () => {
    if (!batchData || batchRecommendations.length === 0) return;

    if (currentBatchIndex < batchRecommendations.length - 1) {
      setCurrentBatchIndex(prev => prev + 1);
      setExpandedBatch(false);
    } else {
      setMessage('已經是最後一個批次了');
    }
  };

  const handlePreviousBatch = () => {
    if (currentBatchIndex > 0) {
      setCurrentBatchIndex(prev => prev - 1);
      setExpandedBatch(false);
    }
  };

  const handleClaimNearbyOrder = async (orderId: string) => {
    setClaimingNearbyId(orderId);
    try {
      await apiRequest(`/api/v1/drivers/orders/${orderId}/claim`, {
        method: 'POST'
      });
      setMessage('額外訂單領取成功');

      // 從推薦列表中移除
      setNearbyOrders(prev => prev.filter(order => order.id !== orderId));

      // Refresh orders
      const [available, active] = await Promise.all([
        apiRequest<Order[]>('/api/v1/drivers/orders/available'),
        apiRequest<Order[]>('/api/v1/drivers/orders/active')
      ]);
      setAvailableOrders(available);
      setActiveOrders(active);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setMessage(`領取訂單失敗: ${msg}`);
    } finally {
      setClaimingNearbyId(null);
    }
  };

  const handleRejectNearbyOrder = (orderId: string) => {
    setNearbyOrders(prev => prev.filter(order => order.id !== orderId));
    setMessage('已忽略此訂單');
  };

  const handleSkipNearbyRecommendations = () => {
    setShowNearbyDialog(false);
    setNearbyOrders([]);
    setMessage('開始配送');
  };

  const openInMaps = (latitude: number, longitude: number, address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    window.open(url, '_blank');
  };

  if (!hydrated) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div className="loading-text">載入中...</div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>誠憶外送員登入</h1>
          <div className="form-group">
            <label>手機號碼</label>
            <input
              type="tel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="請輸入手機號碼"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>密碼</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              disabled={loading}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  void handleLogin();
                }
              }}
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="btn-primary"
          >
            {loading ? '登入中...' : '登入'}
          </button>
          {message && <div className="message">{message}</div>}
        </div>
      </div>
    );
  }

  // 如果進入配送執行模式，顯示 NavigationView
  if (showNavigationView && activeOrders.length > 0 && token) {
    return (
      <NavigationView
        orders={activeOrders}
        token={token}
        onBack={() => setShowNavigationView(false)}
        onOrderComplete={() => {
          // 刷新訂單列表
          void apiRequest<Order[]>('/api/v1/drivers/orders/active')
            .then((data) => setActiveOrders(data))
            .catch(() => {});
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>誠憶外送員</h1>
          {profile && (
            <div className="profile-info">
              <span>{profile.name}</span>
              <button onClick={handleLogout} className="btn-logout">
                登出
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Status Bar */}
      {profile && (
        <div className="status-bar">
          <div className="status-controls">
            <label>目前狀態：</label>
            <select
              value={profile.status}
              onChange={(e) => void handleStatusChange(e.target.value)}
              disabled={loading}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="location-info">
            <span>
              {locationError ? (
                <span className="error">{locationError}</span>
              ) : (
                <>
                  最後定位: {formatTimeLabel(lastLocationSyncedAt)}
                  {locationStale && <span className="stale"> (已過時)</span>}
                </>
              )}
            </span>
          </div>
          {queueLength > 0 && (
            <div className="queue-info">
              離線佇列: {queueLength} 個請求待處理
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <nav className="tab-nav">
        <button
          className={activeTab === 'available' ? 'active' : ''}
          onClick={() => setActiveTab('available')}
        >
          可接訂單 ({availableOrders.length})
        </button>
        <button
          className={activeTab === 'active' ? 'active' : ''}
          onClick={() => setActiveTab('active')}
        >
          配送中 ({activeOrders.length})
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          歷史記錄 ({historyOrders.length})
        </button>
        <button
          className={activeTab === 'problem' ? 'active' : ''}
          onClick={() => setActiveTab('problem')}
        >
          問題訂單 ({problemOrders.length})
        </button>
      </nav>

      {/* Content */}
      <main className="app-content">
        {/* Available Orders Tab */}
        {activeTab === 'available' && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>可接訂單</h2>
              <button onClick={fetchBatchRecommendations} disabled={batchLoading} className="btn-secondary">
                {batchLoading ? '計算中...' : '批次建議'}
              </button>
            </div>

            {batchError && <div className="error-message">{batchError}</div>}

            {batchData && batchRecommendations.length > 0 && (
              <div className="batch-recommendations">
                <div className="batch-navigation-header">
                  <h3>批次配送建議</h3>
                  <div className="batch-counter">
                    {currentBatchIndex + 1} / {batchRecommendations.length}
                  </div>
                </div>

                {(() => {
                  const batch = batchRecommendations[currentBatchIndex];
                  if (!batch) return null;

                  return (
                    <div className="batch-card featured">
                      <div className="batch-header">
                        <div className="batch-info">
                          <h4>批次 #{currentBatchIndex + 1}</h4>
                          <div className="batch-meta">
                            <span className="chip">{batch.orderCount} 筆訂單</span>
                            <span className="chip">{formatCurrency(batch.totalAmount)}</span>
                          </div>
                        </div>
                      </div>

                      {batch.preview && (
                        <div className="batch-preview">
                          <div className="preview-stats">
                            <div className="stat">
                              <span className="stat-label">總距離</span>
                              <span className="stat-value">{formatDistanceLabel(batch.preview.totalDistanceMeters)}</span>
                            </div>
                            <div className="stat">
                              <span className="stat-label">預估時間</span>
                              <span className="stat-value">{formatDurationLabel(batch.preview.totalDurationSeconds)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="batch-orders">
                        <button
                          className="expand-toggle"
                          onClick={() => setExpandedBatch(!expandedBatch)}
                        >
                          {expandedBatch ? '▼' : '▶'} 訂單詳情 ({batch.orderCount} 筆)
                        </button>

                        {expandedBatch && (
                          <div className="orders-list-mini">
                            {batch.orders.map((order, index) => (
                              <div key={order.id} className="order-item-mini">
                                <span className="order-number">{index + 1}</span>
                                <div className="order-info">
                                  <strong>{order.contactName}</strong>
                                  <span>{order.address}</span>
                                  {order.notes && <span className="notes">備註: {order.notes}</span>}
                                </div>
                                <span className="order-amount">{formatCurrency(order.totalAmount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="batch-actions">
                        <button
                          onClick={() => void handleClaimBatch(batch.id)}
                          disabled={claimingBatchId === batch.id}
                          className="btn-primary btn-large"
                        >
                          {claimingBatchId === batch.id ? '領取中...' : '✓ 接受批次'}
                        </button>
                        <div className="secondary-actions">
                          <button
                            onClick={handleRejectBatch}
                            className="btn-secondary"
                            disabled={claimingBatchId === batch.id}
                          >
                            ✗ 拒絕
                          </button>
                          {currentBatchIndex < batchRecommendations.length - 1 && (
                            <button
                              onClick={handleNextBatch}
                              className="btn-secondary"
                              disabled={claimingBatchId === batch.id}
                            >
                              下一個 →
                            </button>
                          )}
                          {currentBatchIndex > 0 && (
                            <button
                              onClick={handlePreviousBatch}
                              className="btn-secondary"
                              disabled={claimingBatchId === batch.id}
                            >
                              ← 上一個
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {batchLeftovers.length > 0 && (
                  <div className="leftovers-info">
                    <p>另有 {batchLeftovers.length} 筆未分組訂單</p>
                  </div>
                )}
              </div>
            )}

            <div className="orders-list">
              {availableOrders.map((order) => (
                <div key={order.id} className="order-card">
                  <div className="order-header">
                    <span className="order-id">#{order.id.slice(0, 8)}</span>
                    <span className="order-amount">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="order-body">
                    <p><strong>收件人:</strong> {order.contactName}</p>
                    <p><strong>地址:</strong> {order.shippingAddress}</p>
                    {order.notes && <p><strong>備註:</strong> {order.notes}</p>}
                  </div>
                  <div className="order-actions">
                    <button onClick={() => void handleClaimOrder(order.id)} disabled={loading} className="btn-primary">
                      領取訂單
                    </button>
                  </div>
                </div>
              ))}
              {availableOrders.length === 0 && (
                <div className="empty-state">目前沒有可接訂單</div>
              )}
            </div>
          </div>
        )}

        {/* Active Orders Tab */}
        {activeTab === 'active' && (
          <div className="tab-content">
            <div className="tab-header">
              <h2>配送中的訂單</h2>
              {activeOrders.length > 0 && (
                <button onClick={() => setShowNavigationView(true)} className="btn-primary">
                  🚚 開始配送
                </button>
              )}
            </div>
            <div className="orders-list">
              {activeOrders.map((order) => (
                <div key={order.id} className="order-card">
                  <div className="order-header">
                    <span className="order-id">#{order.id.slice(0, 8)}</span>
                    <span className="order-amount">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="order-body">
                    <p><strong>收件人:</strong> {order.contactName}</p>
                    <p><strong>地址:</strong> {order.shippingAddress}</p>
                    {order.notes && <p><strong>備註:</strong> {order.notes}</p>}
                  </div>
                  <div className="order-actions">
                    <button onClick={() => void handleCompleteOrder(order.id)} disabled={loading} className="btn-success">
                      完成配送 (拍照)
                    </button>
                    <button onClick={() => handleReportProblem(order.id)} disabled={loading} className="btn-warning">
                      回報問題
                    </button>
                    {order.latitude && order.longitude && (
                      <button
                        onClick={() => openInMaps(order.latitude!, order.longitude!, order.shippingAddress)}
                        className="btn-secondary"
                      >
                        導航
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {activeOrders.length === 0 && (
                <div className="empty-state">目前沒有配送中的訂單</div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="tab-content">
            <h2>歷史記錄</h2>
            <div className="orders-list">
              {historyOrders.map((order) => (
                <div key={order.id} className="order-card history">
                  <div className="order-header">
                    <span className="order-id">#{order.id.slice(0, 8)}</span>
                    <span className="order-amount">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="order-body">
                    <p><strong>收件人:</strong> {order.contactName}</p>
                    <p><strong>地址:</strong> {order.shippingAddress}</p>
                    <p><strong>狀態:</strong> {order.status === 'delivered' ? '已完成' : order.status}</p>
                  </div>
                </div>
              ))}
              {historyOrders.length === 0 && (
                <div className="empty-state">沒有歷史記錄</div>
              )}
            </div>
          </div>
        )}

        {/* Problem Orders Tab */}
        {activeTab === 'problem' && (
          <div className="tab-content">
            <h2>問題訂單</h2>
            <div className="orders-list">
              {problemOrders.map((order) => (
                <div key={order.id} className="order-card problem">
                  <div className="order-header">
                    <span className="order-id">#{order.id.slice(0, 8)}</span>
                    <span className="order-amount">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="order-body">
                    <p><strong>收件人:</strong> {order.contactName}</p>
                    <p><strong>地址:</strong> {order.shippingAddress}</p>
                    {order.notes && <p><strong>備註:</strong> {order.notes}</p>}
                  </div>
                </div>
              ))}
              {problemOrders.length === 0 && (
                <div className="empty-state">沒有問題訂單</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Problem Report Dialog */}
      {problemDialogVisible && (
        <div className="dialog-overlay" onClick={() => setProblemDialogVisible(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>回報問題</h3>
            <textarea
              value={problemReason}
              onChange={(e) => setProblemReason(e.target.value)}
              placeholder="請描述遇到的問題..."
              rows={5}
              disabled={submittingProblem}
            />
            <div className="dialog-actions">
              <button onClick={() => setProblemDialogVisible(false)} disabled={submittingProblem} className="btn-secondary">
                取消
              </button>
              <button onClick={handleSubmitProblem} disabled={submittingProblem || !problemReason.trim()} className="btn-primary">
                {submittingProblem ? '提交中...' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nearby Orders Recommendations Dialog */}
      {showNearbyDialog && nearbyOrders.length > 0 && (
        <div className="dialog-overlay" onClick={() => setShowNearbyDialog(false)}>
          <div className="dialog nearby-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>🎯 額外順路訂單推薦</h3>
            <p className="nearby-description">
              我們找到 {nearbyOrders.length} 筆順路訂單，您可以選擇性接受：
            </p>

            <div className="nearby-orders-list">
              {nearbyOrders.map((order) => (
                <div key={order.id} className="nearby-order-card">
                  <div className="nearby-order-info">
                    <strong>{order.contactName}</strong>
                    <span className="nearby-address">{order.address}</span>
                    <span className="nearby-amount">{formatCurrency(order.totalAmount)}</span>
                    {order.notes && <span className="nearby-notes">備註: {order.notes}</span>}
                  </div>
                  <div className="nearby-order-actions">
                    <button
                      onClick={() => void handleClaimNearbyOrder(order.id)}
                      disabled={claimingNearbyId === order.id}
                      className="btn-success btn-sm"
                    >
                      {claimingNearbyId === order.id ? '領取中...' : '✓ 接受'}
                    </button>
                    <button
                      onClick={() => handleRejectNearbyOrder(order.id)}
                      disabled={claimingNearbyId !== null}
                      className="btn-secondary btn-sm"
                    >
                      ✗ 忽略
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="dialog-actions">
              <button
                onClick={handleSkipNearbyRecommendations}
                disabled={claimingNearbyId !== null}
                className="btn-primary"
              >
                完成選擇
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Message */}
      {message && (
        <div className="toast" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
    </div>
  );
}
