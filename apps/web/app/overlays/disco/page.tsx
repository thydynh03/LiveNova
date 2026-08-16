'use client';

import React, { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  OverlayAction,
  OverlayState,
  DiscoState,
  interpretDiscoEvent,
} from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { DiscoEngine, speakMessage } from '../../../components/disco/disco-engine';
import { applyDiscoAction } from '../../../components/disco/apply-disco-action';
import DiscoStageView from '../../../components/disco/DiscoStageView';
import {
  DEFAULT_LED_DIM,
  FixedFrame,
  readFrameFromParams,
} from '../../../components/overlays/FixedFrame';

function DiscoOverlayContent() {
  const searchParams = useSearchParams();
  const token = searchParams ? searchParams.get('token') : null;
  const customVideo = searchParams ? searchParams.get('video') : null;
  const audioParam = searchParams ? searchParams.get('audio') : null;

  const frame = useMemo(() => readFrameFromParams(searchParams), [searchParams]);

  const engine = useMemo(() => new DiscoEngine(), []);
  const [activeVideo, setActiveVideo] = useState<string>(customVideo || '');
  /**
   * Mặc định TẮT tiếng.
   *
   * Bản trước mặc định bật, cố ý để âm thanh YouTube phát thẳng ra sóng. Nhưng
   * như vậy là phát nhạc có bản quyền lên TikTok, và hệ thống quét vân tay âm
   * thanh của họ bắt được — thường tắt tiếng buổi live trước, rồi kết thúc live
   * nếu lặp lại. Một overlay im lặng thì không bao giờ gây ra chuyện đó.
   *
   * Ai chủ động muốn phát tiếng vẫn bật được bằng `?audio=1`, nhưng phải tự gõ
   * vào — mặc định không đẩy ai vào rủi ro mà họ không biết mình đang nhận.
   */
  const [isMuted, setIsMuted] = useState<boolean>(
    !(audioParam === '1' || audioParam === 'true'),
  );
  const [ledDim, setLedDim] = useState<number>(DEFAULT_LED_DIM);

  useEffect(() => {
    if (customVideo !== null) setActiveVideo(customVideo);
  }, [customVideo]);

  useEffect(() => {
    // Nền trong suốt để OBS / TikTok Live Studio ghép lớp được.
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  /**
   * Áp một khung state sàn nhảy.
   *
   * Dùng chung cho cả socket lẫn `BroadcastChannel` dự phòng, nên hai đường
   * không thể diễn giải khác nhau.
   */
  const applyDiscoState = useCallback(
    (state: DiscoState) => {
      if (state.videoUrl !== undefined) setActiveVideo(state.videoUrl);
      if (state.isMuted !== undefined) setIsMuted(Boolean(state.isMuted));
      if (state.ledDim !== undefined) setLedDim(state.ledDim);

      const duration = state.cameraDurationMs;
      switch (state.cameraShot) {
        case 'DJ_POV':
          engine.triggerDjPov(duration || 9000);
          break;
        case 'SPOTLIGHT_ZOOM':
          engine.triggerSpotlightZoom(duration || 7000, state.cameraTargetId);
          break;
        case 'CRANE_SWOOP':
          engine.triggerCraneSwoop(duration || 6000);
          break;
        case 'WIDE_ORBIT':
          engine.triggerWideOrbit(duration || 8000);
          break;
        default:
          break;
      }

      if (state.effect === 'smoke_blast') engine.triggerSmokeEffect();
      else if (state.effect) engine.triggerEffect(state.effect);

      if (state.speechText) speakMessage(state.speechText);
    },
    [engine],
  );

  const handleState = useCallback(
    (state: OverlayState) => {
      if (state.kind === 'disco') applyDiscoState(state);
    },
    [applyDiscoState],
  );

  /**
   * Sự kiện live từ TikTok.
   *
   * Overlay là nguồn sự thật duy nhất cho nhân vật trên sàn: dashboard chỉ vẽ
   * bản xem trước cục bộ và không còn phát `liveAction` sang đây nữa. Trước
   * đây cả hai cùng gọi `engine.join()` cho một comment, nên khi mở dashboard
   * và OBS trên cùng máy thì mỗi người xem hiện thành hai nhân vật.
   *
   * Đây cũng là bên đọc lời chúc bằng giọng nói, vì đây là bên đang lên sóng.
   */
  const handleAction = useCallback(
    (action: OverlayAction) => {
      if (!action.event) return;
      const discoAction = interpretDiscoEvent(action.event);
      if (discoAction) applyDiscoAction(engine, discoAction, { speak: true });
    },
    [engine],
  );

  const { status, rejectionCode } = useOverlaySocket(token, {
    onAction: handleAction,
    onState: handleState,
    enabled: Boolean(token),
  });

  /**
   * Đường dự phòng trong cùng một trình duyệt.
   *
   * Socket là đường chính vì nó vượt được ranh giới tiến trình. Giữ lại
   * `BroadcastChannel` cho trường hợp xem thử ngay trong tab kế bên khi chưa
   * gắn token — lúc đó không có socket nào để đi.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const channel = new BroadcastChannel('livenova_disco_sync');
    channel.onmessage = (event) => {
      const data = event.data;
      if (data?.type !== 'SYNC_DISCO_MEDIA') return;
      applyDiscoState({ ...data, kind: 'disco', issuedAt: data.timestamp ?? 0 });
    };
    return () => channel.close();
  }, [applyDiscoState]);

  return (
    <FixedFrame frame={frame}>
      {token && status !== 'connected' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            padding: '6px 12px',
            background: 'rgba(0,0,0,0.7)',
            color: status === 'rejected' ? '#ff6b6b' : '#ffa94d',
            borderRadius: 8,
            zIndex: 100,
            fontFamily: 'sans-serif',
            fontSize: 12,
          }}
        >
          {status === 'rejected'
            ? `Token không hợp lệ (${rejectionCode ?? 'rejected'})`
            : `Đang kết nối: ${status}…`}
        </div>
      )}

      <DiscoStageView
        engine={engine}
        videoUrl={activeVideo}
        isMuted={isMuted}
        ledDim={ledDim}
        enableAudio={true}
      />
    </FixedFrame>
  );
}

export default function DiscoOverlayPage() {
  return (
    <Suspense
      fallback={<div style={{ color: '#fff', padding: '1rem' }}>Đang khởi tạo Sàn Nhảy LiveNova…</div>}
    >
      <DiscoOverlayContent />
    </Suspense>
  );
}
