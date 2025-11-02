'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiff } from '../../hooks/useLiff';

type CartItem = {
  productId?: string;
  id?: string;
  name: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type CustomerData = {
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
  paymentMethod?: string;
};

const CART_KEY = 'cart';
const PROFILE_KEY = 'lineProfile';
const CUSTOMER_DATA_KEY = 'customerData';
import { API_BASE_URL as API_BASE } from '../../config/api';

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: '現金付款',
  transfer: '銀行轉帳',
  line_pay: 'LINE Pay',
  credit: '信用卡'
};

export default function CheckoutPage() {
  const { profile } = useLiff();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CustomerData>({
    name: '',
    phone: '',
    address: '',
    notes: '',
    paymentMethod: ''
  });
  const [isSubmitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const cartRaw = window.localStorage.getItem(CART_KEY);
    if (cartRaw) {
      try {
        const parsed: CartItem[] = JSON.parse(cartRaw);
        setCartItems(parsed);
      } catch (error) {
        console.warn('無法解析購物車資料', error);
      }
    }

    const profileRaw = window.localStorage.getItem(PROFILE_KEY);
    const savedCustomerRaw = window.localStorage.getItem(CUSTOMER_DATA_KEY);
    const profile = profileRaw ? JSON.parse(profileRaw) : null;
    const saved = savedCustomerRaw ? JSON.parse(savedCustomerRaw) : null;

    setCustomer(prev => ({
      name: profile?.displayName ?? saved?.name ?? prev.name ?? '',
      phone: saved?.phone ?? prev.phone ?? '',
      address: saved?.address ?? prev.address ?? '',
      notes: saved?.notes ?? prev.notes ?? '',
      paymentMethod: saved?.paymentMethod ?? prev.paymentMethod ?? ''
    }));
  }, []);

  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0), [cartItems]);
  const deliveryFee = subtotal >= 200 ? 0 : 50;
  const totalAmount = subtotal + deliveryFee;

  const handleChange = (field: keyof CustomerData) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setCustomer(prev => ({ ...prev, [field]: value }));
  };

  const clearSavedData = () => {
    window.localStorage.removeItem(CUSTOMER_DATA_KEY);
    setMessage('已清除先前儲存的配送資訊');
  };

  const persistCustomerData = (data: CustomerData) => {
    window.localStorage.setItem(CUSTOMER_DATA_KEY, JSON.stringify(data));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cartItems.length === 0) {
      setMessage('購物車為空，請先選購商品');
      return;
    }
    if (!customer.name || !customer.phone || !customer.address || !customer.paymentMethod) {
      setMessage('請完整填寫必填欄位');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        contactName: customer.name,
        contactPhone: customer.phone,
        address: customer.address,
        paymentMethod: customer.paymentMethod === 'linepay' ? 'line_pay' : customer.paymentMethod,
        subtotal,
        deliveryFee,
        totalAmount,
        notes: customer.notes,
        lineUserId: profile?.userId, // ✨ 新增：傳送 LINE User ID
        lineDisplayName: profile?.displayName, // ✨ 新增：傳送 LINE 顯示名稱
        items: cartItems.map((item, index) => ({
          productId: String(item.productId ?? item.id ?? `item-${index}`),
          name: item.name,
          quantity: item.quantity || 1,
          unit: item.unit ?? '份',
          unitPrice: Number(item.unitPrice ?? 0),
          lineTotal: Number(item.lineTotal ?? 0)
        }))
      };

      const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? '送出訂單失敗');
      }

      persistCustomerData(customer);
      window.localStorage.removeItem(CART_KEY);
      setCartItems([]);
      setMessage('✅ 訂單已送出，請留意 LINE 或簡訊通知！');
    } catch (error: any) {
      setMessage(error.message ?? '送出訂單失敗，請稍候再試');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="legacy-home" style={{ minHeight: '100vh' }}>
      <header className="main-header">
        <div className="header-content" style={{ maxWidth: 600 }}>
          <div className="store-info">
            <h1 className="store-name">誠憶鮮蔬 - 結帳</h1>
            <div className="store-stats">
              <span className="store-badge">安全加密結帳</span>
              <span className="line-status">完善配送資訊，便於出貨安排</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content" style={{ maxWidth: 720 }}>
        <section className="products-section" style={{ padding: '1.5rem' }}>
          <h2 className="mb-3" style={{ textAlign: 'center', color: '#2d4a3a' }}>
            訂單摘要
          </h2>
          {cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <p className="text-muted">目前購物車為空，請返回首頁選購商品。</p>
              <a className="btn btn-success" href="/">
                返回首頁
              </a>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-borderless align-middle">
                <thead>
                  <tr className="text-muted">
                    <th>商品</th>
                    <th className="text-center">數量</th>
                    <th className="text-end">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((item, index) => (
                    <tr key={item.productId ?? item.id ?? index}>
                      <td>
                        <strong>{item.name}</strong>
                        <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                          {item.unit ?? '份'} ｜ 單價 NT${Number(item.unitPrice ?? 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="text-center">{item.quantity ?? 1}</td>
                      <td className="text-end">NT${Number(item.lineTotal ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="text-end">
                      商品金額
                    </td>
                    <td className="text-end">NT${subtotal.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="text-end">
                      配送運費（滿 200 元免運）
                    </td>
                    <td className="text-end">NT${deliveryFee.toLocaleString()}</td>
                  </tr>
                  <tr className="fw-bold">
                    <td colSpan={2} className="text-end">
                      應付金額
                    </td>
                    <td className="text-end">NT${totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="checkout-section" style={{ marginTop: '2rem' }}>
          <form id="checkout-form" className="checkout-form" onSubmit={handleSubmit}>
            <h2 className="mb-3">填寫配送資訊</h2>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="name">
                  收件人姓名*
                </label>
                <input
                  id="name"
                  className="form-control"
                  value={customer.name ?? ''}
                  onChange={handleChange('name')}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="phone">
                  聯絡電話*
                </label>
                <input
                  id="phone"
                  className="form-control"
                  type="tel"
                  value={customer.phone ?? ''}
                  onChange={handleChange('phone')}
                  pattern="09[0-9]{8}"
                  placeholder="09xxxxxxxx"
                  required
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="form-label" htmlFor="address">
                配送地址*
              </label>
              <input
                id="address"
                className="form-control"
                value={customer.address ?? ''}
                onChange={handleChange('address')}
                required
              />
            </div>

            <div className="mt-3">
              <label className="form-label" htmlFor="notes">
                備註事項
              </label>
              <textarea
                id="notes"
                className="form-control"
                rows={3}
                value={customer.notes ?? ''}
                onChange={handleChange('notes')}
                placeholder="例如：希望 17:00 前送達／需搭電梯／其他注意事項"
              />
            </div>

            <div className="mt-3">
              <label className="form-label" htmlFor="paymentMethod">
                付款方式*
              </label>
              <select
                id="paymentMethod"
                className="form-select"
                value={customer.paymentMethod ?? ''}
                onChange={handleChange('paymentMethod')}
                required
              >
                <option value="">請選擇</option>
                <option value="cash">現金付款</option>
                <option value="linepay">LINE Pay</option>
                <option value="transfer">銀行轉帳</option>
                <option value="credit">信用卡</option>
              </select>
            </div>

            <div className="mt-4 d-flex flex-column align-items-center">
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={clearSavedData}
              >
                清除先前儲存的配送資訊
              </button>
              <small className="text-muted mt-2">
                （系統會自動保存您的配送資料，方便下次下單）
              </small>
            </div>

            <div className="info-box mt-4" style={{ padding: '1.25rem', borderRadius: '14px', background: '#f8fffe', border: '1px solid rgba(124,179,66,0.2)' }}>
              <p className="mb-1">
                <strong>貼心提醒：</strong>
              </p>
              <ul className="mb-0" style={{ paddingLeft: '1.2rem', color: '#4b5563' }}>
                <li>每日上午 11:00 前下單的訂單，當日即可安排出貨。</li>
                <li>單筆訂單滿 NT$200 即享免運，未達免運門檻酌收 NT$50。</li>
                <li>配送時間約 2-3 小時，如遇天候因素將另行通知。</li>
              </ul>
            </div>

            <button type="submit" className="btn btn-success w-100 mt-4" disabled={isSubmitting || cartItems.length === 0}>
              {isSubmitting ? '送出訂單中...' : '送出訂單'}
            </button>
          </form>

          {message && (
            <div className={`alert mt-3 ${message.startsWith('✅') ? 'alert-success' : message.startsWith('送出訂單失敗') ? 'alert-danger' : 'alert-info'}`}>
              {message}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
