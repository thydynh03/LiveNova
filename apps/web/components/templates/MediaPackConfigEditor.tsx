'use client';

import React, { useState } from 'react';
import type { MediaPackConfig } from '@livenova/shared';
import { TEMPLATE_LIMITS } from '@livenova/shared';
import { Icon } from '../ui/Icon';

interface MediaPackConfigEditorProps {
  value: MediaPackConfig;
  onChange: (next: MediaPackConfig) => void;
  disabled?: boolean;
}

export function MediaPackConfigEditor({
  value,
  onChange,
  disabled = false,
}: MediaPackConfigEditorProps) {
  const [newKey, setNewKey] = useState('');

  function addKey() {
    const clean = newKey.trim().toLowerCase();
    if (!clean) return;
    const existing = value.assetKeys || [];
    if (existing.includes(clean)) return;
    if (existing.length >= TEMPLATE_LIMITS.MAX_ASSETS_PER_PACK) return;
    onChange({ ...value, assetKeys: [...existing, clean] });
    setNewKey('');
  }

  function removeKey(keyToRemove: string) {
    const existing = value.assetKeys || [];
    onChange({
      ...value,
      assetKeys: existing.filter((k) => k !== keyToRemove),
    });
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <strong style={{ fontSize: '0.95rem' }}>Danh sách khoá Asset (Media Pack)</strong>
        <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
          Khai báo các định danh tài nguyên đồ hoạ/âm thanh mà gói này cung cấp.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addKey();
            }
          }}
          placeholder="Nhập mã định danh (VD: fx_dragon, bg_arena)..."
          disabled={disabled || (value.assetKeys?.length ?? 0) >= TEMPLATE_LIMITS.MAX_ASSETS_PER_PACK}
          style={{
            flex: 1,
            minHeight: '38px',
            padding: '0.4rem 0.65rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid hsl(var(--input))',
            background: 'hsl(var(--background))',
            color: 'inherit',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono), monospace',
          }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={addKey}
          disabled={disabled || !newKey.trim() || (value.assetKeys?.length ?? 0) >= TEMPLATE_LIMITS.MAX_ASSETS_PER_PACK}
          style={{ minHeight: '38px' }}
        >
          <Icon name="plus" size={14} />
          Thêm khoá
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {(value.assetKeys || []).map((k) => (
          <span
            key={k}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              backgroundColor: 'hsl(var(--secondary))',
              border: '1px solid hsl(var(--border))',
              fontFamily: 'var(--font-mono), monospace',
            }}
          >
            <Icon name="spark" size={12} style={{ color: 'hsl(var(--primary))' }} />
            {k}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeKey(k)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  padding: 0,
                  display: 'inline-flex',
                }}
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
