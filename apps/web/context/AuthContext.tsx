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
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
    turnstileToken?: string,
  ) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    turnstileToken?: string,
  ) => Promise<{ pendingVerification: boolean; email: string }>;
  confirmOtp: (email: string, code: string, type?: 'REGISTER' | 'FORGOT_PASSWORD') => Promise<void>;
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
          // Profile first, status second. See `signIn` for why the other order
          // is a bug and not just a preference.
          await fetchUserProfile();
          if (!mounted.current || generation !== authGeneration.current) return;
          setStatus('authenticated');
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

  const signIn = useCallback(async (
    email: string,
    password: string,
    rememberMe?: boolean,
    turnstileToken?: string,
  ) => {
    await apiLogin(email, password, rememberMe, turnstileToken);
    authGeneration.current += 1;
    if (!mounted.current) return;

    // Load the profile *before* announcing the session.
    //
    // The other order publishes a render where `status` is 'authenticated' but
    // `user` is still null, and everything that routes on role reads that
    // render: the login page sent admins to /dashboard because `user?.role`
    // was undefined for one tick, and the admin layout drew its
    // "not an administrator" screen before the role arrived. Making
    // 'authenticated' mean "session established *and* profile settled" removes
    // the window rather than teaching each consumer to wait it out.
    await fetchUserProfile();
    if (mounted.current) setStatus('authenticated');
  }, [fetchUserProfile]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    turnstileToken?: string,
  ) => {
    return apiRegister(email, password, displayName, turnstileToken);
  }, []);

  const confirmOtp = useCallback(async (email: string, code: string, type?: 'REGISTER' | 'FORGOT_PASSWORD') => {
    const { verifyOtp: apiVerifyOtp } = await import('../lib/api-client');
    await apiVerifyOtp(email, code, type);
    authGeneration.current += 1;
    if (!mounted.current) return;
    await fetchUserProfile();
    if (mounted.current) setStatus('authenticated');
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
    <AuthContext.Provider value={{ status, user, signIn, signUp, confirmOtp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
