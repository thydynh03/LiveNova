'use client';

import React, { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayAction, LiveEventType } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { DiscoEngine, speakMessage } from '../../../components/disco/disco-engine';
import DiscoStageView from '../../../components/disco/DiscoStageView';

function DiscoOverlayContent() {
  const searchParams = useSearchParams();
  const token = searchParams ? searchParams.get('token') : null;
  const customVideo = searchParams ? searchParams.get('video') : null;

  const engine = useMemo(() => new DiscoEngine(), []);
  const [activeVideo, setActiveVideo] = useState<string>(customVideo || '');

  useEffect(() => {
    if (customVideo !== null) {
      setActiveVideo(customVideo);
    }
  }, [customVideo]);

  useEffect(() => {
    // OBS / TikTok Live Studio compositing
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  useEffect(() => {
    // Listen to BroadcastChannel for instant real-time camera shot switching and video sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('livenova_disco_sync');
      channel.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === 'SYNC_DISCO_MEDIA') {
          if (data.videoUrl !== undefined) {
            setActiveVideo(data.videoUrl);
          }
          if (data.cameraShot === 'DJ_POV') {
            engine.triggerDjPov(data.duration || 9000);
          } else if (data.cameraShot === 'SPOTLIGHT_ZOOM') {
            engine.triggerSpotlightZoom(data.duration || 7000, data.targetId);
          } else if (data.cameraShot === 'CRANE_SWOOP') {
            engine.triggerCraneSwoop(data.duration || 6000);
          } else if (data.cameraShot === 'WIDE_ORBIT') {
            engine.triggerWideOrbit(data.duration || 8000);
          }

          if (data.effect === 'smoke_blast') {
            engine.triggerSmokeEffect();
          } else if (data.effect) {
            engine.triggerEffect(data.effect);
          }

          if (data.speechText) {
            speakMessage(data.speechText);
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
      if (['hey', '1', 'join', 'vào', 'hi', 'hello'].includes(comment)) {
        engine.join(senderId, senderName, avatarUrl);
      } else if (['2', 'jump', 'lên', 'nhảy'].includes(comment)) {
        engine.jump(senderId);
      } else if (['3', 'đổi', 'đổi nv', 'change'].includes(comment)) {
        engine.changeAvatar(senderId);
      } else if (['4', 'đi', 'đi vòng', 'walk'].includes(comment)) {
        engine.walk(senderId);
      }
    } else if (event.type === LiveEventType.GIFT) {
      const giftName = ((event.giftName || event.content || '') as string).toLowerCase().trim();
      const giftCoins = event.giftCoinValue || 1;
      const giftId = Number((event as unknown as { giftId?: number | string }).giftId) || 0;

      // 1. Tặng Pháo Hoa Giấy (Confetti / Fireworks / Paper Fireworks / Popper) -> Lên thẳng TOP 1 DJ luôn!
      if (
        giftName.includes('pháo hoa giấy') ||
        giftName.includes('phao hoa giay') ||
        giftName.includes('hoa giấy') ||
        giftName.includes('hoa giay') ||
        giftName.includes('confetti') ||
        giftName.includes('firework') ||
        giftName.includes('popper') ||
        giftName.includes('paper') ||
        giftCoins >= 100
      ) {
        engine.promoteToDj(senderId, senderName, avatarUrl);
        speakMessage(`Chúc mừng ${senderName} đã tặng Pháo Hoa Giấy và đăng quang trở thành TOP 1 DJ đêm nay!`);
      }
      // 2. Tặng 1 Rosa -> Highlight user đó lên và đọc cảm ơn bằng voice!
      else if (
        giftName.includes('rosa') ||
        giftName.includes('rose nebula') ||
        giftName.includes('rosy')
      ) {
        if (!engine.dancers.has(senderId)) {
          engine.join(senderId, senderName, avatarUrl);
        }
        engine.addGiftPoints(senderId, senderName, 5, avatarUrl);
        engine.triggerSpotlightZoom(7000, senderId);
        speakMessage(`Cảm ơn ${senderName} đã tặng Rosa cho phòng nhảy! Quẩy lên nào!`);
      }
      // 3. Tặng 1 TikTok -> Đổi avatar trang phục!
      else if (
        giftName.includes('tiktok') ||
        giftName.includes('tik tok') ||
        giftId === 5269
      ) {
        if (!engine.dancers.has(senderId)) {
          engine.join(senderId, senderName, avatarUrl);
        }
        engine.changeAvatar(senderId);
        engine.addGiftPoints(senderId, senderName, 1, avatarUrl);
        engine.jump(senderId);
      }
      // 4. Tặng 1 Rose (Hoa Hồng) -> Zoom cận cảnh người đang nhảy 7s!
      else if (
        giftName.includes('rose') ||
        giftName.includes('hoa hồng') ||
        giftName.includes('hoa hong') ||
        giftName.includes('hồng') ||
        giftId === 5655 ||
        giftCoins === 1
      ) {
        if (!engine.dancers.has(senderId)) {
          engine.join(senderId, senderName, avatarUrl);
        }
        engine.addGiftPoints(senderId, senderName, 1, avatarUrl);
        engine.triggerSpotlightZoom(7000, senderId);
      }
      // 5. Các quà khác
      else {
        engine.enqueueGift(senderId, senderName, giftCoins, avatarUrl);
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
        videoUrl={activeVideo}
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
