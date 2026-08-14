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

  const broadcastSync = (data: { musicUrl?: string; trackTitle?: string; videoUrl?: string; cameraShot?: string; duration?: number; effect?: string }) => {
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
      if (url.startsWith('blob:') || url.startsWith('data:')) {
        localStorage.removeItem('livenova_disco_video_url');
      } else {
        localStorage.setItem('livenova_disco_video_url', url);
      }
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
      }
    } else if (event.type === LiveEventType.GIFT) {
      const senderId = event.senderUsername || 'unknown';
      const senderName = event.senderDisplayName || senderId;
      const avatarUrl = event.senderAvatar;
      const giftPoints = Math.max(1, event.giftCoinValue || 1);
      engine.enqueueGift(senderId, senderName, giftPoints, avatarUrl);
      broadcastSync({ cameraShot: 'DJ_POV', duration: 10000 });
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

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      handleSetVideoUrl(blobUrl);
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
    engine.enqueueGift(id, name, 3);
    broadcastSync({ cameraShot: 'DJ_POV', duration: 10000 });
  };

  const triggerTestGiftDJ = () => {
    const id = testUsername.trim() || '@khangia';
    const name = testDisplayName.trim() || 'Khán Giả';
    engine.enqueueGift(id, name, 15);
    broadcastSync({ cameraShot: 'DJ_POV', duration: 10000 });
  };

  // Live Effect Triggers for Streamer
  const triggerSmoke = () => {
    engine.triggerSmokeEffect();
    broadcastSync({ effect: 'smoke_blast' });
  };

  const triggerConfetti = () => {
    engine.triggerEffect('confetti');
    broadcastSync({ effect: 'confetti' });
  };

  const triggerStrobe = () => {
    engine.triggerEffect('strobe');
    broadcastSync({ effect: 'strobe' });
  };

  const triggerLaserShow = () => {
    engine.triggerEffect('laser_show');
    broadcastSync({ effect: 'laser_show' });
  };

  const triggerFireworkBurst = () => {
    engine.triggerEffect('firework_burst');
    for (let i = 0; i < 8; i++) {
      setTimeout(() => engine.triggerFirework(), i * 150);
    }
    broadcastSync({ effect: 'firework_burst' });
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

  // Automated Scenario Runner State & Engine
  const [activeScenario, setActiveScenario] = useState<'concert' | 'dj_battle' | 'fx_party' | null>(null);
  const [scenarioStepIndex, setScenarioStepIndex] = useState<number>(0);
  const [scenarioTotalSteps, setScenarioTotalSteps] = useState<number>(0);
  const [scenarioLogs, setScenarioLogs] = useState<string[]>([]);
  const scenarioTimerRefs = useRef<NodeJS.Timeout[]>([]);

  const stopScenario = useCallback(() => {
    scenarioTimerRefs.current.forEach((t) => clearTimeout(t));
    scenarioTimerRefs.current = [];
    setActiveScenario(null);
    setScenarioStepIndex(0);
  }, []);

  const addScenarioLog = useCallback((msg: string) => {
    setScenarioLogs((prev) => [msg, ...prev.slice(0, 15)]);
  }, []);

  const runScenario = useCallback((type: 'concert' | 'dj_battle' | 'fx_party') => {
    stopScenario();
    setActiveScenario(type);
    setScenarioLogs([]);

    if (type === 'concert') {
      setScenarioTotalSteps(6);
      setScenarioStepIndex(1);
      addScenarioLog('▶️ [Bước 1/6] 🎵 Khởi động nhạc EDM & Sân khấu đại nhạc hội');
      handleSetMusic('https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=electronic-future-beats-117997.mp3', '⚡ Vinahouse Future Beat');
      triggerStrobe();

      // Step 2
      const t2 = setTimeout(() => {
        setScenarioStepIndex(2);
        addScenarioLog('▶️ [Bước 2/6] 🕺 4 Khán giả (@dancer_alex, @bella_cute, @tony_viet, @super_star) vào sàn');
        engine.join('@dancer_alex', 'Alex Dancer 🔥');
        engine.join('@bella_cute', 'Bella Cute 💃');
        engine.join('@tony_viet', 'Tony Việt 🕺');
        engine.join('@super_star', 'Super Star 🌟');
      }, 3000);

      // Step 3
      const t3 = setTimeout(() => {
        setScenarioStepIndex(3);
        addScenarioLog('▶️ [Bước 3/6] 💃 Toàn bộ khán giả nhảy bốc lửa & đổi trang phục dạ hội');
        engine.jump('@dancer_alex');
        engine.jump('@bella_cute');
        engine.changeAvatar('@tony_viet');
        engine.changeAvatar('@super_star');
        triggerConfetti();
      }, 6000);

      // Step 4
      const t4 = setTimeout(() => {
        setScenarioStepIndex(4);
        addScenarioLog('▶️ [Bước 4/6] 👑 Khán giả @super_star tặng Quà VIP (+15đ) -> Soán ngôi TOP 1 DJ!');
        engine.enqueueGift('@super_star', 'Super Star 🌟', 15);
      }, 9000);

      // Step 5
      const t5 = setTimeout(() => {
        setScenarioStepIndex(5);
        addScenarioLog('▶️ [Bước 5/6] 🎧 Bật góc nhìn 10s DJ POV nhìn xuống toàn cảnh sàn nhảy!');
        triggerCameraDjPov();
      }, 12000);

      // Step 6
      const t6 = setTimeout(() => {
        setScenarioStepIndex(6);
        addScenarioLog('▶️ [Bước 6/6] 🎆 Bùng nổ xịt khói CO2 sân khấu & Bắn pháo hoa đại tiệc kết màn!');
        triggerSmoke();
        triggerFireworkBurst();
        triggerLaserShow();
        const tDone = setTimeout(() => {
          addScenarioLog('✅ [Hoàn Tất] Kịch bản Đêm Nhạc Hội Bùng Nổ đã diễn ra thành công rực rỡ!');
          setActiveScenario(null);
        }, 5000);
        scenarioTimerRefs.current.push(tDone);
      }, 15000);

      scenarioTimerRefs.current.push(t2, t3, t4, t5, t6);
    } else if (type === 'dj_battle') {
      setScenarioTotalSteps(5);
      setScenarioStepIndex(1);
      addScenarioLog('▶️ [Bước 1/5] ⚔️ Bắt đầu cuộc chiến vương quyền DJ giữa @nguyen_nam và @tran_phuong');
      engine.join('@nguyen_nam', 'Nguyễn Nam 🎧');
      engine.join('@tran_phuong', 'Trần Phương 👑');

      const t2 = setTimeout(() => {
        setScenarioStepIndex(2);
        addScenarioLog('▶️ [Bước 2/5] 🎁 @nguyen_nam tặng 12 điểm -> Thăng hạng lên TOP 1 DJ!');
        engine.enqueueGift('@nguyen_nam', 'Nguyễn Nam 🎧', 12);
      }, 3000);

      const t3 = setTimeout(() => {
        setScenarioStepIndex(3);
        addScenarioLog('▶️ [Bước 3/5] 🚀 @tran_phuong phản công tặng 25 điểm -> Soán ngôi chiếm vương miện DJ!');
        engine.enqueueGift('@tran_phuong', 'Trần Phương 👑', 25);
      }, 7000);

      const t4 = setTimeout(() => {
        setScenarioStepIndex(4);
        addScenarioLog('▶️ [Bước 4/5] 🔍 Camera Spotlight Zoom cận cảnh tân vương @tran_phuong');
        triggerCameraSpotlight();
      }, 11000);

      const t5 = setTimeout(() => {
        setScenarioStepIndex(5);
        addScenarioLog('▶️ [Bước 5/5] 🏆 Vinh danh Tân TOP 1 DJ với pháo hoa mừng chiến thắng!');
        triggerFireworkBurst();
        triggerConfetti();
        const tDone = setTimeout(() => {
          addScenarioLog('✅ [Hoàn Tất] Kịch bản Tranh Đoạt Ngôi Vị DJ đã kết thúc!');
          setActiveScenario(null);
        }, 4000);
        scenarioTimerRefs.current.push(tDone);
      }, 14000);

      scenarioTimerRefs.current.push(t2, t3, t4, t5);
    } else if (type === 'fx_party') {
      setScenarioTotalSteps(6);
      setScenarioStepIndex(1);
      addScenarioLog('▶️ [Bước 1/6] 💨 Kích hoạt Xịt khói CO2 sân khấu (Kèm âm thanh khí nén)');
      triggerSmoke();

      const t2 = setTimeout(() => {
        setScenarioStepIndex(2);
        addScenarioLog('▶️ [Bước 2/6] ⚡ Kích hoạt Strobe nhấp nháy vũ trường cực bốc');
        triggerStrobe();
      }, 3000);

      const t3 = setTimeout(() => {
        setScenarioStepIndex(3);
        addScenarioLog('▶️ [Bước 3/6] 🔴 Kích hoạt Laser Show đa chùm xoay 360 độ');
        triggerLaserShow();
      }, 6000);

      const t4 = setTimeout(() => {
        setScenarioStepIndex(4);
        addScenarioLog('▶️ [Bước 4/6] 🎊 Thả mưa Confetti hoa giấy 7 màu lấp lánh');
        triggerConfetti();
      }, 9000);

      const t5 = setTimeout(() => {
        setScenarioStepIndex(5);
        addScenarioLog('▶️ [Bước 5/6] 🏗️ Cần cẩu lia máy Crane Swoop & Flycam toàn cảnh');
        triggerCameraCrane();
      }, 12000);

      const t6 = setTimeout(() => {
        setScenarioStepIndex(6);
        addScenarioLog('▶️ [Bước 6/6] 🎆 Bắn pháo hoa liên hoàn 8 phát đại tiệc kết màn!');
        triggerFireworkBurst();
        const tDone = setTimeout(() => {
          addScenarioLog('✅ [Hoàn Tất] Kịch bản Đại Tiệc Hiệu Ứng đã hoàn thành!');
          setActiveScenario(null);
        }, 4000);
        scenarioTimerRefs.current.push(tDone);
      }, 15000);

      scenarioTimerRefs.current.push(t2, t3, t4, t5, t6);
    }
  }, [addScenarioLog, engine, handleSetMusic, stopScenario, triggerCameraCrane, triggerCameraDjPov, triggerCameraSpotlight, triggerConfetti, triggerFireworkBurst, triggerLaserShow, triggerSmoke, triggerStrobe]);

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

            {/* Quick Presets & Upload Video Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Gợi ý mẫu:</span>
                {[
                  { label: '⚡ Cyber EDM Visualizer (Mặc định)', url: '' },
                  { label: '▶️ YouTube DJ Club Video', url: 'https://www.youtube.com/watch?v=kYbgc0wSrnM' },
                  { label: '🔥 Neon Cyber Loop MP4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
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

              <div>
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
                  <Icon name="preview" size={14} />
                  <span>{djVideoUrl ? '📁 Tải Lên Video/GIF Khác' : '📁 Tải Lên Video/GIF'}</span>
                  <input 
                    type="file" 
                    accept="video/mp4,video/webm,video/*,image/gif,image/*" 
                    onChange={handleVideoFileChange} 
                    style={{ display: 'none' }} 
                  />
                </label>
              </div>
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
          {/* 🎭 Automated Scenario & Test Runner Card */}
          <div style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🎭</span>
                <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: 'hsl(var(--foreground))' }}>
                  Kịch Bản Trình Diễn Tự Động (Auto Scenario)
                </span>
              </div>
              {activeScenario && (
                <button
                  type="button"
                  onClick={stopScenario}
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  ⏹️ Dừng Kịch Bản
                </button>
              )}
            </div>

            {/* Scenario Quick Launcher Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {[
                {
                  id: 'concert' as const,
                  title: '🔥 Kịch Bản 1: Đêm Nhạc Hội Bùng Nổ',
                  desc: '4 Khán giả vào sàn -> Nhảy & đổi đồ -> Tặng quà VIP -> Soán ngôi Top 1 DJ -> 10s DJ POV -> Xịt khói & Pháo hoa',
                  color: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                },
                {
                  id: 'dj_battle' as const,
                  title: '👑 Kịch Bản 2: Tranh Đoạt Ngôi Vị DJ',
                  desc: '2 Khán giả thi đấu điểm quà -> Lần lượt soán ngôi nhau -> Thông báo thăng chức DJ -> Spotlight Zoom',
                  color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                },
                {
                  id: 'fx_party' as const,
                  title: '⚡ Kịch Bản 3: Đại Tiệc Hiệu Ứng Sân Khấu',
                  desc: 'Stress test toàn bộ hiệu ứng: Xịt khói CO2 -> Nhấp nháy Strobe -> Laser Show -> Confetti -> Cần cẩu Crane -> Pháo hoa',
                  color: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                }
              ].map((sc) => {
                const isRunning = activeScenario === sc.id;
                return (
                  <div
                    key={sc.id}
                    style={{
                      border: isRunning ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      background: isRunning ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--secondary) / 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.375rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'hsl(var(--foreground))' }}>
                        {sc.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => runScenario(sc.id)}
                        disabled={isRunning}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: isRunning ? 'hsl(var(--muted))' : sc.color,
                          color: '#fff',
                          border: 'none',
                          cursor: isRunning ? 'default' : 'pointer',
                          boxShadow: isRunning ? 'none' : '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                      >
                        {isRunning ? '⏳ Đang Chạy...' : '▶️ Chạy Ngay'}
                      </button>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.4 }}>
                      {sc.desc}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Scenario Progress & Terminal Log */}
            {activeScenario && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span style={{ color: 'hsl(var(--primary))' }}>Tiến độ: Bước {scenarioStepIndex} / {scenarioTotalSteps}</span>
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>{Math.round((scenarioStepIndex / scenarioTotalSteps) * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'hsl(var(--secondary))', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(scenarioStepIndex / scenarioTotalSteps) * 100}%`,
                      background: 'linear-gradient(90deg, #00f0ff, #ff007f)',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>
            )}

            {scenarioLogs.length > 0 && (
              <div style={{
                background: '#04020a',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.625rem',
                maxHeight: '120px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                fontSize: '0.75rem',
                fontFamily: 'monospace'
              }}>
                {scenarioLogs.map((log, idx) => (
                  <div key={idx} style={{ color: idx === 0 ? '#00f0ff' : '#8892b0' }}>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  <Icon name="gift" size={16} /> 🎁 Tặng Quà (+3 Điểm → Kích Hoạt POV)
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
                  👑 Tặng Quà VIP (+15 Điểm → Soán Ngôi TOP 1 DJ)
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

          {/* 🎆 LIVE EFFECTS PANEL - Streamer triggers effects directly on live */}
          <div style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="rule" size={18} />
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'hsl(var(--foreground))' }}>
                🎆 Hiệu Ứng Trực Tiếp (Bấm Ngay Trên Live)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={triggerSmoke}
                style={{
                  gridColumn: 'span 2',
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  boxShadow: '0 4px 14px rgba(102, 126, 234, 0.35)'
                }}
              >
                💨 XỊT KHÓI SÂN KHẤU (Có Âm Thanh)
              </button>

              <button type="button" onClick={triggerConfetti} style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', border: '1px solid hsl(var(--border))', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                🎊 Confetti / Hoa Giấy
              </button>

              <button type="button" onClick={triggerStrobe} style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', border: '1px solid hsl(var(--border))', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                ⚡ Strobe / Nhấp Nháy
              </button>

              <button type="button" onClick={triggerLaserShow} style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', border: '1px solid hsl(var(--border))', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                🔴 Laser Show
              </button>

              <button type="button" onClick={triggerFireworkBurst} style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', border: '1px solid hsl(var(--border))', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>
                🎆 Pháo Hoa Bùng Nổ
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
              <li><b>Gõ &quot;4&quot;, &quot;walk&quot;, &quot;đi&quot;:</b> Đi bộ khám phá sàn nhảy.</li>
              <li><b>🎁 Tặng bất kỳ quà:</b> Tích lũy điểm + Kích hoạt góc nhìn DJ POV nhìn xuống toàn bộ vũ trường!</li>
              <li><b>👑 Điểm cao nhất (≥ 10 điểm):</b> Soán ngôi làm TOP 1 DJ trên bục trung tâm, thay thế DJ cũ!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
