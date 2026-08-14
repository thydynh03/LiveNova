'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { DiscoEngine } from './disco-engine';

interface DiscoThreeStageProps {
  engine: DiscoEngine;
  videoUrl?: string;
  isMuted?: boolean;
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i);
  return match ? match[1] : null;
}

export function DiscoThreeStage({ engine, videoUrl, isMuted = true }: DiscoThreeStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || 800;
    let height = container.clientHeight || 600;

    const ytId = extractYouTubeId(videoUrl);

    // 1. Scene, Camera, Fog & Renderer
    const scene = new THREE.Scene();
    if (!ytId) {
      scene.background = new THREE.Color(0x06030c);
    }
    scene.fog = new THREE.FogExp2(0x070412, 0.024);

    const isPortrait = width < height;
    const camera = new THREE.PerspectiveCamera(isPortrait ? 65 : 52, width / height, 0.1, 150);
    camera.position.set(0, isPortrait ? 6.8 : 5.2, isPortrait ? 18.5 : 14);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: Boolean(ytId),
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

    const clubWallGeo = new THREE.CylinderGeometry(35, 35, 22, 48, 1, true, -Math.PI * 0.9, Math.PI * 1.8);
    const clubWallMat = new THREE.MeshBasicMaterial({
      map: clubBgTex,
      side: THREE.BackSide,
      color: 0x8877aa,
    });
    const clubWall = new THREE.Mesh(clubWallGeo, clubWallMat);
    clubWall.position.set(0, 7.5, -4);
    if (!ytId) {
      scene.add(clubWall);
    }

    // 5. Pulsating Beat-Synced Disco Dance Floor with Flashing Checkered Tiles
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fCtx = floorCanvas.getContext('2d');

    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(3, 3);

    // Massive Extended Arena Dance Floor spanning forward past camera view (fills 75%-80% of TikTok Studio / Mobile vertical streams)
    const floorGeo = new THREE.CylinderGeometry(48, 48.5, 0.4, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.15,
      metalness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, 8);
    scene.add(floor);

    // Deep Infinite Club Ground Base (Eliminates all empty void in TikTok Studio)
    const infiniteBaseGeo = new THREE.PlaneGeometry(180, 180);
    const infiniteBaseMat = new THREE.MeshStandardMaterial({
      color: 0x06030c,
      roughness: 0.2,
      metalness: 0.8,
    });
    const infiniteBase = new THREE.Mesh(infiniteBaseGeo, infiniteBaseMat);
    infiniteBase.rotation.x = -Math.PI / 2;
    infiniteBase.position.set(0, -0.22, 0);
    scene.add(infiniteBase);

    // Neon Floor Rim Ring
    const floorRimGeo = new THREE.RingGeometry(47.8, 48.2, 64);
    const floorRimMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const floorRim = new THREE.Mesh(floorRimGeo, floorRimMat);
    floorRim.rotation.x = -Math.PI / 2;
    floorRim.position.set(0, 0.02, 8);
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

    // 9. Center Stage LED Screen (Behind DJ Booth)
    const videoCanvas = document.createElement('canvas');
    videoCanvas.width = 1024;
    videoCanvas.height = 576; // 16:9 ratio
    const vCtx = videoCanvas.getContext('2d');

    const videoTexture = new THREE.CanvasTexture(videoCanvas);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    const centerScreenGeo = new THREE.CylinderGeometry(23, 23, 9.2, 36, 1, true, Math.PI * 0.62, Math.PI * 0.30);
    const centerUVs = centerScreenGeo.attributes.uv;
    for (let u = 0; u < centerUVs.count; u++) {
      centerUVs.setX(u, 1 - centerUVs.getX(u));
    }
    centerUVs.needsUpdate = true;

    const centerScreenMat = new THREE.MeshBasicMaterial({
      map: videoTexture,
      side: THREE.BackSide,
      transparent: true,
      opacity: ytId ? 0 : 1,
    });
    const centerScreen = new THREE.Mesh(centerScreenGeo, centerScreenMat);
    centerScreen.position.set(0, 5.2, -2.8);
    if (!ytId) {
      scene.add(centerScreen);
    }

    // Center Screen Glowing Neon Frame
    const centerFrameGeo = new THREE.CylinderGeometry(23.03, 23.03, 0.22, 36, 1, true, Math.PI * 0.62, Math.PI * 0.30);
    const centerFrameTop = new THREE.Mesh(centerFrameGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.BackSide }));
    centerFrameTop.position.set(0, 5.2 + 4.6, -2.8);
    scene.add(centerFrameTop);

    const centerFrameBottom = new THREE.Mesh(centerFrameGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.BackSide }));
    centerFrameBottom.position.set(0, 5.2 - 4.6, -2.8);
    scene.add(centerFrameBottom);

    // 10. Grand Triple Circular Ceiling Trusses with 36 Moving Head Spotlights
    const trussGroup = new THREE.Group();
    trussGroup.position.set(0, 8.8, -4);
    scene.add(trussGroup);

    // 3 Concentric Metal Truss Rings
    const trussRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(11.5, 0.14, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0x18182e, metalness: 0.9, roughness: 0.25 })
    );
    trussRing1.rotation.x = Math.PI / 2;
    trussGroup.add(trussRing1);

    const trussRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(7.5, 0.14, 12, 36),
      new THREE.MeshStandardMaterial({ color: 0x18182e, metalness: 0.9, roughness: 0.25 })
    );
    trussRing2.rotation.x = Math.PI / 2;
    trussGroup.add(trussRing2);

    const trussRing3 = new THREE.Mesh(
      new THREE.TorusGeometry(4.0, 0.14, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0x18182e, metalness: 0.9, roughness: 0.25 })
    );
    trussRing3.rotation.x = Math.PI / 2;
    trussGroup.add(trussRing3);

    // 28 Ceiling Moving Head Volumetric Beam Cones + 8 Floor Uplights = 36 Beams
    const beamCount = 28;
    const beamMeshes: { mesh: THREE.Mesh; baseAngle: number; radius: number; speed: number; color: THREE.Color }[] = [];
    const beamColors = [
      new THREE.Color(0xff0077), // Hot Pink
      new THREE.Color(0x00f0ff), // Cyan
      new THREE.Color(0xaa00ff), // Electric Violet
      new THREE.Color(0xffd700), // Gold
      new THREE.Color(0x00ff88), // Neon Emerald
      new THREE.Color(0x0066ff), // Electric Blue
      new THREE.Color(0xff5500), // Coral Amber
      new THREE.Color(0xffffff), // Strobe White
    ];

    for (let i = 0; i < beamCount; i++) {
      const radius = i % 3 === 0 ? 11.5 : (i % 3 === 1 ? 7.5 : 4.0);
      const baseAngle = (i / beamCount) * Math.PI * 2;
      const beamGeo = new THREE.ConeGeometry(1.0, 16, 18, 1, true);
      beamGeo.translate(0, -8.0, 0); // Pivot at tip

      const beamColor = beamColors[i % beamColors.length];
      const beamMat = new THREE.MeshBasicMaterial({
        color: beamColor,
        transparent: true,
        opacity: 0.38,
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
        speed: (i % 2 === 0 ? 1 : -1) * (0.85 + (i % 4) * 0.3),
        color: beamColor,
      });
    }

    // 8 Floor Uplight Moving Heads along front stage rim
    const floorBeamsGroup = new THREE.Group();
    scene.add(floorBeamsGroup);
    const floorBeamMeshes: { mesh: THREE.Mesh; baseAngle: number; speed: number }[] = [];
    for (let f = 0; f < 8; f++) {
      const fAngle = (f / 8) * Math.PI - Math.PI / 2; // Semi-circle along front
      const fGeo = new THREE.ConeGeometry(0.8, 14, 16, 1, true);
      fGeo.translate(0, 7.0, 0);
      const fColor = beamColors[(f + 2) % beamColors.length];
      const fMat = new THREE.MeshBasicMaterial({
        color: fColor,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const fMesh = new THREE.Mesh(fGeo, fMat);
      fMesh.position.set(Math.sin(fAngle) * 9.5, 0.1, Math.cos(fAngle) * 9.5 - 2);
      floorBeamsGroup.add(fMesh);
      floorBeamMeshes.push({ mesh: fMesh, baseAngle: fAngle, speed: (f % 2 === 0 ? 1 : -1) * 0.9 });
    }

    // 11. Dynamic Top 5 Character Spotlights (Volumetric Beams + Floor Glow Rings + Point Lights)
    const top5Colors = [0xffd700, 0x00f0ff, 0xff007f, 0xb026ff, 0x00ff88];
    const top5SpotlightGroup = new THREE.Group();
    scene.add(top5SpotlightGroup);

    interface Top5SpotlightEntry {
      beamMesh: THREE.Mesh;
      floorRing: THREE.Mesh;
      pointLight: THREE.PointLight;
      color: number;
    }

    const top5Spotlights: Top5SpotlightEntry[] = [];

    // Glowing circular floor texture for spotlight projection
    const spotDiscCanvas = document.createElement('canvas');
    spotDiscCanvas.width = 128;
    spotDiscCanvas.height = 128;
    const spotDiscCtx = spotDiscCanvas.getContext('2d');
    if (spotDiscCtx) {
      const g = spotDiscCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      g.addColorStop(0.35, 'rgba(255, 255, 255, 0.6)');
      g.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
      g.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
      spotDiscCtx.fillStyle = g;
      spotDiscCtx.fillRect(0, 0, 128, 128);
    }
    const spotDiscTex = new THREE.CanvasTexture(spotDiscCanvas);

    for (let i = 0; i < 5; i++) {
      const hex = top5Colors[i];

      // Volumetric spotlight cone: NARROW at ceiling (radiusBottom = 0.08), COMPACT at floor (radiusTop = 1.15)
      const beamGeo = new THREE.CylinderGeometry(1.15, 0.08, 1, 24, 1, true);
      beamGeo.translate(0, 0.5, 0); // Origin y=0 is narrow tip at ceiling, y=1 is base at floor

      const beamMat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.visible = false;
      top5SpotlightGroup.add(beamMesh);

      // Glowing Floor Projection Ring - Compact size (2.0 x 2.0)
      const floorMat = new THREE.MeshBasicMaterial({
        map: spotDiscTex,
        color: hex,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const floorRing = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), floorMat);
      floorRing.rotation.x = -Math.PI / 2;
      floorRing.visible = false;
      top5SpotlightGroup.add(floorRing);

      // Real Point Light illuminating character directly
      const pointLight = new THREE.PointLight(hex, 2.8, 8, 1.6);
      pointLight.visible = false;
      top5SpotlightGroup.add(pointLight);

      top5Spotlights.push({
        beamMesh,
        floorRing,
        pointLight,
        color: hex,
      });
    }

    // 12. Volumetric Stage Smoke & Haze Layers
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
    // 13. Animated Crossing Laser Beams (16 High-Energy Beams)
    const laserCount = 16;
    const laserGroup = new THREE.Group();
    scene.add(laserGroup);

    const laserLines: { line: THREE.Line; speed: number; baseAngle: number; color: number }[] = [];
    for (let l = 0; l < laserCount; l++) {
      const laserGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 8.8, -4),
        new THREE.Vector3(Math.sin(l * 0.4) * 16, 0.1, Math.cos(l * 0.4) * 16 - 3),
      ]);
      const laserCol = beamColors[l % beamColors.length].getHex();
      const laserMat = new THREE.LineBasicMaterial({
        color: laserCol,
        linewidth: 2,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(laserGeo, laserMat);
      laserGroup.add(line);
      laserLines.push({
        line,
        speed: (l % 2 === 0 ? 1 : -1) * (0.9 + (l % 5) * 0.25),
        baseAngle: l * 0.45,
        color: laserCol,
      });
    }

    // 14. Floating Sparks & Massive 3500-Particle Confetti Rainfall (12s Duration)
    const maxParticles = 3500;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(maxParticles * 3);
    const particleColors = new Float32Array(maxParticles * 3);
    
    const confettiColors = [
      [1.0, 0.84, 0.0],  // Gold
      [1.0, 0.0, 0.5],   // Hot Pink
      [0.0, 0.94, 1.0],  // Cyan
      [0.7, 0.15, 1.0],  // Violet
      [0.0, 1.0, 0.4],   // Neon Emerald
      [1.0, 0.4, 0.0],   // Orange
      [1.0, 1.0, 1.0],   // Pure White
    ];

    for (let p = 0; p < maxParticles; p++) {
      particlePositions[p * 3] = (Math.random() - 0.5) * 32;
      particlePositions[p * 3 + 1] = Math.random() * 11.5;
      particlePositions[p * 3 + 2] = (Math.random() - 0.5) * 32 - 2;

      const cPick = confettiColors[p % confettiColors.length];
      particleColors[p * 3] = cPick[0];
      particleColors[p * 3 + 1] = cPick[1];
      particleColors[p * 3 + 2] = cPick[2];
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    
    const particleMat = new THREE.PointsMaterial({
      size: 0.16,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
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
    const getBadgeTexture = (name: string, points: number, rankType: 'dj' | 'top2' | 'top3' | 'top4' | 'top5' | 'normal', color: string): THREE.CanvasTexture => {
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
        } else if (rankType === 'top4') {
          title = `🌟 TOP 4 VIP: ${name} (${points}đ)`;
          badgeColor = '#b026ff';
          borderColor = '#b026ff';
          bgGrad = 'rgba(25, 0, 35, 0.94)';
        } else if (rankType === 'top5') {
          title = `✨ TOP 5 VIP: ${name} (${points}đ)`;
          badgeColor = '#00ff88';
          borderColor = '#00ff88';
          bgGrad = 'rgba(0, 30, 20, 0.94)';
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

    // 16. Video / Image Element setup for 3D LED Video Wall
    let videoEl: HTMLVideoElement | null = null;
    let imageEl: HTMLImageElement | null = null;

    const trimmedUrl = (videoUrl || '').trim();
    const isImage = Boolean(
      trimmedUrl && (
        trimmedUrl.match(/\.(png|jpe?g|gif|webp)(\?.*)?$/i) ||
        trimmedUrl.startsWith('data:image/')
      )
    );

    if (trimmedUrl && !trimmedUrl.includes('youtube.com') && !trimmedUrl.includes('youtu.be')) {
      if (isImage) {
        imageEl = new Image();
        imageEl.crossOrigin = 'anonymous';
        imageEl.onload = () => {};
        imageEl.onerror = () => {
          if (imageEl) {
            imageEl.removeAttribute('crossorigin');
            imageEl.src = trimmedUrl;
          }
        };
        imageEl.src = trimmedUrl;
      } else {
        videoEl = document.createElement('video');
        videoEl.crossOrigin = 'anonymous';
        videoEl.loop = true;
        videoEl.muted = isMuted;
        videoEl.defaultMuted = isMuted;
        videoEl.playsInline = true;
        videoEl.setAttribute('playsinline', '');
        videoEl.setAttribute('webkit-playsinline', '');
        videoEl.autoplay = true;
        videoEl.src = trimmedUrl;
        videoEl.load();

        const currentVideo = videoEl;
        const playPromise = currentVideo.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Retry with muted or without crossOrigin if blocked
            currentVideo.muted = true;
            currentVideo.play().catch(() => {
              currentVideo.removeAttribute('crossorigin');
              currentVideo.src = trimmedUrl;
              currentVideo.load();
              currentVideo.play().catch(() => {});
            });
          });
        }
        videoRef.current = currentVideo;
      }
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
    
    let prevSmokeActive = false;

    const renderLoop = (time: number) => {
      animId = requestAnimationFrame(renderLoop);
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      const nowSec = time * 0.001;

      // STEP ENGINE PHYSICS & QUEUE ON EVERY FRAME
      engine.tick(Date.now());
      
      const smokeActive = engine.smokeEffectActive === true;
      const effects = engine.activeEffects || [];
      const hasEffect = (t: string) => effects.some((e: { type: string; startTime: number; duration: number }) => e.type === t && (Date.now() - e.startTime < e.duration));
      const isSmokeBlast = hasEffect('smoke_blast');
      const isConfetti = hasEffect('confetti');
      const isLaserShow = hasEffect('laser_show');
      const isStrobe = hasEffect('strobe');
      const isFirework = hasEffect('firework_burst');

      // Smoke sound effect with Web Audio API procedural sound generation
      const currentSmokeActive = smokeActive || isSmokeBlast;
      if (currentSmokeActive && !prevSmokeActive) {
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            const bufferSize = Math.floor(ctx.sampleRate * 1.8);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.9));
            }
            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = buffer;

            const bandpass = ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.setValueAtTime(1400, ctx.currentTime);
            bandpass.Q.setValueAtTime(1.2, ctx.currentTime);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.01, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6);

            whiteNoise.connect(bandpass);
            bandpass.connect(gain);
            gain.connect(ctx.destination);
            whiteNoise.start();
            whiteNoise.stop(ctx.currentTime + 1.7);
          }
        } catch (e) {
          console.warn('Audio synthesis error:', e);
        }
      }
      prevSmokeActive = currentSmokeActive;

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
      let beatInt = Math.max(0.8, Math.sin(nowSec * 10) ** 3 * 3.5);
      if (smokeActive || isSmokeBlast) {
        beatInt *= 2.0; 
      }
      beatPointLight.intensity = beatInt;

      if (isStrobe) {
        ambientLight.intensity = (Math.floor(nowSec * 20) % 2 === 0) ? 4.0 : 0.5;
      } else {
        ambientLight.intensity = 2.0;
      }

      if (isFirework) {
        if (Math.random() < 0.1) {
          stageKeyLight.color.setHSL(Math.random(), 1.0, 0.5);
          stageKeyLight.intensity = 5.0;
        } else {
          stageKeyLight.intensity = THREE.MathUtils.lerp(stageKeyLight.intensity, 2.5, dt * 5);
        }
      } else {
        stageKeyLight.color.setHex(0xa060ff);
        stageKeyLight.intensity = 2.5;
      }

      // 18.3 Render Center Video Screen
      if (vCtx) {
        let hasCustomMedia = false;

        if (videoEl && (videoEl.readyState >= 1 || videoEl.videoWidth > 0) && !videoEl.paused) {
          try {
            vCtx.drawImage(videoEl, 0, 0, 1024, 576);
            hasCustomMedia = true;
          } catch {
            hasCustomMedia = false;
          }
        } else if (imageEl && imageEl.complete && imageEl.naturalWidth > 0) {
          try {
            vCtx.drawImage(imageEl, 0, 0, 1024, 576);
            hasCustomMedia = true;
          } catch {
            hasCustomMedia = false;
          }
        }

        if (!hasCustomMedia) {
          // Center Cyber Visualizer Spectrum
          vCtx.fillStyle = '#05020c';
          vCtx.fillRect(0, 0, 1024, 576);

          // Grid lines
          vCtx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
          vCtx.lineWidth = 1.5;
          for (let gy = 260; gy < 576; gy += 30) {
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
            const grad = vCtx.createLinearGradient(0, 576 - h, 0, 576);
            grad.addColorStop(0, b % 2 === 0 ? '#ff007f' : '#00f0ff');
            grad.addColorStop(1, '#6600ff');
            vCtx.fillStyle = grad;
            vCtx.fillRect(b * barWidth + 3, 576 - h, barWidth - 6, h);
          }

          // Live Cyber Title
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

      // 18.4 Animate 36 Moving Head Spotlights (Ceiling + Floor Uplights)
      beamMeshes.forEach((beam) => {
        const sweepAngle = Math.sin(nowSec * beam.speed) * 0.65;
        const targetX = Math.cos(beam.baseAngle + sweepAngle) * (beam.radius * 0.85);
        const targetZ = Math.sin(beam.baseAngle + sweepAngle) * (beam.radius * 0.85) - 3;
        beam.mesh.lookAt(targetX, 0, targetZ);
        beam.mesh.rotateX(Math.PI / 2);
      });

      floorBeamMeshes.forEach((fb) => {
        const sweepAngle = Math.sin(nowSec * fb.speed) * 0.55;
        const targetX = Math.sin(fb.baseAngle + sweepAngle) * 8.0;
        const targetZ = Math.cos(fb.baseAngle + sweepAngle) * 8.0 - 2;
        fb.mesh.lookAt(targetX, 12, targetZ);
        fb.mesh.rotateX(-Math.PI / 2);
      });

      // 18.5 Slowly Rotate Ceiling Truss
      trussGroup.rotation.y = nowSec * 0.045;

      // 18.6 Animate Stage Smoke / Fog Billowing Across Floor
      const targetSmokeOpacity = isSmokeBlast ? 0.8 : (smokeActive ? 0.55 : 0.22);
      const targetSmokeScale = isSmokeBlast ? 2.5 : (smokeActive ? 1.8 : 1.0);
      const smokeSpeedMult = isSmokeBlast ? 4.0 : (smokeActive ? 2.0 : 1.0);

      smokePlanes.forEach((sp, idx) => {
        const mat = sp.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetSmokeOpacity, dt * 2);
        const currentScale = sp.mesh.scale.x;
        const newScale = THREE.MathUtils.lerp(currentScale, targetSmokeScale, dt * 2);
        sp.mesh.scale.set(newScale, newScale, 1);

        sp.mesh.rotation.z += sp.rotSpeed * dt * smokeSpeedMult;
        sp.mesh.position.x = sp.initX + Math.sin(nowSec * 0.5 * smokeSpeedMult + idx) * 1.5;
        sp.mesh.position.z = sp.initZ + Math.cos(nowSec * 0.4 * smokeSpeedMult + idx) * 1.2;
      });

      // 18.7 Animate Crossing Laser Beams (16 Beams)
      const laserSpeedMult = isLaserShow ? 3.5 : 1.0;
      laserLines.forEach((laser) => {
        const lAngle = laser.baseAngle + Math.sin(nowSec * laser.speed * laserSpeedMult) * 0.85;
        const tx = Math.sin(lAngle) * 16;
        const tz = Math.cos(lAngle) * 16 - 3;
        const posAttr = laser.line.geometry.attributes.position as THREE.BufferAttribute;
        posAttr.setXYZ(1, tx, 0.05, tz);
        posAttr.needsUpdate = true;
        const lineMat = laser.line.material as THREE.LineBasicMaterial;
        lineMat.opacity = isLaserShow ? 1.0 : 0.85;
      });

      // 18.8 Floating Dust & Continuous Confetti Rainfall (Flutter Physics)
      const currentDrawCount = isConfetti ? maxParticles : 250;
      sparkPoints.geometry.setDrawRange(0, currentDrawCount);
      
      const posAttrSpark = sparkPoints.geometry.attributes.position as THREE.BufferAttribute;
      const colAttrSpark = sparkPoints.geometry.attributes.color as THREE.BufferAttribute;
      
      const pPositions = posAttrSpark.array as Float32Array;
      const fallSpeed = isConfetti ? 2.2 : 0.35;
      
      for (let p = 0; p < currentDrawCount; p++) {
        pPositions[p * 3 + 1] -= fallSpeed * dt;
        if (isConfetti) {
          // Fluttering paper physics (tumbling left and right as it falls)
          pPositions[p * 3] += Math.sin(nowSec * 6 + p * 0.6) * 0.035;
          pPositions[p * 3 + 2] += Math.cos(nowSec * 5 + p * 0.4) * 0.035;
        }

        // Reset to top when touching floor for continuous 12s rainfall
        if (pPositions[p * 3 + 1] < 0.05) {
          pPositions[p * 3 + 1] = isConfetti ? (10.5 + Math.random() * 2.5) : 9.5;
          pPositions[p * 3] = (Math.random() - 0.5) * 32;
          pPositions[p * 3 + 2] = (Math.random() - 0.5) * 32 - 2;
        }
      }
      posAttrSpark.needsUpdate = true;
      colAttrSpark.needsUpdate = true;
      
      if (isConfetti) {
        (sparkPoints.material as THREE.PointsMaterial).size = 0.25;
        (sparkPoints.material as THREE.PointsMaterial).opacity = 0.9;
      } else {
        (sparkPoints.material as THREE.PointsMaterial).size = 0.14;
        (sparkPoints.material as THREE.PointsMaterial).opacity = 0.7;
      }

      // 18.9 Update Dancers, Top 1 DJ, Top 2 & Top 3 VIP Podiums, and Top 4-5 Floor VIPs
      const topDancers = engine.getTopDancers(5);
      const top1 = topDancers[0] || null;
      const top2 = topDancers[1] || null;
      const top3 = topDancers[2] || null;
      const top4 = topDancers[3] || null;
      const top5 = topDancers[4] || null;

      const activeDancers = Array.from(engine.dancers.values());
      const currentIds = new Set<string>();

      const isDjPovFirstPerson = engine.isDjPovFirstPerson === true;

      // Track 3D target coordinates of Top 5 dancers for Spotlights
      const top5Coords: ({ x: number; y: number; z: number; floorY: number; isDj: boolean } | null)[] = [null, null, null, null, null];

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
        const isTop4 = top4 && top4.id === dancer.id;
        const isTop5 = top5 && top5.id === dancer.id;

        const isCurrentDj = dancer.isDj || isTop1;

        if (isDjPovFirstPerson && isCurrentDj) {
          entry.spriteMesh.visible = false;
          entry.badgeMesh.visible = false;
          return;
        } else {
          entry.spriteMesh.visible = true;
          entry.badgeMesh.visible = true;
        }

        let posX = 0;
        let posY = 1.0;
        let posZ = 0;
        let floorY = 0.05;
        let scale = 1.85 * (dancer.scale || 1);

        if (isCurrentDj) {
          // Elevated Top 1 DJ Booth Position
          posX = 0;
          posY = 2.55;
          posZ = -11.0;
          floorY = 2.05;
          scale = 2.3;
        } else if (isTop2) {
          // Left VIP Stage Podium (Top 2 Gifter)
          posX = -4.2;
          posY = 1.95;
          posZ = -3.5;
          floorY = 1.25;
          scale = 2.2;
        } else if (isTop3) {
          // Right VIP Stage Podium (Top 3 Gifter)
          posX = 4.2;
          posY = 1.95;
          posZ = -3.5;
          floorY = 1.25;
          scale = 2.2;
        } else {
          // Audience Dancers scattered on Dance Floor in layered depth
          posX = (dancer.x - 0.5) * 18;
          posZ = (dancer.z - 0.5) * 12 - 2;
          const dropHeight = Math.max(0, (0.95 - (dancer.y ?? 0.95)) * 8.5);
          posY = 0.98 + dropHeight;
          floorY = 0.05;
        }

        // Save coordinates for Top 5 Spotlights
        if (isTop1) top5Coords[0] = { x: posX, y: posY, z: posZ, floorY, isDj: true };
        else if (isTop2) top5Coords[1] = { x: posX, y: posY, z: posZ, floorY, isDj: false };
        else if (isTop3) top5Coords[2] = { x: posX, y: posY, z: posZ, floorY, isDj: false };
        else if (isTop4) top5Coords[3] = { x: posX, y: posY, z: posZ, floorY, isDj: false };
        else if (isTop5) top5Coords[4] = { x: posX, y: posY, z: posZ, floorY, isDj: false };

        // Natural club rhythm bobbing & jump physics (aligned with 128 BPM beat)
        const bob = Math.abs(Math.sin(nowSec * 4.2 + (dancer.danceOffset || 0))) * 0.14;
        posY += bob + Math.max(0, -dancer.vy * 0.35);

        entry.targetPos.set(posX, posY, posZ);
        entry.spriteMesh.position.lerp(entry.targetPos, 0.12);
        entry.spriteMesh.scale.set(scale, scale, 1);

        // Frame animation at natural 7.5 fps pace
        const frameIdx = Math.floor(nowSec * 7.5 + (dancer.danceOffset || 0)) % 10;
        const spriteId = (isTop2 || isTop3) ? 'hanhan_video_dance' : dancer.spriteId;
        const tex = getSpriteTexture(spriteId, frameIdx);
        if (tex) {
          entry.spriteMesh.material.map = tex;
          entry.spriteMesh.material.needsUpdate = true;
        }

        // Badge Position, Scale & Beat-Synced Flashing Pulse
        const badgePulse = 1.0 + (isTop1 ? 0.12 : 0.06) * Math.abs(Math.sin(nowSec * 8 + (dancer.danceOffset || 0)));
        entry.badgeMesh.position.set(entry.spriteMesh.position.x, entry.spriteMesh.position.y + scale * 0.58, entry.spriteMesh.position.z);
        entry.badgeMesh.scale.set(2.5 * badgePulse, 0.82 * badgePulse, 1);

        const rankType = isCurrentDj ? 'dj' : isTop2 ? 'top2' : isTop3 ? 'top3' : isTop4 ? 'top4' : isTop5 ? 'top5' : 'normal';
        const badgeTex = getBadgeTexture(dancer.name, dancer.points || 0, rankType, dancer.color);
        entry.badgeMesh.material.map = badgeTex;
        entry.badgeMesh.material.needsUpdate = true;

        // Dynamic Opacity during 10s Spotlight Zoom:
        // The focused target player stays 100% sharp & opaque, while other dancers become semi-transparent (0.22)
        const isSpotlightZoom = engine.currentShotType === 'SPOTLIGHT_ZOOM' && Boolean(engine.spotlightTargetId);
        const targetFocusId = engine.spotlightTargetId;
        let targetOpacity = 1.0;
        if (isSpotlightZoom) {
          if (dancer.id === targetFocusId) {
            targetOpacity = 1.0;
          } else {
            targetOpacity = 0.22; // Làm mờ nhân vật khác khi zoom vào 1 nhân vật
          }
        }

        const spriteMat = entry.spriteMesh.material as THREE.SpriteMaterial;
        const badgeMat = entry.badgeMesh.material as THREE.SpriteMaterial;
        spriteMat.opacity = THREE.MathUtils.lerp(spriteMat.opacity, targetOpacity, dt * 7);
        badgeMat.opacity = THREE.MathUtils.lerp(badgeMat.opacity, targetOpacity, dt * 7);
      });

      // 18.9.5 Direct Spotlights Following Top 5 Dancers in Real-Time
      for (let s = 0; s < 5; s++) {
        const spot = top5Spotlights[s];
        const coord = top5Coords[s];

        if (coord && !(isDjPovFirstPerson && coord.isDj)) {
          spot.beamMesh.visible = true;
          spot.floorRing.visible = true;
          spot.pointLight.visible = true;

          // Spotlight origin at ceiling truss
          const originY = 9.2;
          const originX = coord.isDj ? 0 : s === 1 ? -4.2 : s === 2 ? 4.2 : coord.x * 0.75;
          const originZ = coord.isDj ? -9.2 : s === 1 ? -3.5 : s === 2 ? -3.5 : coord.z - 1.5;

          const fromVec = new THREE.Vector3(originX, originY, originZ);
          const toVec = new THREE.Vector3(coord.x, coord.y, coord.z);
          const dir = new THREE.Vector3().subVectors(toVec, fromVec);
          const dist = dir.length();

          // Position and rotate the conical spotlight beam
          spot.beamMesh.position.copy(fromVec);
          const beamPulse = 1.0 + Math.sin(nowSec * 5 + s) * 0.06;
          spot.beamMesh.scale.set(beamPulse, dist, beamPulse);

          const normDir = dir.clone().normalize();
          const upVec = new THREE.Vector3(0, 1, 0);
          spot.beamMesh.quaternion.setFromUnitVectors(upVec, normDir);

          // Position glowing floor aura beneath the dancer's feet
          spot.floorRing.position.set(coord.x, coord.floorY, coord.z);
          const ringPulse = 1.0 + Math.sin(nowSec * 7 + s) * 0.08;
          spot.floorRing.scale.set(ringPulse, ringPulse, 1);
          (spot.floorRing.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(nowSec * 6 + s) * 0.15;

          // Point light directly illuminating the Top character
          spot.pointLight.position.set(coord.x, coord.y + 1.2, coord.z + 0.3);
          spot.pointLight.intensity = 2.4 + Math.sin(nowSec * 8 + s) * 0.5;
        } else {
          spot.beamMesh.visible = false;
          spot.floorRing.visible = false;
          spot.pointLight.visible = false;
        }
      }

      // Clean up removed dancers
      dancerMeshesMap.forEach((entry, id) => {
        if (!currentIds.has(id)) {
          dancersGroup.remove(entry.spriteMesh);
          dancersGroup.remove(entry.badgeMesh);
          dancerMeshesMap.delete(id);
        }
      });

      // 18.10 3D Camera Director & Smooth Movement with Portrait TikTok Adaptivity
      const isPortraitNow = width < height;
      const camDistMult = isPortraitNow ? 1.32 : 1.0;
      const camHeightAdd = isPortraitNow ? 1.2 : 0;

      const isManual = Date.now() - lastUserInteract < 5000;
      const targetCamPos = new THREE.Vector3(0, 5.2 + camHeightAdd, 14 * camDistMult);
      const targetLookAt = new THREE.Vector3(0, 1.4, -3.5);

      if (isManual) {
        // Manual User Orbit
        targetCamPos.x = Math.sin(userYaw) * userDist * camDistMult;
        targetCamPos.z = (Math.cos(userYaw) * userDist - 3) * camDistMult;
        targetCamPos.y = Math.max(1.5, 4 + Math.sin(userPitch) * userDist) + camHeightAdd;
        targetLookAt.set(0, 1.4, -3.5);
      } else {
        // Automated Concert Director Angles
        const shot = engine.currentShotType;
        if (shot === 'DJ_POV') {
          // Point of View of the DJ looking down from Booth onto VIP Podiums & Crowd
          targetCamPos.set(0, 2.8, -10.8);
          targetLookAt.set(0, 0.3, 2);
        } else if (shot === 'SPOTLIGHT_ZOOM') {
          // Dynamic Spotlight Zoom on target dancer
          const targetEntry = engine.spotlightTargetId ? dancerMeshesMap.get(engine.spotlightTargetId) : null;
          if (targetEntry) {
            const tPos = targetEntry.spriteMesh.position;
            targetCamPos.set(tPos.x + Math.sin(nowSec * 0.35) * 1.5, tPos.y + 0.85 + (isPortraitNow ? 0.3 : 0), tPos.z + 4.2 * (isPortraitNow ? 1.15 : 1.0));
            targetLookAt.set(tPos.x, tPos.y + 0.35, tPos.z);
          } else {
            const targetX = Math.sin(nowSec * 0.6) * 4.2;
            targetCamPos.set(targetX, 2.8 + camHeightAdd, 4.5 * camDistMult);
            targetLookAt.set(targetX * 0.7, 1.8, -3.5);
          }
        } else if (shot === 'CRANE_SWOOP') {
          // High altitude swooping crane camera
          targetCamPos.set(Math.sin(nowSec * 0.4) * 4.5, (7.5 + Math.cos(nowSec * 0.3) * 1.5) + camHeightAdd, 12 * camDistMult);
          targetLookAt.set(0, 1.4, -3.5);
        } else {
          // FRONT_STAGE - Wide Grand Panoramic View with Gentle Subtle Lateral Sway (75%-80% Vertical TikTok Coverage)
          const swayX = Math.sin(nowSec * 0.22) * (isPortraitNow ? 1.4 : 2.0);
          const swayY = Math.cos(nowSec * 0.18) * 0.25;
          targetCamPos.set(swayX, (isPortraitNow ? 6.6 : 5.2) + swayY, (isPortraitNow ? 17.2 : 14.8));
          targetLookAt.set(swayX * 0.35, (isPortraitNow ? 1.8 : 1.2), -3.2);
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
      const isPortrait = width < height;
      camera.fov = isPortrait ? 78 : 56;
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
