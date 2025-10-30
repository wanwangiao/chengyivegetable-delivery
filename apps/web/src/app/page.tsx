'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FloatingCartBar } from '../components/FloatingCartBar';
import { CartDrawer } from '../components/CartDrawer';
import { CheckoutDrawer, type CheckoutFormData } from '../components/CheckoutDrawer';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { BrandHeader } from '../components/BrandHeader';
import { BusinessStatusBanner } from '../components/BusinessStatusBanner';
import { StaggerList } from '../components/animations/StaggerList';
import { ListSkeleton } from '../components/animations/Skeleton';
import { useCart } from '../hooks/useCart';
import '../styles/theme.css';
import styles from './page.module.css';

type Product = {
  id: string;
  name: string;
  category: string;
  price: number | null | undefined;
  unit: string;
  stock: number;
  imageUrl?: string;
  description?: string;
  isPricedItem?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

const FALLBACK_CATEGORIES = ['全部商品', '安心精選', '每日推薦'];

const categoryLabel = (category: string | undefined) => (category && category.trim().length > 0 ? category : '其他');

export default function HomePage() {
  const router = useRouter();
  const cart = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部商品');
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [checkoutDrawerOpen, setCheckoutDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/products?onlyAvailable=true`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('載入商品失敗，請稍後再試');
        }
        const json = await response.json();
        setProducts(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message ?? '發生未知錯誤');
        }
      } finally {
        setLoading(false);
      }
    };

    loadProducts().catch(() => undefined);
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => {
    const dynamic = Array.from(new Set(products.map(product => categoryLabel(product.category))));
    return ['全部商品', ...dynamic, ...FALLBACK_CATEGORIES.filter(cat => !dynamic.includes(cat))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = searchKeyword.trim();
    return products.filter(product => {
      const nameMatches = product.name.includes(keyword);
      const categoryMatches = categoryLabel(product.category).includes(keyword);
      const matchesKeyword = keyword.length === 0 || nameMatches || categoryMatches;
      const productCategory = categoryLabel(product.category);
      const matchesCategory =
        activeCategory === '全部商品' ||
        productCategory === activeCategory ||
        (activeCategory === '安心精選' && (product.price ?? 0) >= 100) ||
        (activeCategory === '每日推薦' && product.stock <= 20);
      return matchesKeyword && matchesCategory;
    });
  }, [products, searchKeyword, activeCategory]);

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setProductModalOpen(true);
  };

  const handleCloseProductModal = () => {
    setProductModalOpen(false);
    setTimeout(() => setSelectedProduct(null), 200);
  };

  const handleAddToCart = (product: Product, quantity: number = 1, selectedOptions?: Record<string, string | string[]>) => {
    if (product.price === null || product.price === undefined) {
      window.alert('此商品為秤重商品，請直接與客服聯繫。');
      return;
    }

    for (let i = 0; i < quantity; i += 1) {
      cart.addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit
      }, selectedOptions);
    }
  };

  const handleCheckout = () => {
    if (cart.items.length === 0) {
      window.alert('購物車為空，請先選購商品。');
      return;
    }
    setCartDrawerOpen(false);
    setTimeout(() => setCheckoutDrawerOpen(true), 250);
  };

  const handleBackToCart = () => {
    setCheckoutDrawerOpen(false);
    setTimeout(() => setCartDrawerOpen(true), 250);
  };

  const handleSubmitOrder = async (formData: CheckoutFormData) => {
    if (cart.items.length === 0) {
      window.alert('購物車為空，請先選購商品。');
      return;
    }

    const payload = {
      contactName: formData.contactName,
      contactPhone: formData.contactPhone,
      address: formData.address,
      paymentMethod: formData.paymentMethod === 'linepay' ? 'line_pay' : formData.paymentMethod,
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      totalAmount: cart.totalAmount,
      notes: formData.notes,
      items: cart.items.map((item, index) => ({
        productId: item.productId ?? item.id ?? `item-${index}`,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal
      }))
    };

    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || '訂單送出失敗，請稍後再試');
    }

    cart.clearCart();
    setCheckoutDrawerOpen(false);
    window.alert('訂單已送出，我們將盡快為您安排配送！');
    router.push('/order-tracking');
  };

  return (
    <div className={styles.page}>
      {/* LOGO + 店名 + 營業狀態 組合框 */}
      <div className={styles.brandContainer}>
        <BrandHeader />
        <BusinessStatusBanner />
      </div>

      <section className={styles.categoryNav}>
        <div className={styles.categoryTabs}>
          {categories.map(category => (
            <button
              key={category}
              type="button"
              className={`${styles.categoryTab} ${category === activeCategory ? styles.active : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <main className={styles.mainContent}>
        <section className={styles.searchArea}>
          <div className={styles.searchBox}>
            <input
              id="product-search"
              className={styles.searchInput}
              placeholder="搜尋商品名稱或類別"
              value={searchKeyword}
              onChange={event => setSearchKeyword(event.target.value)}
            />
            {searchKeyword.length > 0 && (
              <button className={styles.searchClear} type="button" onClick={() => setSearchKeyword('')}>
                ✕
              </button>
            )}
          </div>
          <div className={styles.searchResultsInfo}>
            <div className={styles.searchResultText}>
              {loading ? '載入商品中...' : `共有 ${filteredProducts.length} 項商品符合條件`}
            </div>
          </div>
        </section>

        <section className={styles.productsSection}>
          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}
          <div>
            {loading && <ListSkeleton count={5} />}

            {!loading && filteredProducts.length === 0 && (
              <div id="no-results-message" style={{ padding: '2rem', textAlign: 'center' }}>
                <strong>尚未找到符合條件的商品</strong>
                <p>請嘗試其他關鍵字或調整篩選條件。</p>
              </div>
            )}

            {!loading && filteredProducts.length > 0 && (
              <>
                {/* 前 20 個商品使用動畫 */}
                <StaggerList staggerDelay={50} duration={400} direction="up">
                  {filteredProducts.slice(0, 20).map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onClick={() => handleProductClick(product)}
                    />
                  ))}
                </StaggerList>

                {/* 剩餘商品直接顯示，無動畫 */}
                {filteredProducts.slice(20).map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => handleProductClick(product)}
                  />
                ))}
              </>
            )}
          </div>
        </section>

        <section className={styles.serviceAnnouncement}>
          <h3 className={styles.announcementTitle}>配送說明</h3>
          <div className={styles.announcementContent}>
            ・每日 12:00 前下單，當日新鮮出貨。<br />
            ・雨天將採用保冷箱配送，確保蔬果品質。<br />
            ・大量訂購歡迎透過 LINE 官方帳號與客服聯繫。
          </div>
        </section>

        <section className={styles.ctaBlock}>
          <div className={styles.ctaCard}>
            <h3>訂單查詢</h3>
            <p>輸入訂單編號即可查詢出貨進度與司機位置。</p>
            <a className={styles.btnPrimary} href="/order-tracking">
              前往訂單追蹤
            </a>
          </div>
        </section>
      </main>

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

      <ProductDetailModal
        product={selectedProduct}
        open={productModalOpen}
        onClose={handleCloseProductModal}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
