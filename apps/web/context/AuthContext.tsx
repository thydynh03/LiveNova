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
  register as apiRegister,
  logout as apiLogout,
  restoreSession,
  setAccessToken,
  setUnauthenticatedHandler,
  getProfile,
} from '../lib/api-client';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatar: string | null;
  role: string;
  locale: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  const router = useRouter();
  const mounted = useRef(true);

  const authGeneration = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchUserProfile = useCallback(async () => {
    const generation = authGeneration.current;
    try {
      const profile = await getProfile();
      if (mounted.current && generation === authGeneration.current) {
        setUser(profile);
      }
    } catch {
      if (mounted.current && generation === authGeneration.current) {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    const generation = authGeneration.current;

    restoreSession()
      .then(async (token) => {
        if (!mounted.current || generation !== authGeneration.current) return;
        if (token) {
          setStatus('authenticated');
          await fetchUserProfile();
        } else {
          setStatus('anonymous');
          setUser(null);
        }
      })
      .catch(() => {
        if (!mounted.current || generation !== authGeneration.current) return;
        setStatus('anonymous');
        setUser(null);
      });
  }, [fetchUserProfile]);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      authGeneration.current += 1;
      setAccessToken(null);
      if (mounted.current) {
        setStatus('anonymous');
        setUser(null);
      }
    });
    return () => setUnauthenticatedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string, rememberMe?: boolean) => {
    await apiLogin(email, password, rememberMe);
    authGeneration.current += 1;
    if (mounted.current) {
      setStatus('authenticated');
      await fetchUserProfile();
    }
  }, [fetchUserProfile]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    await apiRegister(email, password, displayName);
    authGeneration.current += 1;
    if (mounted.current) {
      setStatus('authenticated');
      await fetchUserProfile();
    }
  }, [fetchUserProfile]);

  const signOut = useCallback(async () => {
    authGeneration.current += 1;
    await apiLogout();
    if (mounted.current) {
      setStatus('anonymous');
      setUser(null);
    }
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    await fetchUserProfile();
  }, [fetchUserProfile]);

  return (
    <AuthContext.Provider value={{ status, user, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
