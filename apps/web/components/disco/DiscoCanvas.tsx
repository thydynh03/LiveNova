'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DiscoEngine } from './disco-engine';

export interface DiscoCanvasProps {
  engine: DiscoEngine;
}

// Preload sprites
const SPRITE_CACHE: Record<string, HTMLImageElement[]> = {};
let spritesLoaded = false;

function preloadSprites() {
  if (spritesLoaded) return;
  spritesLoaded = true;

  const loadSequence = (key: string, pathPrefix: string, count: number) => {
    SPRITE_CACHE[key] = [];
    for (let i = 0; i < count; i++) {
      const img = new Image();
      // Format number as 3 digits (e.g. 000.png)
      const numStr = i.toString().padStart(3, '0');
      img.src = `${pathPrefix}${numStr}.png`;
      SPRITE_CACHE[key].push(img);
    }
  };

  // Load all 18 animated character dance sprites
  loadSequence('mushroom_dance_15', '/assets/disco/Characters/mushroom_dance_15/', 11);
  loadSequence('mushroom_dance_01', '/assets/disco/Characters/mushroom_dance_01/', 14);
  loadSequence('mushroom_magic_02', '/assets/disco/Characters/mushroom_magic_02/', 16);
  loadSequence('hanhan_video_dance', '/assets/disco/Characters/hanhan_video_dance/', 40);
  loadSequence('char_dj_pro', '/assets/disco/Characters/char_dj_pro/', 30);
  loadSequence('char_disco_king', '/assets/disco/Characters/char_disco_king/', 16);
  loadSequence('char_cat_groove', '/assets/disco/Characters/char_cat_groove/', 14);
  loadSequence('char_super_duck', '/assets/disco/Characters/char_super_duck/', 16);
  loadSequence('char_matrix_dancer', '/assets/disco/Characters/char_matrix_dancer/', 15);
  loadSequence('char_a', '/assets/disco/Characters/a/', 10);
  loadSequence('char_b', '/assets/disco/Characters/b/', 12);
  loadSequence('char_c', '/assets/disco/Characters/c/', 8);
  loadSequence('char_d', '/assets/disco/Characters/d/', 16);
  loadSequence('char_e', '/assets/disco/Characters/e/', 8);
  loadSequence('char_g', '/assets/disco/Characters/g/', 15);
  loadSequence('char_h', '/assets/disco/Characters/h/', 9);
  loadSequence('char_j', '/assets/disco/Characters/j/', 14);
  loadSequence('char_k', '/assets/disco/Characters/k/', 9);
}

export default function DiscoCanvas({ engine }: DiscoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    preloadSprites();
    const handleResize = () => {
      if (wrapperRef.current) {
        setSize({ 
          width: wrapperRef.current.clientWidth, 
          height: wrapperRef.current.clientHeight 
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      engine.tick(now);

      const W = canvas.width || 800;
      const H = canvas.height || 600;
      const floorY = H * 0.85; // Natural floor position on stage
      
      ctx.clearRect(0, 0, W, H);
      
      // Apply Camera Transform
      ctx.save();
      const targetPx = engine.camera.x * W;
      const targetPy = engine.camera.y <= 0.5 ? engine.camera.y * H : engine.camera.y * floorY;
      
      ctx.translate(W / 2, H / 2);
      ctx.scale(engine.camera.scale, engine.camera.scale);
      ctx.translate(-targetPx, -targetPy);

      // Draw Dancers
      const dancersArray = Array.from(engine.dancers.values());
      for (const dancer of dancersArray) {
        const x = dancer.x * W;
        let y = dancer.y * floorY;
        
        if (dancer.state === 'dancing') {
          y -= Math.abs(Math.sin(dancer.danceOffset)) * 10;
        }

        // Draw shadow (don't draw if they are a floating DJ high up, unless they are near floor)
        if (!dancer.isDj || dancer.y > 0.8) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.beginPath();
          const shadowScale = (1 - Math.max(0, floorY - y) / 300) * dancer.scale;
          if (shadowScale > 0) {
            ctx.ellipse(x, floorY + 40, Math.max(10, 40 * shadowScale), Math.max(3, 12 * shadowScale), 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Draw Sprite
        ctx.save();
        ctx.translate(x, y);
        
        // Direction based on vx (if walking left, flip)
        if (dancer.vx < -0.01) {
          ctx.scale(-1, 1);
        }

        // Slight rotation if bobbing
        if (dancer.state === 'dancing') {
          ctx.rotate(Math.sin(dancer.danceOffset) * 0.1);
        }

        // Apply scale (grow)
        const renderScale = dancer.scale * (dancer.isDj ? 1.5 : 1); // DJ is naturally 1.5x bigger
        ctx.scale(renderScale, renderScale);

        // Get frames for this sprite
        const frames = SPRITE_CACHE[dancer.spriteId];
        if (frames && frames.length > 0) {
          const frameIndex = frames.length > 1 
            ? Math.floor(now / 80) % frames.length 
            : 0;
            
          const img = frames[frameIndex];
          if (img && img.complete) {
            const drawW = 120;
            const drawH = 120 * (img.height / img.width || 1);
            ctx.drawImage(img, -drawW/2, -drawH + 40, drawW, drawH);
          }
        }
        ctx.restore();

        // Draw Nameplate
        ctx.textAlign = 'center';
        
        const nameY = y - (90 * renderScale);
        
        if (dancer.isDj) {
          // Special DJ Crown and Name
          ctx.font = 'bold 24px sans-serif';
          ctx.fillStyle = '#FFD700'; // Gold
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 4;
          const djText = `👑 TOP DJ: ${dancer.name}`;
          ctx.strokeText(djText, x, nameY - 15);
          ctx.fillText(djText, x, nameY - 15);
        } else {
          // Normal Nameplate
          ctx.font = 'bold 16px sans-serif';
          ctx.fillStyle = dancer.color;
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 3;
          ctx.strokeText(dancer.name, x, nameY);
          ctx.fillText(dancer.name, x, nameY);
        }
      }

      // Draw Fireworks
      for (const fw of engine.fireworks) {
        const age = now - fw.createdAt;
        if (age > 2000) continue;
        
        const fwX = fw.x * W;
        const fwY = fw.y * H;
        const progress = age / 2000;
        
        ctx.save();
        ctx.translate(fwX, fwY);
        // Draw 12 particles expanding outwards
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2 + (progress * 2);
          const distance = progress * 150 * (1 - progress * 0.5); // Slow down near end
          const pX = Math.cos(angle) * distance;
          const pY = Math.sin(angle) * distance + (progress * 50); // Gravity falls down
          
          ctx.beginPath();
          ctx.arc(pX, pY, 5 * (1 - progress), 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${i * 30 + age * 0.1}, 100%, 60%, ${1 - progress})`;
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore(); // End Camera Transform
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [engine, size]);

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}
