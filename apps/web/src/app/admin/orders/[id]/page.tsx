"use client";

import { notFound } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE_URL as API_BASE } from '../../../../config/api';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "pending", label: "待確認" },
  { value: "preparing", label: "備貨中" },
  { value: "ready", label: "待出貨" },
  { value: "delivering", label: "配送中" },
  { value: "delivered", label: "已完成" },
  { value: "problem", label: "異常處理" },
  { value: "cancelled", label: "已取消" }
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "現金",
  transfer: "銀行轉帳",
  line_pay: "LINE Pay",
  credit: "信用卡"
};

type OrderDetail = {
  id: string;
  contactName: string;
  contactPhone: string;
  address: string;
  notes?: string;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  driverId?: string;
  items: Array<{
    productId?: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

type HistoryEntry = {
  status: string;
  note?: string;
  changedAt: string;
};

const STATUS_UPDATE_ERRORS: Record<string, string> = {
  ORDER_ALREADY_CLAIMED: "此訂單已由其他司機認領",
  ORDER_NOT_ASSIGNED_TO_DRIVER: "該司機尚未認領此訂單",
  INVALID_STATUS_TRANSITION: "狀態流程不符合，請確認"
};

const statusLabel = (value: string) => STATUS_OPTIONS.find(option => option.value === value)?.label ?? value;

const formatCurrency = (value: number) => `NT$${Number(value ?? 0).toLocaleString("zh-TW")}`;

const formatDateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-TW");
};

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [token, setToken] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("chengyi_admin_token");
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  const headers = useMemo(() => {
    const base: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      base.Authorization = `Bearer ${token}`;
    }
    return base;
  }, [token]);

  const loadData = useCallback(async () => {
    if (!headers.Authorization) {
      return;
    }
    try {
      setLoading(true);
      setMessage(null);

      const [orderRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/orders/${id}`, { headers }),
        fetch(`${API_BASE}/orders/${id}/history`, { headers })
      ]);

      if (orderRes.status === 404) {
        notFound();
        return;
      }
      if (!orderRes.ok) {
        const errJson = await orderRes.json().catch(() => ({}));
        throw new Error(errJson.error ?? "讀取訂單時發生錯誤");
      }

      const orderJson = await orderRes.json();
      const detail = orderJson.data as OrderDetail;
      setOrder(detail);
      setSelectedStatus(detail.status ?? "pending");

      if (historyRes.ok) {
        const historyJson = await historyRes.json();
        setHistory(historyJson.data ?? []);
      } else {
        setHistory([]);
      }
    } catch (error: any) {
      setMessage(error?.message ?? "連線發生異常，請稍後再試");
    } finally {
      setLoading(false);
    }
  }, [headers, id]);

  useEffect(() => {
    loadData().catch(() => undefined);
  }, [loadData]);

  const updateStatus = async () => {
    if (!order) {
      return;
    }
    setUpdating(true);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE}/orders/${order.id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: selectedStatus })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const code = errJson.error as string | undefined;
        throw new Error((code && STATUS_UPDATE_ERRORS[code]) ?? code ?? "更新狀態時發生錯誤");
      }

      const json = await response.json();
      setOrder(json.data);
      setMessage("狀態已更新");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message ?? "更新狀態時發生錯誤");
    } finally {
      setUpdating(false);
    }
  };

  if (!headers.Authorization) {
    return (
      <div className="page-wrapper">
        <div className="token-box">
          <h5>請貼上管理者 JWT Token</h5>
          <p>將 Token 輸入後點選「儲存」，即可載入訂單資料。</p>
          <div className="token-actions">
            <input
              className="form-control"
              placeholder="Bearer Token"
              value={token}
              onChange={event => setToken(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-success"
              onClick={() => window.localStorage.setItem("chengyi_admin_token", token)}
            >
              儲存
            </button>
          </div>
        </div>
        {message && <div className="alert alert-info mt-3">{message}</div>}
      </div>
    );
  }

  if (loading) {
    return <div className="page-wrapper">載入中，請稍候…</div>;
  }

  if (!order) {
    return <div className="page-wrapper">查無此訂單，請確認網址是否正確。</div>;
  }

  return (
    <div className="page-wrapper">
      <div className="token-box">
        <h5 className="mb-3">管理者 JWT Token</h5>
        <p className="text-muted mb-3">如需更新權杖，請貼上新的 Token 後按下儲存。</p>
        <div className="token-actions">
          <input
            className="form-control"
            placeholder="Bearer Token"
            value={token}
            onChange={event => setToken(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => window.localStorage.setItem("chengyi_admin_token", token)}
          >
            儲存
          </button>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => loadData()}
            disabled={loading}
          >
            重新整理
          </button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="order-header">
        <div>
          <h2>訂單 #{order.id}</h2>
          <p className="text-muted">建立時間：{formatDateTime(order.createdAt)}</p>
        </div>
        <span className={`status-badge status-${order.status}`}>
          {statusLabel(order.status)}
        </span>
      </div>

      <div className="order-info-grid">
        <div className="info-card">
          <h5>收件資訊</h5>
          <dl>
            <div>
              <dt>聯絡人</dt>
              <dd>{order.contactName}</dd>
            </div>
            <div>
              <dt>電話</dt>
              <dd>{order.contactPhone}</dd>
            </div>
            <div>
              <dt>配送地址</dt>
              <dd>{order.address}</dd>
            </div>
            {order.notes && (
              <div>
                <dt>備註</dt>
                <dd>{order.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="info-card">
          <h5>金額資訊</h5>
          <dl>
            <div>
              <dt>付款方式</dt>
              <dd>{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</dd>
            </div>
            <div>
              <dt>商品小計</dt>
              <dd>{formatCurrency(order.subtotal)}</dd>
            </div>
            <div>
              <dt>配送費</dt>
              <dd>{formatCurrency(order.deliveryFee)}</dd>
            </div>
            <div>
              <dt>訂單總額</dt>
              <dd className="amount-highlight">{formatCurrency(order.totalAmount)}</dd>
            </div>
          </dl>
        </div>

        <div className="info-card">
          <h5>狀態調整</h5>
          <label className="form-label" htmlFor="status-select">
            更新訂單狀態
          </label>
          <select
            id="status-select"
            className="form-select"
            value={selectedStatus}
            onChange={event => setSelectedStatus(event.target.value)}
            disabled={updating}
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary mt-3" onClick={updateStatus} disabled={updating}>
            {updating ? "更新中…" : "更新狀態"}
          </button>
          <p className="note mt-2">司機會在 App 中從「待出貨」(READY) 清單自行認領訂單。</p>
        </div>

        <div className="info-card">
          <h5>司機資訊</h5>
          {order.driverId ? (
            <p className="mb-0">目前由司機 ID：{order.driverId} 負責配送。</p>
          ) : (
            <p className="mb-0">尚未有司機認領。司機在 App 內確認後會自動綁定帳號。</p>
          )}
        </div>
      </div>

      <div className="items-table">
        <div className="table-header">商品明細</div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>品項</th>
                <th>數量</th>
                <th>單價</th>
                <th>小計</th>
              </tr>
            </thead>
            <tbody>
              {order.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-4">
                    目前沒有商品項目
                  </td>
                </tr>
              )}
              {order.items.map((item, index) => (
                <tr key={item.productId ?? `${index}`}>
                  <td className="item-name">{item.name}</td>
                  <td>{item.quantity} {item.unit}</td>
                  <td>{formatCurrency(item.unitPrice)}</td>
                  <td>{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="items-table">
        <div className="table-header">狀態紀錄</div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>狀態</th>
                <th>時間</th>
                <th>說明</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-4">
                    尚未有狀態歷程
                  </td>
                </tr>
              )}
              {history.map((entry, index) => (
                <tr key={`${entry.status}-${index}`}>
                  <td>{statusLabel(entry.status)}</td>
                  <td>{formatDateTime(entry.changedAt)}</td>
                  <td>{entry.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="footer-actions">
        <a className="btn btn-secondary" href="/admin/orders">
          返回訂單列表
        </a>
        <button className="btn btn-outline-primary" type="button" onClick={() => loadData()} disabled={loading}>
          重新整理
        </button>
      </div>

      <style jsx>{`
        .page-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 24px 16px 48px;
        }

        .token-box {
          background: #f1f5f9;
          border-radius: 16px;
          padding: 16px 24px;
          border: 1px solid #e2e8f0;
        }

        .token-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .order-header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          border-radius: 16px;
          background: #0f172a;
          color: #f8fafc;
        }

        .status-badge {
          padding: 8px 16px;
          border-radius: 999px;
          font-weight: 600;
          background: #1e293b;
          color: #f8fafc;
        }

        .order-info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }

        .info-card {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .info-card h5 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        dl {
          margin: 0;
          display: grid;
          gap: 8px;
        }

        dt {
          font-size: 14px;
          color: #64748b;
        }

        dd {
          margin: 0;
          font-size: 15px;
          color: #0f172a;
        }

        .amount-highlight {
          color: #16a34a;
          font-weight: 700;
        }

        .note {
          font-size: 13px;
          color: #64748b;
        }

        .items-table {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #fff;
        }

        .table-header {
          padding: 16px 20px;
          font-weight: 600;
          border-bottom: 1px solid #e2e8f0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          font-size: 14px;
          color: #475569;
        }

        td {
          font-size: 15px;
        }

        .item-name {
          font-weight: 600;
        }

        .footer-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        @media (max-width: 640px) {
          .token-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .footer-actions {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
}
