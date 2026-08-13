'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { DiscoEngine } from './disco-engine';

export interface DiscoCanvasProps {
  engine: DiscoEngine;
}

export default function DiscoCanvas({ engine }: DiscoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Track window size
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      
      engine.tick(now);

      const W = canvas.width;
      const H = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, W, H);
      
      // Draw disco floor line
      ctx.beginPath();
      ctx.moveTo(0, H - 20);
      ctx.lineTo(W, H - 20);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw dancers
      for (const dancer of engine.dancers.values()) {
        const x = dancer.x * W;
        // Floor is H - 80 (leave space for the character)
        const floorY = H - 80;
        let y = dancer.y * floorY;
        
        // Add dance bobbing
        if (dancer.state === 'dancing') {
          // Bob up and down by 15 pixels
          y -= Math.abs(Math.sin(dancer.danceOffset)) * 15;
        }

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        const shadowScale = 1 - (floorY - y) / 300;
        ctx.ellipse(x, floorY + 40, Math.max(10, 30 * shadowScale), Math.max(3, 10 * shadowScale), 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw avatar (Emoji as placeholder)
        ctx.font = '60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Slight rotation for dancing
        ctx.save();
        ctx.translate(x, y);
        if (dancer.state === 'dancing') {
          const rotation = Math.sin(dancer.danceOffset) * 0.2;
          ctx.rotate(rotation);
        }
        
        // Draw the emoji
        ctx.fillText(dancer.emoji, 0, 0);
        
        ctx.restore();

        // Draw nameplate
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = dancer.color;
        ctx.textAlign = 'center';
        ctx.fillText(dancer.name, x, y - 50);
        
        // Draw outline for text
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(dancer.name, x, y - 50);
        ctx.fillText(dancer.name, x, y - 50); // fill again over stroke
      }
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [engine, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size.width}
      height={size.height}
      style={{
        display: 'block',
        width: '100vw',
        height: '100vh',
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
