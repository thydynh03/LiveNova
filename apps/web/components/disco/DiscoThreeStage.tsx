'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DiscoEngine } from './disco-engine';

interface DiscoThreeStageProps {
  engine: DiscoEngine;
  videoUrl?: string;
  isMuted?: boolean;
}

export function DiscoThreeStage({ engine, videoUrl, isMuted = true }: DiscoThreeStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 600;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040308);
    scene.fog = new THREE.FogExp2(0x06040d, 0.022);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 150);
    camera.position.set(0, 5.5, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 2. Lighting System
    const ambientLight = new THREE.AmbientLight(0x221a38, 1.8);
    scene.add(ambientLight);

    const mainStageLight = new THREE.DirectionalLight(0x9060ff, 2.2);
    mainStageLight.position.set(0, 15, -5);
    scene.add(mainStageLight);

    // 3. 3D Club Architecture
    // 3.1 Main Reflective Dance Floor
    const floorGeo = new THREE.CylinderGeometry(15, 15.5, 0.4, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080812,
      roughness: 0.18,
      metalness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, -3);
    scene.add(floor);

    // Floor Glowing Ring Trim
    const floorRingGeo = new THREE.RingGeometry(14.8, 15.2, 48);
    const floorRingMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const floorRing = new THREE.Mesh(floorRingGeo, floorRingMat);
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.set(0, 0.01, -3);
    scene.add(floorRing);

    // 3.2 DJ Stage Platform (Elevated at Back Center)
    const djStageGeo = new THREE.CylinderGeometry(5.5, 6.0, 1.2, 32);
    const djStageMat = new THREE.MeshStandardMaterial({ color: 0x0f0b1a, roughness: 0.3, metalness: 0.7 });
    const djStage = new THREE.Mesh(djStageGeo, djStageMat);
    djStage.position.set(0, 0.6, -11.5);
    scene.add(djStage);

    // DJ Booth Table
    const djDeskGeo = new THREE.BoxGeometry(4.2, 1.1, 1.6);
    const djDeskMat = new THREE.MeshStandardMaterial({ color: 0x05040a, roughness: 0.2, metalness: 0.9 });
    const djDesk = new THREE.Mesh(djDeskGeo, djDeskMat);
    djDesk.position.set(0, 1.65, -11.0);
    scene.add(djDesk);

    // DJ Booth Front LED Neon Trim
    const djTrimGeo = new THREE.PlaneGeometry(4.0, 0.15);
    const djTrimMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const djTrim = new THREE.Mesh(djTrimGeo, djTrimMat);
    djTrim.position.set(0, 1.65, -10.19);
    scene.add(djTrim);

    // 3.3 Two VIP Podiums for Top 2 & Top 3 Dancers (Middle of Floor)
    // Left VIP Podium (Top 2)
    const leftPodiumGeo = new THREE.CylinderGeometry(1.5, 1.7, 0.9, 32);
    const leftPodiumMat = new THREE.MeshStandardMaterial({ color: 0x120c24, roughness: 0.2, metalness: 0.8 });
    const leftPodium = new THREE.Mesh(leftPodiumGeo, leftPodiumMat);
    leftPodium.position.set(-4.2, 0.45, -3.5);
    scene.add(leftPodium);

    const leftPodiumRing = new THREE.Mesh(
      new THREE.RingGeometry(1.45, 1.55, 32),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })
    );
    leftPodiumRing.rotation.x = -Math.PI / 2;
    leftPodiumRing.position.set(-4.2, 0.91, -3.5);
    scene.add(leftPodiumRing);

    // Right VIP Podium (Top 3)
    const rightPodiumGeo = new THREE.CylinderGeometry(1.5, 1.7, 0.9, 32);
    const rightPodiumMat = new THREE.MeshStandardMaterial({ color: 0x120c24, roughness: 0.2, metalness: 0.8 });
    const rightPodium = new THREE.Mesh(rightPodiumGeo, rightPodiumMat);
    rightPodium.position.set(4.2, 0.45, -3.5);
    scene.add(rightPodium);

    const rightPodiumRing = new THREE.Mesh(
      new THREE.RingGeometry(1.45, 1.55, 32),
      new THREE.MeshBasicMaterial({ color: 0xff007f, side: THREE.DoubleSide })
    );
    rightPodiumRing.rotation.x = -Math.PI / 2;
    rightPodiumRing.position.set(4.2, 0.91, -3.5);
    scene.add(rightPodiumRing);

    // 3.4 Massive 3D Curved LED Video Wall at the Back
    const videoCanvas = document.createElement('canvas');
    videoCanvas.width = 1024;
    videoCanvas.height = 512;
    const vCtx = videoCanvas.getContext('2d');

    const videoTexture = new THREE.CanvasTexture(videoCanvas);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    // Curved LED Screen Geometry
    const ledScreenGeo = new THREE.CylinderGeometry(15, 15, 6.8, 36, 1, true, Math.PI * 0.78, Math.PI * 0.44);
    const ledScreenMat = new THREE.MeshBasicMaterial({
      map: videoTexture,
      side: THREE.BackSide,
    });
    const ledScreen = new THREE.Mesh(ledScreenGeo, ledScreenMat);
    ledScreen.position.set(0, 4.6, -2.5);
    scene.add(ledScreen);

    // Screen Neon Border Frame
    const frameGeo = new THREE.CylinderGeometry(15.02, 15.02, 0.15, 36, 1, true, Math.PI * 0.78, Math.PI * 0.44);
    const frameTop = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.BackSide }));
    frameTop.position.set(0, 8.0, -2.5);
    scene.add(frameTop);

    const frameBottom = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.BackSide }));
    frameBottom.position.set(0, 1.2, -2.5);
    scene.add(frameBottom);

    // 3.5 Grand Circular Ceiling Trusses with Moving Spotlights (Image 2 style)
    const trussGroup = new THREE.Group();
    trussGroup.position.set(0, 8.5, -4);
    scene.add(trussGroup);

    // Outer & Inner Truss Rings
    const trussRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(8.5, 0.12, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.9, roughness: 0.3 })
    );
    trussRing1.rotation.x = Math.PI / 2;
    trussGroup.add(trussRing1);

    const trussRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(4.5, 0.12, 12, 36),
      new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.9, roughness: 0.3 })
    );
    trussRing2.rotation.x = Math.PI / 2;
    trussGroup.add(trussRing2);

    // 16 Moving Head Spotlight Beams
    const beamCount = 14;
    const beamMeshes: { mesh: THREE.Mesh; baseAngle: number; radius: number; speed: number; color: THREE.Color }[] = [];
    const beamColors = [
      new THREE.Color(0xff0055), // Hot Pink
      new THREE.Color(0x00ffff), // Cyan
      new THREE.Color(0x9d00ff), // Violet
      new THREE.Color(0xffea00), // Gold
      new THREE.Color(0x00ff88), // Neon Green
    ];

    for (let i = 0; i < beamCount; i++) {
      const radius = i % 2 === 0 ? 8.5 : 4.5;
      const baseAngle = (i / beamCount) * Math.PI * 2;
      const beamGeo = new THREE.ConeGeometry(0.8, 14, 16, 1, true);
      beamGeo.translate(0, -7, 0); // Origin at tip

      const beamColor = beamColors[i % beamColors.length];
      const beamMat = new THREE.MeshBasicMaterial({
        color: beamColor,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set(Math.cos(baseAngle) * radius, 0, Math.sin(baseAngle) * radius);
      trussGroup.add(beamMesh);

      beamMeshes.push({
        mesh: beamMesh,
        baseAngle,
        radius,
        speed: (i % 2 === 0 ? 1 : -1) * (0.8 + (i % 3) * 0.3),
        color: beamColor,
      });
    }

    // 3.6 VIP Downward Spotlight Cones for Top 2 & Top 3 Podiums
    const vipSpotLeft = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 8.5, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    vipSpotLeft.geometry.translate(0, -4.25, 0);
    vipSpotLeft.position.set(-4.2, 8.5, -3.5);
    scene.add(vipSpotLeft);

    const vipSpotRight = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 8.5, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff007f,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    vipSpotRight.geometry.translate(0, -4.25, 0);
    vipSpotRight.position.set(4.2, 8.5, -3.5);
    scene.add(vipSpotRight);

    // 3.7 Spark Particles Floating in the Air
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount; p++) {
      particlePositions[p * 3] = (Math.random() - 0.5) * 24;
      particlePositions[p * 3 + 1] = Math.random() * 9;
      particlePositions[p * 3 + 2] = (Math.random() - 0.5) * 24 - 4;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.12,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const sparkPoints = new THREE.Points(particleGeo, particleMat);
    scene.add(sparkPoints);

    // 4. Dancer Sprite Mesh Pool
    const textureLoader = new THREE.TextureLoader();
    const loadedTextures: Map<string, THREE.Texture> = new Map();

    const getSpriteTexture = (spriteId: string, frameIndex: number): THREE.Texture | null => {
      const padded = String(frameIndex % 10).padStart(3, '0');
      const path = `/assets/disco/Characters/${spriteId}/${padded}.png`;
      if (loadedTextures.has(path)) {
        return loadedTextures.get(path)!;
      }
      const tex = textureLoader.load(path);
      tex.minFilter = THREE.LinearFilter;
      loadedTextures.set(path, tex);
      return tex;
    };

    // Helper to generate 3D Floating Nameplate Badge Textures
    const badgeTextureCache = new Map<string, THREE.CanvasTexture>();
    const getBadgeTexture = (name: string, points: number, rankType: 'dj' | 'top2' | 'top3' | 'normal', color: string): THREE.CanvasTexture => {
      const key = `${name}_${points}_${rankType}`;
      if (badgeTextureCache.has(key)) return badgeTextureCache.get(key)!;

      const c = document.createElement('canvas');
      c.width = 384;
      c.height = 128;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 384, 128);

        let title = name;
        let badgeColor = color;
        let borderColor = 'rgba(255, 255, 255, 0.4)';
        let bgGrad = 'rgba(10, 10, 20, 0.85)';

        if (rankType === 'dj') {
          title = `👑 TOP 1 DJ: ${name} (${points || 10}đ)`;
          badgeColor = '#ffd700';
          borderColor = '#ffd700';
          bgGrad = 'rgba(30, 20, 0, 0.92)';
        } else if (rankType === 'top2') {
          title = `🥈 TOP 2: ${name} (${points}đ)`;
          badgeColor = '#00f0ff';
          borderColor = '#00f0ff';
          bgGrad = 'rgba(0, 20, 30, 0.92)';
        } else if (rankType === 'top3') {
          title = `🥉 TOP 3: ${name} (${points}đ)`;
          badgeColor = '#ff007f';
          borderColor = '#ff007f';
          bgGrad = 'rgba(30, 0, 20, 0.92)';
        } else if (points > 0) {
          title = `${name} (${points}đ)`;
        }

        // Draw Pill
        const pillW = Math.min(370, ctx.measureText(title).width * 1.5 + 40);
        const pillH = 46;
        const px = (384 - pillW) / 2;
        const py = 40;

        ctx.fillStyle = bgGrad;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(px, py, pillW, pillH, 23);
        } else {
          ctx.rect(px, py, pillW, pillH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = badgeColor;
        ctx.fillText(title, 192, py + pillH / 2);
      }

      const tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      badgeTextureCache.set(key, tex);
      return tex;
    };

    // Dancer Meshes Group
    const dancersGroup = new THREE.Group();
    scene.add(dancersGroup);

    interface DancerMeshEntry {
      spriteMesh: THREE.Sprite;
      badgeMesh: THREE.Sprite;
      dancerId: string;
      targetPos: THREE.Vector3;
    }
    const dancerMeshesMap = new Map<string, DancerMeshEntry>();

    // 5. Video Element setup for 3D Video Wall
    let videoEl: HTMLVideoElement | null = null;
    if (videoUrl && !videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
      videoEl = document.createElement('video');
      videoEl.src = videoUrl;
      videoEl.crossOrigin = 'anonymous';
      videoEl.loop = true;
      videoEl.muted = isMuted;
      videoEl.playsInline = true;
      videoEl.play().catch(() => {});
      videoRef.current = videoEl;
    }

    // 6. Camera Orbit & Dynamic Director State
    let isUserDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let userYaw = 0;
    let userPitch = 0.15;
    let userDist = 14;
    let lastUserInteract = 0;

    const handleMouseDown = (e: MouseEvent) => {
      isUserDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      lastUserInteract = Date.now();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isUserDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      userYaw -= dx * 0.005;
      userPitch = Math.max(-0.25, Math.min(0.55, userPitch + dy * 0.005));
      lastUserInteract = Date.now();
    };

    const handleMouseUp = () => {
      isUserDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      userDist = Math.max(6, Math.min(22, userDist + e.deltaY * 0.01));
      lastUserInteract = Date.now();
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: true });

    // 7. Animation Loop
    let animId: number;
    let lastTime = performance.now();

    const renderLoop = (time: number) => {
      animId = requestAnimationFrame(renderLoop);
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      const nowSec = time * 0.001;

      // 7.1 Update LED Video Screen Canvas Texture
      if (vCtx) {
        if (videoEl && !videoEl.paused && videoEl.readyState >= 2) {
          vCtx.drawImage(videoEl, 0, 0, 1024, 512);
        } else {
          // Dynamic Futuristic Cyber Equalizer & Neon Waves
          vCtx.fillStyle = '#04020a';
          vCtx.fillRect(0, 0, 1024, 512);

          // Neon Grid Horizon
          vCtx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
          vCtx.lineWidth = 1.5;
          for (let gy = 256; gy < 512; gy += 32) {
            vCtx.beginPath();
            vCtx.moveTo(0, gy);
            vCtx.lineTo(1024, gy);
            vCtx.stroke();
          }

          // Audio Spectrum Bars
          const numBars = 32;
          const barWidth = 1024 / numBars;
          for (let b = 0; b < numBars; b++) {
            const h = Math.abs(Math.sin(nowSec * 5 + b * 0.35)) * 260 + 40;
            const grad = vCtx.createLinearGradient(0, 512 - h, 0, 512);
            grad.addColorStop(0, b % 2 === 0 ? '#ff007f' : '#00f0ff');
            grad.addColorStop(1, '#6600ff');
            vCtx.fillStyle = grad;
            vCtx.fillRect(b * barWidth + 4, 512 - h, barWidth - 8, h);
          }

          // Center Live Cyber Logo
          vCtx.textAlign = 'center';
          vCtx.textBaseline = 'middle';
          vCtx.font = '900 48px sans-serif';
          vCtx.fillStyle = '#00f0ff';
          vCtx.shadowColor = '#00f0ff';
          vCtx.shadowBlur = 25;
          vCtx.fillText('⚡ LIVENOVA 3D CLUB ⚡', 512, 180);
        }
        videoTexture.needsUpdate = true;
      }

      // 7.2 Animate 16 Moving Head Spotlight Beams (Image 2 style)
      beamMeshes.forEach((beam) => {
        const sweepAngle = Math.sin(nowSec * beam.speed) * 0.55;
        const targetX = Math.cos(beam.baseAngle + sweepAngle) * (beam.radius * 0.8);
        const targetZ = Math.sin(beam.baseAngle + sweepAngle) * (beam.radius * 0.8) - 3;
        beam.mesh.lookAt(targetX, 0, targetZ);
        beam.mesh.rotateX(Math.PI / 2);
      });

      // 7.3 Rotate Ceiling Truss slowly
      trussGroup.rotation.y = nowSec * 0.04;

      // 7.4 Floating Dust/Sparks
      const posAttr = sparkPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let p = 0; p < particleCount; p++) {
        let py = posAttr.getY(p) - dt * 0.4;
        if (py < 0) py = 9;
        posAttr.setY(p, py);
      }
      posAttr.needsUpdate = true;

      // 7.5 Update Dancers, Top 1 DJ, Top 2, and Top 3 VIP Podiums
      const topDancers = engine.getTopDancers(3);
      const top1 = topDancers[0] || null;
      const top2 = topDancers[1] || null;
      const top3 = topDancers[2] || null;

      const activeDancers = Array.from(engine.dancers.values());
      const currentIds = new Set<string>();

      activeDancers.forEach((dancer) => {
        currentIds.add(dancer.id);
        let entry = dancerMeshesMap.get(dancer.id);

        if (!entry) {
          const spriteMat = new THREE.SpriteMaterial({
            transparent: true,
            depthWrite: false,
          });
          const spriteMesh = new THREE.Sprite(spriteMat);

          const badgeMat = new THREE.SpriteMaterial({
            transparent: true,
            depthWrite: false,
          });
          const badgeMesh = new THREE.Sprite(badgeMat);

          dancersGroup.add(spriteMesh);
          dancersGroup.add(badgeMesh);

          entry = {
            spriteMesh,
            badgeMesh,
            dancerId: dancer.id,
            targetPos: new THREE.Vector3(),
          };
          dancerMeshesMap.set(dancer.id, entry);
        }

        // Determine Role and Position
        const isTop1 = top1 && top1.id === dancer.id;
        const isTop2 = top2 && top2.id === dancer.id;
        const isTop3 = top3 && top3.id === dancer.id;

        let posX = 0;
        let posY = 1.0;
        let posZ = 0;
        let scale = 1.8 * (dancer.scale || 1);

        if (isTop1 || dancer.isDj) {
          // Elevated DJ Booth Position
          posX = 0;
          posY = 2.45;
          posZ = -11.0;
          scale = 2.2;
        } else if (isTop2) {
          // Left VIP Stage Podium
          posX = -4.2;
          posY = 1.85;
          posZ = -3.5;
          scale = 2.1;
        } else if (isTop3) {
          // Right VIP Stage Podium
          posX = 4.2;
          posY = 1.85;
          posZ = -3.5;
          scale = 2.1;
        } else {
          // General Dancers scattered on Dance Floor
          posX = (dancer.x - 0.5) * 18;
          posZ = (dancer.z - 0.5) * 12 - 2;
          posY = 0.95;
        }

        // Bobbing & Jump physics
        const bob = Math.abs(Math.sin(nowSec * 8 + dancer.danceOffset)) * 0.22;
        posY += bob + Math.max(0, -dancer.vy * 0.4);

        entry.targetPos.set(posX, posY, posZ);
        entry.spriteMesh.position.lerp(entry.targetPos, 0.2);
        entry.spriteMesh.scale.set(scale, scale, 1);

        // Frame animation for dancer sprite
        const frameIdx = Math.floor(nowSec * 15 + dancer.danceOffset * 5) % 10;
        const spriteId = (isTop2 || isTop3) ? 'hanhan_video_dance' : dancer.spriteId;
        const tex = getSpriteTexture(spriteId, frameIdx);
        if (tex) {
          entry.spriteMesh.material.map = tex;
          entry.spriteMesh.material.needsUpdate = true;
        }

        // Badge Position & Texture
        entry.badgeMesh.position.set(entry.spriteMesh.position.x, entry.spriteMesh.position.y + scale * 0.58, entry.spriteMesh.position.z);
        entry.badgeMesh.scale.set(2.4, 0.8, 1);

        const rankType = isTop1 || dancer.isDj ? 'dj' : isTop2 ? 'top2' : isTop3 ? 'top3' : 'normal';
        const badgeTex = getBadgeTexture(dancer.name, dancer.points || 0, rankType, dancer.color);
        entry.badgeMesh.material.map = badgeTex;
        entry.badgeMesh.material.needsUpdate = true;
      });

      // Clean up left dancers
      dancerMeshesMap.forEach((entry, id) => {
        if (!currentIds.has(id)) {
          dancersGroup.remove(entry.spriteMesh);
          dancersGroup.remove(entry.badgeMesh);
          dancerMeshesMap.delete(id);
        }
      });

      // 7.6 3D Camera Director & Smooth Movement
      const isManual = Date.now() - lastUserInteract < 5000;
      const targetCamPos = new THREE.Vector3(0, 5.5, 14);
      const targetLookAt = new THREE.Vector3(0, 1.6, -3.5);

      if (isManual) {
        // Manual User Orbit
        targetCamPos.x = Math.sin(userYaw) * userDist;
        targetCamPos.z = Math.cos(userYaw) * userDist - 3;
        targetCamPos.y = Math.max(1.5, 4 + Math.sin(userPitch) * userDist);
        targetLookAt.set(0, 1.5, -3.5);
      } else {
        // Automated Concert Camera Director Modes
        const shot = engine.currentShotType;
        if (shot === 'DJ_POV') {
          // Point of View of the DJ looking down from Booth onto the Crowd & VIP Podiums!
          targetCamPos.set(0, 3.2, -11.6);
          targetLookAt.set(0, 1.2, 0.5);
        } else if (shot === 'SPOTLIGHT_ZOOM') {
          // Zoom into VIP Podiums & Stage
          const targetX = Math.sin(nowSec * 0.5) * 4;
          targetCamPos.set(targetX, 2.8, 4.5);
          targetLookAt.set(targetX * 0.6, 1.8, -3.5);
        } else if (shot === 'CRANE_SWOOP') {
          // High swooping crane camera
          targetCamPos.set(Math.sin(nowSec * 0.4) * 8, 8.5 + Math.cos(nowSec * 0.3) * 2.5, 11);
          targetLookAt.set(0, 1.4, -4);
        } else {
          // WIDE_ORBIT - Smooth wide circling
          const orbitAngle = nowSec * 0.22;
          targetCamPos.set(Math.sin(orbitAngle) * 15, 6.2 + Math.sin(nowSec * 0.3) * 1.5, Math.cos(orbitAngle) * 14 - 3);
          targetLookAt.set(0, 1.6, -3.5);
        }
      }

      camera.position.lerp(targetCamPos, 0.045);
      camera.lookAt(targetLookAt);

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(renderLoop);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || 800;
      height = container.clientHeight || 600;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [engine, videoUrl, isMuted]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grab',
        touchAction: 'none',
      }}
    />
  );
}
