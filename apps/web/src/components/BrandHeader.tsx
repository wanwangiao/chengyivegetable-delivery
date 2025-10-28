'use client';

import { useEffect, useState } from 'react';
import styles from './BrandHeader.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';

type SystemConfig = {
  storeName: string;
  storeSlogan: string;
  storeLogo: string | null;
  storePhone: string | null;
};

export function BrandHeader() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/settings`);
        if (!response.ok) throw new Error('Failed to load config');
        const json = (await response.json()) as { data: SystemConfig };
        setConfig(json.data);
      } catch (error) {
        console.error('載入品牌設定失敗:', error);
        // 使用預設值
        setConfig({
          storeName: '誠憶鮮蔬',
          storeSlogan: '新鮮蔬果・每日配送',
          storeLogo: null,
          storePhone: null
        });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  if (loading || !config) {
    return (
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.skeleton} />
        </div>
      </header>
    );
  }

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.brandWrapper}>
          {config.storeLogo ? (
            <div className={styles.logoWrapper}>
              <img
                src={config.storeLogo}
                alt={`${config.storeName} LOGO`}
                className={styles.logo}
              />
            </div>
          ) : (
            <div className={styles.logoPlaceholder}>
              <span className={styles.logoEmoji}>🥬</span>
            </div>
          )}

          <div className={styles.brandText}>
            <h1 className={styles.storeName}>{config.storeName}</h1>
            <p className={styles.storeSlogan}>{config.storeSlogan}</p>
          </div>
        </div>

        {config.storePhone && (
          <a href={`tel:${config.storePhone}`} className={styles.phoneLink}>
            📞 {config.storePhone}
          </a>
        )}
      </div>
    </header>
  );
}
