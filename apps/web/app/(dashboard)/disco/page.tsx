'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useEventsSocket } from '../../../lib/use-events-socket';
import { LiveEvent, LiveEventType } from '@livenova/shared';
import DiscoCanvas from '../../../components/disco/DiscoCanvas';
import { DiscoEngine } from '../../../components/disco/disco-engine';
import Image from 'next/image';
import { useApi } from '../../../lib/use-api';
import type { Channel } from '../../../lib/types';

export default function DiscoOverlayPage() {
  const { user } = useAuth();
  
  // The engine holds all the physics and state for dancers
  const engine = useMemo(() => new DiscoEngine(), []);

  // Music Player State
  const [musicUrl, setMusicUrl] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch channels to listen to
  const channels = useApi<Channel[]>('/channels');
  const channelIds = useMemo(() => (channels.data ?? []).map((c) => c.id), [channels.data]);

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === LiveEventType.COMMENT) {
      const comment = (event.content || '').toLowerCase().trim();
      const senderId = event.senderUsername || 'unknown';
      const senderName = event.senderDisplayName || senderId;
      const avatarUrl = event.senderAvatar;

      // Command: "1", "join", "vào" -> Join the dance floor
      if (['1', 'join', 'vào'].includes(comment)) {
        engine.join(senderId, senderName, avatarUrl);
      }
      // Command: "2", "jump", "lên", "nhảy" -> Jump
      else if (['2', 'jump', 'lên', 'nhảy'].includes(comment)) {
        engine.jump(senderId);
      }
      // Command: "3", "đổi", "đổi nv", "change" -> Change avatar
      else if (['3', 'đổi', 'đổi nv', 'change'].includes(comment)) {
        engine.changeAvatar(senderId);
      }
      // Command: "4", "đi", "đi vòng", "walk" -> Walk around
      else if (['4', 'đi', 'đi vòng', 'walk'].includes(comment)) {
        engine.walk(senderId);
      }
    } else if (event.type === LiveEventType.GIFT) {
      // Whenever a gift is sent
      const senderId = event.senderUsername || 'unknown';
      const senderName = event.senderDisplayName || senderId;
      const avatarUrl = event.senderAvatar;
      const diamondCount = event.giftCoinValue || 1;
      
      engine.join(senderId, senderName, avatarUrl);
      
      // Zoom in on the gifter!
      engine.zoomOn(senderId);
      engine.grow(senderId); // Make them huge temporarily
      
      // If gift >= 199 diamonds, they become the TOP DJ!
      if (diamondCount >= 199) {
        engine.setDj(senderId);
      }
      
      // Trigger a bunch of fireworks for gifts
      const numFireworks = Math.min(10, Math.max(3, diamondCount / 10));
      for (let i = 0; i < numFireworks; i++) {
        setTimeout(() => {
          engine.triggerFirework();
        }, i * 300);
      }
    } else if (
      event.type === LiveEventType.JOIN || 
      event.type === LiveEventType.FOLLOW || 
      event.type === LiveEventType.LIKE || 
      event.type === LiveEventType.SHARE
    ) {
       // VIP joins or top fans join trigger a firework
       const senderId = event.senderUsername || 'unknown';
       const senderName = event.senderDisplayName || senderId;
       engine.join(senderId, senderName);
       engine.triggerFirework();
    }
  }, [engine]);

  const { status } = useEventsSocket({
    channelIds,
    onEvent: handleEvent,
    enabled: channelIds.length > 0,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMusicUrl(url);
      setTimeout(() => {
        if (audioRef.current) audioRef.current.play();
      }, 100);
    }
  };

  if (!user) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <h2>Vui lòng đăng nhập để sử dụng Sàn Nhảy</h2>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#111' }}>
      
      {/* Background styling for the nightclub using the premium stage image */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0
      }}>
        <Image 
          src="/assets/disco/Stage/premium-stage-v2.png" 
          alt="Premium Stage" 
          fill
          style={{ objectFit: 'cover' }}
          priority
        />
      </div>

      {/* Connection status overlay for debugging */}
      {status !== 'connected' && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          borderRadius: 8,
          zIndex: 100,
          fontFamily: 'sans-serif',
          fontSize: 12
        }}>
          Trạng thái kết nối: {status}
        </div>
      )}

      {/* Admin Music Player Overlay */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        padding: '12px',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: '250px'
      }}>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '14px', fontFamily: 'sans-serif' }}>🎧 Admin Music Player</h3>
        
        <input 
          type="file" 
          accept="audio/*" 
          onChange={handleFileChange}
          style={{ color: '#fff', fontSize: '12px' }}
        />
        
        {musicUrl && (
          <>
            <audio 
              ref={audioRef} 
              src={musicUrl} 
              loop 
              style={{ width: '100%', height: '30px', marginTop: '4px' }} 
              controls 
            />
          </>
        )}
      </div>

      {/* The main 2D render context */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        <DiscoCanvas engine={engine} />
      </div>

    </div>
  );
}
