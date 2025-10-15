import { useEffect, useState } from 'react';
import liff from '@line/liff';

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || '2008130399-z1QXZgma';

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export function useLiff() {
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        setIsReady(true);

        if (liff.isLoggedIn()) {
          setIsLoggedIn(true);
          const userProfile = await liff.getProfile();
          const liffProfile: LiffProfile = {
            userId: userProfile.userId,
            displayName: userProfile.displayName,
            pictureUrl: userProfile.pictureUrl
          };
          setProfile(liffProfile);

          // 儲存到 localStorage 供其他頁面使用
          if (typeof window !== 'undefined') {
            localStorage.setItem('lineProfile', JSON.stringify(liffProfile));
          }
        }
      } catch (err: any) {
        console.error('LIFF init failed:', err);
        setError(err.message || 'LIFF 初始化失敗');
      }
    };

    initLiff();
  }, []);

  const login = () => {
    if (isReady && !isLoggedIn) {
      liff.login();
    }
  };

  const logout = () => {
    if (isReady && isLoggedIn) {
      liff.logout();
      setIsLoggedIn(false);
      setProfile(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lineProfile');
      }
    }
  };

  return {
    isReady,
    isLoggedIn,
    profile,
    error,
    login,
    logout,
    liff: isReady ? liff : null
  };
}
