import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AdminLayoutShell from './_components/admin-layout-shell';

export const metadata: Metadata = {
  title: '誠憶鮮蔬｜後台管理',
  description: '管理訂單、商品、帳號與配送設定'
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
