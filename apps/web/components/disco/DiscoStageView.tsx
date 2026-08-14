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

export default function DiscoStageView({
  engine,
  videoUrl = '/assets/disco/Stage/default-dj-loop.gif',
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

  const isImageOrGif = useMemo(() => {
    if (!videoUrl) return true;
    return (
      videoUrl.endsWith('.gif') ||
      videoUrl.endsWith('.png') ||
      videoUrl.endsWith('.jpg') ||
      videoUrl.endsWith('.webp') ||
      videoUrl.includes('default-dj-loop')
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
      {/* 1. Background Arena Stage Image */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Image
          src={
            aspect === 'vertical'
              ? '/assets/disco/Stage/arena-vertical.png'
              : '/assets/disco/Stage/arena-horizontal.png'
          }
          alt="Arena Stage Background"
          fill
          style={{ objectFit: 'cover' }}
          priority
        />
      </div>

      {/* 2. DJ Video Screen Frame (Placed right behind DJ Booth on the LED wall) */}
      <div
        style={{
          position: 'absolute',
          top: aspect === 'vertical' ? '23.2%' : '17%',
          left: aspect === 'vertical' ? '16.5%' : '26%',
          width: aspect === 'vertical' ? '67%' : '48%',
          height: aspect === 'vertical' ? '19.2%' : '27%',
          zIndex: 2,
          borderRadius: 10,
          overflow: 'hidden',
          backgroundColor: '#000',
          boxShadow: '0 0 25px rgba(0, 240, 255, 0.4), inset 0 0 15px rgba(255, 0, 160, 0.3)',
          border: '2px solid rgba(0, 240, 255, 0.6)',
        }}
      >
        {/* Video / GIF Content */}
        {ytEmbedUrl ? (
          <iframe
            src={ytEmbedUrl}
            style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
            allow="autoplay; encrypted-media"
            title="DJ Video Screen"
          />
        ) : isImageOrGif ? (
          <img
            src={videoUrl}
            alt="DJ Live Video"
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
