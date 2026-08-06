'use client';

import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';
import { Icon } from '../ui/Icon';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const goingDark = theme === 'light';
  const reduce = useReducedMotion();

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
      {/*
        The glyph swap is cross-faded with a quarter turn so the control reads
        as one object changing state, not two icons blinking in place.
      */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          className="theme-toggle__icon"
          style={{ display: 'flex' }}
          initial={reduce ? false : { opacity: 0, rotate: -90, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, rotate: 90, scale: 0.7 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <Icon name={theme === 'light' ? 'sun' : 'moon'} size={20} weight="fill" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
