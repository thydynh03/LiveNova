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

  const trimmedVideoUrl = (activeVideoUrl || '').trim();
  const ytId = getYouTubeId(trimmedVideoUrl);

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

  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [topDancers, setTopDancers] = useState<any[]>([]);

  useEffect(() => {
    const checkPortrait = () => {
      setIsPortrait(typeof window !== 'undefined' && window.innerWidth < window.innerHeight);
    };
    checkPortrait();
    window.addEventListener('resize', checkPortrait);
    return () => window.removeEventListener('resize', checkPortrait);
  }, []);

  useEffect(() => {
    const update = () => {
      setTopDancers(engine.getTopDancers(5));
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [engine]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(5, 5, 15, 0.75)', border: '1px solid rgba(0, 240, 255, 0.4)', backdropFilter: 'blur(10px)', color: '#fff', fontSize: '12px', fontWeight: 700 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
          Sẵn sàng
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px', borderRadius: '999px', background: 'linear-gradient(90deg, rgba(20,10,40,0.85), rgba(40,10,60,0.85))', border: '1px solid rgba(255, 0, 127, 0.5)', backdropFilter: 'blur(12px)', color: '#fff', fontSize: '13px', fontWeight: 800 }}>
          <span>🎵 ĐANG PHÁT:</span>
          <span style={{ color: '#00f0ff' }}>{activeTrackTitle || 'EDM Club Mix'}</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(10, 5, 25, 0.85)',
            border: '1px solid rgba(255, 215, 0, 0.4)',
            backdropFilter: 'blur(12px)',
            minWidth: isPortrait ? '140px' : '170px',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.2)'
          }}
        >
          <div style={{ color: '#ffd700', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>👑</span> BẢNG TOP VIP & DJ
          </div>
          {topDancers.map((dancer, idx) => {
            const colors = ['#ffd700', '#00f0ff', '#ff007f', '#b026ff', '#00ff88'];
            const prefixes = ['👑 TOP 1: ', '🥈 TOP 2: ', '🥉 TOP 3: ', '🌟 TOP 4: ', '✨ TOP 5: '];
            return (
              <div key={dancer.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', gap: '8px' }}>
                <span style={{ color: colors[idx] || '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isPortrait ? '95px' : '130px' }}>
                  {prefixes[idx] || `#${idx + 1}: `}{dancer.name}
                </span>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: '10px' }}>{dancer.points || 0}đ</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3D Festival Mainstage Center Screen */}
      {ytId && (
        <div
          style={{
            position: 'absolute',
            top: isPortrait ? '9%' : '5%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: isPortrait ? '94%' : '58%',
            aspectRatio: '16 / 9',
            maxHeight: isPortrait ? '34%' : '56%',
            zIndex: 3,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 0 50px rgba(0, 240, 255, 0.5)',
            border: '2px solid rgba(0, 240, 255, 0.8)',
            backgroundColor: '#000',
            pointerEvents: 'none',
          }}
        >
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&enablejsapi=1`}
            title="Main Center LED Screen"
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        <DiscoThreeStage engine={engine} videoUrl={activeVideoUrl} isMuted={isMuted} />
      </div>
    </div>
  );
}
