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

  // Load all 29 animated character dance sprites
  loadSequence('mushroom_dance_15', '/assets/disco/Characters/mushroom_dance_15/', 11);
  loadSequence('mushroom_dance_01', '/assets/disco/Characters/mushroom_dance_01/', 14);
  loadSequence('mushroom_magic_02', '/assets/disco/Characters/mushroom_magic_02/', 16);
  loadSequence('hanhan_video_dance', '/assets/disco/Characters/hanhan_video_dance/', 40);
  loadSequence('char_anya_heh', '/assets/disco/Characters/char_anya_heh/', 16);
  loadSequence('char_bocchi_panic', '/assets/disco/Characters/char_bocchi_panic/', 16);
  loadSequence('char_gojo_sensei', '/assets/disco/Characters/char_gojo_sensei/', 16);
  loadSequence('char_umaru_chan', '/assets/disco/Characters/char_umaru_chan/', 14);
  loadSequence('char_tanjiro_derp', '/assets/disco/Characters/char_tanjiro_derp/', 14);
  loadSequence('char_zoro_lost', '/assets/disco/Characters/char_zoro_lost/', 16);
  loadSequence('char_panda_cry', '/assets/disco/Characters/char_panda_cry/', 16);
  loadSequence('char_panda_smug', '/assets/disco/Characters/char_panda_smug/', 14);
  loadSequence('char_yaoming_laugh', '/assets/disco/Characters/char_yaoming_laugh/', 12);
  loadSequence('char_hoe_fighter', '/assets/disco/Characters/char_hoe_fighter/', 11);
  loadSequence('char_slipper_slap', '/assets/disco/Characters/char_slipper_slap/', 16);
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
      const floorY = H * 0.90; // Natural floor position on stage
      const djTableY = H * 0.53; // Perfect alignment right behind the DJ mixer desk
      
      ctx.clearRect(0, 0, W, H);
      
      // ==========================================
      // 1. STAGE LIGHTING & LASER BEAMS LAYER (Screen Blend)
      // ==========================================
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Laser emitters along the ceiling truss
      const emitters = [
        { x: W * 0.12, y: H * 0.05, color: 'rgba(0, 240, 255, 0.4)', speed: 0.0014, phase: 0 },
        { x: W * 0.28, y: H * 0.03, color: 'rgba(255, 0, 160, 0.4)', speed: 0.0019, phase: 1.2 },
        { x: W * 0.50, y: H * 0.02, color: 'rgba(0, 255, 140, 0.35)', speed: 0.0023, phase: 2.5 },
        { x: W * 0.72, y: H * 0.03, color: 'rgba(255, 220, 0, 0.4)', speed: 0.0017, phase: 3.8 },
        { x: W * 0.88, y: H * 0.05, color: 'rgba(180, 0, 255, 0.4)', speed: 0.0021, phase: 5.0 },
      ];

      for (const emitter of emitters) {
        const sweepAngle = Math.sin(now * emitter.speed + emitter.phase) * 0.55;
        const targetX = emitter.x + Math.tan(sweepAngle) * H * 1.2;
        const targetY = H * 1.1;

        // Draw glowing laser cone/beam
        const beamGrad = ctx.createLinearGradient(emitter.x, emitter.y, targetX, targetY);
        beamGrad.addColorStop(0, emitter.color.replace('0.4', '0.8').replace('0.35', '0.8'));
        beamGrad.addColorStop(0.7, emitter.color);
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        // Outer glow beam
        ctx.beginPath();
        ctx.moveTo(emitter.x, emitter.y);
        ctx.lineTo(targetX - 25, targetY);
        ctx.lineTo(targetX + 25, targetY);
        ctx.closePath();
        ctx.fillStyle = beamGrad;
        ctx.fill();

        // Intense central laser line
        ctx.strokeStyle = emitter.color.replace('0.4', '0.95').replace('0.35', '0.95');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(emitter.x, emitter.y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
      }

      // Sweeping Stage Spotlights (Left & Right wide cones)
      const leftSpotAngle = Math.sin(now * 0.0009) * 0.35 + 0.35;
      const leftTargetX = W * 0.1 + Math.sin(leftSpotAngle) * W * 0.8;
      const leftGrad = ctx.createRadialGradient(leftTargetX, floorY, 10, leftTargetX, floorY, 180);
      leftGrad.addColorStop(0, 'rgba(0, 200, 255, 0.35)');
      leftGrad.addColorStop(0.6, 'rgba(180, 0, 255, 0.15)');
      leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.moveTo(W * 0.05, 0);
      ctx.lineTo(leftTargetX - 140, floorY + 40);
      ctx.lineTo(leftTargetX + 140, floorY + 40);
      ctx.closePath();
      ctx.fillStyle = leftGrad;
      ctx.fill();

      const rightSpotAngle = -Math.cos(now * 0.0011) * 0.35 - 0.35;
      const rightTargetX = W * 0.9 + Math.sin(rightSpotAngle) * W * 0.8;
      const rightGrad = ctx.createRadialGradient(rightTargetX, floorY, 10, rightTargetX, floorY, 180);
      rightGrad.addColorStop(0, 'rgba(255, 50, 180, 0.35)');
      rightGrad.addColorStop(0.6, 'rgba(255, 200, 0, 0.15)');
      rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.moveTo(W * 0.95, 0);
      ctx.lineTo(rightTargetX - 140, floorY + 40);
      ctx.lineTo(rightTargetX + 140, floorY + 40);
      ctx.closePath();
      ctx.fillStyle = rightGrad;
      ctx.fill();

      // Disco Floor Sparkles (moving glints on glossy floor)
      for (let s = 0; s < 10; s++) {
        const sx = (W * 0.15) + ((s * 73 + (now * 0.04)) % (W * 0.7));
        const sy = floorY - 30 + (Math.sin(s + now * 0.002) * 50);
        const sparkleSize = Math.max(0, Math.sin(now * 0.005 + s * 1.5) * 5);
        if (sparkleSize > 0.5) {
          ctx.beginPath();
          ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${s * 36 + now * 0.1}, 100%, 75%, 0.8)`;
          ctx.fill();
        }
      }

      ctx.restore(); // End Stage Lights Screen Blend

      // ==========================================
      // 2. CAMERA TRANSFORM
      // ==========================================
      ctx.save();
      const targetPx = engine.camera.x * W;
      const targetPy = engine.camera.y <= 0.55 
        ? engine.camera.y * H 
        : engine.camera.y * floorY;
      
      ctx.translate(W / 2, H / 2);
      ctx.scale(engine.camera.scale, engine.camera.scale);
      ctx.translate(-targetPx, -targetPy);

      // Identify if there is a focused dancer for Depth of Field Blur
      const focusedId = engine.camera.lockedOnId;
      const dancersArray = Array.from(engine.dancers.values());

      // Helper function to render a single dancer
      const renderDancer = (dancer: typeof dancersArray[0], isFocused: boolean, isBlurred: boolean) => {
        const x = dancer.x * W;
        let y = dancer.isDj ? djTableY : dancer.y * floorY;
        
        if (dancer.state === 'dancing') {
          y -= Math.abs(Math.sin(dancer.danceOffset)) * 10;
        }

        ctx.save();

        if (isBlurred) {
          ctx.filter = 'blur(4px)';
          ctx.globalAlpha = 0.45;
        } else {
          ctx.filter = 'none';
          ctx.globalAlpha = 1.0;
        }

        // Draw Focus Aura & Floor Spotlight for the focused dancer
        if (isFocused) {
          // Floor Spotlight Glow
          const spotY = dancer.isDj ? djTableY + 40 : floorY + 40;
          const spotGrad = ctx.createRadialGradient(x, spotY, 5, x, spotY, 120);
          spotGrad.addColorStop(0, 'rgba(255, 230, 80, 0.7)');
          spotGrad.addColorStop(0.5, 'rgba(255, 0, 160, 0.35)');
          spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = spotGrad;
          ctx.beginPath();
          ctx.ellipse(x, spotY, 110, 32, 0, 0, Math.PI * 2);
          ctx.fill();

          // Rotating Neon Aura Ring
          ctx.save();
          ctx.translate(x, y - 40);
          ctx.strokeStyle = `hsl(${(now * 0.15) % 360}, 100%, 65%)`;
          ctx.lineWidth = 3;
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.ellipse(0, 0, 75 * dancer.scale, 24 * dancer.scale, Math.sin(now * 0.003) * 0.4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Shadow (for floor dancers)
        if (!dancer.isDj) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          const shadowScale = (1 - Math.max(0, floorY - y) / 300) * dancer.scale;
          if (shadowScale > 0) {
            ctx.ellipse(x, floorY + 40, Math.max(10, 42 * shadowScale), Math.max(3, 13 * shadowScale), 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Draw Sprite
        ctx.save();
        ctx.translate(x, y);
        
        // Direction based on vx
        if (dancer.vx < -0.01) {
          ctx.scale(-1, 1);
        }

        // Bobbing rotation
        if (dancer.state === 'dancing') {
          ctx.rotate(Math.sin(dancer.danceOffset) * 0.1);
        }

        // Scale (DJ is naturally 1.35x bigger behind mixer table)
        const renderScale = dancer.scale * (dancer.isDj ? 1.35 : 1.0);
        ctx.scale(renderScale, renderScale);

        // Get frames for sprite
        const frames = SPRITE_CACHE[dancer.spriteId];
        if (frames && frames.length > 0) {
          const frameIndex = frames.length > 1 
            ? Math.floor(now / 75) % frames.length 
            : 0;
            
          const img = frames[frameIndex];
          if (img && img.complete) {
            const drawW = 140;
            const drawH = 140 * (img.height / img.width || 1);
            // Feet grounded at (0, 0)
            ctx.drawImage(img, -drawW / 2, -drawH + 20, drawW, drawH);
          }
        }
        ctx.restore();

        // Draw Nameplate
        ctx.textAlign = 'center';
        const nameY = y - (95 * renderScale);
        
        if (dancer.isDj) {
          // Special DJ Crown & Golden Nameplate
          ctx.font = 'bold 24px sans-serif';
          ctx.fillStyle = '#FFD700';
          ctx.strokeStyle = 'rgba(0,0,0,0.9)';
          ctx.lineWidth = 5;
          ctx.shadowColor = '#ffb700';
          ctx.shadowBlur = 10;
          const djText = `👑 TOP DJ: ${dancer.name}`;
          ctx.strokeText(djText, x, nameY - 15);
          ctx.fillText(djText, x, nameY - 15);
        } else {
          // Normal / Focused Nameplate
          ctx.font = isFocused ? 'bold 19px sans-serif' : 'bold 16px sans-serif';
          ctx.fillStyle = isFocused ? '#ffffff' : dancer.color;
          ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          ctx.lineWidth = isFocused ? 4 : 3;
          if (isFocused) {
            ctx.shadowColor = dancer.color;
            ctx.shadowBlur = 12;
          }
          ctx.strokeText(dancer.name, x, nameY);
          ctx.fillText(dancer.name, x, nameY);
        }

        ctx.restore();
      };

      // If camera is focused on a specific dancer, render background dancers blurred first
      if (focusedId) {
        // Render non-focused dancers with Depth-of-field blur
        for (const dancer of dancersArray) {
          if (dancer.id !== focusedId) {
            renderDancer(dancer, false, true);
          }
        }
        // Render the focused dancer in sharp focus on top
        const focusedDancer = engine.dancers.get(focusedId);
        if (focusedDancer) {
          renderDancer(focusedDancer, true, false);
        }
      } else {
        // Normal mode: render all dancers sharp
        for (const dancer of dancersArray) {
          renderDancer(dancer, false, false);
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
        for (let i = 0; i < 14; i++) {
          const angle = (i / 14) * Math.PI * 2 + (progress * 2);
          const distance = progress * 160 * (1 - progress * 0.5);
          const pX = Math.cos(angle) * distance;
          const pY = Math.sin(angle) * distance + (progress * 60);
          
          ctx.beginPath();
          ctx.arc(pX, pY, 5.5 * (1 - progress), 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${i * 26 + age * 0.15}, 100%, 65%, ${1 - progress})`;
          ctx.shadowColor = '#fff';
          ctx.shadowBlur = 8;
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore(); // End Camera Transform

      // ==========================================
      // 3. STROBE FLASH & SCREEN CHÓI SÁNG OVERLAY
      // ==========================================
      const beatStrobe = Math.max(0, Math.sin(now * 0.006) ** 7) * 0.15;
      const totalFlash = Math.min(0.85, (engine.flashIntensity || 0) + beatStrobe);

      if (totalFlash > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // Full Screen Flash
        ctx.fillStyle = `rgba(255, 255, 255, ${totalFlash * 0.35})`;
        ctx.fillRect(0, 0, W, H);

        // Center Radial Bloom Glow
        const bloom = ctx.createRadialGradient(W / 2, H * 0.48, 20, W / 2, H * 0.48, W * 0.65);
        bloom.addColorStop(0, `rgba(255, 230, 255, ${totalFlash * 0.6})`);
        bloom.addColorStop(0.4, `rgba(0, 220, 255, ${totalFlash * 0.3})`);
        bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, W, H);

        ctx.restore();
      }
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
