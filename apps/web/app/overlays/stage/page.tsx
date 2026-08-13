'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  AvatarDancePayload,
  AvatarMotionPayload,
  OverlayAction,
  RuleActionType,
  StageEffectKind,
  STAGE_EFFECT_LIMITS,
  readAvatarDancePayload,
  readAvatarMotionPayload,
  readEffectPayload,
} from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { EffectLayer, ActiveEffect } from '../../../components/overlays/EffectLayer';

/**
 * Three.js và three-vrm cộng lại là vài trăm KB. Nạp tĩnh sẽ bắt mọi sân khấu
 * trả giá đó, kể cả những sân khấu chỉ dùng khói và pháo giấy — nên lớp nhân
 * vật chỉ được tải khi thực sự có người dùng tới nó.
 */
const VrmAvatarLayer = dynamic(
  () => import('../../../components/overlays/VrmAvatarLayer').then((m) => m.VrmAvatarLayer),
  { ssr: false },
);

function StageOverlayContent() {
  const params = useSearchParams();
  const token = params.get('token');
  const [effects, setEffects] = useState<ActiveEffect[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  /**
   * Bật sẵn bằng `?avatar=1` khi dán URL vào OBS, hoặc tự bật ở hành động đầu
   * tiên. Tự bật khiến món quà đầu tiên phải chờ mô hình tải xong — vài trăm
   * mili-giây — nên tham số này có mặt để buổi phát quan trọng không phải chịu
   * độ trễ đó đúng vào lần đầu.
   */
  const [avatarEnabled, setAvatarEnabled] = useState(params.get('avatar') === '1');
  const [motion, setMotion] = useState<{ id: string; payload: AvatarMotionPayload } | null>(null);
  const [dance, setDance] = useState<{ id: string; payload: AvatarDancePayload } | null>(null);
  const seenActions = useRef(new Set<string>());

  /**
   * Mô hình do người dùng tải lên, lấy từ cấu hình của chính overlay này.
   *
   * Đọc bằng token công khai nên browser source không cần đăng nhập. `undefined`
   * nghĩa là chưa biết và `VrmAvatarLayer` sẽ tự quyết theo biến môi trường —
   * đó là lý do state khởi tạo là `undefined` chứ không phải chuỗi rỗng.
   */
  const [configuredModelUrl, setConfiguredModelUrl] = useState<string | undefined>(undefined);
  const [configuredDanceUrl, setConfiguredDanceUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // Bọc trong try/catch chứ không chỉ `.catch()`: nếu `fetch` không tồn tại
    // thì lỗi ném ra *đồng bộ*, trước khi có promise nào để bắt, và cả overlay
    // sập theo. Một sân khấu không đọc được cấu hình vẫn phải dựng được — khói
    // và pháo giấy không phụ thuộc vào mô hình nhân vật.
    try {
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/public/overlays/${encodeURIComponent(token)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { config?: Record<string, unknown> } | null) => {
          if (cancelled) return;
          const url = data?.config?.vrmModelUrl;
          if (typeof url === 'string' && url.trim() !== '') setConfiguredModelUrl(url.trim());
          const dUrl = data?.config?.danceUrl;
          if (typeof dUrl === 'string' && dUrl.trim() !== '') setConfiguredDanceUrl(dUrl.trim());
        })
        .catch(() => undefined);
    } catch {
      /* Không đọc được cấu hình thì dùng mô hình mặc định. */
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    // Transparent background for OBS chromakey
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const handleAction = useCallback((action: OverlayAction) => {
    if (action.type === RuleActionType.AVATAR_MOTION) {
      // Re-đọc thay vì ép kiểu, cùng lý do như EFFECT bên dưới.
      const payload = readAvatarMotionPayload(action.payload);
      if (!payload) return;

      // Phát lại sau khi kết nối lại sẽ gửi lại đúng những hành động vừa diễn.
      // Không lọc thì nhân vật diễn lại toàn bộ lịch sử mỗi lần mạng chớp.
      if (seenActions.current.has(action.id)) return;
      seenActions.current.add(action.id);
      if (seenActions.current.size > 256) {
        seenActions.current.delete(seenActions.current.values().next().value as string);
      }

      setAvatarEnabled(true);
      setMotion({ id: action.id, payload });
      return;
    }

    if (action.type === RuleActionType.AVATAR_DANCE) {
      const payload = readAvatarDancePayload(action.payload);
      if (!payload) return;

      if (seenActions.current.has(action.id)) return;
      seenActions.current.add(action.id);
      if (seenActions.current.size > 256) {
        seenActions.current.delete(seenActions.current.values().next().value as string);
      }

      setAvatarEnabled(true);
      setDance({ id: action.id, payload });
      return;
    }

    if (action.type !== RuleActionType.EFFECT) return;

    // Re-read rather than cast. The server clamps everything before dispatch,
    // but this page also renders replayed actions after a reconnect, and an
    // overlay that trusts its input is one bad row away from a frozen source.
    const payload = readEffectPayload(action.payload);
    if (!payload) return;

    const item: ActiveEffect = {
      id: action.id,
      payload,
      startedAt: performance.now(),
    };

    setEffects((current) => {
      // Drop the oldest rather than queue: an effect that was triggered ten
      // seconds ago no longer relates to anything happening on stream.
      const kept = current.slice(-(STAGE_EFFECT_LIMITS.MAX_CONCURRENT - 1));
      return [...kept, item];
    });

    window.setTimeout(() => {
      setEffects((current) => current.filter((e) => e.id !== item.id));
    }, payload.durationMs);
  }, []);

  const { status, rejectionCode } = useOverlaySocket(token, { onAction: handleAction });

  const statusMessage = !token
    ? 'Thiếu ?token= trong URL overlay'
    : status === 'connecting'
    ? 'Đang kết nối…'
    : status === 'reconnecting'
    ? 'Mất kết nối — đang thử lại…'
    : status === 'rejected'
    ? `Token không hợp lệ (${rejectionCode ?? 'unknown'})`
    : null;

  const shake = useMemo(
    () => effects.find((e) => e.payload.kind === StageEffectKind.SHAKE),
    [effects],
  );

  // Amplitude is capped so a rule author cannot make the whole broadcast
  // unwatchable, and disabled outright under reduced motion.
  const shakeAmplitude = shake && !reducedMotion
    ? Math.min(12, 2 + shake.payload.intensity * 10)
    : 0;

  const captions = effects.filter((e) => e.payload.caption);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes ln-shake {
          0%, 100% { transform: translate3d(0, 0, 0); }
          20%  { transform: translate3d(calc(var(--ln-amp) * -1px), calc(var(--ln-amp) * 0.6px), 0); }
          40%  { transform: translate3d(calc(var(--ln-amp) * 0.8px), calc(var(--ln-amp) * -0.7px), 0); }
          60%  { transform: translate3d(calc(var(--ln-amp) * -0.6px), calc(var(--ln-amp) * -0.4px), 0); }
          80%  { transform: translate3d(calc(var(--ln-amp) * 0.5px), calc(var(--ln-amp) * 0.5px), 0); }
        }
        @keyframes ln-caption-in {
          from { opacity: 0; transform: translate3d(0, 12px, 0); }
          to   { opacity: 1; transform: translate3d(0, 0, 0); }
        }
      `}</style>

      {statusMessage && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            zIndex: 10,
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            fontFamily: 'sans-serif',
            fontSize: '0.85rem',
          }}
        >
          {statusMessage}
        </div>
      )}

      <div
        data-testid="stage-shake-root"
        style={
          {
            position: 'absolute',
            inset: 0,
            '--ln-amp': shakeAmplitude,
            animation: shakeAmplitude > 0 ? 'ln-shake 420ms ease-in-out infinite' : undefined,
            willChange: shakeAmplitude > 0 ? 'transform' : undefined,
            pointerEvents: 'none',
          } as React.CSSProperties
        }
      >
        {/* Nhân vật nằm dưới lớp hiệu ứng: khói và pháo giấy phải phủ lên
            người, không phải bị người che mất. */}
        {avatarEnabled && <VrmAvatarLayer motion={motion} dance={dance} modelUrl={configuredModelUrl} danceUrl={configuredDanceUrl} />}

        <EffectLayer effects={effects} reducedMotion={reducedMotion} />

        {captions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '8%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              pointerEvents: 'none',
            }}
          >
            {captions.map((effect) => (
              <div
                key={effect.id}
                style={{
                  padding: '0.6rem 1.4rem',
                  borderRadius: '999px',
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '2rem',
                  fontWeight: 700,
                  textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                  animation: 'ln-caption-in 240ms ease-out both',
                }}
              >
                {/*
                  A React text node, never innerHTML. Captions interpolate
                  {sender}, so this string can contain a viewer-controlled
                  display name — the audited reference implementation built the
                  same thing by string-concatenating HTML and shipped a stored
                  XSS as a result.
                */}
                {effect.payload.caption}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StageOverlayPage() {
  return (
    <Suspense fallback={null}>
      <StageOverlayContent />
    </Suspense>
  );
}
