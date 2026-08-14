'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { DiscoEngine } from './disco-engine';
import DiscoCanvas from './DiscoCanvas';

export interface DiscoStageViewProps {
  engine: DiscoEngine;
  videoUrl?: string;
  isMuted?: boolean;
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
  videoUrl = '',
  isMuted = true,
}: DiscoStageViewProps) {
  const [aspect, setAspect] = useState<'vertical' | 'horizontal'>('vertical');
  const [eqHeights, setEqHeights] = useState<number[]>([15, 25, 40, 30, 50, 60, 45, 35, 20, 55, 65, 35, 45, 25, 15]);

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

  // Format YouTube Embed if user enters a YouTube URL
  const ytEmbedUrl = useMemo(() => {
    if (!videoUrl) return null;
    if (videoUrl.includes('youtube.com/watch?v=')) {
      const vidId = videoUrl.split('watch?v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${vidId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${vidId}&controls=0&showinfo=0`;
    }
    if (videoUrl.includes('youtu.be/')) {
      const vidId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${vidId}?autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${vidId}&controls=0&showinfo=0`;
    }
    return null;
  }, [videoUrl, isMuted]);

  const hasCustomVideo = Boolean(videoUrl && videoUrl.trim() !== '' && !videoUrl.includes('default-dj-loop'));

  const isImageOrGif = useMemo(() => {
    if (!videoUrl) return false;
    return (
      videoUrl.endsWith('.gif') ||
      videoUrl.endsWith('.png') ||
      videoUrl.endsWith('.jpg') ||
      videoUrl.endsWith('.webp')
    );
  }, [videoUrl]);

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
      {/* 1. Background Nightclub Bar Stage Image */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Image
          src="/assets/disco/Stage/premium-stage-v2.png"
          alt="Nightclub Bar Stage"
          fill
          style={{ objectFit: 'cover', objectPosition: 'center center' }}
          priority
        />
      </div>

      {/* 2. Panoramic LED Video Screen Wall behind distant DJ Booth */}
      <div
        style={{
          position: 'absolute',
          top: aspect === 'vertical' ? '31.2%' : '18%',
          left: aspect === 'vertical' ? '36.2%' : '38%',
          width: aspect === 'vertical' ? '27.6%' : '24%',
          height: aspect === 'vertical' ? '10.6%' : '16%',
          zIndex: 2,
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: '#000',
          boxShadow: '0 0 30px rgba(0, 240, 255, 0.6), inset 0 0 15px rgba(255, 0, 160, 0.35)',
          border: '1.5px solid rgba(0, 240, 255, 0.8)',
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
              src={videoUrl}
              alt="DJ Custom Screen"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <video
              src={videoUrl}
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

      {/* 3. 2D/3D Dance Canvas (Dancers + Lights + Sparks + Camera Orbit) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
        <DiscoCanvas engine={engine} />
      </div>
    </div>
  );
}
