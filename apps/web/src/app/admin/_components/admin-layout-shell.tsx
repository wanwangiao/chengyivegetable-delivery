'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  const activeItem = NAV_ITEMS.find(item => pathname.startsWith(item.href));
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <span className={styles.statusBadge}>線上</span>
        </header>
        <section className={styles.adminMainSection}>{children}</section>
      </main>
    </div>
  );
}
