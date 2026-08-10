'use client';

import React, { useState } from 'react';
import { api } from '../../lib/api-client';
import { Icon } from '../ui/Icon';
import { ConfirmAction } from '../common/ConfirmAction';
import { BATTLE_MAP_PRESETS } from '@livenova/shared';

export interface TemplateAssetItem {
  id: string;
  key: string;
  url: string;
  mediaType: string;
  /** Máy chủ không trả trường này; đừng khai là bắt buộc. */
  createdAt?: string;
}

interface TemplateAssetManagerProps {
  templateId: string;
  templateName: string;
  assets: TemplateAssetItem[];
  onChanged: () => void;
  onClose: () => void;
}

const COMMON_MEDIA_TYPES = [
  { value: 'image/jpeg', label: 'Ảnh JPG / JPEG' },
  { value: 'image/png', label: 'Ảnh PNG (Trong suốt)' },
  { value: 'image/webp', label: 'Ảnh WebP' },
  { value: 'video/webm', label: 'Video WebM (Trong suốt)' },
  { value: 'video/mp4', label: 'Video MP4' },
  { value: 'audio/mp3', label: 'Âm thanh MP3' },
  { value: 'audio/wav', label: 'Âm thanh WAV' },
];

export function TemplateAssetManager({
  templateId,
  templateName,
  assets,
  onChanged,
  onClose,
}: TemplateAssetManagerProps) {
  const [key, setKey] = useState('');
  const [url, setUrl] = useState('');
  const [mediaType, setMediaType] = useState('image/jpeg');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function handleAdd(e?: React.FormEvent, customKey?: string, customUrl?: string, customType?: string) {
    if (e) e.preventDefault();
    const finalKey = (customKey || key).trim().toLowerCase();
    const finalUrl = (customUrl || url).trim();
    const finalType = (customType || mediaType).trim();

    if (!finalKey || !finalUrl) return;

    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/admin/templates/${templateId}/assets`, {
        key: finalKey,
        url: finalUrl,
        mediaType: finalType,
      });
      setKey('');
      setUrl('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thêm được asset');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(assetKey: string) {
    setError(null);
    try {
      await api.delete(`/admin/templates/${templateId}/assets/${assetKey}`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xoá được asset');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'grid',
          gap: '1.25rem',
          backgroundColor: 'hsl(var(--card))',
          boxShadow: 'var(--shadow-lg)',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              Quản lý tài nguyên & Bản đồ (Assets)
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              Mẫu: <strong>{templateName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '0.25rem',
            }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {error && (
          <p role="alert" style={{ color: 'hsl(var(--destructive))', fontSize: '0.85rem', margin: 0 }}>
            {error}
          </p>
        )}

        {/* AI Maps Preset Quick Loader */}
        <div className="card" style={{ background: 'hsl(var(--accent-surface))', borderColor: 'hsl(var(--primary) / 0.3)', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <Icon name="spark" size={18} style={{ color: 'hsl(var(--primary))' }} />
            <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--foreground))' }}>
              Nạp nhanh Bản đồ Chiến trường AI (Quick AI Maps)
            </strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.625rem' }}>
            {BATTLE_MAP_PRESETS.filter((p) => p.backgroundUrl).map((preset) => (
              <div
                key={preset.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius)',
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <img
                  src={preset.thumbnail}
                  alt={preset.name}
                  style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {preset.name}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={submitting}
                    onClick={() => handleAdd(undefined, 'map_background', preset.backgroundUrl, 'image/jpeg')}
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', marginTop: '0.25rem' }}
                  >
                    Gán `map_background`
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add asset form */}
        <form onSubmit={handleAdd} className="card" style={{ display: 'grid', gap: '0.75rem', background: 'hsl(var(--secondary) / 0.5)' }}>
          <strong style={{ fontSize: '0.9rem' }}>Thêm tài nguyên thủ công</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: '0.5rem' }}>
            <div>
              <label style={smallLabelStyle}>Khoá logic (Key)</label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="VD: map_background, fx_dragon"
                disabled={submitting}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono), monospace' }}
                required
              />
            </div>
            <div>
              <label style={smallLabelStyle}>Đường dẫn (URL)</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://... /maps/..."
                disabled={submitting}
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={smallLabelStyle}>Định dạng</label>
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value)}
                disabled={submitting}
                style={inputStyle}
              >
                {COMMON_MEDIA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !key.trim() || !url.trim()}
              style={{ fontSize: '0.85rem' }}
            >
              <Icon name="plus" size={14} />
              {submitting ? 'Đang thêm…' : 'Thêm Asset'}
            </button>
          </div>
        </form>

        {/* Asset List */}
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>Tài nguyên hiện có ({assets.length})</strong>
          {assets.length === 0 ? (
            <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.85rem' }}>
              Chưa có tài nguyên nào được gán cho mẫu này.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {assets.map((asset) => {
                const isImage = asset.mediaType.startsWith('image') || asset.url.endsWith('.png') || asset.url.endsWith('.jpg') || asset.url.endsWith('.webp');
                return (
                  <div
                    key={asset.id || asset.key}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.6rem 0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: '1 1 auto', overflow: 'hidden' }}>
                      {isImage ? (
                        <img
                          src={asset.url}
                          alt={asset.key}
                          style={{
                            width: 36,
                            height: 36,
                            objectFit: 'cover',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid hsl(var(--border))',
                          }}
                        />
                      ) : (
                        <Icon
                          name={asset.mediaType.startsWith('video') ? 'play' : asset.mediaType.startsWith('audio') ? 'waveform' : 'spark'}
                          size={18}
                          style={{ color: 'hsl(var(--primary))', flexShrink: 0 }}
                        />
                      )}
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <code style={{ fontWeight: 700, fontSize: '0.85rem' }}>{asset.key}</code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(asset.key)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: copiedKey === asset.key ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
                              padding: '0.1rem',
                            }}
                            title="Sao chép khoá"
                          >
                            <Icon name={copiedKey === asset.key ? 'check' : 'copy'} size={14} />
                          </button>
                          <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>
                            ({asset.mediaType})
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {asset.url}
                        </div>
                      </div>
                    </div>

                    <ConfirmAction
                      label="Xoá"
                      question={`Xoá asset "${asset.key}"?`}
                      confirmLabel="Xoá"
                      busyLabel="Đang xoá…"
                      onConfirm={() => handleDelete(asset.key)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const smallLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'hsl(var(--muted-foreground))',
  display: 'block',
  marginBottom: '0.2rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  fontSize: '0.85rem',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  backgroundColor: 'hsl(var(--input))',
  color: 'hsl(var(--foreground))',
  boxSizing: 'border-box',
};
