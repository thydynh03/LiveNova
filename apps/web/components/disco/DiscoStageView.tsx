'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { DiscoEngine } from './disco-engine';
import DiscoCanvas from './DiscoCanvas';

export interface DiscoStageViewProps {
  engine: DiscoEngine;
  videoUrl?: string;
  musicUrl?: string;
  trackTitle?: string;
  isMuted?: boolean;
  enableAudio?: boolean;
}

function CyberLedVisualizer() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    const render = () => {
      tick++;
      const w = (canvas.width = canvas.offsetWidth || 400);
      const h = (canvas.height = canvas.offsetHeight || 200);

      // Dark cyber background
      ctx.fillStyle = '#030308';
      ctx.fillRect(0, 0, w, h);

      // 1. Perspective Cyber Grid
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
      ctx.lineWidth = 1;
      const horizonY = h * 0.35;
      const speed = (tick * 1.2) % 30;

      // Horizontal moving grid lines
      for (let y = horizonY; y < h; y += 14 + (y - horizonY) * 0.3) {
        const lineY = y + (speed * (y - horizonY) / h);
        if (lineY < h) {
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(w, lineY);
          ctx.stroke();
        }
      }

      // Vanishing point diagonal rays
      const vX = w * 0.5;
      for (let x = -w * 0.5; x <= w * 1.5; x += 40) {
        ctx.beginPath();
        ctx.moveTo(vX, horizonY);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.restore();

      // 2. Animated Spectrum Equalizer Waves
      ctx.save();
      const numBars = 32;
      const barW = (w * 0.85) / numBars;
      const startX = w * 0.075;
      const baseWaveY = h * 0.72;

      for (let i = 0; i < numBars; i++) {
        const bx = startX + i * barW;
        const freq1 = Math.sin(tick * 0.08 + i * 0.35);
        const freq2 = Math.cos(tick * 0.05 - i * 0.2);
        const barH = Math.max(8, Math.abs(freq1 * 0.6 + freq2 * 0.4) * (h * 0.45));

        const grad = ctx.createLinearGradient(bx, baseWaveY, bx, baseWaveY - barH);
        grad.addColorStop(0, '#00f0ff');
        grad.addColorStop(0.6, '#ff007f');
        grad.addColorStop(1, '#ffea00');

        ctx.fillStyle = grad;
        ctx.fillRect(bx + 1.5, baseWaveY - barH, barW - 3, barH);

        // Mirror reflection downwards
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.fillRect(bx + 1.5, baseWaveY, barW - 3, barH * 0.3);
      }
      ctx.restore();

      // 3. Central Neon EDM Logo & Audio Pulses
      ctx.save();
      const pulse = 1 + Math.sin(tick * 0.1) * 0.08;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outer Glow
      ctx.font = `900 ${Math.round(18 * pulse)}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 18;
      ctx.fillText('⚡ EDM LIVE CLUB ⚡', w * 0.5, h * 0.32);

      // Inner Text
      ctx.fillStyle = '#ffffff';
      ctx.fillText('⚡ EDM LIVE CLUB ⚡', w * 0.5, h * 0.32);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

export default function DiscoStageView({
  engine,
  videoUrl: initialVideoUrl = '',
  musicUrl: initialMusicUrl = '',
  trackTitle: initialTrackTitle = '',
  isMuted = true,
  enableAudio = false,
}: DiscoStageViewProps) {
  const [aspect, setAspect] = useState<'vertical' | 'horizontal'>('vertical');
  const [eqHeights, setEqHeights] = useState<number[]>([15, 25, 40, 30, 50, 60, 45, 35, 20, 55, 65, 35, 45, 25, 15]);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>(initialVideoUrl);
  const [activeMusicUrl, setActiveMusicUrl] = useState<string>(initialMusicUrl);
  const [activeTrackTitle, setActiveTrackTitle] = useState<string>(initialTrackTitle);
  const [showTrackToast, setShowTrackToast] = useState<boolean>(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Sync props when parent updates
  useEffect(() => {
    if (initialVideoUrl !== undefined) setActiveVideoUrl(initialVideoUrl);
  }, [initialVideoUrl]);

  useEffect(() => {
    if (initialMusicUrl) {
      setActiveMusicUrl(initialMusicUrl);
      if (initialTrackTitle) setActiveTrackTitle(initialTrackTitle);
    }
  }, [initialMusicUrl, initialTrackTitle]);

  // Real-Time Cross-Window / OBS Overlay Sync via BroadcastChannel & LocalStorage
  useEffect(() => {
    // 1. Check saved track in localStorage on mount
    if (typeof window !== 'undefined') {
      try {
        const savedMusic = localStorage.getItem('livenova_disco_current_music');
        const savedTitle = localStorage.getItem('livenova_disco_current_title');
        const savedVideo = localStorage.getItem('livenova_disco_video_url');
        if (savedMusic && !activeMusicUrl) setActiveMusicUrl(savedMusic);
        if (savedTitle && !activeTrackTitle) setActiveTrackTitle(savedTitle);
        if (savedVideo && !activeVideoUrl) setActiveVideoUrl(savedVideo);
      } catch {
        // storage disabled
      }
    }

    // 2. Listen to BroadcastChannel for instant real-time updates
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('livenova_disco_sync');
      channel.onmessage = (event) => {
        const data = event.data;
        if (data && data.type === 'SYNC_DISCO_MEDIA') {
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

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const isVert = window.innerHeight > window.innerWidth;
        setAspect(isVert ? 'vertical' : 'horizontal');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Animate Equalizer Bars
  useEffect(() => {
    const interval = setInterval(() => {
      setEqHeights((prev) =>
        prev.map(() => Math.floor(Math.random() * 55 + 15))
      );
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Synchronize 3D camera pan, tilt, and orbit to background image & LED screen
  const [camTransform, setCamTransform] = useState({
    bgTransform: 'scale(1.32) translate3d(0px, 0px, 0px)',
    screenTransform: 'translate3d(0px, 0px, 35px)',
  });

  useEffect(() => {
    let animId: number;
    const updateCam = () => {
      if (engine && engine.camera) {
        const { yaw, pitch, x, y, scale } = engine.camera;
        // Background 3D Parallax Transform (Scales to 1.32x so rotating camera never reveals black screen edges)
        const bgShiftX = (0.5 - x) * 140 - Math.sin(yaw) * 130;
        const bgShiftY = (0.52 - y) * 90 + (pitch - 0.12) * 80;
        const bgRotY = yaw * 14;
        const bgRotX = -(pitch - 0.12) * 12;
        const bgZoom = 1.32 * Math.max(0.9, Math.min(1.5, scale * 0.95));

        // Screen 3D Parallax Transform (Higher foreground parallax depth)
        const screenShiftX = (0.5 - x) * 180 - Math.sin(yaw) * 165;
        const screenShiftY = (0.52 - y) * 115 + (pitch - 0.12) * 105;
        const screenRotY = yaw * 18;
        const screenRotX = -(pitch - 0.12) * 15;
        const screenZoom = Math.max(0.85, Math.min(1.7, scale));

        setCamTransform({
          bgTransform: `scale(${bgZoom}) translate3d(${bgShiftX.toFixed(1)}px, ${bgShiftY.toFixed(1)}px, 0px) rotateY(${bgRotY.toFixed(2)}deg) rotateX(${bgRotX.toFixed(2)}deg)`,
          screenTransform: `translate3d(${screenShiftX.toFixed(1)}px, ${screenShiftY.toFixed(1)}px, 35px) rotateY(${screenRotY.toFixed(2)}deg) rotateX(${screenRotX.toFixed(2)}deg) scale(${screenZoom.toFixed(2)})`,
        });
      }
      animId = requestAnimationFrame(updateCam);
    };
    animId = requestAnimationFrame(updateCam);
    return () => cancelAnimationFrame(animId);
  }, [engine]);

  // Format YouTube Embed if user enters a YouTube URL
  const ytEmbedUrl = useMemo(() => {
    if (!activeVideoUrl) return null;
    if (activeVideoUrl.includes('youtube.com/watch?v=')) {
      const vidId = activeVideoUrl.split('watch?v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${vidId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${vidId}&controls=0&showinfo=0`;
    }
    if (activeVideoUrl.includes('youtu.be/')) {
      const vidId = activeVideoUrl.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${vidId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${vidId}&controls=0&showinfo=0`;
    }
    return null;
  }, [activeVideoUrl, isMuted]);

  const hasCustomVideo = Boolean(activeVideoUrl && activeVideoUrl.trim() !== '' && !activeVideoUrl.includes('default-dj-loop'));

  const isImageOrGif = useMemo(() => {
    if (!activeVideoUrl) return false;
    return (
      activeVideoUrl.endsWith('.gif') ||
      activeVideoUrl.endsWith('.png') ||
      activeVideoUrl.endsWith('.jpg') ||
      activeVideoUrl.endsWith('.webp')
    );
  }, [activeVideoUrl]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#050508',
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
            animation: 'fadeIn 0.3s ease-out',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '16px', animation: 'spin 3s linear infinite' }}>🎵</span>
          <span style={{ color: '#00f0ff' }}>ĐANG PHÁT:</span>
          <span style={{ color: '#fff', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeTrackTitle || 'EDM Club Mix'}
          </span>
        </div>
      )}

      {/* Floating Top DJ Leaderboard Badge */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 40,
          background: 'rgba(10, 8, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 215, 0, 0.4)',
          boxShadow: '0 0 20px rgba(255, 215, 0, 0.25)',
          borderRadius: '12px',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          color: '#fff',
          fontSize: '11px',
          pointerEvents: 'none',
          minWidth: '150px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 800, color: '#ffd700', fontSize: '11px' }}>
          <span>👑</span>
          <span>BẢNG TOP DJ (≥10đ)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {engine.getTopDancers(3).map((dancer, idx) => (
            <div key={dancer.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{ color: idx === 0 ? '#ffd700' : '#e2e8f0', fontWeight: idx === 0 ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                {idx === 0 ? '🎧 ' : `${idx + 1}. `}{dancer.name}
              </span>
              <span style={{ color: idx === 0 ? '#00f0ff' : '#94a3b8', fontWeight: 700, fontSize: '10px' }}>
                {dancer.points || (dancer.isDj ? 10 : 0)}đ
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3D Perspective Stage & Background Environment Container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: '1000px',
          perspectiveOrigin: '50% 50%',
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        {/* 1. Dynamic 3D Moving Nightclub Bar Stage Image */}
        <div
          style={{
            position: 'absolute',
            inset: '-15%',
            zIndex: 0,
            transform: camTransform.bgTransform,
            transformOrigin: '50% 50%',
            transition: 'transform 0.04s ease-out',
            willChange: 'transform',
          }}
        >
          <Image
            src="/assets/disco/Stage/premium-stage-v2.png"
            alt="Nightclub Bar Stage"
            fill
            style={{ objectFit: 'cover', objectPosition: 'center center' }}
            priority
          />
        </div>

        {/* 2. Massive Panoramic LED Video Screen Wall behind DJ Booth */}
        <div
          style={{
            position: 'absolute',
            top: aspect === 'vertical' ? '13%' : '7%',
            left: aspect === 'vertical' ? '16%' : '22%',
            width: aspect === 'vertical' ? '68%' : '56%',
            height: aspect === 'vertical' ? '25%' : '30%',
            zIndex: 2,
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#000',
            boxShadow: '0 0 35px rgba(0, 240, 255, 0.7), inset 0 0 20px rgba(255, 0, 160, 0.4)',
            border: '2px solid rgba(0, 240, 255, 0.85)',
            transform: camTransform.screenTransform,
            transformOrigin: '50% 50%',
            transition: 'transform 0.04s ease-out',
            willChange: 'transform',
          }}
        >
          {/* Video / GIF Content or Clean Cyber LED Visualizer */}
          {hasCustomVideo ? (
            ytEmbedUrl ? (
              <iframe
                src={ytEmbedUrl}
                style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
                allow="autoplay; encrypted-media"
                title="DJ Video Screen"
              />
            ) : isImageOrGif ? (
              <img
                src={activeVideoUrl}
                alt="DJ Custom Screen"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <video
                src={activeVideoUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )
          ) : (
            <CyberLedVisualizer />
          )}

          {/* LED Equalizer Audio Bars at bottom of video frame */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '24px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: '3px',
              padding: '0 8px 3px 8px',
              pointerEvents: 'none',
            }}
          >
            {eqHeights.map((h, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  maxWidth: '6px',
                  height: `${h}%`,
                  background:
                    h > 50
                      ? '#ff0055'
                      : h > 35
                      ? '#ffbb00'
                      : '#00ffaa',
                  borderRadius: '2px 2px 0 0',
                  boxShadow: '0 0 6px currentColor',
                  transition: 'height 0.1s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 3. 2D/3D Dance Canvas (Dancers + Lights + Sparks + 3D Camera Orbit) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'auto' }}>
        <DiscoCanvas engine={engine} />
      </div>
    </div>
  );
}
