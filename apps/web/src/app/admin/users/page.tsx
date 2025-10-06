'use client';

import { useEffect, useMemo, useState } from 'react';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'DRIVER' | 'CUSTOMER';
  isActive: boolean;
  createdAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

const roleOptions: Array<{ value: User['role']; label: string }> = [
  { value: 'ADMIN', label: '管理員' },
  { value: 'DRIVER', label: '外送員' },
  { value: 'CUSTOMER', label: '一般用戶' }
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    role: 'ADMIN' as User['role']
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('chengyi_admin_token');
    if (saved) {
      setToken(saved);
    }
  }, []);

  const headers = useMemo(() => {
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    } as Record<string, string>;
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_BASE}/admin/users`, {
          headers,
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(response.status === 401 ? '未授權，請確認 token' : '讀取帳號資料失敗');
        }
        const json = await response.json();
        setUsers(json.data ?? []);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message ?? '系統錯誤');
        }
      } finally {
        setLoading(false);
      }
    };
    load().catch(() => undefined);
    return () => controller.abort();
  }, [token, headers]);

  const saveToken = () => {
    window.localStorage.setItem('chengyi_admin_token', token);
  };

  const refreshUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/users`, { headers });
      if (!response.ok) {
        throw new Error('讀取帳號資料失敗');
      }
      const json = await response.json();
      setUsers(json.data ?? []);
    } catch (err: any) {
      setError(err.message ?? '系統錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError('請先設定管理員 Token');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newUser)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error === 'EMAIL_EXISTS' ? 'Email 已存在' : '建立帳號失敗');
      }
      setNewUser({ email: '', name: '', password: '', role: 'ADMIN' });
      await refreshUsers();
    } catch (err: any) {
      setError(err.message ?? '建立帳號失敗');
    } finally {
      setCreating(false);
    }
  };

  const patchUser = async (id: string, payload: Partial<User> & { password?: string }) => {
    if (!token) return;
    await fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    })
      .then(async response => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? '更新帳號失敗');
        }
        await refreshUsers();
      })
      .catch(err => setError(err.message ?? '更新帳號失敗'));
  };

  const toggleActive = async (user: User) => {
    await patchUser(user.id, { isActive: !user.isActive });
  };

  const updateRole = async (user: User, role: User['role']) => {
    if (role === user.role) return;
    await patchUser(user.id, { role });
  };

  const resetPassword = async (user: User) => {
    const newPassword = window.prompt(`為 ${user.email} 設定新密碼（至少 8 碼）`);
    if (!newPassword) return;
    if (newPassword.length < 8) {
      window.alert('密碼長度需至少 8 碼');
      return;
    }
    await patchUser(user.id, { password: newPassword });
  };

  return (
    <div>
      <div className="token-box">
        <h5 className="mb-3">管理員授權 Token</h5>
        <p className="text-muted">於登入 API 後取得的 JWT，將用於呼叫後端保護路由。</p>
        <div className="d-flex gap-2">
          <input
            className="form-control"
            placeholder="Bearer Token"
            value={token}
            onChange={event => setToken(event.target.value)}
          />
          <button type="button" className="btn btn-success" onClick={saveToken}>
            儲存
          </button>
        </div>
      </div>

      <form className="user-form-card" onSubmit={handleCreateUser}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 className="mb-1">新增帳號</h5>
            <p className="text-muted mb-0">建立新的管理員或外送員帳號</p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? '建立中…' : '建立帳號'}
          </button>
        </div>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">Email</label>
            <input
              className="form-control"
              type="email"
              value={newUser.email}
              onChange={event => setNewUser(prev => ({ ...prev, email: event.target.value }))}
              required
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">姓名</label>
            <input
              className="form-control"
              value={newUser.name}
              onChange={event => setNewUser(prev => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">密碼</label>
            <input
              className="form-control"
              type="password"
              value={newUser.password}
              onChange={event => setNewUser(prev => ({ ...prev, password: event.target.value }))}
              minLength={8}
              required
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">角色</label>
            <select
              className="form-select"
              value={newUser.role}
              onChange={event => setNewUser(prev => ({ ...prev, role: event.target.value as User['role'] }))}
            >
              {roleOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="table-responsive shadow-sm rounded-3 bg-white">
        <table className="table table-hover mb-0 user-table">
          <thead className="table-light">
            <tr>
              <th scope="col">Email</th>
              <th scope="col">姓名</th>
              <th scope="col">角色</th>
              <th scope="col">狀態</th>
              <th scope="col">建立時間</th>
              <th scope="col" className="text-end">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.name}</td>
                <td style={{ maxWidth: 160 }}>
                  <select
                    className="form-select form-select-sm"
                    value={user.role}
                    onChange={event => updateRole(user, event.target.value as User['role'])}
                    disabled={loading}
                  >
                    {roleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`badge ${user.isActive ? 'bg-success' : 'bg-secondary'}`}>
                    {user.isActive ? '啟用' : '停用'}
                  </span>
                </td>
                <td>{new Date(user.createdAt).toLocaleString('zh-TW')}</td>
                <td className="text-end">
                  <div className="btn-group btn-group-sm" role="group">
                    <button className="btn btn-outline-secondary" onClick={() => toggleActive(user)} disabled={loading}>
                      {user.isActive ? '停用' : '啟用'}
                    </button>
                    <button className="btn btn-outline-primary" onClick={() => resetPassword(user)} disabled={loading}>
                      重設密碼
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted">
                  尚無帳號資料，請先建立。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="text-center text-muted mt-3">資料載入中…</div>
      )}
    </div>
  );
}
