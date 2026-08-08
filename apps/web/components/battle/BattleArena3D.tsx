'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { BattleState } from '@livenova/shared';

interface Props {
  state: BattleState;
  isDark?: boolean;
}

interface Unit3D {
  mesh: THREE.Group;
  hpBar: THREE.Mesh;
  teamKey: string;
  progress: number;
  speed: number;
  lane: 'cat' | 'dog' | 'bear' | 'capy';
  offset: number;
  maxHp: number;
  currentHp: number;
}

const TEAM_COLORS: Record<string, { hex: number; css: string; lightHex: number }> = {
  cat: { hex: 0xc084fc, css: '#c084fc', lightHex: 0xd8b4fe },
  dog: { hex: 0x60a5fa, css: '#60a5fa', lightHex: 0x93c5fd },
  bear: { hex: 0xfb923c, css: '#fb923c', lightHex: 0xfdba74 },
  capy: { hex: 0x34d399, css: '#34d399', lightHex: 0x6ee7b7 },
};

// 3D Anchor positions for 4 corners (X, Z)
const CORNERS = {
  cat: { x: -28, z: -28, angle: Math.PI * 0.25 },
  dog: { x: 28, z: -28, angle: -Math.PI * 0.25 },
  bear: { x: -28, z: 28, angle: Math.PI * 0.75 },
  capy: { x: 28, z: 28, angle: -Math.PI * 0.75 },
};

export function BattleArena3D({ state, isDark = true }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [cameraMode, setCameraMode] = useState<'isometric' | 'cinematic'>('isometric');

  // References for live simulation
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const unitsRef = useRef<Unit3D[]>([]);
  const particlesRef = useRef<THREE.Points | null>(null);
  const shockwavesRef = useRef<THREE.Mesh[]>([]);
  const frameIdRef = useRef<number | null>(null);
  const crystalRef = useRef<THREE.Mesh | null>(null);
  const crystalRingsRef = useRef<THREE.Group | null>(null);
  const teamTroopCountsRef = useRef<Record<string, number>>({});

  // Helper to build 3D Castle Tower
  const buildCastle = (scene: THREE.Scene, cornerKey: 'cat' | 'dog' | 'bear' | 'capy') => {
    const pos = CORNERS[cornerKey];
    const colorInfo = TEAM_COLORS[cornerKey];

    const castleGroup = new THREE.Group();
    castleGroup.position.set(pos.x, 0, pos.z);

    // Stone base
    const baseGeo = new THREE.CylinderGeometry(5, 5.8, 4, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x27272a : 0x71717a,
      roughness: 0.8,
      flatShading: true,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 2;
    castleGroup.add(base);

    // Main tower
    const towerGeo = new THREE.CylinderGeometry(3.6, 4.2, 7, 8);
    const towerMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x3f3f46 : 0xa1a1aa,
      roughness: 0.7,
      flatShading: true,
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 7.5;
    castleGroup.add(tower);

    // Roof cone with team color
    const roofGeo = new THREE.ConeGeometry(4.2, 5, 8);
    const roofMat = new THREE.MeshStandardMaterial({
      color: colorInfo.hex,
      roughness: 0.4,
      metalness: 0.3,
      flatShading: true,
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 13.5;
    castleGroup.add(roof);

    // Glowing spire crystal
    const spireGeo = new THREE.OctahedronGeometry(1.2, 0);
    const spireMat = new THREE.MeshBasicMaterial({ color: colorInfo.lightHex });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = 17;
    castleGroup.add(spire);

    // Glowing Castle Light
    const pointLight = new THREE.PointLight(colorInfo.hex, 2.5, 30);
    pointLight.position.y = 12;
    castleGroup.add(pointLight);

    // Bridge leading to center
    const bridgeLength = 26;
    const bridgeGeo = new THREE.BoxGeometry(3.5, 0.8, bridgeLength);
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x334155 : 0x94a3b8,
      roughness: 0.9,
      flatShading: true,
    });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.set(-pos.x * 0.45, 0.4, -pos.z * 0.45);
    bridge.rotation.y = pos.angle;
    scene.add(bridge);

    scene.add(castleGroup);
  };

  // Helper to spawn 3D Chibi Soldier with floating HP bar
  const createTroop3D = (lane: 'cat' | 'dog' | 'bear' | 'capy', teamKey: string): Unit3D => {
    const group = new THREE.Group();
    const colorInfo = TEAM_COLORS[teamKey] ?? TEAM_COLORS.cat;

    // Body (stylized low-poly capsule / sphere)
    const bodyGeo = new THREE.SphereGeometry(0.85, 8, 8);
    bodyGeo.scale(1, 1.2, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorInfo.hex,
      roughness: 0.4,
      metalness: 0.2,
      flatShading: true,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.1;
    group.add(body);

    // Head / Helm
    const headGeo = new THREE.SphereGeometry(0.65, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1e293b : 0xe2e8f0,
      roughness: 0.5,
      flatShading: true,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.1;
    group.add(head);

    // Tiny weapon / Sword
    const swordGeo = new THREE.BoxGeometry(0.2, 1.2, 0.15);
    const swordMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.8,
      roughness: 0.2,
    });
    const sword = new THREE.Mesh(swordGeo, swordMat);
    sword.position.set(0.9, 1.4, 0.4);
    sword.rotation.x = Math.PI * 0.25;
    group.add(sword);

    // Mini 3D Health Bar Plane floating above head
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width = 64;
    hpCanvas.height = 12;
    const hpCtx = hpCanvas.getContext('2d');
    if (hpCtx) {
      hpCtx.fillStyle = '#0f172a';
      hpCtx.fillRect(0, 0, 64, 12);
      hpCtx.fillStyle = '#22c55e';
      hpCtx.fillRect(2, 2, 60, 8);
    }
    const hpTex = new THREE.CanvasTexture(hpCanvas);
    const hpMat = new THREE.MeshBasicMaterial({ map: hpTex, transparent: true });
    const hpGeo = new THREE.PlaneGeometry(1.8, 0.35);
    const hpMesh = new THREE.Mesh(hpGeo, hpMat);
    hpMesh.position.y = 3.1;
    group.add(hpMesh);

    const startPos = CORNERS[lane];
    group.position.set(startPos.x, 0.5, startPos.z);

    return {
      mesh: group,
      hpBar: hpMesh,
      teamKey,
      progress: 0,
      speed: 0.18 + Math.random() * 0.05,
      lane,
      offset: (Math.random() - 0.5) * 1.8,
      maxHp: 100,
      currentHp: 100,
    };
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(isDark ? 0x090d16 : 0xe0f2fe);
    scene.fog = new THREE.FogExp2(isDark ? 0x090d16 : 0xe0f2fe, 0.015);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 48, 52);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(isDark ? 0x64748b : 0xffffff, isDark ? 1.4 : 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    sunLight.position.set(20, 40, 20);
    scene.add(sunLight);

    // Ground Plane (Water / Basin)
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x0c4a6e : 0x38bdf8,
      roughness: 0.2,
      metalness: 0.6,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    scene.add(ground);

    // Center Arena Platform
    const arenaGeo = new THREE.CylinderGeometry(11, 12, 1.2, 24);
    const arenaMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1e293b : 0xcbd5e1,
      roughness: 0.7,
      flatShading: true,
    });
    const arena = new THREE.Mesh(arenaGeo, arenaMat);
    arena.position.y = 0.5;
    scene.add(arena);

    // Runic Floor Inset
    const runicGeo = new THREE.RingGeometry(4, 9.5, 24);
    const runicMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x38bdf8 : 0x0284c7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const runicRing = new THREE.Mesh(runicGeo, runicMat);
    runicRing.rotation.x = -Math.PI / 2;
    runicRing.position.y = 1.15;
    scene.add(runicRing);

    // Central Floating Crystal Spire
    const crystalGeo = new THREE.OctahedronGeometry(2.5, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.8,
      flatShading: true,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, 5.5, 0);
    scene.add(crystal);
    crystalRef.current = crystal;

    const crystalLight = new THREE.PointLight(0x38bdf8, 4, 25);
    crystalLight.position.set(0, 6, 0);
    scene.add(crystalLight);

    // Orbiting Magic Rings around Crystal
    const ringsGroup = new THREE.Group();
    ringsGroup.position.set(0, 5.5, 0);
    const torusGeo = new THREE.TorusGeometry(3.6, 0.12, 8, 32);
    const torusMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    const ring1 = new THREE.Mesh(torusGeo, torusMat);
    ring1.rotation.x = Math.PI / 3;
    ringsGroup.add(ring1);
    const ring2 = new THREE.Mesh(torusGeo, torusMat);
    ring2.rotation.y = Math.PI / 3;
    ringsGroup.add(ring2);
    scene.add(ringsGroup);
    crystalRingsRef.current = ringsGroup;

    // Ambient floating particles
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 80;
      particlePositions[i + 1] = Math.random() * 25 + 1;
      particlePositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.45,
      transparent: true,
      opacity: 0.7,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // Build 4 Castles
    buildCastle(scene, 'cat');
    buildCastle(scene, 'dog');
    buildCastle(scene, 'bear');
    buildCastle(scene, 'capy');

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Rotate central crystal & rings
      if (crystalRef.current) {
        crystalRef.current.rotation.y += delta * 0.8;
        crystalRef.current.rotation.x = Math.sin(time * 1.5) * 0.15;
        crystalRef.current.position.y = 5.5 + Math.sin(time * 2) * 0.4;
      }
      if (crystalRingsRef.current) {
        crystalRingsRef.current.rotation.y -= delta * 0.6;
        crystalRingsRef.current.rotation.z += delta * 0.4;
      }

      // Camera Orbit in Cinematic Mode
      if (cameraRef.current) {
        if (cameraMode === 'cinematic') {
          const camAngle = time * 0.2;
          const radius = 55;
          cameraRef.current.position.x = Math.sin(camAngle) * radius;
          cameraRef.current.position.z = Math.cos(camAngle) * radius;
          cameraRef.current.position.y = 35 + Math.sin(time * 0.4) * 8;
          cameraRef.current.lookAt(0, 3, 0);
        } else {
          cameraRef.current.position.set(0, 48, 52);
          cameraRef.current.lookAt(0, 2, 0);
        }
      }

      // Update 3D Troops
      const survivors: Unit3D[] = [];
      const units = unitsRef.current;

      for (const unit of units) {
        unit.progress += unit.speed * delta;

        if (unit.progress >= 1) {
          // Clash explosion at center: trigger expanding shockwave
          const shockGeo = new THREE.RingGeometry(0.5, 1.2, 16);
          const shockMat = new THREE.MeshBasicMaterial({
            color: TEAM_COLORS[unit.teamKey]?.hex || 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
          });
          const shock = new THREE.Mesh(shockGeo, shockMat);
          shock.rotation.x = -Math.PI / 2;
          shock.position.set((Math.random() - 0.5) * 6, 1.2, (Math.random() - 0.5) * 6);
          scene.add(shock);
          shockwavesRef.current.push(shock);

          scene.remove(unit.mesh);
          continue;
        }

        const start = CORNERS[unit.lane];
        const currentX = start.x + (0 - start.x) * unit.progress + Math.sin(unit.progress * Math.PI) * unit.offset;
        const currentZ = start.z + (0 - start.z) * unit.progress + Math.cos(unit.progress * Math.PI) * unit.offset;

        unit.mesh.position.set(currentX, 1.1 + Math.abs(Math.sin(time * 8 + unit.offset)) * 0.35, currentZ);

        // Turn towards center
        unit.mesh.lookAt(0, 1.1, 0);

        // Billboard HP bar to face camera
        if (cameraRef.current) {
          unit.hpBar.quaternion.copy(cameraRef.current.quaternion);
        }

        survivors.push(unit);
      }
      unitsRef.current = survivors;

      // Update Shockwaves
      const remainingShocks: THREE.Mesh[] = [];
      for (const shock of shockwavesRef.current) {
        shock.scale.multiplyScalar(1.08);
        if (shock.material instanceof THREE.Material) {
          shock.material.opacity -= delta * 1.6;
          if (shock.material.opacity > 0.05) {
            remainingShocks.push(shock);
          } else {
            scene.remove(shock);
          }
        }
      }
      shockwavesRef.current = remainingShocks;

      // Render
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isDark, cameraMode]);

  // Sync incoming state events or soldier counts to spawn 3D troops
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    state.teams.forEach((t) => {
      const prev = teamTroopCountsRef.current[t.key] || 0;
      const count = t.soldierCount || 0;
      if (count > prev) {
        const diff = Math.min(12, Math.max(1, count - prev));
        teamTroopCountsRef.current[t.key] = count;

        const lane = (t.key === 'cat' || t.key === 'dog' || t.key === 'bear' || t.key === 'capy' ? t.key : 'cat') as
          | 'cat'
          | 'dog'
          | 'bear'
          | 'capy';

        for (let i = 0; i < diff; i++) {
          const troop = createTroop3D(lane, t.key);
          scene.add(troop.mesh);
          unitsRef.current.push(troop);
        }
      }
    });
  }, [state.teams]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Floating 3D Control Pill */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-1.5 p-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-lg text-xs">
        <button
          type="button"
          onClick={() => setCameraMode('isometric')}
          className={`px-3 py-1 rounded-full font-bold transition-all ${
            cameraMode === 'isometric' ? 'bg-primary text-white shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          📷 Isometric
        </button>
        <button
          type="button"
          onClick={() => setCameraMode('cinematic')}
          className={`px-3 py-1 rounded-full font-bold transition-all ${
            cameraMode === 'cinematic' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          ✨ Cinematic 3D
        </button>
      </div>
    </div>
  );
}
