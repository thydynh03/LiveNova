'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { LiveEvent } from '@livenova/shared';
import { useApi } from '../../../lib/use-api';
import { api, ApiError } from '../../../lib/api-client';
import { useEventsSocket } from '../../../lib/use-events-socket';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';
import { LiveFeed, LIVE_FEED_LIMIT } from '../../../components/live-feed/LiveFeed';
import type { Channel } from '../../../lib/types';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối…',
  authenticating: 'Đang xác thực…',
  connected: 'Đang nhận sự kiện',
  reconnecting: 'Mất kết nối — đang thử lại…',
  unauthorized: 'Phiên hết hạn — hãy đăng nhập lại',
};

export default function ChannelsPage() {
  const { data, loading, error, reload } = useApi<Channel[]>('/channels');

  const [handle, setHandle] = useState('');
  const [linking, setLinking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);

  // Only verified channels can be subscribed to — the server rejects the rest,
  // so asking would just produce FORBIDDEN noise.
  const channelIds = useMemo(
    () => (data ?? []).filter((c) => c.verified).map((c) => c.id),
    [data],
  );

  const handleEvent = useCallback((event: LiveEvent) => {
    setEvents((prev) => [...prev, event].slice(-LIVE_FEED_LIMIT));
  }, []);

  const { status, subscribed } = useEventsSocket({
    channelIds,
    onEvent: handleEvent,
    enabled: channelIds.length > 0,
  });

  async function linkChannel(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = handle.trim().replace(/^@/, '');
    if (!trimmed) return;

    setActionError(null);
    setLinking(true);
    try {
      await api.post('/channels', {
        platform: 'TIKTOK',
        platformChannelId: trimmed,
        handle: trimmed,
      });
      setHandle('');
      reload();
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status === 409
          ? 'Kênh này đã được liên kết với một tài khoản khác.'
          : err instanceof Error
            ? err.message
            : 'Liên kết kênh thất bại',
      );
    } finally {
      setLinking(false);
    }
  }

  async function verify(channel: Channel) {
    setActionError(null);
    setBusyId(channel.id);
    try {
      await api.post(`/channels/${channel.id}/verify`);
      reload();
    } catch (err) {
      // Q-12 is unresolved, so the API refuses on purpose rather than granting
      // unverified access. Surface that plainly instead of as a generic failure.
      setActionError(err instanceof Error ? err.message : 'Xác minh thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function unlink(channel: Channel) {
    setActionError(null);
    setBusyId(channel.id);
    try {
      await api.delete(`/channels/${channel.id}`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Hủy liên kết thất bại');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Kênh</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2rem' }}>
        Liên kết kênh TikTok để nhận bình luận, quà tặng và lượt theo dõi theo thời gian thực.
      </p>

      <form
        onSubmit={linkChannel}
        style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}
      >
        {/*
          The label is visually hidden rather than omitted: a placeholder is not
          an accessible name, and it disappears the moment the user types.
        */}
        <label
          htmlFor="handle"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Tên kênh TikTok
        </label>
        <input
          id="handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@tenkenh"
          autoComplete="off"
          style={{
            flex: '1 1 260px',
            padding: '0.7rem 0.9rem',
            minHeight: '44px',
            borderRadius: 'var(--radius)',
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
          }}
        />
        <button
          type="submit"
          disabled={linking || handle.trim() === ''}
          style={{
            minHeight: '44px',
            padding: '0.5rem 1.5rem',
            borderRadius: 'var(--radius)',
            border: 'none',
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            fontWeight: 600,
            cursor: linking || handle.trim() === '' ? 'not-allowed' : 'pointer',
            opacity: linking || handle.trim() === '' ? 0.6 : 1,
          }}
        >
          {linking ? 'Đang liên kết…' : 'Liên kết kênh'}
        </button>
      </form>

      {actionError && (
        <p role="alert" style={{ color: 'hsl(var(--destructive))', marginBottom: '1rem' }}>
          {actionError}
        </p>
      )}

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="Chưa liên kết kênh nào"
          description="Nhập tên kênh TikTok ở trên để bắt đầu."
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data?.map((channel) => (
          <div
            key={channel.id}
            className="glass"
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong style={{ fontSize: '1.05rem' }}>@{channel.handle}</strong>
                <div
                  style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}
                >
                  {channel.platform}
                  {channel.verified ? ' · đã xác minh' : ' · chưa xác minh'}
                  {channel.isLive && ' · 🔴 đang live'}
                  {channel.verified && subscribed.includes(channel.id) && ' · đang theo dõi'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!channel.verified && (
                  <button
                    onClick={() => verify(channel)}
                    disabled={busyId === channel.id}
                    style={buttonStyle}
                  >
                    {busyId === channel.id ? '…' : 'Xác minh'}
                  </button>
                )}
                <button
                  onClick={() => unlink(channel)}
                  disabled={busyId === channel.id}
                  style={buttonStyle}
                >
                  Hủy liên kết
                </button>
              </div>
            </div>

            {!channel.verified && channel.verificationCode && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  background: 'hsl(var(--muted) / 0.35)',
                  fontSize: '0.85rem',
                }}
              >
                Dán mã sau vào phần giới thiệu (bio) của kênh, rồi bấm{' '}
                <strong>Xác minh</strong>:
                <code
                  style={{
                    display: 'block',
                    marginTop: '0.4rem',
                    fontSize: '0.85rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {channel.verificationCode}
                </code>
              </div>
            )}
          </div>
        ))}
      </div>

      {channelIds.length > 0 && (
        <section style={{ marginTop: '2.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '0.75rem',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sự kiện trực tiếp</h2>
            <span
              role="status"
              style={{
                fontSize: '0.85rem',
                color:
                  status === 'connected'
                    ? 'hsl(var(--success, 142 71% 45%))'
                    : status === 'unauthorized'
                      ? 'hsl(var(--destructive))'
                      : 'hsl(var(--muted-foreground))',
              }}
            >
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>

          <LiveFeed events={events} />
        </section>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  minHeight: '44px',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  cursor: 'pointer',
  fontSize: '0.9rem',
};
