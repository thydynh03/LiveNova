'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { THEME_STORAGE_KEY } from '../lib/theme-script';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  /** True while the user has expressed no preference and we follow the OS. */
  followsSystem: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // Tells the browser to render form controls, scrollbars and the canvas in the
  // matching scheme. Without it, native widgets stay light on a dark page.
  document.documentElement.style.colorScheme = theme;
}

function readAppliedTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Seeded from what the pre-paint script already applied, not from a hard-coded
  // 'light'. Defaulting to light here would make the toggle show the wrong icon
  // for one render on a dark-preferring machine.
  const [theme, setThemeState] = useState<Theme>(readAppliedTheme);
  const [followsSystem, setFollowsSystem] = useState(true);

  useEffect(() => {
    setThemeState(readAppliedTheme());
    try {
      setFollowsSystem(localStorage.getItem(THEME_STORAGE_KEY) === null);
    } catch {
      setFollowsSystem(true);
    }
  }, []);

  // Follow the OS while the user has not chosen. Someone whose machine switches
  // to dark at sunset expects the page to follow without a reload.
  useEffect(() => {
    if (!followsSystem) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      const next: Theme = event.matches ? 'dark' : 'light';
      applyTheme(next);
      setThemeState(next);
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [followsSystem]);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
    setFollowsSystem(false);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice simply does not survive a reload.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(readAppliedTheme() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, followsSystem }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
