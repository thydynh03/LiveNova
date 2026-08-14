'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DiscoEngine } from './disco-engine';
import { DiscoThreeStage } from './DiscoThreeStage';

export interface DiscoStageViewProps {
  engine: DiscoEngine;
  videoUrl?: string;
  musicUrl?: string;
  trackTitle?: string;
  isMuted?: boolean;
  enableAudio?: boolean;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
  return match ? match[1] : null;
}

export default function DiscoStageView({
  engine,
  videoUrl = '',
  musicUrl = '',
  trackTitle = '',
  isMuted = true,
  enableAudio = true,
}: DiscoStageViewProps) {
  const [activeVideoUrl, setActiveVideoUrl] = useState(videoUrl);
  const [activeMusicUrl, setActiveMusicUrl] = useState(musicUrl);
  const [activeTrackTitle, setActiveTrackTitle] = useState(trackTitle);
  const [showTrackToast, setShowTrackToast] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ytId = getYouTubeId(activeVideoUrl);

  // Sync prop updates
  useEffect(() => {
    setActiveVideoUrl(videoUrl);
  }, [videoUrl]);

  useEffect(() => {
    setActiveMusicUrl(musicUrl);
  }, [musicUrl]);

  useEffect(() => {
    setActiveTrackTitle(trackTitle);
  }, [trackTitle]);

  // Real-Time BroadcastChannel Cross-Tab Synchronizer
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('livenova_disco_sync');
      channel.onmessage = (event) => {
        const data = event.data;
        if (data) {
          if (data.musicUrl !== undefined) {
            setActiveMusicUrl(data.musicUrl);
            if (audioRef.current) {
              audioRef.current.src = data.musicUrl;
              audioRef.current.play().catch(() => {});
            }
          }
          if (data.trackTitle !== undefined) {
            setActiveTrackTitle(data.trackTitle);
            setShowTrackToast(true);
            setTimeout(() => setShowTrackToast(false), 5000);
          }
          if (data.videoUrl !== undefined) {
            setActiveVideoUrl(data.videoUrl);
          }
        }
      };
      return () => {
        channel.close();
      };
    }
  }, []);

  // Play audio when activeMusicUrl changes and audio is enabled
  useEffect(() => {
    if (enableAudio && activeMusicUrl && audioRef.current) {
      audioRef.current.src = activeMusicUrl;
      audioRef.current.play().catch(() => {});
    }
  }, [activeMusicUrl, enableAudio]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#040308',
        userSelect: 'none',
      }}
    >
      {/* Hidden Audio element for background music playback */}
      {enableAudio && (
        <audio
          ref={audioRef}
          src={activeMusicUrl || undefined}
          autoPlay
          loop
          style={{ display: 'none' }}
        />
      )}

      {/* Floating Now Playing Track Toast */}
      {(showTrackToast || activeTrackTitle) && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            background: 'rgba(5, 5, 12, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            boxShadow: '0 0 25px rgba(0, 240, 255, 0.25)',
            borderRadius: '24px',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 700,
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '16px' }}>🎵</span>
          <span style={{ color: '#00f0ff' }}>ĐANG PHÁT:</span>
          <span style={{ color: '#fff', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeTrackTitle || 'EDM Club Mix'}
          </span>
        </div>
      )}

      {/* Floating Top DJ & VIP Podium Leaderboard Badge */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 40,
          background: 'rgba(10, 8, 20, 0.88)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 215, 0, 0.45)',
          boxShadow: '0 0 25px rgba(255, 215, 0, 0.3)',
          borderRadius: '14px',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          color: '#fff',
          fontSize: '11px',
          pointerEvents: 'none',
          minWidth: '170px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#ffd700', fontSize: '11px' }}>
          <span>👑</span>
          <span>BẢNG TOP VIP &amp; DJ</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {engine.getTopDancers(5).map((dancer, idx) => {
            const colors = ['#ffd700', '#00f0ff', '#ff007f', '#b026ff', '#00ff88'];
            const prefixes = ['👑 TOP 1 DJ: ', '🥈 BỤC TOP 2: ', '🥉 BỤC TOP 3: ', '🌟 TOP 4: ', '✨ TOP 5: '];
            return (
              <div key={dancer.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{
                  color: colors[idx] || '#fff',
                  fontWeight: 700,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '130px'
                }}>
                  {prefixes[idx] || `#${idx + 1}: `}{dancer.name}
                </span>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: '10px' }}>
                  {dancer.points || (dancer.isDj ? 10 : 0)}đ
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* YouTube Embedded Video Layer on the 3D DJ Stage Video Wall */}
      {ytId && (
        <div
          style={{
            position: 'absolute',
            top: '8%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '62%',
            height: '44%',
            zIndex: 4,
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 0 45px rgba(0, 240, 255, 0.45)',
            border: '2px solid rgba(0, 240, 255, 0.7)',
            pointerEvents: 'none',
          }}
        >
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&enablejsapi=1`}
            title="DJ Stage Video Wall"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      )}

      {/* Full 3D Nightclub Scene via Three.js (Arena Floor, Top 2/3 VIP Podiums, DJ Booth, Moving Light Trusses & Curved 3D Video Wall) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        <DiscoThreeStage engine={engine} videoUrl={activeVideoUrl} isMuted={isMuted} />
      </div>
    </div>
  );
}
