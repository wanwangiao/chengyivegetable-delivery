'use client';

import { useEffect, useMemo, useState } from 'react';

type Order = {
  id: string;
  contactName: string;
  contactPhone: string;
  address: string;
  status: string;
  totalAmount: number;
  createdAt?: string;
};

type HistoryEntry = {
  status: string;
  note?: string;
  changedAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

const STATUS_STEPS: Array<{ key: string; label: string; description: string; icon: string }> = [
  { key: 'pending', label: '待確認', description: '訂單已送出，待客服確認', icon: '📝' },
  { key: 'preparing', label: '包裝中', description: '正在為您挑選整理蔬果', icon: '🥬' },
  { key: 'ready', label: '包裝完成', description: '訂單已裝箱，準備交給外送員', icon: '📦' },
  { key: 'delivering', label: '配送中', description: '外送員已出發，請保持電話暢通', icon: '🚚' },
  { key: 'delivered', label: '已送達', description: '訂單配送完成，謝謝惠顧', icon: '✅' },
  { key: 'problem', label: '待解決', description: '訂單遇到問題，客服將盡速聯絡您', icon: '⚠️' },
  { key: 'cancelled', label: '已取消', description: '訂單已取消或未完成', icon: '❌' }
];

const statusIndex = (status: string) => STATUS_STEPS.findIndex(step => step.key === status);

export default function OrderTrackingPage() {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem('customerData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.phone) {
          setPhone(parsed.phone);
        }
      } catch (err) {
        console.warn('無法還原先前的聯絡電話', err);
      }
    }
  }, []);

  const loadOrders = async (targetPhone: string) => {
    if (!targetPhone) {
      setError('請輸入手機號碼');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/orders/search?phone=${encodeURIComponent(targetPhone)}`);
      if (!response.ok) {
        throw new Error('查詢訂單失敗');
      }
      const json = await response.json();
      const data = json.data ?? [];
      setOrders(data);
      if (data.length > 0) {
        setSelectedOrder(data[0]);
      } else {
        setSelectedOrder(null);
        setTimeline([]);
      }
    } catch (err: any) {
      setError(err.message ?? '查詢訂單失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedOrder) {
      setTimeline([]);
      return;
    }
    const controller = new AbortController();
    const fetchHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/orders/${selectedOrder.id}/history`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('取得訂單歷程失敗');
        }
        const json = await response.json();
        setTimeline(json.data ?? []);
      } catch (err) {
        if ((err as any).name !== 'AbortError') {
          console.warn(err);
        }
      }
    };
    fetchHistory().catch(() => undefined);
    return () => controller.abort();
  }, [selectedOrder]);

  const currentStatusIndex = useMemo(() => (selectedOrder ? statusIndex(selectedOrder.status) : -1), [selectedOrder]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadOrders(phone).catch(() => undefined);
  };

  return (
    <div className="tracking-container">
      <section className="order-header">
        <h1>訂單追蹤</h1>
        <p className="text-muted">輸入下單時的手機號碼，即可查詢訂單狀態</p>
        <form className="row g-2 justify-content-center" onSubmit={handleSearch} style={{ maxWidth: 420, margin: '0 auto' }}>
          <div className="col-8">
            <input
              className="form-control"
              placeholder="09xxxxxxxx"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              pattern="09[0-9]{8}"
              required
            />
          </div>
          <div className="col-4">
            <button className="btn btn-success w-100" type="submit" disabled={loading}>
              {loading ? '查詢中…' : '查詢訂單'}
            </button>
          </div>
        </form>
        {error && <div className="alert alert-danger mt-3">{error}</div>}
      </section>

      {orders.length > 0 && (
        <section className="order-details">
          <h5 className="mb-3">訂單列表</h5>
          <div className="list-group">
            {orders.map(order => (
              <button
                key={order.id}
                type="button"
                className={`list-group-item list-group-item-action ${selectedOrder?.id === order.id ? 'active' : ''}`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="d-flex w-100 justify-content-between">
                  <h6 className="mb-1">訂單編號：{order.id}</h6>
                  <small>{order.createdAt ? new Date(order.createdAt).toLocaleString('zh-TW') : ''}</small>
                </div>
                <p className="mb-1">
                  狀態：{STATUS_STEPS.find(step => step.key === order.status)?.label ?? order.status}
                </p>
                <small>金額：NT${Number(order.totalAmount ?? 0).toLocaleString()}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedOrder && (
        <>
          <section className="order-details">
            <div className="detail-row">
              <span>收件人</span>
              <strong>{selectedOrder.contactName}</strong>
            </div>
            <div className="detail-row">
              <span>聯絡電話</span>
              <strong>{selectedOrder.contactPhone}</strong>
            </div>
            <div className="detail-row">
              <span>配送地址</span>
              <strong>{selectedOrder.address}</strong>
            </div>
            <div className="detail-row">
              <span>訂單金額</span>
              <strong>NT${Number(selectedOrder.totalAmount ?? 0).toLocaleString()}</strong>
            </div>
          </section>

          <section className="status-timeline">
            <h5 className="mb-4">配送進度</h5>
            {STATUS_STEPS.map((step, index) => {
              const statusRecord = timeline.find(entry => entry.status === step.key);
              const state = index < currentStatusIndex ? 'completed' : index === currentStatusIndex ? 'current' : 'pending';
              return (
                <div className="timeline-item" key={step.key}>
                  <div className={`timeline-icon ${state}`}>
                    {step.icon}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-title">{step.label}</div>
                    <div className="timeline-description">{step.description}</div>
                    {statusRecord && (
                      <div className="timeline-time">
                        {new Date(statusRecord.changedAt).toLocaleString('zh-TW')}
                        {statusRecord.note ? `｜備註：${statusRecord.note}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}

      {orders.length === 0 && !loading && !error && (
        <div className="text-center text-muted" style={{ marginTop: '2rem' }}>
          請輸入手機號碼查詢訂單。
        </div>
      )}
    </div>
  );
}
