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
    if (typeof window !== 'undefined') {
      const cachedProfile = window.localStorage.getItem('lineProfile');
      if (cachedProfile) {
        try {
          const parsedProfile = JSON.parse(cachedProfile) as LiffProfile;
          setProfile(parsedProfile);
        } catch {
          window.localStorage.removeItem('lineProfile');
        }
      }
    }

    const initLiff = async () => {
      try {
        await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: true });
        setIsReady(true);

        if (!liff.isLoggedIn()) {
          if (typeof window !== 'undefined') {
            liff.login({ redirectUri: window.location.href });
          } else {
            liff.login();
          }
          return;
        }

        setIsLoggedIn(true);
        const userProfile = await liff.getProfile();
        const liffProfile: LiffProfile = {
          userId: userProfile.userId,
          displayName: userProfile.displayName,
          pictureUrl: userProfile.pictureUrl
        };
        setProfile(liffProfile);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem('lineProfile', JSON.stringify(liffProfile));
        }
      } catch (err: any) {
        console.error('LIFF init failed:', err);
        setError(err.message || 'LIFF initialization failed');
      }
    };

    initLiff();
  }, []);

  const login = () => {
    if (isReady && !isLoggedIn) {
      if (typeof window !== 'undefined') {
        liff.login({ redirectUri: window.location.href });
      } else {
        liff.login();
      }
    }
  };

  const logout = () => {
    if (isReady && isLoggedIn) {
      liff.logout();
      setIsLoggedIn(false);
      setProfile(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('lineProfile');
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
