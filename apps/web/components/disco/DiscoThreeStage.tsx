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

    // 1. Scene, Camera, Fog & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06030c);
    scene.fog = new THREE.FogExp2(0x070412, 0.024);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 150);
    camera.position.set(0, 5.2, 14);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // 2. Texture & Asset Loaders
    const textureLoader = new THREE.TextureLoader();

    // 3. Lighting System
    const ambientLight = new THREE.AmbientLight(0x281a42, 2.0);
    scene.add(ambientLight);

    const stageKeyLight = new THREE.DirectionalLight(0xa060ff, 2.5);
    stageKeyLight.position.set(0, 16, -2);
    scene.add(stageKeyLight);

    const beatPointLight = new THREE.PointLight(0x00f0ff, 3.0, 30);
    beatPointLight.position.set(0, 7, -3);
    scene.add(beatPointLight);

    // 4. 3D Club Enclosure (Photorealistic Club Panorama Walls - No Black Void)
    const clubBgTex = textureLoader.load('/assets/disco/Stage/premium-stage-v2.png');
    clubBgTex.wrapS = THREE.RepeatWrapping;
    clubBgTex.wrapT = THREE.ClampToEdgeWrapping;
    clubBgTex.repeat.set(1.4, 1);

    const clubWallGeo = new THREE.CylinderGeometry(28, 28, 22, 48, 1, true, -Math.PI * 0.9, Math.PI * 1.8);
    const clubWallMat = new THREE.MeshBasicMaterial({
      map: clubBgTex,
      side: THREE.BackSide,
      color: 0x8877aa,
    });
    const clubWall = new THREE.Mesh(clubWallGeo, clubWallMat);
    clubWall.position.set(0, 7.5, -4);
    scene.add(clubWall);

    // 5. Pulsating Beat-Synced Disco Dance Floor with Flashing Checkered Tiles
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fCtx = floorCanvas.getContext('2d');

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;

    const floorGeo = new THREE.CylinderGeometry(15.5, 16.0, 0.4, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.15,
      metalness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, -3);
    scene.add(floor);

    // Neon Floor Rim Ring
    const floorRimGeo = new THREE.RingGeometry(15.4, 15.8, 48);
    const floorRimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const floorRim = new THREE.Mesh(floorRimGeo, floorRimMat);
    floorRim.rotation.x = -Math.PI / 2;
    floorRim.position.set(0, 0.02, -3);
    scene.add(floorRim);

    // 6. DJ Stage Platform & Booth Table (Elevated at Back Center)
    const djStageGeo = new THREE.CylinderGeometry(5.8, 6.4, 1.3, 32);
    const djStageMat = new THREE.MeshStandardMaterial({ color: 0x140d24, roughness: 0.25, metalness: 0.8 });
    const djStage = new THREE.Mesh(djStageGeo, djStageMat);
    djStage.position.set(0, 0.65, -11.5);
    scene.add(djStage);

    // DJ Stage Neon Edge Rings
    const djStageRing = new THREE.Mesh(
      new THREE.RingGeometry(5.75, 5.95, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide })
    );
    djStageRing.rotation.x = -Math.PI / 2;
    djStageRing.position.set(0, 1.31, -11.5);
    scene.add(djStageRing);

    // DJ Console Table
    const djDeskGeo = new THREE.BoxGeometry(4.4, 1.15, 1.7);
    const djDeskMat = new THREE.MeshStandardMaterial({ color: 0x07060f, roughness: 0.2, metalness: 0.9 });
    const djDesk = new THREE.Mesh(djDeskGeo, djDeskMat);
    djDesk.position.set(0, 1.72, -11.0);
    scene.add(djDesk);

    // DJ Console Front LED Neon Display Trim
    const djTrimGeo = new THREE.PlaneGeometry(4.2, 0.2);
    const djTrimMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    const djTrim = new THREE.Mesh(djTrimGeo, djTrimMat);
    djTrim.position.set(0, 1.72, -10.14);
    scene.add(djTrim);

    // 7. Concert Subwoofer Speaker Stacks on Left and Right of DJ Booth
    const speakerMat = new THREE.MeshStandardMaterial({ color: 0x0a0914, roughness: 0.3, metalness: 0.8 });
    const wooferMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    const createSpeakerStack = (x: number) => {
      const group = new THREE.Group();
      group.position.set(x, 2.2, -10.5);

      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 1.4), speakerMat);
      group.add(cabinet);

      // Woofer Cones
      for (let w = 0; w < 3; w++) {
        const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), wooferMat);
        woofer.rotation.x = Math.PI / 2;
        woofer.position.set(0, 0.9 - w * 0.9, 0.71);
        group.add(woofer);
      }
      return group;
    };
    const speakerLeft = createSpeakerStack(-7.2);
    const speakerRight = createSpeakerStack(7.2);
    scene.add(speakerLeft);
    scene.add(speakerRight);

    // 8. VIP Podiums for Top 2 & Top 3 Dancers (Middle of Dance Floor)
    // 8.1 Left VIP Podium (Top 2 Gifter)
    const leftPodiumGeo = new THREE.CylinderGeometry(1.6, 1.85, 0.95, 32);
    const leftPodiumMat = new THREE.MeshStandardMaterial({ color: 0x0e1428, roughness: 0.15, metalness: 0.85 });
    const leftPodium = new THREE.Mesh(leftPodiumGeo, leftPodiumMat);
    leftPodium.position.set(-4.2, 0.48, -3.5);
    scene.add(leftPodium);

    const leftPodiumRing = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.68, 32),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })
    );
    leftPodiumRing.rotation.x = -Math.PI / 2;
    leftPodiumRing.position.set(-4.2, 0.96, -3.5);
    scene.add(leftPodiumRing);

    // 8.2 Right VIP Podium (Top 3 Gifter)
    const rightPodiumGeo = new THREE.CylinderGeometry(1.6, 1.85, 0.95, 32);
    const rightPodiumMat = new THREE.MeshStandardMaterial({ color: 0x280e1a, roughness: 0.15, metalness: 0.85 });
    const rightPodium = new THREE.Mesh(rightPodiumGeo, rightPodiumMat);
    rightPodium.position.set(4.2, 0.48, -3.5);
    scene.add(rightPodium);

    const rightPodiumRing = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.68, 32),
      new THREE.MeshBasicMaterial({ color: 0xff007f, side: THREE.DoubleSide })
    );
    rightPodiumRing.rotation.x = -Math.PI / 2;
    rightPodiumRing.position.set(4.2, 0.96, -3.5);
    scene.add(rightPodiumRing);

    // 9. Massive 3D Curved LED Video Wall at the Back (Orientation Fixed - Not Mirrored)
    const videoCanvas = document.createElement('canvas');
    videoCanvas.width = 1024;
    videoCanvas.height = 512;
    const vCtx = videoCanvas.getContext('2d');

    const videoTexture = new THREE.CanvasTexture(videoCanvas);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    // Curved LED Screen Geometry (Using standard plane with curve offset or proper UV cylinder arc)
    const ledScreenGeo = new THREE.CylinderGeometry(15, 15, 7.2, 40, 1, true, Math.PI * 0.78, Math.PI * 0.44);
    // Flip UVs horizontally so video/text isn't mirrored
    const uvs = ledScreenGeo.attributes.uv;
    for (let u = 0; u < uvs.count; u++) {
      uvs.setX(u, 1 - uvs.getX(u));
    }
    uvs.needsUpdate = true;

    const ledScreenMat = new THREE.MeshBasicMaterial({
      map: videoTexture,
      side: THREE.BackSide,
    });
    const ledScreen = new THREE.Mesh(ledScreenGeo, ledScreenMat);
    ledScreen.position.set(0, 4.8, -2.5);
    scene.add(ledScreen);

    // Glowing Neon Frames on LED Video Wall
    const frameGeo = new THREE.CylinderGeometry(15.02, 15.02, 0.16, 40, 1, true, Math.PI * 0.78, Math.PI * 0.44);
    const frameTop = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.BackSide }));
    frameTop.position.set(0, 8.4, -2.5);
    scene.add(frameTop);

    const frameBottom = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.BackSide }));
    frameBottom.position.set(0, 1.2, -2.5);
    scene.add(frameBottom);

    // 10. Grand Circular Ceiling Trusses with Moving Head Spotlights (Image 2 style)
    const trussGroup = new THREE.Group();
    trussGroup.position.set(0, 8.8, -4);
    scene.add(trussGroup);

    // Concentric Metal Truss Rings
    const trussRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(8.8, 0.14, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0x18182e, metalness: 0.9, roughness: 0.25 })
    );
    trussRing1.rotation.x = Math.PI / 2;
    trussGroup.add(trussRing1);

    const trussRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(4.8, 0.14, 12, 36),
      new THREE.MeshStandardMaterial({ color: 0x18182e, metalness: 0.9, roughness: 0.25 })
    );
    trussRing2.rotation.x = Math.PI / 2;
    trussGroup.add(trussRing2);

    // 16 Moving Head Spotlight Volumetric Beam Cones
    const beamCount = 14;
    const beamMeshes: { mesh: THREE.Mesh; baseAngle: number; radius: number; speed: number; color: THREE.Color }[] = [];
    const beamColors = [
      new THREE.Color(0xff0077), // Hot Pink
      new THREE.Color(0x00f0ff), // Cyan
      new THREE.Color(0xaa00ff), // Electric Violet
      new THREE.Color(0xffd700), // Gold
      new THREE.Color(0x00ff99), // Neon Emerald
    ];

    for (let i = 0; i < beamCount; i++) {
      const radius = i % 2 === 0 ? 8.8 : 4.8;
      const baseAngle = (i / beamCount) * Math.PI * 2;
      const beamGeo = new THREE.ConeGeometry(0.9, 15, 18, 1, true);
      beamGeo.translate(0, -7.5, 0); // Pivot at tip

      const beamColor = beamColors[i % beamColors.length];
      const beamMat = new THREE.MeshBasicMaterial({
        color: beamColor,
        transparent: true,
        opacity: 0.35,
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
        speed: (i % 2 === 0 ? 1 : -1) * (0.85 + (i % 3) * 0.35),
        color: beamColor,
      });
    }

    // 11. Downward VIP Spotlights on Left and Right Podiums
    const createVipSpotlight = (x: number, hexColor: number) => {
      const spotMesh = new THREE.Mesh(
        new THREE.ConeGeometry(2.0, 9.0, 24, 1, true),
        new THREE.MeshBasicMaterial({
          color: hexColor,
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      spotMesh.geometry.translate(0, -4.5, 0);
      spotMesh.position.set(x, 8.8, -3.5);
      return spotMesh;
    };
    const vipSpotLeft = createVipSpotlight(-4.2, 0x00f0ff);
    const vipSpotRight = createVipSpotlight(4.2, 0xff007f);
    scene.add(vipSpotLeft);
    scene.add(vipSpotRight);

    // 12. Volumetric Stage Smoke & Haze Layers (Mờ ảo có khói)
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = 128;
    smokeCanvas.height = 128;
    const sCtx = smokeCanvas.getContext('2d');
    if (sCtx) {
      const radGrad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      radGrad.addColorStop(0, 'rgba(180, 150, 255, 0.45)');
      radGrad.addColorStop(0.5, 'rgba(80, 180, 255, 0.22)');
      radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = radGrad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const smokeTexture = new THREE.CanvasTexture(smokeCanvas);

    const smokeGroup = new THREE.Group();
    scene.add(smokeGroup);

    const smokeCount = 14;
    const smokePlanes: { mesh: THREE.Mesh; rotSpeed: number; initX: number; initZ: number }[] = [];
    const smokeGeo = new THREE.PlaneGeometry(8, 8);

    for (let s = 0; s < smokeCount; s++) {
      const smokeMat = new THREE.MeshBasicMaterial({
        map: smokeTexture,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const sMesh = new THREE.Mesh(smokeGeo, smokeMat);
      const angle = (s / smokeCount) * Math.PI * 2;
      const dist = Math.random() * 8 + 2;
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist - 3;
      const py = Math.random() * 1.8 + 0.5;
      sMesh.position.set(px, py, pz);
      sMesh.rotation.x = -Math.PI / 2;
      sMesh.rotation.z = Math.random() * Math.PI;
      smokeGroup.add(sMesh);

      smokePlanes.push({
        mesh: sMesh,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        initX: px,
        initZ: pz,
      });
    }

    // 13. Animated Crossing Laser Beams
    const laserCount = 8;
    const laserGroup = new THREE.Group();
    scene.add(laserGroup);

    const laserLines: { line: THREE.Line; speed: number; baseAngle: number; color: number }[] = [];
    for (let l = 0; l < laserCount; l++) {
      const laserGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 8.8, -4),
        new THREE.Vector3(Math.sin(l) * 14, 0.1, Math.cos(l) * 14 - 3),
      ]);
      const laserCol = l % 2 === 0 ? 0x00ffff : 0xff0055;
      const laserMat = new THREE.LineBasicMaterial({
        color: laserCol,
        linewidth: 2,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(laserGeo, laserMat);
      laserGroup.add(line);
      laserLines.push({
        line,
        speed: (l % 2 === 0 ? 1 : -1) * (0.8 + l * 0.2),
        baseAngle: l * 0.8,
        color: laserCol,
      });
    }

    // 14. Floating Sparks/Dust in Air
    const particleCount = 220;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount; p++) {
      particlePositions[p * 3] = (Math.random() - 0.5) * 26;
      particlePositions[p * 3 + 1] = Math.random() * 9.5;
      particlePositions[p * 3 + 2] = (Math.random() - 0.5) * 26 - 4;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.14,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const sparkPoints = new THREE.Points(particleGeo, particleMat);
    scene.add(sparkPoints);

    // 15. Dancer Sprites & Floating 3D Nameplates Pool
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
        let bgGrad = 'rgba(10, 10, 20, 0.88)';

        if (rankType === 'dj') {
          title = `👑 TOP 1 DJ: ${name} (${points || 10}đ)`;
          badgeColor = '#ffd700';
          borderColor = '#ffd700';
          bgGrad = 'rgba(35, 25, 0, 0.94)';
        } else if (rankType === 'top2') {
          title = `🥈 TOP 2 VIP: ${name} (${points}đ)`;
          badgeColor = '#00f0ff';
          borderColor = '#00f0ff';
          bgGrad = 'rgba(0, 25, 35, 0.94)';
        } else if (rankType === 'top3') {
          title = `🥉 TOP 3 VIP: ${name} (${points}đ)`;
          badgeColor = '#ff007f';
          borderColor = '#ff007f';
          bgGrad = 'rgba(35, 0, 25, 0.94)';
        } else if (points > 0) {
          title = `${name} (${points}đ)`;
        }

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

    const dancersGroup = new THREE.Group();
    scene.add(dancersGroup);

    interface DancerMeshEntry {
      spriteMesh: THREE.Sprite;
      badgeMesh: THREE.Sprite;
      dancerId: string;
      targetPos: THREE.Vector3;
    }
    const dancerMeshesMap = new Map<string, DancerMeshEntry>();

    // 16. Video Element setup for 3D Video Wall
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

    // 17. Camera Orbit & Drag State
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

    // 18. Main Animation & Render Loop
    let animId: number;
    let lastTime = performance.now();

    const renderLoop = (time: number) => {
      animId = requestAnimationFrame(renderLoop);
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      const nowSec = time * 0.001;

      // 18.1 Render Animated Pulsating Checkered Dance Floor Tiles
      if (fCtx) {
        fCtx.fillStyle = '#06040d';
        fCtx.fillRect(0, 0, 512, 512);

        const cols = 8;
        const tileSize = 512 / cols;

        for (let r = 0; r < cols; r++) {
          for (let c = 0; c < cols; c++) {
            const tileIdx = r * cols + c;
            const tilePhase = Math.sin(nowSec * 6 + tileIdx * 0.7);
            const isLit = tilePhase > 0.15;

            const tx = c * tileSize;
            const ty = r * tileSize;

            if (isLit) {
              const palColor = (tileIdx + Math.floor(nowSec * 2)) % 4;
              let hex = '#ff007f';
              if (palColor === 1) hex = '#00f0ff';
              else if (palColor === 2) hex = '#aa00ff';
              else if (palColor === 3) hex = '#ffd700';

              fCtx.fillStyle = hex;
              fCtx.shadowColor = hex;
              fCtx.shadowBlur = 15;
              fCtx.fillRect(tx + 4, ty + 4, tileSize - 8, tileSize - 8);
              fCtx.shadowBlur = 0;
            } else {
              fCtx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
              fCtx.lineWidth = 1;
              fCtx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
            }
          }
        }

        // Radiating pulse ring from center
        const pulseR = ((nowSec * 140) % 256) + 20;
        fCtx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
        fCtx.lineWidth = 4;
        fCtx.beginPath();
        fCtx.arc(256, 256, pulseR, 0, Math.PI * 2);
        fCtx.stroke();

        floorTexture.needsUpdate = true;
      }

      // 18.2 Beat-synced Point Light & Strobe
      const beatInt = Math.max(0.8, Math.sin(nowSec * 10) ** 3 * 3.5);
      beatPointLight.intensity = beatInt;

      // 18.3 Render Curved LED Video Wall Texture
      if (vCtx) {
        if (videoEl && !videoEl.paused && videoEl.readyState >= 2) {
          vCtx.drawImage(videoEl, 0, 0, 1024, 512);
        } else {
          // Cyber Visualizer Spectrum
          vCtx.fillStyle = '#05020c';
          vCtx.fillRect(0, 0, 1024, 512);

          // Grid lines
          vCtx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
          vCtx.lineWidth = 1.5;
          for (let gy = 260; gy < 512; gy += 30) {
            vCtx.beginPath();
            vCtx.moveTo(0, gy);
            vCtx.lineTo(1024, gy);
            vCtx.stroke();
          }

          // Spectrum Bars
          const numBars = 32;
          const barWidth = 1024 / numBars;
          for (let b = 0; b < numBars; b++) {
            const h = Math.abs(Math.sin(nowSec * 6 + b * 0.35)) * 260 + 35;
            const grad = vCtx.createLinearGradient(0, 512 - h, 0, 512);
            grad.addColorStop(0, b % 2 === 0 ? '#ff007f' : '#00f0ff');
            grad.addColorStop(1, '#6600ff');
            vCtx.fillStyle = grad;
            vCtx.fillRect(b * barWidth + 3, 512 - h, barWidth - 6, h);
          }

          // Live Cyber Title (Left to Right text)
          vCtx.textAlign = 'center';
          vCtx.textBaseline = 'middle';
          vCtx.font = '900 48px sans-serif';
          vCtx.fillStyle = '#00f0ff';
          vCtx.shadowColor = '#00f0ff';
          vCtx.shadowBlur = 25;
          vCtx.fillText('⚡ LIVENOVA 3D CLUB ⚡', 512, 160);
          vCtx.shadowBlur = 0;
        }
        videoTexture.needsUpdate = true;
      }

      // 18.4 Animate Moving Head Spotlights (Image 2 style)
      beamMeshes.forEach((beam) => {
        const sweepAngle = Math.sin(nowSec * beam.speed) * 0.65;
        const targetX = Math.cos(beam.baseAngle + sweepAngle) * (beam.radius * 0.85);
        const targetZ = Math.sin(beam.baseAngle + sweepAngle) * (beam.radius * 0.85) - 3;
        beam.mesh.lookAt(targetX, 0, targetZ);
        beam.mesh.rotateX(Math.PI / 2);
      });

      // 18.5 Slowly Rotate Ceiling Truss
      trussGroup.rotation.y = nowSec * 0.045;

      // 18.6 Animate Stage Smoke / Fog Billowing Across Floor
      smokePlanes.forEach((sp, idx) => {
        sp.mesh.rotation.z += sp.rotSpeed * dt;
        sp.mesh.position.x = sp.initX + Math.sin(nowSec * 0.5 + idx) * 1.5;
        sp.mesh.position.z = sp.initZ + Math.cos(nowSec * 0.4 + idx) * 1.2;
      });

      // 18.7 Animate Crossing Laser Beams
      laserLines.forEach((laser) => {
        const lAngle = laser.baseAngle + Math.sin(nowSec * laser.speed) * 0.8;
        const tx = Math.sin(lAngle) * 14;
        const tz = Math.cos(lAngle) * 14 - 3;
        const posAttr = laser.line.geometry.attributes.position as THREE.BufferAttribute;
        posAttr.setXYZ(1, tx, 0.05, tz);
        posAttr.needsUpdate = true;
      });

      // 18.8 Floating Dust & Light Sparks
      const posAttr = sparkPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let p = 0; p < particleCount; p++) {
        let py = posAttr.getY(p) - dt * 0.35;
        if (py < 0) py = 9.5;
        posAttr.setY(p, py);
      }
      posAttr.needsUpdate = true;

      // 18.9 Update Dancers, Top 1 DJ, and Top 2 & Top 3 VIP Podiums
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

        // Determine Role and Position in 3D Space
        const isTop1 = top1 && top1.id === dancer.id;
        const isTop2 = top2 && top2.id === dancer.id;
        const isTop3 = top3 && top3.id === dancer.id;

        let posX = 0;
        let posY = 1.0;
        let posZ = 0;
        let scale = 1.85 * (dancer.scale || 1);

        if (isTop1 || dancer.isDj) {
          // Elevated Top 1 DJ Booth Position
          posX = 0;
          posY = 2.55;
          posZ = -11.0;
          scale = 2.3;
        } else if (isTop2) {
          // Left VIP Stage Podium (Top 2 Gifter)
          posX = -4.2;
          posY = 1.95;
          posZ = -3.5;
          scale = 2.2;
        } else if (isTop3) {
          // Right VIP Stage Podium (Top 3 Gifter)
          posX = 4.2;
          posY = 1.95;
          posZ = -3.5;
          scale = 2.2;
        } else {
          // Audience Dancers scattered on Dance Floor in layered depth
          posX = (dancer.x - 0.5) * 18;
          posZ = (dancer.z - 0.5) * 12 - 2;
          posY = 0.98;
        }

        // Bobbing & Jump physics
        const bob = Math.abs(Math.sin(nowSec * 8.5 + dancer.danceOffset)) * 0.25;
        posY += bob + Math.max(0, -dancer.vy * 0.4);

        entry.targetPos.set(posX, posY, posZ);
        entry.spriteMesh.position.lerp(entry.targetPos, 0.2);
        entry.spriteMesh.scale.set(scale, scale, 1);

        // Frame animation for dancer sprite (Top 2 & Top 3 use hot dancing female sprite 'hanhan_video_dance')
        const frameIdx = Math.floor(nowSec * 16 + dancer.danceOffset * 5) % 10;
        const spriteId = (isTop2 || isTop3) ? 'hanhan_video_dance' : dancer.spriteId;
        const tex = getSpriteTexture(spriteId, frameIdx);
        if (tex) {
          entry.spriteMesh.material.map = tex;
          entry.spriteMesh.material.needsUpdate = true;
        }

        // Badge Position & Texture
        entry.badgeMesh.position.set(entry.spriteMesh.position.x, entry.spriteMesh.position.y + scale * 0.58, entry.spriteMesh.position.z);
        entry.badgeMesh.scale.set(2.5, 0.82, 1);

        const rankType = isTop1 || dancer.isDj ? 'dj' : isTop2 ? 'top2' : isTop3 ? 'top3' : 'normal';
        const badgeTex = getBadgeTexture(dancer.name, dancer.points || 0, rankType, dancer.color);
        entry.badgeMesh.material.map = badgeTex;
        entry.badgeMesh.material.needsUpdate = true;
      });

      // Clean up removed dancers
      dancerMeshesMap.forEach((entry, id) => {
        if (!currentIds.has(id)) {
          dancersGroup.remove(entry.spriteMesh);
          dancersGroup.remove(entry.badgeMesh);
          dancerMeshesMap.delete(id);
        }
      });

      // 18.10 3D Camera Director & Smooth Movement
      const isManual = Date.now() - lastUserInteract < 5000;
      const targetCamPos = new THREE.Vector3(0, 5.2, 14);
      const targetLookAt = new THREE.Vector3(0, 1.6, -3.5);

      if (isManual) {
        // Manual User Orbit
        targetCamPos.x = Math.sin(userYaw) * userDist;
        targetCamPos.z = Math.cos(userYaw) * userDist - 3;
        targetCamPos.y = Math.max(1.5, 4 + Math.sin(userPitch) * userDist);
        targetLookAt.set(0, 1.5, -3.5);
      } else {
        // Automated Concert Director Angles
        const shot = engine.currentShotType;
        if (shot === 'DJ_POV') {
          // Point of View of the DJ looking down from Booth onto VIP Podiums & Crowd
          targetCamPos.set(0, 3.2, -11.5);
          targetLookAt.set(0, 1.2, 0.5);
        } else if (shot === 'SPOTLIGHT_ZOOM') {
          // Close-up sweep on the VIP Podiums and Stage
          const targetX = Math.sin(nowSec * 0.6) * 4.2;
          targetCamPos.set(targetX, 2.8, 4.5);
          targetLookAt.set(targetX * 0.7, 1.8, -3.5);
        } else if (shot === 'CRANE_SWOOP') {
          // High altitude swooping crane camera
          targetCamPos.set(Math.sin(nowSec * 0.4) * 8.5, 8.5 + Math.cos(nowSec * 0.3) * 2.5, 11);
          targetLookAt.set(0, 1.4, -4);
        } else {
          // WIDE_ORBIT - Smooth wide circular flycam
          const orbitAngle = nowSec * 0.22;
          targetCamPos.set(Math.sin(orbitAngle) * 15.5, 6.2 + Math.sin(nowSec * 0.3) * 1.5, Math.cos(orbitAngle) * 14.5 - 3);
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
