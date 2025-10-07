'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Route } from 'next';

type NavItem = {
  label: string;
  href: Route;
};

const NAV_ITEMS: NavItem[] = [
  { label: '儀表板', href: '/admin' },
  { label: '訂單管理', href: '/admin/orders' },
  { label: '商品管理', href: '/admin/products' },
  { label: '配送監控', href: '/admin/delivery' },
  { label: '帳號管理', href: '/admin/users' }
];

export default function AdminLayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeItem = NAV_ITEMS.find(item => pathname.startsWith(item.href));

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <h2>誠憶鮮蔬</h2>
          <p>後台管理系統</p>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <div className="nav-item" key={item.href}>
              <Link className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''}`} href={item.href}>
                <span className="me-2">
                  <i className="fa-solid fa-circle" style={{ fontSize: '0.5rem' }} />
                </span>
                {item.label}
              </Link>
            </div>
          ))}
        </nav>
      </aside>
      <main className="admin-content">
        <header className="admin-header">
          <div>
            <h1 className="admin-title">{activeItem?.label ?? '後台管理'}</h1>
            <p className="text-muted mb-0">檢視與維護 {activeItem?.label ?? '後台'} 的相關資訊</p>
          </div>
          <span className="badge bg-success">線上</span>
        </header>
        <section className="admin-main-section">{children}</section>
      </main>
    </div>
  );
}
