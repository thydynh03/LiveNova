'use client';

import React, { useCallback, useRef, useState } from 'react';
import { api, uploadVrmDanceClip } from '../../lib/api-client';
import { Panel } from './AdminShell';

const LABEL: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'hsl(var(--foreground))',
};

const VALUE: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'hsl(var(--muted-foreground))',
  lineHeight: 1.5,
};

interface OverlaySummary {
  id: string;
  type: string;
  config?: Record<string, unknown> | null;
}

interface Props {
  danceUrl: string | null;
  onDanceUrlChange: (url: string | null) => void;
  onNote: (message: string) => void;
}

export function VrmDancePanel({ danceUrl, onDanceUrlChange, onNote }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<'idle' | 'saving' | 'done'>('idle');

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setPublishState('idle');
      setBusy(true);
      try {
        setProgressLabel(`Đang tải lên ${(file.size / 1024 / 1024).toFixed(1)}MB…`);
        const result = await uploadVrmDanceClip(file);
        onDanceUrlChange(result.url);
        onNote(`Đã tải lên điệu nhảy mới`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải điệu nhảy lên thất bại');
      } finally {
        setBusy(false);
        setProgressLabel(null);
      }
    },
    [onDanceUrlChange, onNote],
  );

  const publishToStage = useCallback(async () => {
    setPublishState('saving');
    setError(null);
    try {
      const overlays = await api.get<OverlaySummary[]>('/overlays');
      const stage = overlays.find((o) => o.type === 'STAGE');
      if (!stage) {
        setError('Chưa có overlay Sân khấu (STAGE). Hãy tạo overlay đó trước.');
        setPublishState('idle');
        return;
      }

      await api.patch(`/overlays/${stage.id}/config`, {
        config: { ...(stage.config ?? {}), danceUrl: danceUrl },
      });
      setPublishState('done');
      onNote('Sân khấu phát sóng đã dùng điệu nhảy này');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được vào overlay Sân khấu');
      setPublishState('idle');
    }
  }, [danceUrl, onNote]);

  const clearDance = useCallback(async () => {
    onDanceUrlChange(null);
    setPublishState('idle');
    setError(null);
  }, [onDanceUrlChange]);

  return (
    <Panel
      title="Điệu nhảy nền (Background Dance)"
      subtitle="Tải tệp .vrma hoặc .vmd để nhân vật luôn nhảy trên sân khấu phát sóng."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <span style={LABEL}>Đang dùng</span>
        <span
          style={{
            ...VALUE,
            fontFamily: 'var(--font-mono), monospace',
            wordBreak: 'break-all',
            fontSize: '0.72rem',
          }}
        >
          {danceUrl || 'Chưa có (Nhân vật đứng yên)'}
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".vrma,.vmd,application/octet-stream"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          style={{ flex: 1 }}
        >
          {busy ? progressLabel ?? 'Đang xử lý…' : 'Tải tệp .vrma, .vmd'}
        </button>
        {danceUrl && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={clearDance}
          >
            Xoá bỏ
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            ...VALUE,
            color: 'hsl(var(--destructive))',
            padding: '0.6rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            background: 'hsl(var(--destructive) / 0.08)',
            border: '1px solid hsl(var(--destructive) / 0.3)',
          }}
        >
          {error}
        </div>
      )}

      {danceUrl && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || publishState === 'saving'}
          onClick={() => void publishToStage()}
          style={{ width: '100%', fontSize: '0.82rem' }}
        >
          {publishState === 'saving'
            ? 'Đang lưu…'
            : publishState === 'done'
            ? 'Đã áp dụng điệu nhảy cho sân khấu phát sóng'
            : 'Phát điệu nhảy này trên sân khấu phát sóng'}
        </button>
      )}
    </Panel>
  );
}
