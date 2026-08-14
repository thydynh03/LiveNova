'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DiscoEngine } from './disco-engine';

export interface DiscoCanvasProps {
  engine: DiscoEngine;
}

// Preload sprites & avatars
const SPRITE_CACHE: Record<string, HTMLImageElement[]> = {};
const AVATAR_CACHE: Record<string, HTMLImageElement> = {};
let spritesLoaded = false;

function getAvatarImg(url: string) {
  if (!AVATAR_CACHE[url]) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    AVATAR_CACHE[url] = img;
  }
  return AVATAR_CACHE[url];
}

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
      
      ctx.clearRect(0, 0, W, H);
      
      // ==========================================
      // 1. OVERHEAD CIRCULAR TRUSS & STAGE LIGHTING (Screen Blend)
      // ==========================================
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      // Overhead circular truss center
      const trussCenterX = W * 0.5;
      const trussCenterY = H * 0.18;
      const trussRadiusX = W * 0.28;
      const trussRadiusY = H * 0.055;

      const lightColors = [
        'rgba(0, 240, 255, 0.45)', // Cyan
        'rgba(255, 0, 160, 0.45)', // Magenta
        'rgba(0, 255, 140, 0.40)', // Lime
        'rgba(255, 220, 0, 0.45)', // Gold
        'rgba(180, 0, 255, 0.45)', // Purple
        'rgba(255, 50, 50, 0.40)',  // Red
      ];

      // 6 Rotating Truss Lasers
      for (let i = 0; i < 6; i++) {
        const ringAngle = (i / 6) * Math.PI * 2 + now * 0.0008;
        const emitterX = trussCenterX + Math.cos(ringAngle) * trussRadiusX;
        const emitterY = trussCenterY + Math.sin(ringAngle) * trussRadiusY;

        const targetSweep = Math.sin(now * 0.0016 + i * 1.1) * 0.65;
        const targetX = emitterX + Math.tan(targetSweep) * H * 0.85;
        const targetY = H * 1.05;

        const color = lightColors[i % lightColors.length];
        const beamGrad = ctx.createLinearGradient(emitterX, emitterY, targetX, targetY);
        beamGrad.addColorStop(0, color.replace('0.45', '0.9').replace('0.40', '0.9'));
        beamGrad.addColorStop(0.7, color);
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        // Outer glow cone
        ctx.beginPath();
        ctx.moveTo(emitterX, emitterY);
        ctx.lineTo(targetX - 28, targetY);
        ctx.lineTo(targetX + 28, targetY);
        ctx.closePath();
        ctx.fillStyle = beamGrad;
        ctx.fill();

        // Intense core laser line
        ctx.strokeStyle = color.replace('0.45', '1.0').replace('0.40', '1.0');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(emitterX, emitterY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
      }

      // Sweeping Stage Spotlights (Left & Right wide cones)
      const leftSpotAngle = Math.sin(now * 0.0009) * 0.35 + 0.35;
      const leftTargetX = W * 0.1 + Math.sin(leftSpotAngle) * W * 0.8;
      const leftGrad = ctx.createRadialGradient(leftTargetX, H * 0.85, 10, leftTargetX, H * 0.85, 180);
      leftGrad.addColorStop(0, 'rgba(0, 200, 255, 0.35)');
      leftGrad.addColorStop(0.6, 'rgba(180, 0, 255, 0.15)');
      leftGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.moveTo(W * 0.05, 0);
      ctx.lineTo(leftTargetX - 140, H * 0.95);
      ctx.lineTo(leftTargetX + 140, H * 0.95);
      ctx.closePath();
      ctx.fillStyle = leftGrad;
      ctx.fill();

      const rightSpotAngle = -Math.cos(now * 0.0011) * 0.35 - 0.35;
      const rightTargetX = W * 0.9 + Math.sin(rightSpotAngle) * W * 0.8;
      const rightGrad = ctx.createRadialGradient(rightTargetX, H * 0.85, 10, rightTargetX, H * 0.85, 180);
      rightGrad.addColorStop(0, 'rgba(255, 50, 180, 0.35)');
      rightGrad.addColorStop(0.6, 'rgba(255, 200, 0, 0.15)');
      rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.moveTo(W * 0.95, 0);
      ctx.lineTo(rightTargetX - 140, H * 0.95);
      ctx.lineTo(rightTargetX + 140, H * 0.95);
      ctx.closePath();
      ctx.fillStyle = rightGrad;
      ctx.fill();

      // Disco Floor Sparkles (moving glints on glossy amphitheater floor)
      for (let s = 0; s < 12; s++) {
        const sx = (W * 0.12) + ((s * 67 + (now * 0.035)) % (W * 0.76));
        const sy = H * 0.65 + (Math.sin(s + now * 0.002) * (H * 0.25));
        const sparkleSize = Math.max(0, Math.sin(now * 0.005 + s * 1.5) * 5.5);
        if (sparkleSize > 0.5) {
          ctx.beginPath();
          ctx.arc(sx, sy, sparkleSize, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${s * 32 + now * 0.1}, 100%, 75%, 0.85)`;
          ctx.fill();
        }
      }

      ctx.restore(); // End Stage Lights Screen Blend

      // ==========================================
      // 2. 3D CAMERA TRANSFORM & AMPHITHEATER FLOOR
      // ==========================================
      ctx.save();
      const targetPx = engine.camera.x * W;
      const targetPy = engine.camera.y * H;
      
      ctx.translate(W / 2, H / 2);
      ctx.scale(engine.camera.scale, engine.camera.scale);
      ctx.translate(-targetPx, -targetPy);

      // Identify if there is a focused dancer for Depth of Field Blur
      const focusedId = engine.camera.lockedOnId;
      const rawDancers = Array.from(engine.dancers.values());

      // Calculate 3D screen position & scale for each dancer (Top-Down Wide Club Floor Perspective)
      const calcDancerScreenPos = (dancer: typeof rawDancers[0]) => {
        const isVertical = H > W;
        if (dancer.isDj) {
          return {
            x: 0.5 * W,
            y: isVertical ? H * 0.525 : H * 0.48,
            renderScale: dancer.scale * (isVertical ? 1.25 : 1.1),
            depth: 0.05,
          };
        }
        const z = Math.max(0.1, Math.min(1.0, dancer.z ?? 0.5));
        // Top-down elevated floor perspective spanning from 0.58 to 0.94
        const baseFloorY = isVertical ? (H * 0.58 + z * (H * 0.36)) : (H * 0.50 + z * (H * 0.45));
        let y = dancer.y < 1.0 ? dancer.y * baseFloorY : baseFloorY;
        if (dancer.state === 'dancing') {
          y -= Math.abs(Math.sin(dancer.danceOffset)) * (4 + z * 5);
        }
        // Wide horizontal spread reaching both left and right flanks
        const x = W * (0.5 + (dancer.x - 0.5) * (0.90 + z * 0.18));
        const renderScale = (0.52 + z * 0.52) * dancer.scale;
        return { x, y, renderScale, depth: z };
      };

      // Sort dancers by depth so back dancers are drawn first
      const dancersWithPos = rawDancers.map((d) => ({
        dancer: d,
        pos: calcDancerScreenPos(d),
      }));
      dancersWithPos.sort((a, b) => a.pos.depth - b.pos.depth);

      // Helper function to render a single dancer
      const renderDancer = (item: typeof dancersWithPos[0], isFocused: boolean, isBlurred: boolean) => {
        const { dancer, pos } = item;
        const { x, y, renderScale } = pos;

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
          const spotY = y + 20;
          const spotGrad = ctx.createRadialGradient(x, spotY, 5, x, spotY, 110 * renderScale);
          spotGrad.addColorStop(0, 'rgba(255, 230, 80, 0.7)');
          spotGrad.addColorStop(0.5, 'rgba(255, 0, 160, 0.35)');
          spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = spotGrad;
          ctx.beginPath();
          ctx.ellipse(x, spotY, 100 * renderScale, 30 * renderScale, 0, 0, Math.PI * 2);
          ctx.fill();

          // Rotating Neon Aura Ring
          ctx.save();
          ctx.translate(x, y - 35 * renderScale);
          ctx.strokeStyle = `hsl(${(now * 0.15) % 360}, 100%, 65%)`;
          ctx.lineWidth = 3;
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.ellipse(0, 0, 65 * renderScale, 22 * renderScale, Math.sin(now * 0.003) * 0.4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Shadow (for floor dancers)
        if (!dancer.isDj) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          const shadowScale = (1 - Math.max(0, 1.0 - dancer.y) / 2) * renderScale;
          if (shadowScale > 0) {
            ctx.ellipse(x, y + 20, Math.max(8, 38 * shadowScale), Math.max(3, 11 * shadowScale), 0, 0, Math.PI * 2);
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
          ctx.rotate(Math.sin(dancer.danceOffset) * 0.08);
        }

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

        // ==========================================
        // Floating Circular Avatar Badge & Nameplate above Head
        // ==========================================
        const headTopY = y - (115 * renderScale);
        const avatarRadius = Math.max(13, Math.round(17 * renderScale));
        const avatarCenterY = headTopY - avatarRadius - 4;
        const nameCenterY = avatarCenterY - avatarRadius - 10;

        // 1. Draw Floating Circular Avatar Badge
        ctx.save();
        
        // Draw Avatar Image (clipped to circle)
        let hasCustomAvatar = false;
        if (dancer.avatarUrl) {
          const avImg = getAvatarImg(dancer.avatarUrl);
          if (avImg && avImg.complete && avImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, avatarCenterY, avatarRadius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avImg, x - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            ctx.restore();
            hasCustomAvatar = true;
          }
        }

        // Fallback colored avatar with initial letter if no image
        if (!hasCustomAvatar) {
          ctx.beginPath();
          ctx.arc(x, avatarCenterY, avatarRadius, 0, Math.PI * 2);
          ctx.fillStyle = dancer.color || '#ff007f';
          ctx.fill();

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(11, Math.round(avatarRadius * 1.05))}px sans-serif`;
          ctx.fillText(dancer.name.charAt(0).toUpperCase() || '★', x, avatarCenterY + 1);
        }

        // Avatar Circular Border Ring
        ctx.beginPath();
        ctx.arc(x, avatarCenterY, avatarRadius, 0, Math.PI * 2);
        if (dancer.isDj) {
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 10;
        } else if (isFocused) {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 10;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 4;
        }
        ctx.stroke();

        // If DJ, draw floating crown on top of avatar
        if (dancer.isDj) {
          ctx.font = `${Math.max(14, Math.round(20 * renderScale))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 8;
          ctx.fillText('👑', x, avatarCenterY - avatarRadius + 2);
        }
        ctx.restore();

        // 2. Draw Nameplate Badge with background pill
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const fontSize = Math.max(11, Math.round(13 * renderScale));
        ctx.font = isFocused ? `bold ${fontSize + 2}px sans-serif` : `bold ${fontSize}px sans-serif`;

        const displayName = dancer.isDj ? `TOP DJ: ${dancer.name}` : dancer.name;
        const textMetrics = ctx.measureText(displayName);
        const pillWidth = textMetrics.width + 14;
        const pillHeight = fontSize + 8;

        // Pill background
        ctx.fillStyle = dancer.isDj ? 'rgba(30, 20, 0, 0.85)' : 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x - pillWidth / 2, nameCenterY - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
        } else {
          ctx.rect(x - pillWidth / 2, nameCenterY - pillHeight / 2, pillWidth, pillHeight);
        }
        ctx.fill();

        // Pill border
        ctx.strokeStyle = dancer.isDj ? '#ffd700' : isFocused ? '#00f0ff' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text
        ctx.fillStyle = dancer.isDj ? '#ffd700' : isFocused ? '#ffffff' : dancer.color;
        ctx.fillText(displayName, x, nameCenterY);
        ctx.restore();

        ctx.restore();
      };

      // If camera is focused on a specific dancer, render background dancers blurred first
      if (focusedId) {
        // Render non-focused dancers with Depth-of-field blur
        for (const item of dancersWithPos) {
          if (item.dancer.id !== focusedId) {
            renderDancer(item, false, true);
          }
        }
        // Render the focused dancer in sharp focus on top
        const focusedItem = dancersWithPos.find((i) => i.dancer.id === focusedId);
        if (focusedItem) {
          renderDancer(focusedItem, true, false);
        }
      } else {
        // Normal mode: render all dancers sharp according to depth
        for (const item of dancersWithPos) {
          renderDancer(item, false, false);
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
