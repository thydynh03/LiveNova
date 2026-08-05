'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  login as apiLogin,
  logout as apiLogout,
  restoreSession,
  setAccessToken,
  setUnauthenticatedHandler,
} from '../lib/api-client';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const router = useRouter();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The access token is memory-only, so every page load starts anonymous and
  // silently re-mints one from the httpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;

    restoreSession()
      .then((token) => {
        if (cancelled) return;
        setStatus(token ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 that survives a refresh means the session is gone for good.
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setAccessToken(null);
      if (mounted.current) setStatus('anonymous');
    });
    return () => setUnauthenticatedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setStatus('anonymous');
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ status, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
