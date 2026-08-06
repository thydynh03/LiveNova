'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import {
  BridgeStatus,
  readStoredBridgeToken,
  storeBridgeToken,
} from '../../lib/use-local-bridge';

/**
 * Where the streamer hands over the Local Bridge session token.
 *
 * The token authorises moving the keyboard of the machine the bridge runs on,
 * so it is deliberately entered by hand and kept in this browser's
 * localStorage. It is never sent to the API and never placed in a URL: overlay
 * URLs get pasted into OBS and are routinely visible on stream, and a
 * credential that can drive a keyboard must not travel that way.
 */

const STATUS_TEXT: Record<BridgeStatus, string> = {
  disabled: 'Chưa bật — dán mã phiên từ ứng dụng máy tính',
  connecting: 'Đang kết nối…',
  connected: 'Đã kết nối — luật bấm phím sẽ chạy',
  rejected: 'Mã phiên sai — lấy lại mã trong ứng dụng máy tính',
  offline: 'Không thấy ứng dụng máy tính đang chạy',
};

export function BridgePanel({
  status,
  lastError,
  onTokenChange,
}: {
  status: BridgeStatus;
  lastError: string | null;
  onTokenChange: (token: string) => void;
}) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  // Read on mount rather than during render: localStorage does not exist on the
  // server, and reading it while rendering would mismatch the hydrated markup.
  useEffect(() => {
    setValue(readStoredBridgeToken());
  }, []);

  function save(next: string) {
    storeBridgeToken(next);
    onTokenChange(next.trim());
    setSaved(true);
    // Long enough to read, short enough not to linger as stale reassurance.
    window.setTimeout(() => setSaved(false), 2500);
  }

  const tone =
    status === 'connected'
      ? 'hsl(var(--success))'
      : status === 'rejected'
        ? 'hsl(var(--destructive))'
        : 'hsl(var(--muted-foreground))';

  return (
    <section className="card" style={{ display: 'grid', gap: '0.85rem' }}>
      <div>
        <h2
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1.05rem',
            fontWeight: 700,
          }}
        >
          <Icon name="desktop" size={18} />
          Điều khiển game qua ứng dụng máy tính
        </h2>
        <p
          style={{
            color: 'hsl(var(--muted-foreground))',
            fontSize: '0.9rem',
            marginTop: '0.35rem',
            maxWidth: '62ch',
          }}
        >
          Mở ứng dụng LiveNova trên máy tính, sao chép mã phiên rồi dán vào đây. Mã
          chỉ được lưu trong trình duyệt này và không bao giờ gửi lên máy chủ.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <label htmlFor="bridge-token" className="sr-only">
          Mã phiên Local Bridge
        </label>
        <input
          id="bridge-token"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          // A bearer credential, so it is masked by default like a password.
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Dán mã phiên ở đây"
          style={{
            flex: '1 1 280px',
            minHeight: '44px',
            padding: '0.6rem 0.9rem',
            borderRadius: 'var(--radius)',
            border: '1px solid hsl(var(--input))',
            background: 'hsl(var(--background))',
            color: 'inherit',
            fontFamily: 'var(--font-mono), monospace',
            fontSize: '0.85rem',
          }}
        />
        <button type="button" className="btn btn-primary" onClick={() => save(value)}>
          <Icon name={saved ? 'check' : 'link'} size={16} />
          {saved ? 'Đã lưu' : 'Kết nối'}
        </button>
        {value !== '' && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setValue('');
              save('');
            }}
          >
            Xoá
          </button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontSize: '0.85rem',
          color: tone,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'currentColor',
            flexShrink: 0,
          }}
        />
        {STATUS_TEXT[status]}
      </div>

      {lastError && (
        <p role="alert" style={{ fontSize: '0.85rem', color: 'hsl(var(--destructive))' }}>
          {lastError}
        </p>
      )}
    </section>
  );
}
