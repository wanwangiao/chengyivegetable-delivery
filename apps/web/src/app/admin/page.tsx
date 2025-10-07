import Link from 'next/link';
import type { Route } from 'next';

const DASHBOARD_SECTIONS: { title: string; description: string; href: Route }[] = [
  {
    title: '訂單管理',
    description: '檢視訂單狀態、指派配送員並追蹤配送進度。',
    href: '/admin/orders'
  },
  {
    title: '商品管理',
    description: '維護商品資訊、庫存與售價，保持銷售內容最新。',
    href: '/admin/products'
  },
  {
    title: '配送監控',
    description: '掌握配送區域設定與即時路線狀態，確保準時送達。',
    href: '/admin/delivery'
  },
  {
    title: '帳號管理',
    description: '管理後台使用者與配送員權限，維持操作安全。',
    href: '/admin/users'
  }
];

export default function AdminDashboardPage() {
  return (
    <div className="admin-dashboard">
      <section className="admin-section">
        <header className="mb-4">
          <h1 className="h3 mb-2">營運儀表板</h1>
          <p className="text-muted mb-0">快速掌握核心模組狀態並進入對應維運流程。</p>
        </header>
        <div className="dashboard-grid">
          {DASHBOARD_SECTIONS.map(section => (
            <article className="dashboard-card" key={section.href}>
              <h2 className="h5 mb-2">{section.title}</h2>
              <p className="text-muted mb-3">{section.description}</p>
              <Link className="btn btn-success" href={section.href}>
                前往管理
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
