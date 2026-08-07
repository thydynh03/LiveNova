'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useApi } from '../../../lib/use-api';
import { api } from '../../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';
import { Icon, type IconName } from '../../../components/ui/Icon';
import { ConfirmAction } from '../../../components/common/ConfirmAction';
import type { Overlay, Channel } from '../../../lib/types';

/**
 * Only overlay types whose renderer actually consumes the token and live data.
 *
 * The other pages under /overlays still animate hard-coded demo values and
 * ignore the token entirely. Handing a streamer a URL for one of those would
 * put a fake, randomly-changing widget on their broadcast — worse than telling
 * them it is not ready.
 */
const LIVE_RENDERERS: Record<string, string> = {
  MEDIA: '/overlays/media',
  CHAT: '/overlays/chat',
  GOAL: '/overlays/goal',
  PK_BAR: '/overlays/pk',
};

/** Type codes are database values. Nobody streaming has to see PK_BAR. */
const DISPLAY: Record<string, { name: string; blurb: string; icon: IconName }> = {
  MEDIA: {
    name: 'Hiệu ứng quà tặng',
    blurb: 'Hiện video hoặc ảnh lên màn hình khi có người tặng quà.',
    icon: 'gift',
  },
  CHAT: {
    name: 'Khung bình luận',
    blurb: 'Bình luận của khán giả chạy trên màn hình live.',
    icon: 'comment',
  },
  GOAL: {
    name: 'Thanh mục tiêu quà',
    blurb: 'Thanh chạy dần tới mục tiêu bạn đặt cho buổi live.',
    icon: 'goal',
  },
  PK_BAR: {
    name: 'Thanh đấu PK',
    blurb: 'So kè điểm giữa hai bên khi bạn vào trận PK.',
    icon: 'versus',
  },
  LEADERBOARD: { name: 'Bảng xếp hạng', blurb: 'Đang được phát triển.', icon: 'goal' },
  ROOM_ENTRY: { name: 'Chào người vào phòng', blurb: 'Đang được phát triển.', icon: 'follow' },
  ALERTS: { name: 'Thông báo trên màn hình', blurb: 'Đang được phát triển.', icon: 'spark' },
};

const AWAITING_PRODUCER: Record<string, string> = {
  CHAT: 'Cần một kịch bản khung bình luận thì mới có nội dung chạy.',
  GOAL: 'Hiện lên khi có món quà đầu tiên.',
  PK_BAR: 'Hiện lên khi bạn vào trận PK.',
};

function ObsGuide() {
  const [open, setOpen] = useState(false);
  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <Icon name={open ? 'caretDown' : 'caretRight'} size={18} />
        Cách đưa hiệu ứng vào OBS — 3 bước
      </button>
      {open && (
        <ol
          style={{
            margin: '0.875rem 0 0',
            paddingLeft: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          <li>Bấm “Thêm vào OBS” ở hiệu ứng bạn muốn — đường dẫn được chép vào bộ nhớ tạm.</li>
          <li>
            Trong OBS, ở khung <strong>Nguồn</strong> bấm dấu <strong>+</strong> rồi chọn{' '}
            <strong>Browser</strong> (Trình duyệt).
          </li>
          <li>
            Dán đường dẫn vào ô <strong>URL</strong>, đặt rộng 1920 cao 1080, bấm OK. Xong.
          </li>
        </ol>
      )}
    </section>
  );
}

export default function OverlaysPage() {
  const { data, loading, error, reload } = useApi<Overlay[]>('/overlays');
  // Warn rather than hide. Someone may run a phone broadcast and still have OBS
  // open on a second machine, and a screen that silently omits half its content
  // is harder to trust than one that explains itself.
  const { data: channels } = useApi<Channel[]>('/channels');
  const mobileOnly =
    (channels?.length ?? 0) > 0 && channels!.every((c) => c.broadcastSource === 'MOBILE');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Tokens rotated in this session, shown until the refetch catches up. */
  const [localTokens, setLocalTokens] = useState<Record<string, string>>({});
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  // Server data wins once it arrives. Keeping the local override indefinitely
  // meant a token rotated from another tab (or by anyone else) stayed hidden
  // behind a value this tab had cached, so the page would keep handing out a
  // URL the server had already revoked.
  useEffect(() => {
    if (data) setLocalTokens({});
  }, [data]);

  // Clearing the override on refetch is not enough on its own: without a reason
  // to refetch, a token rotated in another tab would stay stale on this screen
  // indefinitely. Revalidate when the tab becomes visible again — the moment a
  // user is most likely to come back and copy a URL.
  useEffect(() => {
    function revalidate() {
      if (document.visibilityState === 'visible') reload();
    }
    document.addEventListener('visibilitychange', revalidate);
    return () => document.removeEventListener('visibilitychange', revalidate);
  }, [reload]);

  function overlayUrl(overlay: Overlay): string | null {
    const path = LIVE_RENDERERS[overlay.type];
    if (!path) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const token = localTokens[overlay.id] ?? overlay.publicToken;
    return `${origin}${path}?token=${token}`;
  }

  async function copy(overlay: Overlay) {
    const url = overlayUrl(overlay);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(overlay.id);
      // Cancel the previous timer, or copying a second URL quickly would have
      // the first timeout clear the second one's confirmation.
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setActionError('Trình duyệt không cho chép tự động — bạn mở “Xem thử” rồi chép từ thanh địa chỉ nhé.');
    }
  }

  async function rotate(overlay: Overlay) {
    // Confirmation is inline — see ConfirmAction on why window.confirm() is not
    // usable here.
    setActionError(null);
    setRotatingId(overlay.id);
    try {
      const rotated = await api.post<{ id: string; publicToken: string }>(
        `/overlays/${overlay.id}/rotate-token`,
      );

      // Apply the new token immediately. `reload()` is async, and until it
      // landed the row still displayed — and copied — the token that was just
      // revoked, so pasting it into OBS produced a dead overlay.
      if (rotated?.publicToken) {
        setLocalTokens((prev) => ({ ...prev, [overlay.id]: rotated.publicToken }));
      }
      setCopiedId((current) => (current === overlay.id ? null : current));
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không tạo được đường dẫn mới');
    } finally {
      setRotatingId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 className="page-title">Hiệu ứng màn hình</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
          Những thứ khán giả nhìn thấy trên màn hình live của bạn. Ai có đường dẫn là xem được, nên
          đừng để lộ nó trên sóng.
        </p>
      </div>

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

      {mobileOnly && (
        <section
          className="card"
          style={{
            background: 'hsl(var(--warning) / 0.09)',
            borderColor: 'hsl(var(--warning) / 0.35)',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
          }}
        >
          <span aria-hidden="true" style={{ color: 'hsl(38 92% 32%)', display: 'flex', marginTop: '0.15rem' }}>
            <Icon name="warning" size={20} weight="fill" />
          </span>
          <div>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
              Kênh của bạn đang đặt là live bằng điện thoại
            </strong>
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>
              Những hiệu ứng dưới đây cần một phần mềm ghép hình trên máy tính, nên khán giả sẽ không
              thấy chúng. Vẫn dùng được nếu bạn mở OBS trên máy khác.{' '}
              <Link href="/huong-dan" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline' }}>
                Cách dùng đủ tính năng mà không cần stream key
              </Link>
              .
            </span>
          </div>
        </section>
      )}

      <ObsGuide />

      {/*
        The spinner is for the first load only. Showing it on every background
        revalidation replaced the whole list with a spinner each time the user
        switched back to the tab — jarring on a screen meant to stay open beside
        OBS. A revalidation keeps the current list on screen.
      */}
      {loading && !data && <LoadingState label="Đang tải hiệu ứng…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (data?.length ?? 0) === 0 && (
        <div className="card">
          <EmptyState
            title="Chưa có hiệu ứng nào"
            description="Hiệu ứng là trang mà OBS mở ra để hiện quà tặng, bình luận hay thanh mục tiêu lên màn hình live."
          />
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
        }}
      >
        {data?.map((overlay) => {
          const url = overlayUrl(overlay);
          const meta = DISPLAY[overlay.type] ?? {
            name: overlay.type,
            blurb: '',
            icon: 'spark' as IconName,
          };
          const copied = copiedId === overlay.id;

          return (
            <article
              key={overlay.id}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    flex: 'none',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 'var(--radius)',
                    background: 'hsl(var(--accent-surface))',
                    color: 'hsl(var(--primary))',
                  }}
                >
                  <Icon name={meta.icon} size={22} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, letterSpacing: 0 }}>
                    {meta.name}
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                    {meta.blurb}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                <span className={overlay.enabled ? 'pill pill-ok' : 'pill'}>
                  <span
                    className={`dot ${overlay.enabled ? 'dot-ok' : 'dot-warn'}`}
                    aria-hidden="true"
                  />
                  {overlay.enabled ? 'Đang bật' : 'Đang tắt'}
                </span>
                {url && AWAITING_PRODUCER[overlay.type] && (
                  <span className="pill" title={AWAITING_PRODUCER[overlay.type]}>
                    Chờ dữ liệu
                  </span>
                )}
                {!url && <span className="pill">Đang phát triển</span>}
              </div>

              {url ? (
                <>
                  {/* The raw URL is deliberately not printed. It is 80 characters
                      of token nobody needs to read, and printing it on screen is
                      exactly how it ends up visible on a broadcast. */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1, minWidth: '150px' }}
                      onClick={() => copy(overlay)}
                    >
                      <Icon name={copied ? 'check' : 'copy'} size={18} />
                      {copied ? 'Đã chép, dán vào OBS' : 'Thêm vào OBS'}
                    </button>
                    <a href={url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                      <Icon name="preview" size={18} />
                      Xem thử
                    </a>
                  </div>
                  <ConfirmAction
                    label="Lỡ để lộ đường dẫn? Tạo cái mới"
                    question="Đường dẫn cũ sẽ ngừng chạy, phải dán lại vào OBS."
                    confirmLabel="Tạo đường dẫn mới"
                    busyLabel="Đang tạo…"
                    disabled={rotatingId === overlay.id}
                    onConfirm={() => rotate(overlay)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0.25rem 0',
                      minHeight: '32px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: '0.8125rem',
                      color: 'hsl(var(--muted-foreground))',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                    }}
                  />
                </>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginTop: 'auto' }}>
                  Hiệu ứng này chưa dùng được. Chúng tôi sẽ báo bạn khi xong.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
