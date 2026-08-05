'use client';

import React, { useState, useEffect } from 'react';

export default function DashboardPage() {
  const [balance, setBalance] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Simulate balance fetch and connection
    setBalance(5420);
    setTimeout(() => setConnected(true), 1500);
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Overview</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: connected ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
            boxShadow: `0 0 10px ${connected ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}`
          }}></div>
          <span style={{ fontWeight: 600, color: connected ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}>
            {connected ? 'Live Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card glass">
          <h3 style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>Credit Balance</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
            {balance.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>credits</span>
          </p>
        </div>
        <div className="card glass">
          <h3 style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>Quick Actions</h3>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn" style={{ background: 'hsl(var(--destructive))', color: 'white' }}>Emergency Stop</button>
            <button className="btn glass">Clear Queue</button>
            <button className="btn glass">Skip TTS</button>
          </div>
        </div>
      </div>

      <div className="card glass">
        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>Recent Events</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              padding: '1rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--secondary) / 0.5)',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <div>
                <strong style={{ color: 'hsl(var(--primary))' }}>User{i * 123}</strong> sent a Rose
              </div>
              <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>Just now</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
