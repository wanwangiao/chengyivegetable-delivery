import type { Metadata } from 'next';
import './globals.css';
import { Noto_Sans_TC } from 'next/font/google';

const notoSans = Noto_Sans_TC({ subsets: ['latin'], weight: ['400', '500', '700'] });

export const metadata: Metadata = {
  title: '誠憶鮮蔬｜線上訂購系統',
  description: '提供新鮮蔬果訂購、配送與訂單追蹤的全新平台。'
};

const legacyStyles = [
  '/legacy/css/styles.css',
  '/legacy/css/card-layout.css',
  '/legacy/css/cart-item-detail.css',
  '/legacy/css/cart-modal.css',
  '/legacy/css/mobile-optimized.css',
  '/legacy/css/admin-dashboard.css',
  '/legacy/css/driver-portal.css'
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
        {legacyStyles.map(path => (
          <link key={path} rel="stylesheet" href={path} />
        ))}
      </head>
      <body className={notoSans.className}>{children}</body>
    </html>
  );
}
