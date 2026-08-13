'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { useEventsSocket } from '../../../../lib/use-events-socket';
import { LiveEvent } from '@livenova/shared';
import DiscoCanvas from '../../../../components/disco/DiscoCanvas';
import { DiscoEngine } from '../../../../components/disco/disco-engine';

export default function DiscoOverlayPage() {
  const { user, linkedChannels } = useAuth();
  
  // The engine holds all the physics and state for dancers
  const engine = useMemo(() => new DiscoEngine(), []);

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
      // Command: "2", "jump", "lên" -> Jump
      else if (['2', 'jump', 'lên', 'nhảy'].includes(comment)) {
        engine.jump(senderId);
      }
    } else if (event.type === 'gift') {
      // Whenever a gift is sent, anyone who gifted joins the floor and jumps!
      const senderId = event.payload.uniqueId || 'unknown';
      const senderName = event.payload.nickname || senderId;
      const avatarUrl = event.payload.profilePictureUrl;
      
      engine.join(senderId, senderName, avatarUrl);
      engine.jump(senderId);
    }
  }, [engine]);

  const { status } = useEventsSocket({
    channelIds,
    onEvent: handleEvent,
    enabled: true,
  });

  if (!user) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        <h2>Vui lòng đăng nhập để sử dụng Sàn Nhảy</h2>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#111' }}>
      
      {/* Background styling for the nightclub */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, #2a0845 0%, #6441A5 100%)',
        opacity: 0.6,
        zIndex: 0
      }} />

      {/* Connection status overlay for debugging (only shows if disconnected) */}
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

      {/* The main 2D render context */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        <DiscoCanvas engine={engine} />
      </div>

    </div>
  );
}
