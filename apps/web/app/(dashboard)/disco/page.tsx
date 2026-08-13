'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '../../../context/AuthContext';
import { useEventsSocket } from '../../../lib/use-events-socket';
import { LiveEvent, LiveEventType } from '@livenova/shared';
import { useApi } from '../../../lib/use-api';
import { api } from '../../../lib/api-client';
import { DiscoEngine } from '../../../components/disco/disco-engine';
import DiscoCanvas from '../../../components/disco/DiscoCanvas';
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
  const [musicUrl, setMusicUrl] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Test Simulator State
  const [testUsername, setTestUsername] = useState('@khangia_vip');
  const [testDisplayName, setTestDisplayName] = useState('Khán Giả Cute');
  const [copied, setCopied] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);

  // Fetch channels to listen to live events
  const channels = useApi<Channel[]>('/channels');
  const channelIds = useMemo(() => (channels.data ?? []).map((c) => c.id), [channels.data]);

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
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    return publicToken ? `${origin}/overlays/disco?token=${publicToken}` : `${origin}/overlays/disco`;
  }, [publicToken]);

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
      const url = URL.createObjectURL(file);
      setMusicUrl(url);
      setTimeout(() => {
        if (audioRef.current) audioRef.current.play();
      }, 100);
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
            minHeight: '440px',
            backgroundColor: '#0a0a0f',
            borderRadius: 'var(--radius)',
            border: '1px solid hsl(var(--border))',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            {/* Stage Background */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              <Image 
                src="/assets/disco/Stage/premium-stage-v2.png" 
                alt="Premium Stage" 
                fill
                style={{ objectFit: 'cover' }}
                priority
              />
            </div>

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
              zIndex: 30,
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

            {/* Canvas */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
              <DiscoCanvas engine={engine} />
            </div>
          </div>

          {/* Music Player & Audio Control Bar */}
          <div style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-sm)',
                background: 'hsl(var(--primary) / 0.15)',
                color: 'hsl(var(--primary))',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Icon name="audio" size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
                  Âm nhạc Sàn Nhảy
                </div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  {musicUrl ? 'Đang phát nhạc MP3 từ máy của bạn' : 'Chọn bài nhạc MP3 sôi động để quẩy'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{
                cursor: 'pointer',
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                background: 'hsl(var(--secondary))',
                color: 'hsl(var(--secondary-foreground))',
                border: '1px solid hsl(var(--border))',
                fontSize: '0.8125rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem'
              }}>
                <Icon name="music" size={16} />
                <span>{musicUrl ? 'Đổi bài MP3' : 'Tải lên bài MP3'}</span>
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
                  style={{ height: '32px', maxWidth: '240px' }} 
                />
              )}
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
              <li><b>Tặng bất kỳ quà:</b> Phóng to, camera zoom cận cảnh 3.5s + pháo hoa.</li>
              <li><b>Tặng từ 199 xu:</b> Vinh danh TOP DJ bay lên bục trung tâm!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
