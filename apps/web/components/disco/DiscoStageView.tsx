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
  /** Độ mờ lớp phủ màn LED, 0 = trong suốt, 1 = đen kịt. */
  ledDim?: number;
  /** Hệ số nhân độ phân giải render 3D. */
  renderQuality?: number;
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
  ledDim = 0.28,
  renderQuality = 1,
}: DiscoStageViewProps) {
  const [activeVideoUrl, setActiveVideoUrl] = useState(videoUrl);
  const [activeMusicUrl, setActiveMusicUrl] = useState(musicUrl);
  const [activeTrackTitle, setActiveTrackTitle] = useState(trackTitle);
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
      // Bục vinh danh, đã loại DJ — xem chú thích ở khối hiển thị bên dưới.
      setTopDancers(engine.getPodiumDancers());
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

      {/* Ultra-Compact Minimalist Broadcast HUD (Top Bar - Non-intrusive, 0 obstruction) */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '12px',
          right: '12px',
          zIndex: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {/* Left: Stream Ready & Now Playing Track Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: 'rgba(5, 5, 15, 0.75)',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
          <span>Sẵn sàng</span>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
          <span style={{ color: '#00f0ff' }}>🎵 {activeTrackTitle || 'EDM Club Mix'}</span>
        </div>

        {/* Right: Slim Compact VIP & DJ Leaderboard Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'rgba(10, 8, 22, 0.78)',
            border: '1px solid rgba(255, 215, 0, 0.4)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            boxShadow: '0 2px 12px rgba(255, 215, 0, 0.2)',
          }}
        >
          {/*
            Bảng quà, KHÔNG có DJ.

            Trước đây ô này lấy `getTopDancers`, mà hàm đó tính cả DJ LiveNova —
            nên DJ luôn chiếm hạng nhất với "10đ" dù DJ không hề nhận quà, và
            khán giả tặng quà thật thì bị đẩy xuống hạng dưới. `getPodiumDancers`
            loại DJ ra, đúng với việc DJ không tham gia đua quà.
          */}
          {topDancers.length === 0 ? (
            <span style={{ color: 'rgba(255,255,255,0.75)' }}>Chưa có ai tặng quà</span>
          ) : (
            topDancers.slice(0, 3).map((dancer, index) => (
              <React.Fragment key={dancer.id}>
                {index > 0 && <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>}
                <span
                  style={{
                    color: ['#ffd700', '#c0c8d8', '#cd7f32'][index],
                    maxWidth: index === 0 ? '120px' : '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {['🥇', '🥈', '🥉'][index]} {dancer.name}
                  {index === 0 ? ` (${dancer.points}đ)` : ''}
                </span>
              </React.Fragment>
            ))
          )}
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
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${ytId}&controls=0&showinfo=0&rel=0&modestbranding=1&enablejsapi=1`}
            title="Main Center LED Screen"
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
          {/*
            Lớp phủ làm dịu màn LED, bản dành cho YouTube.

            Khi nguồn là YouTube thì màn LED trong scene 3D bị gỡ đi và video
            chạy bằng <iframe> ở tầng DOM, nên lớp phủ 3D không với tới được.
            Đây là lớp tương đương, đặt đè lên iframe.
          */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: `rgba(0, 0, 0, ${ledDim})`,
              pointerEvents: 'none',
            }}
          />
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        <DiscoThreeStage
          engine={engine}
          videoUrl={activeVideoUrl}
          isMuted={isMuted}
          ledDim={ledDim}
          renderQuality={renderQuality}
        />
      </div>
    </div>
  );
}
