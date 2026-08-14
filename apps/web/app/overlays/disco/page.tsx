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
  const audioParam = searchParams ? searchParams.get('audio') : null;

  const engine = useMemo(() => new DiscoEngine(), []);
  const [activeVideo, setActiveVideo] = useState<string>(customVideo || '');
  // Default unmuted (isMuted = false) so YouTube sound plays directly in TikTok Live Studio / OBS!
  const [isMuted, setIsMuted] = useState<boolean>(audioParam === '0' || audioParam === 'false' ? true : false);

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
          if (data.isMuted !== undefined) {
            setIsMuted(Boolean(data.isMuted));
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

          if (data.liveAction) {
            const { type, senderId, senderName, avatarUrl } = data.liveAction;
            if (type === 'join') {
              engine.join(senderId, senderName, avatarUrl);
            } else if (type === 'jump') {
              if (!engine.dancers.has(senderId)) engine.join(senderId, senderName, avatarUrl);
              engine.jump(senderId);
            } else if (type === 'change') {
              if (!engine.dancers.has(senderId)) engine.join(senderId, senderName, avatarUrl);
              engine.changeAvatar(senderId);
            } else if (type === 'walk') {
              if (!engine.dancers.has(senderId)) engine.join(senderId, senderName, avatarUrl);
              engine.walk(senderId);
            }
          }
        }
      };
      return () => channel.close();
    }
  }, [engine]);

  const handleAction = useCallback((action: OverlayAction) => {
    const { event } = action;
    if (!event) return;
    console.log('[Disco Overlay] Received action:', action);

    const senderId = (event as { senderUsername?: string }).senderUsername || event.senderDisplayName || 'khangia';
    const senderName = event.senderDisplayName || senderId;
    const avatarUrl = event.senderAvatar;

    if (event.type === LiveEventType.COMMENT) {
      const rawText = (event.content || '').toLowerCase().trim();
      const words = rawText.split(/\s+/);
      const isJoin =
        rawText === 'hey' ||
        rawText === '1' ||
        rawText === 'join' ||
        rawText.startsWith('hey ') ||
        rawText.startsWith('1 ') ||
        rawText.startsWith('join ') ||
        words.some((w) => ['hey', 'heyy', 'heyyy', '1', 'join', 'vào', 'vao', 'nhảy', 'nhay', 'quẩy', 'quay'].includes(w)) ||
        rawText.includes('vào phòng') ||
        rawText.includes('vao phong') ||
        rawText.includes('vào nhảy') ||
        rawText.includes('vao nhay') ||
        rawText.includes('vào quẩy') ||
        rawText.includes('vao quay');

      const isJump =
        rawText === '2' ||
        words.some((w) => ['2', 'jump', 'nhảy', 'lên', 'bật'].includes(w));

      const isChange =
        rawText === '3' ||
        words.some((w) => ['3', 'skin', 'đổi', 'change'].includes(w));

      const isWalk =
        rawText === '4' ||
        words.some((w) => ['4', 'walk', 'đi', 'dạo'].includes(w));

      if (isJoin) {
        engine.join(senderId, senderName, avatarUrl);
      } else if (isJump) {
        if (engine.dancers.has(senderId)) engine.jump(senderId);
      } else if (isChange) {
        if (engine.dancers.has(senderId)) engine.changeAvatar(senderId);
      } else if (isWalk) {
        if (engine.dancers.has(senderId)) engine.walk(senderId);
      }
      // Note: Regular comments do NOT join the dancefloor!
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
        engine.triggerSpotlightZoom(7000, senderId, 2);
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
        engine.triggerSpotlightZoom(7000, senderId, 2);
      }
      // 4. Tặng 1 Rose (Hoa Hồng) -> Zoom cận cảnh người đang nhảy đúng 7s cố định (Priority 2)!
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
        engine.triggerSpotlightZoom(7000, senderId, 2);
      }
      // 5. Các quà khác
      else {
        engine.enqueueGift(senderId, senderName, giftCoins, avatarUrl);
      }
    } else if (event.type === LiveEventType.LIKE) {
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
        isMuted={isMuted}
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
