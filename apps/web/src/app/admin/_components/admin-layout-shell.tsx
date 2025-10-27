'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Route } from 'next';
import styles from './admin-layout-shell.module.css';

type NavItem = {
  label: string;
  href: Route;
};

const NAV_ITEMS: NavItem[] = [
  { label: '儀表板', href: '/admin' },
  { label: '訂單管理', href: '/admin/orders' },
  { label: '商品管理', href: '/admin/products' },
  { label: '配送監控', href: '/admin/delivery' },
  { label: '帳號管理', href: '/admin/users' },
  { label: '系統設定', href: '/admin/settings' }
];

export default function AdminLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeItem = NAV_ITEMS.find(item => pathname.startsWith(item.href));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // 檢查身份驗證
  useEffect(() => {
    // 如果在登入頁面，直接通過
    if (pathname === '/admin/login') {
      setIsAuthenticated(true);
      setIsChecking(false);
      return;
    }

    // 檢查 localStorage 中的 token
    const token = localStorage.getItem('chengyi_admin_token');

    if (!token) {
      // 沒有 token，重定向到登入頁面
      router.push('/admin/login');
      setIsChecking(false);
    } else {
      // 有 token，設置為已驗證
      setIsAuthenticated(true);
      setIsChecking(false);
    }
  }, [pathname, router]);

  // 路徑改變時關閉側邊欄
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // 防止側邊欄打開時背景滾動
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('chengyi_admin_token');
    router.push('/admin/login');
  };

  // 載入中狀態
  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        驗證中...
      </div>
    );
  }

  // 如果在登入頁面，不顯示後台佈局
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // 如果未通過驗證（理論上不會到這裡，因為會重定向）
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.adminLayout}>
      {/* 漢堡選單按鈕 (手機版) */}
      <button
        className={`${styles.menuButton} ${sidebarOpen ? styles.open : ''}`}
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? '關閉選單' : '打開選單'}
      >
        <div className={styles.menuIcon}>
          <span />
          <span />
          <span />
        </div>
      </button>

      {/* 遮罩層 */}
      <div
        className={`${styles.overlay} ${sidebarOpen ? styles.visible : ''}`}
        onClick={closeSidebar}
      />

      {/* 側邊欄 */}
      <aside className={`${styles.adminSidebar} ${sidebarOpen ? styles.open : ''}`}>
        <div className={styles.sidebarLogo}>
          <h2>誠憶鮮蔬</h2>
          <p>後台管理系統</p>
        </div>
        <nav className={styles.sidebarNav}>
          {NAV_ITEMS.map(item => (
            <div className={styles.navItem} key={item.href}>
              <Link
                className={`${styles.navLink} ${pathname.startsWith(item.href) ? styles.active : ''}`}
                href={item.href}
              >
                <span className={styles.navIcon}>●</span>
                {item.label}
              </Link>
            </div>
          ))}
        </nav>
      </aside>

      {/* 主內容區 */}
      <main className={styles.adminContent}>
        <header className={styles.adminHeader}>
          <div>
            <h1 className={styles.adminTitle}>{activeItem?.label ?? '後台管理'}</h1>
            <p className={styles.adminSubtitle}>檢視與維護 {activeItem?.label ?? '後台'} 的相關資訊</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className={styles.statusBadge}>線上</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
              onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
            >
              登出
            </button>
          </div>
        </header>
        <section className={styles.adminMainSection}>{children}</section>
      </main>
    </div>
  );
}
