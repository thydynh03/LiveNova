'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApi } from '../../../lib/use-api';
import { api, uploadImage } from '../../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';
import { Icon, type IconName } from '../../../components/ui/Icon';
import { ConfirmAction } from '../../../components/common/ConfirmAction';
import type { Overlay } from '../../../lib/types';

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
  GAME_BATTLE: '/overlays/battle',
  STAGE: '/overlays/stage',
};

/** Type codes are database values. Nobody streaming has to see PK_BAR. */
const DISPLAY: Record<string, { name: string; blurb: string; icon: IconName }> = {
  GAME_BATTLE: {
    name: 'Sàn đấu tương tác (Game Battle)',
    blurb: 'Màn hình chiến trường chia phe (Mèo vs Chó, Kingdom War) đấu điểm quà tặng, thả lính, bắn bom và rồng bay.',
    icon: 'versus',
  },
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
  STAGE: {
    name: 'Hiệu ứng sân khấu',
    blurb: 'Khói, pháo hoa, kim tuyến, rung màn hình — chạy khi khán giả gõ lệnh hoặc tặng quà.',
    icon: 'spark',
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
  GAME_BATTLE: 'Có thể mở Trình mô phỏng hoặc vào trận live để kích hoạt.',
  STAGE: 'Cần một kịch bản có hành động "Hiệu ứng sân khấu" thì mới chạy.',
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

function MediaIdleVideoSection({ overlay, reload }: { overlay: Overlay; reload: () => void }) {
  const currentVideo = (overlay.config as Record<string, string> | undefined)?.defaultVideo || '/DogDefault.mp4';
  const [videoUrl, setVideoUrl] = useState(currentVideo);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVideoUrl((overlay.config as Record<string, string> | undefined)?.defaultVideo || '/DogDefault.mp4');
  }, [overlay.config]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await api.patch(`/overlays/${overlay.id}/config`, {
        config: {
          ...(overlay.config as Record<string, unknown>),
          defaultVideo: videoUrl,
        },
      });
      setMessage('✅ Đã lưu Video chờ riêng cho tài khoản!');
      setTimeout(() => setMessage(null), 3000);
      reload();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Không lưu được';
      setMessage(`❌ Lỗi: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const res = await uploadImage(file);
      if (res?.url) {
        setVideoUrl(res.url);
        setMessage('✅ Đã tải file lên! Bấm nút "Lưu" để cập nhật.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định';
      setMessage(`❌ Tải file thất bại: ${errMsg}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '0.75rem',
        borderRadius: 'var(--radius)',
        background: 'hsl(var(--accent-surface) / 0.5)',
        border: '1px solid hsl(var(--border) / 0.6)',
        marginTop: '0.25rem',
      }}
    >
      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
        🎥 Video chờ riêng (Chạy khi chưa có donate):
      </label>
      <input
        type="text"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="/DogDefault.mp4 hoặc dán Link URL video..."
        style={{
          width: '100%',
          padding: '0.45rem 0.6rem',
          borderRadius: 'var(--radius)',
          border: '1px solid hsl(var(--border))',
          background: 'hsl(var(--background))',
          color: 'inherit',
          fontSize: '0.8125rem',
          boxSizing: 'border-box',
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-secondary"
          style={{ flex: 1, padding: '0.4rem 0.5rem', fontSize: '0.8125rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
        >
          {uploading ? 'Đang tải...' : 'Tải video lên'}
        </button>
        <button
          type="button"
          disabled={saving || videoUrl === currentVideo}
          onClick={handleSave}
          className="btn btn-primary"
          style={{ flex: 1, padding: '0.4rem 0.5rem', fontSize: '0.8125rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
        >
          {saving ? 'Đang lưu...' : 'Lưu video chờ'}
        </button>
      </div>
      {message && (
        <span style={{ fontSize: '0.8rem', color: message.startsWith('✅') ? '#4ade80' : '#f87171' }}>
          {message}
        </span>
      )}
    </div>
  );
}

export default function OverlaysPage() {
  const { data, loading, error, reload } = useApi<Overlay[]>('/overlays');
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
    // Use explicitly configured overlay domain (e.g. Vercel) if available, otherwise fallback to current domain
    let origin = typeof window === 'undefined' ? '' : window.location.origin;
    if (process.env.NEXT_PUBLIC_OVERLAY_URL) {
      origin = process.env.NEXT_PUBLIC_OVERLAY_URL.replace(/\/$/, '');
    }
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

              {overlay.type === 'MEDIA' && (
                <MediaIdleVideoSection overlay={overlay} reload={reload} />
              )}

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
