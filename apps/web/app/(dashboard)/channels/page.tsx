'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { LiveEvent } from '@livenova/shared';
import { useApi } from '../../../lib/use-api';
import { api, ApiError } from '../../../lib/api-client';
import { useEventsSocket } from '../../../lib/use-events-socket';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';
import { LiveFeed, LIVE_FEED_LIMIT } from '../../../components/live-feed/LiveFeed';
import { Icon } from '../../../components/ui/Icon';
import { useToast } from '../../../components/ui/Toast';
import { ConfirmAction } from '../../../components/common/ConfirmAction';
import { BridgePanel } from '../../../components/bridge/BridgePanel';
import { readStoredBridgeToken, useLocalBridge } from '../../../lib/use-local-bridge';
import type { GameInputCommand } from '@livenova/shared';
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
  const toast = useToast();

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

  // Drop events belonging to channels that are no longer linked. Without this,
  // unlinking a channel left its events sitting in the feed under a heading
  // that now describes a different set of channels.
  const activeKey = channelIds.join(',');
  useEffect(() => {
    setEvents((prev) => prev.filter((e) => channelIds.includes(e.channelId)));
    // `channelIds` is compared by value through activeKey; depending on the
    // array itself would re-run on every render.
  }, [activeKey]);

  // The bridge token lives only in this browser. Read once on mount, because
  // localStorage does not exist during server rendering.
  const [bridgeToken, setBridgeToken] = useState('');
  useEffect(() => {
    setBridgeToken(readStoredBridgeToken());
  }, []);

  const bridge = useLocalBridge({ token: bridgeToken });

  const handleGameInput = useCallback(
    (command: GameInputCommand) => {
      bridge.send(command);
    },
    [bridge],
  );

  const { status, subscribed } = useEventsSocket({
    channelIds,
    onEvent: handleEvent,
    onGameInput: handleGameInput,
    enabled: channelIds.length > 0,
  });

  /**
   * Mở phiên nhận sự kiện cho các kênh đã xác minh.
   *
   * Chỉ gọi MỘT LẦN cho mỗi kênh trong suốt vòng đời trang. Bản cũ phụ thuộc
   * vào `data`, mà `data` thay đổi sau mỗi `reload()` — kể cả lần reload do
   * chuyển tab kích hoạt qua listener `visibilitychange` bên dưới. Kết quả là
   * mỗi lần alt-tab lại bắn một loạt request connect, và mọi lỗi đều bị
   * `.catch(() => undefined)` nuốt mất.
   */
  const connectAttempted = useRef(new Set<string>());

  useEffect(() => {
    if (!data) return;

    for (const channel of data) {
      if (!channel.verified || connectAttempted.current.has(channel.id)) continue;
      connectAttempted.current.add(channel.id);

      api.post(`/tiktok/channels/${channel.id}/connect`).catch((err) => {
        // Cho phép thử lại kênh này về sau, nhưng nói cho người dùng biết là
        // lần này hỏng — im lặng chính là lý do "app lỗi mà không biết vì sao".
        connectAttempted.current.delete(channel.id);
        toast.error(
          `Không kết nối được kênh @${channel.handle}`,
          err instanceof ApiError ? err.message : 'Kiểm tra kênh có đang live không, rồi thử lại.',
        );
      });
    }
  }, [data, toast]);

  // `isLive` comes from a snapshot and would otherwise stay stale for as long
  // as the tab is open. Revalidating on visibility is the cheap half of the fix;
  // a push-based status event belongs with the ingest work (Q-01).
  useEffect(() => {
    function revalidate() {
      if (document.visibilityState === 'visible') reload();
    }
    document.addEventListener('visibilitychange', revalidate);
    return () => document.removeEventListener('visibilitychange', revalidate);
  }, [reload]);

  async function linkChannel(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = handle.trim().replace(/^@/, '');
    if (!trimmed) return;

    setActionError(null);
    setLinking(true);
    try {
      const res = await api.post<Channel>('/channels', {
        platform: 'TIKTOK',
        platformChannelId: trimmed,
        handle: trimmed,
      });
      if (res?.id) {
        await api.post(`/tiktok/channels/${res.id}/connect`).catch(() => undefined);
      }
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
      await api.post(`/tiktok/channels/${channel.id}/connect`).catch(() => undefined);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Xác minh thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function unlink(channel: Channel) {
    // The confirmation lives in <ConfirmAction>, not in window.confirm(): the
    // native dialog is suppressed in embedded browsers, and a suppressed
    // confirm() returns false, which made this button do nothing at all.
    setActionError(null);
    setBusyId(channel.id);
    try {
      // Stop ingest first. Deleting the row alone leaves the server's session
      // running and still emitting events for a channel that no longer exists.
      // The server should enforce this for non-UI callers too — noted for Dev A,
      // who owns TiktokService.
      await api.delete(`/tiktok/channels/${channel.id}/connect`).catch(() => undefined);
      await api.delete(`/channels/${channel.id}`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Hủy liên kết thất bại');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 className="page-title">Kênh TikTok</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
          Nối kênh của bạn vào LiveNova để nhận bình luận, quà tặng và lượt theo dõi ngay khi lên sóng.
        </p>
      </div>

      <form
        onSubmit={linkChannel}
        className="card"
        style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}
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
            border: '1px solid hsl(var(--input))',
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={linking || handle.trim() === ''}
        >
          {linking ? 'Đang nối…' : 'Nối kênh'}
        </button>
      </form>

      <BridgePanel
        status={bridge.status}
        lastError={bridge.lastError}
        onTokenChange={setBridgeToken}
      />

      {actionError && (
        <div
          role="alert"
          className="card"
          style={{
            padding: '0.875rem 1.25rem',
            borderColor: 'hsl(var(--destructive) / 0.35)',
            color: 'hsl(var(--destructive))',
          }}
        >
          {actionError}
        </div>
      )}

      {loading && !data && <LoadingState label="Đang tải kênh…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (data?.length ?? 0) === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <EmptyState
            title="Kết nối kênh TikTok của bạn để bắt đầu"
            description="Chúng tôi chỉ đọc bình luận và quà tặng công khai trong buổi live — không đăng gì lên kênh bạn, không đọc tin nhắn riêng."
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data?.map((channel) => (
          <div key={channel.id} className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                {channel.avatarUrl ? (
                  <img
                    src={channel.avatarUrl}
                    alt={channel.handle}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid hsl(var(--border))',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'hsl(var(--primary) / 0.15)',
                      color: 'hsl(var(--primary))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                    }}
                  >
                    {channel.handle.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '1.05rem', color: 'hsl(var(--foreground))' }}>
                      @{channel.handle}
                    </strong>
                    {channel.verified && (
                      <span className="pill pill-ok">
                        <Icon name="check" size={13} weight="bold" />
                        Đã xác minh
                      </span>
                    )}
                  </div>
                  <div
                    style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.15rem' }}
                  >
                    {channel.platform === 'TIKTOK' ? 'TikTok' : channel.platform}
                    {!channel.verified && ' · Chưa xác minh'}
                    {channel.isLive && (
                      <>
                        {' · '}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            color: 'hsl(var(--live))',
                            fontWeight: 600,
                          }}
                        >
                          <span className="live-dot" aria-hidden="true" />
                          đang live
                        </span>
                      </>
                    )}
                    {channel.verified && subscribed.includes(channel.id) && ' · Đang kết nối nhận sự kiện'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {channel.verified ? (
                  <button
                    onClick={() => verify(channel)}
                    disabled={busyId === channel.id}
                    style={{
                      ...buttonStyle,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                    title="Cập nhật lại thông tin & ảnh đại diện mới nhất từ TikTok"
                  >
                    <Icon name="rotate" size={15} />
                    {busyId === channel.id ? 'Đang cập nhật…' : 'Xác minh lại'}
                  </button>
                ) : (
                  <button
                    onClick={() => verify(channel)}
                    disabled={busyId === channel.id}
                    style={{
                      ...buttonStyle,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Icon name="check" size={15} />
                    {busyId === channel.id ? 'Đang xác minh…' : 'Xác minh'}
                  </button>
                )}
                <ConfirmAction
                  label="Ngắt kênh"
                  question={`Ngắt @${channel.handle}? Nối lại phải xác minh từ đầu.`}
                  confirmLabel="Ngắt kênh"
                  busyLabel="Đang ngắt…"
                  disabled={busyId === channel.id}
                  style={{ ...buttonStyle, color: 'hsl(var(--destructive))' }}
                  onConfirm={() => unlink(channel)}
                />
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
        <section className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <h2 className="section-title">Đang diễn ra trên live</h2>
            <span
              role="status"
              className={
                status === 'connected'
                  ? 'pill pill-ok'
                  : status === 'unauthorized'
                    ? 'pill'
                    : 'pill pill-warn'
              }
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
