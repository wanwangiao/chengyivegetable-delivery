'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import './login.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error === 'INVALID_CREDENTIALS' ? '帳號或密碼錯誤' : '登入失敗');
      }

      const data = await response.json();

      // 儲存 token
      if (typeof window !== 'undefined') {
        localStorage.setItem('chengyi_admin_token', data.accessToken);
      }

      // 跳轉到儀表板
      router.push('/admin');
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? '登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>誠憶鮮蔬</h1>
          <p>後台管理系統</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="請輸入管理員 Email"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">密碼</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              required
              disabled={loading}
              autoComplete="current-password"
              minLength={8}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-login"
            disabled={loading}
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>

        <div className="login-footer">
          <p className="text-muted">請使用管理員帳號登入</p>
        </div>
      </div>
    </div>
  );
}
