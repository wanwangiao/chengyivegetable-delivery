'use client';

import { useEffect, useMemo, useState } from 'react';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部商品');

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
          <div className="products-list mobile-layout">
            {!loading && filteredProducts.length === 0 && (
              <div id="no-results-message" style={{ padding: '2rem', textAlign: 'center' }}>
                <strong>找不到符合條件的商品</strong>
                <p>試試其他關鍵字或切換分類。</p>
              </div>
            )}
            {filteredProducts.map(product => (
              <article key={product.id} className="product-item mobile-item">
                <div className="product-image-left">
                  <div className="product-image-container">🥬</div>
                </div>
                <div className="product-info">
                  <h3 className="product-title">{product.name}</h3>
                  <div className="product-price">
                    <span className="price-amount">NT${product.price.toLocaleString()}</span>
                    <span className="price-unit"> / {product.unit}</span>
                  </div>
                  <div className="product-meta">
                    <span className="stock-info">庫存：約 {Math.max(Math.round(product.stock), 0)} {product.unit}</span>
                  </div>
                </div>
                <div className="product-actions">
                  <button className="btn-primary" type="button">
                    加入購物車
                  </button>
                  <button className="btn-secondary" type="button">
                    查看詳情
                  </button>
                </div>
              </article>
            ))}
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
    </div>
  );
}
