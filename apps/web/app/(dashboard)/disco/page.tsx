'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useEventsSocket } from '../../../lib/use-events-socket';
import { LiveEvent, LiveEventType } from '@livenova/shared';
import { useApi } from '../../../lib/use-api';
import { api } from '../../../lib/api-client';
import { DiscoEngine } from '../../../components/disco/disco-engine';
import DiscoStageView from '../../../components/disco/DiscoStageView';
import { Icon } from '../../../components/ui/Icon';

interface Channel {
  id: string;
  name: string;
}

interface OverlayItem {
  id: string;
  type: string;
  publicToken: string;
}

export default function DiscoDashboardPage() {
  const { user } = useAuth();
  
  // The engine holds all the physics and state for dancers
  const engine = useMemo(() => new DiscoEngine(), []);

  // Music Player State
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string>('');
  const [trackTitle, setTrackTitle] = useState<string>('EDM Nightclub Mix');
  const [customMusicInput, setCustomMusicInput] = useState<string>('');
  const [djVideoUrl, setDjVideoUrl] = useState<string>('');
  const [isDjVideoMuted, setIsDjVideoMuted] = useState<boolean>(true);
  const [isAutoDirector, setIsAutoDirector] = useState<boolean>(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Test Simulator state
  const [testUsername, setTestUsername] = useState('@streamer_pro');
  const [testDisplayName, setTestDisplayName] = useState('Khán Giả 999');

  // Fetch channels to listen to live events
  const channels = useApi<Channel[]>('/channels');
  const channelIds = useMemo(() => (channels.data ?? []).map((c) => c.id), [channels.data]);

  // Load saved video and music from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVideo = localStorage.getItem('livenova_disco_video_url');
      if (savedVideo && !savedVideo.includes('default-dj-loop')) setDjVideoUrl(savedVideo);

      const savedMusic = localStorage.getItem('livenova_disco_current_music');
      const savedTitle = localStorage.getItem('livenova_disco_current_title');
      if (savedMusic) setMusicUrl(savedMusic);
      if (savedTitle) setTrackTitle(savedTitle);
    }
  }, []);

  const broadcastSync = (data: { musicUrl?: string; trackTitle?: string; videoUrl?: string; cameraShot?: string; duration?: number }) => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('livenova_disco_sync');
        channel.postMessage({
          type: 'SYNC_DISCO_MEDIA',
          ...data,
          timestamp: Date.now(),
        });
        channel.close();
      } catch (err) {
        console.error('BroadcastChannel sync failed:', err);
      }
    }
  };

  const handleSetVideoUrl = (url: string) => {
    setDjVideoUrl(url);
    if (typeof window !== 'undefined') {
      localStorage.setItem('livenova_disco_video_url', url);
    }
    broadcastSync({ videoUrl: url });
  };

  const handleSetMusic = (url: string, title: string) => {
    setMusicUrl(url);
    setTrackTitle(title);
    if (typeof window !== 'undefined') {
      localStorage.setItem('livenova_disco_current_music', url);
      localStorage.setItem('livenova_disco_current_title', title);
    }
    broadcastSync({ musicUrl: url, trackTitle: title });
    if (audioRef.current && url) {
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    }
  };

  // Fetch user's public token for OBS / TikTok Live Studio overlay
  useEffect(() => {
    async function loadToken() {
      try {
        const overlays = await api.get<OverlayItem[]>('/overlays');
        // Find STAGE or first available overlay to share the public token
        const stageOverlay = overlays.find((o) => o.type === 'STAGE' || o.type === 'GAME_BATTLE') || overlays[0];
        if (stageOverlay) {
          setPublicToken(stageOverlay.publicToken);
        }
      } catch (err) {
        console.error('Failed to fetch overlay token:', err);
      }
    }
    loadToken();
  }, []);

  const overlayUrl = useMemo(() => {
    let origin = typeof window === 'undefined' ? '' : window.location.origin;
    if (process.env.NEXT_PUBLIC_OVERLAY_URL) {
      origin = process.env.NEXT_PUBLIC_OVERLAY_URL.replace(/\/$/, '');
    }
    const params = new URLSearchParams();
    if (publicToken) params.set('token', publicToken);
    if (djVideoUrl && djVideoUrl.trim() !== '') {
      params.set('video', djVideoUrl);
    }
    const query = params.toString();
    return query ? `${origin}/overlays/disco?${query}` : `${origin}/overlays/disco`;
  }, [publicToken, djVideoUrl]);

  const handleCopyUrl = async () => {
    if (!overlayUrl) return;
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === LiveEventType.COMMENT) {
      const comment = (event.content || '').toLowerCase().trim();
      const senderId = event.senderUsername || 'unknown';
      const senderName = event.senderDisplayName || senderId;
      const avatarUrl = event.senderAvatar;

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
        broadcastSync({ cameraShot: 'DJ_POV', duration: 9000 });
      } else if (['!zoom', 'zoom', 'spotlight'].includes(comment)) {
        engine.triggerSpotlightZoom(5000, senderId);
        broadcastSync({ cameraShot: 'SPOTLIGHT_ZOOM', duration: 5000 });
      } else if (['!crane', 'crane'].includes(comment)) {
        engine.triggerCraneSwoop(6000);
        broadcastSync({ cameraShot: 'CRANE_SWOOP', duration: 6000 });
      } else if (['!orbit', 'orbit', 'wide'].includes(comment)) {
        engine.triggerWideOrbit(8000);
        broadcastSync({ cameraShot: 'WIDE_ORBIT', duration: 8000 });
      }
    } else if (event.type === LiveEventType.GIFT) {
      const senderId = event.senderUsername || 'unknown';
      const senderName = event.senderDisplayName || senderId;
      const avatarUrl = event.senderAvatar;
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
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          handleSetMusic(dataUrl, fileName);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Test action helpers
  const triggerTestJoin = () => {
    engine.join(testUsername.trim() || '@khangia', testDisplayName.trim() || 'Khán Giả');
  };

  const triggerTestJump = () => {
    triggerTestJoin();
    engine.jump(testUsername.trim() || '@khangia');
  };

  const triggerTestAvatarChange = () => {
    triggerTestJoin();
    engine.changeAvatar(testUsername.trim() || '@khangia');
  };

  const triggerTestWalk = () => {
    triggerTestJoin();
    engine.walk(testUsername.trim() || '@khangia');
  };

  const triggerTestGiftNormal = () => {
    const id = testUsername.trim() || '@khangia';
    const name = testDisplayName.trim() || 'Khán Giả';
    engine.join(id, name);
    engine.zoomOn(id);
    engine.grow(id);
    engine.triggerFirework();
    setTimeout(() => engine.triggerFirework(), 200);
    setTimeout(() => engine.triggerFirework(), 400);
  };

  const triggerTestGiftDJ = () => {
    const id = testUsername.trim() || '@khangia';
    const name = testDisplayName.trim() || 'Khán Giả';
    engine.join(id, name);
    engine.setDj(id);
    engine.zoomOn(id);
    engine.grow(id);
    for (let i = 0; i < 8; i++) {
      setTimeout(() => engine.triggerFirework(), i * 200);
    }
  };

  const triggerAddRandomDancers = () => {
    const randomNicks = ['Mèo Con', 'Gấu Bắc Cực', 'Cá Heo', 'Bắp Rang', 'Vịt Vàng', 'Gà Siêu Đẳng', 'Heo Hồng'];
    const count = 3;
    for (let i = 0; i < count; i++) {
      const id = `@user_${Math.floor(Math.random() * 9000 + 1000)}`;
      const name = randomNicks[Math.floor(Math.random() * randomNicks.length)];
      engine.join(id, name);
    }
  };

  const triggerClearDancers = () => {
    engine.clear();
  };

  // Camera Director Test Helpers
  const triggerCameraDjPov = () => {
    engine.triggerDjPov(9000);
    broadcastSync({ cameraShot: 'DJ_POV', duration: 9000 });
  };

  const triggerCameraSpotlight = () => {
    engine.triggerSpotlightZoom(5000);
    broadcastSync({ cameraShot: 'SPOTLIGHT_ZOOM', duration: 5000 });
  };

  const triggerCameraCrane = () => {
    engine.triggerCraneSwoop(6000);
    broadcastSync({ cameraShot: 'CRANE_SWOOP', duration: 6000 });
  };

  const triggerCameraOrbit = () => {
    engine.triggerWideOrbit(8000);
    broadcastSync({ cameraShot: 'WIDE_ORBIT', duration: 8000 });
  };

  const toggleAutoDirector = () => {
    const next = !isAutoDirector;
    setIsAutoDirector(next);
    engine.toggleAutoDirector(next);
  };

  if (!user) {
    return (
      <div style={{ padding: '2rem', color: 'hsl(var(--foreground))' }}>
        <h2>Vui lòng đăng nhập để sử dụng Sàn Nhảy</h2>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Header & Description */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <span style={{ color: 'hsl(var(--primary))' }}>🎵</span> Sàn Nhảy Livestream (Disco Club)
          </h1>
          <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Khán giả bình luận để bước vào sàn nhảy, bật nhảy, đổi trang phục. Tặng quà để phóng to, zoom cận cảnh và thăng cấp thành <b>TOP DJ</b> sân khấu!
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={triggerAddRandomDancers}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
              border: '1px solid hsl(var(--border))'
            }}
          >
            <Icon name="plus" size={16} /> Thêm 3 Dancer
          </button>
          
          <button
            onClick={triggerClearDancers}
            className="btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: 'hsl(var(--destructive) / 0.1)',
              color: 'hsl(var(--destructive))',
              border: '1px solid hsl(var(--destructive) / 0.3)'
            }}
          >
            <Icon name="trash" size={16} /> Xóa Sàn
          </button>
        </div>
      </div>

      {/* OBS Overlay Link Box */}
      <div style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="link" size={18} />
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
              Link Overlay gắn OBS / TikTok Live Studio
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
            Độ phân giải khuyên dùng: <b>1920 × 1080</b>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            readOnly
            value={overlayUrl}
            style={{
              flex: 1,
              minWidth: '280px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--background))',
              color: 'hsl(var(--foreground))',
            }}
          />
          <button
            onClick={handleCopyUrl}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: copied ? 'hsl(142 76% 36%)' : 'hsl(var(--primary))',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={16} />
            {copied ? 'Đã sao chép!' : 'Sao chép Link'}
          </button>
          <a
            href={overlayUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.875rem',
              background: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
              border: '1px solid hsl(var(--border))',
              textDecoration: 'none',
            }}
          >
            <Icon name="preview" size={16} /> Mở Tab Mới
          </a>
        </div>
      </div>

      {/* Main Grid: Stage View (Left) & Simulator Controls (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1fr)',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Left Column: Stage Box & Audio Player */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            minHeight: '460px',
            backgroundColor: '#0a0a0f',
            borderRadius: 'var(--radius)',
            border: '1px solid hsl(var(--border))',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            {/* Socket Status Badge */}
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              padding: '4px 10px',
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: status === 'connected' ? '#4ade80' : '#f87171',
              borderRadius: 20,
              zIndex: 35,
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: status === 'connected' ? '#4ade80' : '#f87171'
              }} />
              {status === 'connected' ? 'Sẵn sàng nhận sự kiện Live' : `Đang kết nối: ${status}`}
            </div>

            {/* 3D Arena Stage View Component with DJ Video Screen */}
            <DiscoStageView
              engine={engine}
              videoUrl={djVideoUrl}
              musicUrl={musicUrl}
              trackTitle={trackTitle}
              isMuted={isDjVideoMuted}
              enableAudio={false}
            />
          </div>

          {/* DJ Video Screen Config Card */}
          <div style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="preview" size={18} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
                  📺 Màn Hình Video DJ Sân Khấu
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsDjVideoMuted(!isDjVideoMuted)}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    background: isDjVideoMuted ? 'hsl(var(--secondary))' : 'hsl(var(--primary) / 0.15)',
                    color: isDjVideoMuted ? 'hsl(var(--secondary-foreground))' : 'hsl(var(--primary))',
                    border: '1px solid hsl(var(--border))',
                    cursor: 'pointer'
                  }}
                >
                  {isDjVideoMuted ? '🔇 Tắt tiếng Video' : '🔊 Bật tiếng Video'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={djVideoUrl}
                onChange={(e) => handleSetVideoUrl(e.target.value)}
                placeholder="Dán link Video (MP4, WebM, GIF, YouTube...)"
                style={{
                  flex: 1,
                  minWidth: '240px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8125rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <button
                type="button"
                onClick={() => handleSetVideoUrl('')}
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  background: 'hsl(var(--secondary))',
                  color: 'hsl(var(--secondary-foreground))',
                  border: '1px solid hsl(var(--border))',
                  cursor: 'pointer'
                }}
              >
                Mặc định
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Gợi ý mẫu:</span>
              {[
                { label: '⚡ Cyber EDM Visualizer (Mặc định)', url: '' },
                { label: '📹 Cyberpunk EDM Video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSetVideoUrl(p.url)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: djVideoUrl === p.url ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--secondary) / 0.6)',
                    color: djVideoUrl === p.url ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                    border: djVideoUrl === p.url ? '1px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                    cursor: 'pointer'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Real-Time Live Music & Audio Controller */}
          <div style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="audio" size={18} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
                  🎵 Âm Nhạc Sàn Nhảy (Tự Động Đồng Bộ Lên Live Ngay Lập Tức)
                </span>
              </div>
              {trackTitle && (
                <div style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'hsl(var(--primary) / 0.15)',
                  color: 'hsl(var(--primary))',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>⚡ Đang phát:</span>
                  <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {trackTitle}
                  </span>
                </div>
              )}
            </div>

            {/* URL Input Form */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={customMusicInput}
                onChange={(e) => setCustomMusicInput(e.target.value)}
                placeholder="Dán link nhạc MP3 trực tiếp (https://.../music.mp3)"
                style={{
                  flex: 1,
                  minWidth: '240px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8125rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (customMusicInput.trim()) {
                    handleSetMusic(customMusicInput.trim(), 'Bài Hát Trực Tuyến');
                    setCustomMusicInput('');
                  }
                }}
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                ▶️ Đổi Nhạc Lên Live
              </button>
            </div>

            {/* Quick EDM Presets & Upload button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Nhạc mẫu:</span>
                {[
                  { title: '⚡ Vinahouse Future Beat', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=electronic-future-beats-117997.mp3' },
                  { title: '🔥 Cyberpunk Rave 2099', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=cyberpunk-2099-10701.mp3' },
                  { title: '💃 Festival Bass Drop', url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=drop-it-124014.mp3' },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSetMusic(p.url, p.title)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: musicUrl === p.url ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--secondary) / 0.6)',
                      color: musicUrl === p.url ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                      border: musicUrl === p.url ? '1px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                      cursor: 'pointer'
                    }}
                  >
                    {p.title}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{
                  cursor: 'pointer',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'hsl(var(--secondary))',
                  color: 'hsl(var(--secondary-foreground))',
                  border: '1px solid hsl(var(--border))',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem'
                }}>
                  <Icon name="music" size={14} />
                  <span>{musicUrl ? '📁 Tải Lên MP3 Khác' : '📁 Tải Lên MP3'}</span>
                  <input 
                    type="file" 
                    accept="audio/mp3,audio/*" 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }} 
                  />
                </label>

                {musicUrl && (
                  <audio 
                    ref={audioRef} 
                    src={musicUrl} 
                    loop 
                    controls 
                    style={{ height: '28px', maxWidth: '200px' }} 
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Simulator & Live Commands Cheat Sheet */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Simulator Panel */}
          <div style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '0.75rem' }}>
              <Icon name="rule" size={18} />
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'hsl(var(--foreground))' }}>
                Bảng Thử Nghiệm Tương Tác (Test)
              </span>
            </div>

            {/* Test User Input */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '4px' }}>
                  Tên tài khoản (ID)
                </label>
                <input
                  type="text"
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  placeholder="@user_vip"
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.8125rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: '4px' }}>
                  Biệt danh hiển thị
                </label>
                <input
                  type="text"
                  value={testDisplayName}
                  onChange={(e) => setTestDisplayName(e.target.value)}
                  placeholder="Khán Giả Cute"
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.8125rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
              </div>
            </div>

            {/* Test Chat Actions */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                💬 TEST LỆNH CHAT KHÁN GIẢ
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  onClick={triggerTestJoin}
                  style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--secondary-foreground))',
                    border: '1px solid hsl(var(--border))',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem'
                  }}
                >
                  🕺 Gõ &quot;1&quot; (Join sàn)
                </button>

                <button
                  onClick={triggerTestJump}
                  style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--secondary-foreground))',
                    border: '1px solid hsl(var(--border))',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem'
                  }}
                >
                  🦘 Gõ &quot;2&quot; (Bật nhảy)
                </button>

                <button
                  onClick={triggerTestAvatarChange}
                  style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--secondary-foreground))',
                    border: '1px solid hsl(var(--border))',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem'
                  }}
                >
                  🎭 Gõ &quot;3&quot; (Đổi Avatar)
                </button>

                <button
                  onClick={triggerTestWalk}
                  style={{
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--secondary-foreground))',
                    border: '1px solid hsl(var(--border))',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem'
                  }}
                >
                  🚶 Gõ &quot;4&quot; (Đi dạo)
                </button>
              </div>
            </div>

            {/* Test Gift Actions */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: '0.5rem' }}>
                🎁 TEST TẶNG QUÀ (HIỆU ỨNG ĐẶC BIỆT)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  onClick={triggerTestGiftNormal}
                  style={{
                    padding: '0.625rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'hsl(var(--primary) / 0.12)',
                    color: 'hsl(var(--primary))',
                    border: '1px solid hsl(var(--primary) / 0.3)',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem'
                  }}
                >
                  <Icon name="gift" size={16} /> Tặng Quà Thường (Zoom + Pháo Hoa)
                </button>

                <button
                  onClick={triggerTestGiftDJ}
                  style={{
                    padding: '0.625rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.375rem',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  👑 Tặng Quà 199 Xu (Lên làm TOP DJ Sân Khấu)
                </button>
              </div>
            </div>
          </div>

          {/* Camera Director & DJ POV Fast Test Panel */}
          <div style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="broadcast" size={18} />
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
                  🎥 Đổi Góc Quay Camera (Test Nhanh)
                </span>
              </div>
              <button
                type="button"
                onClick={toggleAutoDirector}
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid hsl(var(--border))',
                  background: isAutoDirector ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                  color: isAutoDirector ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  cursor: 'pointer'
                }}
              >
                {isAutoDirector ? '⚡ Tự động: BẬT' : '⏸️ Tự động: TẮT'}
              </button>
            </div>

            {/* Fast Test Button Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {/* 1. DJ POV Button */}
              <button
                type="button"
                onClick={triggerCameraDjPov}
                style={{
                  gridColumn: 'span 2',
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #00f0ff 0%, #0077ff 100%)',
                  color: '#000',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  boxShadow: '0 4px 14px rgba(0, 240, 255, 0.35)'
                }}
              >
                🎧 GÓC NHÌN DJ (POV NHÌN XUỐNG SÀN)
              </button>

              {/* 2. Spotlight Zoom */}
              <button
                type="button"
                onClick={triggerCameraSpotlight}
                style={{
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'hsl(var(--secondary))',
                  color: 'hsl(var(--secondary-foreground))',
                  border: '1px solid hsl(var(--border))',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                🔍 Zoom Cận Cảnh
              </button>

              {/* 3. Crane Swoop */}
              <button
                type="button"
                onClick={triggerCameraCrane}
                style={{
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'hsl(var(--secondary))',
                  color: 'hsl(var(--secondary-foreground))',
                  border: '1px solid hsl(var(--border))',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                🏗️ Cần Cẩu Lia Máy
              </button>

              {/* 4. Wide 3D Orbit */}
              <button
                type="button"
                onClick={triggerCameraOrbit}
                style={{
                  gridColumn: 'span 2',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'hsl(var(--secondary))',
                  color: 'hsl(var(--secondary-foreground))',
                  border: '1px solid hsl(var(--border))',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                🌐 Flycam Toàn Cảnh (Orbit)
              </button>
            </div>
          </div>

          {/* Audience Guide Cheat Sheet */}
          <div style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
              📖 Cú pháp lệnh cho người xem Live
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
              <li><b>Gõ &quot;1&quot;, &quot;join&quot;, &quot;vào&quot;:</b> Tham gia xuất hiện trên sàn nhảy.</li>
              <li><b>Gõ &quot;2&quot;, &quot;jump&quot;, &quot;nhảy&quot;:</b> Bật nhảy lên không trung.</li>
              <li><b>Gõ &quot;3&quot;, &quot;change&quot;, &quot;đổi&quot;:</b> Thay đổi diện mạo/avatar khác.</li>
              <li><b>Gõ &quot;4&quot;, &quot;walk&quot;, &quot;đi&quot;:</b> Đi bộ khám phá sân khấu.</li>
              <li><b>Gõ &quot;!dj&quot;, &quot;!pov&quot;, &quot;goc dj&quot;:</b> Kích hoạt góc nhìn từ bàn DJ nhìn xuống biển khán giả!</li>
              <li><b>Gõ &quot;!zoom&quot;, &quot;!crane&quot;, &quot;!orbit&quot;:</b> Đổi góc lia camera tự động.</li>
              <li><b>Tặng bất kỳ quà:</b> Phóng to, camera zoom cận cảnh 3.5s + pháo hoa.</li>
              <li><b>Tặng từ 199 xu:</b> Vinh danh TOP DJ bay lên bục trung tâm!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
