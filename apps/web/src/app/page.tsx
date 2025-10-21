'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FloatingCartBar } from '../components/FloatingCartBar';
import { CartDrawer } from '../components/CartDrawer';
import { CheckoutDrawer } from '../components/CheckoutDrawer';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { BusinessStatusBanner } from '../components/BusinessStatusBanner';
import { StaggerList } from '../components/animations/StaggerList';
import { ListSkeleton } from '../components/animations/Skeleton';
import { useCart } from '../hooks/useCart';
import '../styles/theme.css';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

const FALLBACK_CATEGORIES = ['全部商品', '熱門精選', '本日推薦'];

const categoryLabel = (category: string | undefined) => {
  if (!category) return '其他';
  return category;
};

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部商品');

  // Shopping cart state
  const cart = useCart();
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [checkoutDrawerOpen, setCheckoutDrawerOpen] = useState(false);

  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/products?onlyAvailable=true`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('載入商品失敗');
        }
        const json = await response.json();
        setProducts(json.data ?? []);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message ?? '未知錯誤');
        }
      } finally {
        setLoading(false);
      }
    };
    load().catch(() => undefined);
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => {
    const dynamic = Array.from(new Set(products.map(product => categoryLabel(product.category))));
    return ['全部商品', ...dynamic, ...FALLBACK_CATEGORIES.filter(cat => !dynamic.includes(cat))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesKeyword = product.name.includes(searchKeyword) || categoryLabel(product.category).includes(searchKeyword);
      const matchesCategory =
        activeCategory === '全部商品' || categoryLabel(product.category) === activeCategory ||
        (activeCategory === '熱門精選' && product.price >= 100) ||
        (activeCategory === '本日推薦' && product.stock <= 20);
      return matchesKeyword && matchesCategory;
    });
  }, [products, searchKeyword, activeCategory]);

  // Product detail handlers
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const handleCloseProductModal = () => {
    setProductModalOpen(false);
    setTimeout(() => setSelectedProduct(null), 300);
  };

  // Cart handlers
  const handleAddToCart = (product: Product, quantity: number = 1) => {
    for (let i = 0; i < quantity; i++) {
      cart.addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit
      });
    }
  };

  const handleCheckout = () => {
    setCartDrawerOpen(false);
    setTimeout(() => {
      setCheckoutDrawerOpen(true);
    }, 300);
  };

  const handleBackToCart = () => {
    setCheckoutDrawerOpen(false);
    setTimeout(() => {
      setCartDrawerOpen(true);
    }, 300);
  };

  const handleSubmitOrder = async (formData: any) => {
    try {
      const orderPayload = {
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        address: formData.address,
        paymentMethod: formData.paymentMethod,
        items: cart.items.map(item => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit
        })),
        subtotal: cart.subtotal,
        deliveryFee: cart.deliveryFee,
        totalAmount: cart.totalAmount
      };

      const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        throw new Error('訂單提交失敗');
      }

      const result = await response.json();

      // Save customer data for next time
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastCustomerData', JSON.stringify({
          contactName: formData.contactName,
          contactPhone: formData.contactPhone,
          address: formData.address
        }));
      }

      // Clear cart and close drawer
      cart.clearCart();
      setCheckoutDrawerOpen(false);

      // Redirect to order tracking
      alert(`訂單已成功送出！訂單編號：${result.data?.id || '未知'}`);
      router.push(`/order-tracking?phone=${encodeURIComponent(formData.contactPhone)}`);
    } catch (err: any) {
      alert(`訂單提交失敗：${err.message}`);
    }
  };

  return (
    <div className="legacy-home">
      <header className="main-header">
        <div className="header-content">
          <div className="store-info">
            <h1 className="store-name">誠憶鮮蔬線上超市</h1>
            <div className="store-stats">
              <span className="store-badge">每日現採配送</span>
              <span className="line-status">LINE 下單 24H 快速回覆</span>
            </div>
          </div>
          <div className="store-pillars">
            <div>新鮮蔬果</div>
            <div>友善配送</div>
            <div>產地直送</div>
          </div>
        </div>
      </header>

      {/* Business Status Banner */}
      <div style={{ padding: '0 1rem' }}>
        <BusinessStatusBanner />
      </div>

      <section className="category-nav">
        <div className="category-tabs">
          {categories.map(category => (
            <button
              key={category}
              type="button"
              className={`category-tab ${activeCategory === category ? 'active' : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <main className="main-content">
        <section className="search-area">
          <div className="search-box">
            <input
              id="product-search"
              className="search-input"
              placeholder="搜尋蔬菜、食材或關鍵字"
              value={searchKeyword}
              onChange={event => setSearchKeyword(event.target.value)}
            />
            {searchKeyword.length > 0 && (
              <button className="search-clear" type="button" onClick={() => setSearchKeyword('')}>
                ×
              </button>
            )}
          </div>
          <div className="search-results-info">
            <div className="search-result-text">
              {loading ? '正在載入商品...' : `共 ${filteredProducts.length} 項商品符合條件`}
            </div>
          </div>
        </section>

        <section className="products-section">
          {error && (
            <div className="error-message" style={{ padding: '1rem', textAlign: 'center', color: '#c53030' }}>
              {error}
            </div>
          )}
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 1rem' }}>
            {loading && <ListSkeleton count={5} />}

            {!loading && filteredProducts.length === 0 && (
              <div id="no-results-message" style={{ padding: '2rem', textAlign: 'center' }}>
                <strong>找不到符合條件的商品</strong>
                <p>試試其他關鍵字或切換分類。</p>
              </div>
            )}

            {!loading && filteredProducts.length > 0 && (
              <StaggerList
                staggerDelay={80}
                duration={500}
                direction="up"
              >
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => handleProductClick(product)}
                  />
                ))}
              </StaggerList>
            )}
          </div>
        </section>

        <section className="service-announcement" style={{ marginTop: '1.5rem' }}>
          <h3 className="announcement-title">配送提醒</h3>
          <div className="announcement-content">
            ・每日 12:00 前下單，當日新鮮出貨<br />
            ・雨天配送改由保冷箱保存，確保品質<br />
            ・如需大量訂購，歡迎透過 LINE 官方帳號聯繫客服
          </div>
        </section>

        <section className="cta-block" style={{ marginTop: '1.5rem' }}>
          <div className="cta-card">
            <h3>想查詢訂單？</h3>
            <p>輸入手機號碼即可查看配送進度與司機位置。</p>
            <a className="btn-primary" href="/order-tracking">
              前往訂單追蹤
            </a>
          </div>
        </section>
      </main>

      {/* Shopping Cart Components */}
      <FloatingCartBar
        itemCount={cart.itemCount}
        totalAmount={cart.totalAmount}
        onClick={() => setCartDrawerOpen(true)}
      />

      <CartDrawer
        open={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        items={cart.items}
        subtotal={cart.subtotal}
        deliveryFee={cart.deliveryFee}
        totalAmount={cart.totalAmount}
        isFreeShipping={cart.isFreeShipping}
        amountToFreeShipping={cart.amountToFreeShipping}
        onUpdateQuantity={cart.updateQuantity}
        onRemoveItem={cart.removeItem}
        onCheckout={handleCheckout}
      />

      <CheckoutDrawer
        open={checkoutDrawerOpen}
        onClose={() => setCheckoutDrawerOpen(false)}
        onBack={handleBackToCart}
        items={cart.items}
        subtotal={cart.subtotal}
        deliveryFee={cart.deliveryFee}
        totalAmount={cart.totalAmount}
        onSubmit={handleSubmitOrder}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        open={productModalOpen}
        onClose={handleCloseProductModal}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
