'use client';

import React, { useMemo, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayAction, LiveEventType } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { DiscoEngine } from '../../../components/disco/disco-engine';
import DiscoStageView from '../../../components/disco/DiscoStageView';

function DiscoOverlayContent() {
  const searchParams = useSearchParams();
  const token = searchParams ? searchParams.get('token') : null;
  const customVideo = searchParams ? searchParams.get('video') : null;

  const engine = useMemo(() => new DiscoEngine(), []);

  useEffect(() => {
    // OBS / TikTok Live Studio compositing
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  useEffect(() => {
    // Listen to BroadcastChannel for instant real-time camera shot switching
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('livenova_disco_sync');
      channel.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === 'SYNC_DISCO_MEDIA') {
          if (data.cameraShot === 'DJ_POV') {
            engine.triggerDjPov(data.duration || 9000);
          } else if (data.cameraShot === 'SPOTLIGHT_ZOOM') {
            engine.triggerSpotlightZoom(data.duration || 5000);
          } else if (data.cameraShot === 'CRANE_SWOOP') {
            engine.triggerCraneSwoop(data.duration || 6000);
          } else if (data.cameraShot === 'WIDE_ORBIT') {
            engine.triggerWideOrbit(data.duration || 8000);
          }
        }
      };
      return () => channel.close();
    }
  }, [engine]);

  const handleAction = useCallback((action: OverlayAction) => {
    const { event } = action;
    if (!event) return;

    const senderId = event.senderDisplayName || 'khangia';
    const senderName = event.senderDisplayName || senderId;
    const avatarUrl = event.senderAvatar;

    if (event.type === LiveEventType.COMMENT) {
      const comment = (event.content || '').toLowerCase().trim();
      if (['1', 'join', 'vào'].includes(comment)) {
        engine.join(senderId, senderName, avatarUrl);
      } else if (['2', 'jump', 'lên', 'nhảy'].includes(comment)) {
        engine.jump(senderId);
      } else if (['3', 'đổi', 'đổi nv', 'change'].includes(comment)) {
        engine.changeAvatar(senderId);
      } else if (['4', 'đi', 'đi vòng', 'walk'].includes(comment)) {
        engine.walk(senderId);
      } else if (['!dj', '!pov', '!gocdj', 'pov', 'dj', 'goc dj', 'góc dj', 'view dj'].includes(comment)) {
        engine.triggerDjPov(9000);
      } else if (['!zoom', 'zoom', 'spotlight'].includes(comment)) {
        engine.triggerSpotlightZoom(5000, senderId);
      } else if (['!crane', 'crane'].includes(comment)) {
        engine.triggerCraneSwoop(6000);
      } else if (['!orbit', 'orbit', 'wide'].includes(comment)) {
        engine.triggerWideOrbit(8000);
      }
    } else if (event.type === LiveEventType.GIFT) {
      const diamondCount = event.giftCoinValue || 1;
      engine.join(senderId, senderName, avatarUrl);
      engine.zoomOn(senderId);
      engine.grow(senderId);

      if (diamondCount >= 199) {
        engine.setDj(senderId);
      }

      const numFireworks = Math.min(10, Math.max(3, Math.floor(diamondCount / 10)));
      for (let i = 0; i < numFireworks; i++) {
        setTimeout(() => {
          engine.triggerFirework();
        }, i * 250);
      }
    } else if (
      event.type === LiveEventType.JOIN ||
      event.type === LiveEventType.FOLLOW ||
      event.type === LiveEventType.LIKE ||
      event.type === LiveEventType.SHARE
    ) {
      engine.join(senderId, senderName, avatarUrl);
      engine.triggerFirework();
    }
  }, [engine]);

  const { status, rejectionCode } = useOverlaySocket(token, {
    onAction: handleAction,
    enabled: Boolean(token),
  });

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: 'transparent' }}>
      {/* Connection Indicator in dev or error */}
      {token && status !== 'connected' && (
        <div style={{
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
        }}>
          {status === 'rejected' ? `Token không hợp lệ (${rejectionCode ?? 'rejected'})` : `Đang kết nối: ${status}…`}
        </div>
      )}

      {/* 3D Nightclub Stage View with LED Video Wall, 2D Dancers & Real-Time Sync Music */}
      <DiscoStageView
        engine={engine}
        videoUrl={customVideo || ''}
        isMuted={true}
        enableAudio={true}
      />
    </div>
  );
}

export default function DiscoOverlayPage() {
  return (
    <Suspense fallback={<div style={{ color: '#fff', padding: '1rem' }}>Đang khởi tạo Sàn Nhảy LiveNova…</div>}>
      <DiscoOverlayContent />
    </Suspense>
  );
}
