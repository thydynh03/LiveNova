'use client';

import React, { useState } from 'react';

type Rule = { id: string; name: string; event: string; action: string; enabled: boolean };

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([
    { id: '1', name: 'Thank for Rose', event: 'Gift (Rose)', action: 'TTS: Thank you!', enabled: true },
    { id: '2', name: 'Like Milestone', event: 'Likes > 1000', action: 'Play Sound: Cheering', enabled: true },
    { id: '3', name: 'Sub Alert', event: 'New Subscriber', action: 'OBS Overlay: Celebration', enabled: false },
  ]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Automation Rules</h1>
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>Drag to reorder rule priority.</p>
        </div>
        <button className="btn btn-primary">
          + Add New Rule
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rules.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>No rules created yet.</p>
            <button className="btn btn-primary">Create your first rule</button>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="card glass" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'grab', padding: '1rem 1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ cursor: 'grab', opacity: 0.5 }}>☰</div>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{rule.name}</h4>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>IF <strong style={{ color: 'hsl(var(--foreground))' }}>{rule.event}</strong></span>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>THEN <strong style={{ color: 'hsl(var(--primary))' }}>{rule.action}</strong></span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={rule.enabled} onChange={() => {
                    setRules(rules.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                  }} style={{ width: '1.2rem', height: '1.2rem' }} />
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </label>
                <button className="btn" style={{ background: 'hsl(var(--secondary))' }}>Edit</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
