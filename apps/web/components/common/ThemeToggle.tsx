'use client';

import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle btn glass"
      aria-label="Toggle Theme"
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{
        transform: theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.5s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {theme === 'light' ? '☀️' : '🌙'}
      </div>
    </button>
  );
}
