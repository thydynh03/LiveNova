'use client';

import React, { useEffect, useState } from 'react';

export default function GoalOverlay() {
  const [current, setCurrent] = useState(450);
  const target = 1000;

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    const int = setInterval(() => {
      setCurrent(p => Math.min(p + Math.floor(Math.random() * 20), target));
    }, 3000);
    return () => clearInterval(int);
  }, []);

  const percentage = Math.min((current / target) * 100, 100);

  return (
    <div style={{ width: '100vw', padding: '2rem', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '400px',
        background: 'rgba(20,20,25,0.7)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '1rem',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          color: 'white', marginBottom: '0.75rem',
          fontFamily: 'sans-serif', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '1px',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
          <span>Daily Goal (Roses)</span>
          <span style={{ color: 'hsl(var(--primary))' }}>{current} / {target}</span>
        </div>

        <div style={{
          width: '100%', height: '20px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '10px', overflow: 'hidden',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: 'hsl(var(--primary))',
            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 0 15px rgba(217, 70, 239, 0.5)',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: 'shimmer 2s infinite',
            }} />
          </div>
        </div>

        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    </div>
  );
}
