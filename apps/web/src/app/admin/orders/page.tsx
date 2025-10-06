'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Order = {
  id: string;
  contactName: string;
  contactPhone: string;
  address: string;
  status: string;
  totalAmount: number;
  createdAt?: string;
};

type OrdersResponse = {
  data: Order[];
  stats: Record<string, number>;
  meta: {
    total: number;
    statusLabels: Record<string, string>;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

const STATUS_STYLE: Record<string, string> = {
  pending: 'status-pending',
  preparing: 'status-preparing',
  ready: 'status-ready',
  delivering: 'status-delivering',
  delivered: 'status-delivered',
  problem: 'status-problem',
  cancelled: 'status-cancelled'
};

export default function AdminOrdersPage() {
  const [token, setToken] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem('chengyi_admin_token');
    if (saved) {
      setToken(saved);
    }
  }, []);

  const headers = useMemo(() => {
    if (!token) return undefined;
    return {
      Authorization: `Bearer ${token}`
    } as Record<string, string>;
  }, [token]);

  const loadOrders = useCallback(async () => {
    if (!headers) {
      setError('請先輸入管理員 Token');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/orders`, { headers });
      if (!response.ok) {
        throw new Error('讀取訂單資料失敗，請確認 Token 是否有效');
      }
      const json = (await response.json()) as OrdersResponse;
      setOrders(json.data ?? []);
      setStats(json.stats ?? {});
      setStatusLabels(json.meta?.statusLabels ?? {});
    } catch (err: any) {
      setError(err.message ?? '讀取訂單資料失敗');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (headers) {
      loadOrders().catch(() => undefined);
    }
  }, [headers, loadOrders]);

  const saveToken = () => {
    window.localStorage.setItem('chengyi_admin_token', token);
    if (token) {
      loadOrders().catch(() => undefined);
    }
  };

  const totalOrders = orders.length;

  return (
    <div>
      <div className="token-box">
        <h5 className="mb-3">管理員授權 Token</h5>
        <div className="d-flex gap-2">
          <input
            className="form-control"
            placeholder="Bearer Token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <button type="button" className="btn btn-success" onClick={saveToken}>
            儲存並重新載入
          </button>
        </div>
      </div>

      <div className="orders-header">
        <div>
          <h1>訂單概況</h1>
          <p>掌握整體訂單狀態與最新進度</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '2rem' }}>總筆數</div>
          <div>{totalOrders} 筆訂單</div>
        </div>
      </div>

      <div className="orders-stats">
        {Object.entries(statusLabels).map(([statusKey, label]) => (
          <div className={`stat-card ${statusKey}`} key={statusKey}>
            <div className="stat-number">{stats[statusKey] ?? 0}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="orders-table">
        <div className="table-header">
          訂單列表 - 共 {totalOrders} 筆
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>訂單號</th>
                <th>聯絡人</th>
                <th>配送地址</th>
                <th>狀態</th>
                <th>金額</th>
                <th>建立時間</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const statusClass = STATUS_STYLE[order.status] ?? 'status-pending';
                const statusLabel = statusLabels[order.status] ?? order.status;
                return (
                  <tr key={order.id}>
                    <td><strong>#{order.id}</strong></td>
                    <td>
                      <div><strong>{order.contactName}</strong></div>
                      <div className="text-muted" style={{ fontSize: '0.85rem' }}>{order.contactPhone}</div>
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.address}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
                    </td>
                    <td><strong style={{ color: '#27ae60' }}>NT${Number(order.totalAmount ?? 0).toLocaleString()}</strong></td>
                    <td className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleString('zh-TW') : ''}
                    </td>
                    <td className="text-end">
                      <a className="btn btn-primary btn-sm" href={`/admin/orders/${order.id}`}>
                        查看
                      </a>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-5 text-muted">
                    {loading ? '資料載入中…' : '暫無訂單資料'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
