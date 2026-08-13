'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { useEventsSocket } from '../../../../lib/use-events-socket';
import { LiveEvent } from '@livenova/shared';
import DiscoCanvas from '../../../../components/disco/DiscoCanvas';
import { DiscoEngine } from '../../../../components/disco/disco-engine';
import Image from 'next/image';

export default function DiscoOverlayPage() {
  const { user, linkedChannels } = useAuth();
  
  // The engine holds all the physics and state for dancers
  const engine = useMemo(() => new DiscoEngine(), []);

  // Music Player State
  const [musicUrl, setMusicUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Use the events socket to listen to RAW chat events across all connected channels
  const channelIds = useMemo(() => linkedChannels.map(c => c.id), [linkedChannels]);

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'chat') {
      const comment = event.payload.comment.toLowerCase().trim();
      const senderId = event.payload.uniqueId || 'unknown';
      const senderName = event.payload.nickname || senderId;
      const avatarUrl = event.payload.profilePictureUrl;

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
    } else if (event.type === 'gift') {
      // Whenever a gift is sent
      const senderId = event.payload.uniqueId || 'unknown';
      const senderName = event.payload.nickname || senderId;
      const avatarUrl = event.payload.profilePictureUrl;
      const diamondCount = event.payload.diamondCount || 1;
      
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
    } else if (event.type === 'member') {
       // VIP joins or top fans join trigger a firework
       const senderId = event.payload.uniqueId || 'unknown';
       const senderName = event.payload.nickname || senderId;
       engine.join(senderId, senderName);
       engine.triggerFirework();
    }
  }, [engine]);

  const { status } = useEventsSocket({
    channelIds,
    onEvent: handleEvent,
    enabled: true,
  });

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMusicUrl(url);
      setIsPlaying(true);
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
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
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
