'use client';

import React, { useEffect, useState } from 'react';

export default function PkOverlay() {
  const [team1Score, setTeam1Score] = useState(1500);
  const [team2Score, setTeam2Score] = useState(1200);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    const int = setInterval(() => {
      setTeam1Score(p => p + Math.floor(Math.random() * 50));
      setTeam2Score(p => p + Math.floor(Math.random() * 50));
    }, 2000);
    return () => clearInterval(int);
  }, []);

  const total = team1Score + team2Score || 1;
  const p1 = (team1Score / total) * 100;
  const p2 = 100 - p1;

  return (
    <div style={{ width: '100vw', padding: '2rem', display: 'flex', justifyContent: 'center' }}>
      <div style={{
        width: '600px',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        borderRadius: '30px',
        padding: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          color: 'white',
          padding: '0 1rem 0.5rem 1rem',
          fontWeight: 'bold',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
          <span style={{ color: '#ff4b4b' }}>Team Red: {team1Score}</span>
          <span style={{ color: '#4b7bff' }}>Team Blue: {team2Score}</span>
        </div>
        
        <div style={{
          width: '100%',
          height: '24px',
          borderRadius: '12px',
          background: '#1a1a1a',
          display: 'flex',
          overflow: 'hidden',
          boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: `${p1}%`,
            background: 'linear-gradient(90deg, #ff0055, #ff4b4b)',
            transition: 'width 0.5s ease-out',
            boxShadow: '0 0 10px #ff0055'
          }} />
          <div style={{
            width: `${p2}%`,
            background: 'linear-gradient(90deg, #4b7bff, #0055ff)',
            transition: 'width 0.5s ease-out',
            boxShadow: '0 0 10px #0055ff'
          }} />
        </div>
      </div>
    </div>
  );
}
