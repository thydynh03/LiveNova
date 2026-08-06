'use client';

import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const goingDark = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle btn glass"
      // The old label was a static "Toggle Theme", which tells a screen-reader
      // user nothing about what will happen or what the current state is.
      aria-label={goingDark ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
      aria-pressed={theme === 'dark'}
      title={goingDark ? 'Giao diện tối' : 'Giao diện sáng'}
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {theme === 'light' ? '☀️' : '🌙'}
      </span>
    </button>
  );
}
