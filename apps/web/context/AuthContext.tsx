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

  /**
   * Bumped by any deliberate auth action (sign-in, sign-out).
   *
   * The mount-time session restore is asynchronous. If the user signs in while
   * it is still running, the restore resolving afterwards would otherwise mark
   * them anonymous and overwrite the brand-new token with the old session's.
   */
  const authGeneration = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const generation = authGeneration.current;

    restoreSession()
      .then((token) => {
        if (!mounted.current || generation !== authGeneration.current) return;
        setStatus(token ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (!mounted.current || generation !== authGeneration.current) return;
        setStatus('anonymous');
      });
  }, []);

  // A 401 that survives a refresh means the session is gone for good.
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      authGeneration.current += 1;
      setAccessToken(null);
      if (mounted.current) setStatus('anonymous');
    });
    return () => setUnauthenticatedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // The generation is bumped only after a *successful* login. Bumping first
    // meant a rejected password invalidated the in-flight mount-time restore,
    // whose result was then discarded — leaving status stuck on 'loading'
    // forever, with no way to reach the login form again.
    await apiLogin(email, password);
    authGeneration.current += 1;
    if (mounted.current) setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    authGeneration.current += 1;
    await apiLogout();
    if (mounted.current) setStatus('anonymous');
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
