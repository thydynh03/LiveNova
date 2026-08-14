export interface Dancer {
  id: string; // usually the username
  name: string;
  avatarUrl?: string;
  x: number; // 0 to 1 (percent of screen width)
  y: number; // 0 to 1 (percent of screen height, 1 is floor)
  z: number; // 0.05 (back near DJ booth) to 1.0 (front near audience)
  vy: number;
  vx: number;
  color: string;
  spriteId: string; // 'mushroom_dance_15', 'hanhan_video_dance', 'char_a', etc.
  scale: number;
  targetScale: number;
  state: 'idle' | 'dancing' | 'jumping';
  danceOffset: number; // For bobbing up and down
  isDj?: boolean; // DJ flag
  points: number; // Gift score points
}

export interface Firework {
  id: string;
  x: number;
  y: number;
  createdAt: number;
}

export interface Camera {
  x: number;
  y: number;
  scale: number;
  targetX: number;
  targetY: number;
  targetScale: number;
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
  isUserDragging: boolean;
  lastUserInteraction: number;
  lockedOnId: string | null;
  lockTimeout: number;
}

export const SPRITES = [
  'mushroom_dance_15',
  'mushroom_dance_01',
  'mushroom_magic_02',
  'hanhan_video_dance',
  'char_anya_heh',
  'char_bocchi_panic',
  'char_gojo_sensei',
  'char_umaru_chan',
  'char_tanjiro_derp',
  'char_zoro_lost',
  'char_panda_cry',
  'char_panda_smug',
  'char_yaoming_laugh',
  'char_hoe_fighter',
  'char_slipper_slap',
  'char_dj_pro',
  'char_disco_king',
  'char_cat_groove',
  'char_super_duck',
  'char_matrix_dancer',
  'char_a',
  'char_b',
  'char_c',
  'char_d',
  'char_e',
  'char_g',
  'char_h',
  'char_j',
  'char_k',
];

export class DiscoEngine {
  dancers: Map<string, Dancer> = new Map();
  fireworks: Firework[] = [];
  camera: Camera = {
    x: 0.5,
    y: 0.52,
    scale: 1.10,
    targetX: 0.5,
    targetY: 0.52,
    targetScale: 1.10,
    yaw: 0,
    pitch: 0.12,
    targetYaw: 0,
    targetPitch: 0.12,
    isUserDragging: false,
    lastUserInteraction: 0,
    lockedOnId: null,
    lockTimeout: 0,
  };
  flashIntensity: number = 0;
  lastTick: number = 0;
  
  private colors = ['#ff4b4b', '#ff7a4b', '#ffb54b', '#e2ff4b', '#62ff4b', '#4bff9a', '#4be2ff', '#4b7aff', '#9a4bff', '#ff4be2'];

  constructor() {
    this.addDemoDancers(8);
  }

  addDemoDancers(count = 8) {
    const demoNames = [
      { id: 'bot_dj_pro', name: '🎧 DJ Pro LiveNova', sprite: 'char_dj_pro', isDj: true, z: 0.05 },
      { id: 'bot_anya_heh', name: '😏 Anya Waku Waku', sprite: 'char_anya_heh', isDj: false, z: 0.85 },
      { id: 'bot_gojo', name: '🤞 Thầy Gojo Vô Cực', sprite: 'char_gojo_sensei', isDj: false, z: 0.35 },
      { id: 'bot_bocchi', name: '🎸 Bocchi Hoảng Loạn', sprite: 'char_bocchi_panic', isDj: false, z: 0.65 },
      { id: 'bot_umaru', name: '🐹 Umaru Trùm Mũ', sprite: 'char_umaru_chan', isDj: false, z: 0.95 },
      { id: 'bot_zoro', name: '⚔️ Zoro Lạc Đường', sprite: 'char_zoro_lost', isDj: false, z: 0.25 },
      { id: 'bot_panda_cry', name: '😭 Gấu Trúc Khóc Nhè', sprite: 'char_panda_cry', isDj: false, z: 0.55 },
      { id: 'bot_yaoming', name: '😂 Thánh Cười YaoMing', sprite: 'char_yaoming_laugh', isDj: false, z: 0.75 },
      { id: 'bot_tanjiro', name: '🎴 Tanjiro Hoang Mang', sprite: 'char_tanjiro_derp', isDj: false, z: 0.45 },
    ];

    const toAdd = demoNames.slice(0, count);
    for (let i = 0; i < toAdd.length; i++) {
      const item = toAdd[i];
      if (!this.dancers.has(item.id)) {
        const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];
        const spreadX = item.isDj ? 0.5 : 0.15 + (i / (toAdd.length - 1 || 1)) * 0.7;
        this.dancers.set(item.id, {
          id: item.id,
          name: item.name,
          avatarUrl: `/assets/disco/Characters/${item.sprite}/000.png`,
          x: spreadX,
          y: item.isDj ? 0.435 : 0.95,
          z: item.z || 0.5,
          vy: 0,
          vx: (Math.random() - 0.5) * 0.04,
          color: randomColor,
          spriteId: item.sprite,
          scale: 1,
          targetScale: 1,
          state: 'dancing',
          danceOffset: Math.random() * Math.PI * 2,
          isDj: item.isDj,
          points: item.isDj ? 10 : 0,
        });
      }
    }
  }

  clear() {
    this.dancers.clear();
    this.fireworks = [];
    this.camera.lockedOnId = null;
    this.camera.targetScale = 1.15;
    this.camera.targetX = 0.5;
    this.camera.targetY = 0.6;
    this.flashIntensity = 0;
  }

  public currentDjId: string | null = 'bot_dj_pro';
  public djPromotionToast: { oldDjName: string; newDjName: string; points: number; time: number } | null = null;
  public lastGiftInfo: { senderName: string; giftPoints: number; time: number } | null = null;

  triggerFlash(amount = 0.7) {
    this.flashIntensity = Math.min(1.0, this.flashIntensity + amount);
  }

  join(id: string, name: string, avatarUrl?: string) {
    if (this.dancers.has(id)) {
      this.jump(id);
      this.zoomOn(id, 2500);
      return;
    }

    const randomSprite = SPRITES[Math.floor(Math.random() * SPRITES.length)];
    const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];

    this.dancers.set(id, {
      id,
      name,
      avatarUrl,
      x: Math.random() * 0.76 + 0.12, // Random x across arena
      y: -0.1, // Start slightly above screen to fall in
      z: Math.random() * 0.78 + 0.20, // Random depth row in arena
      vy: 0,
      vx: (Math.random() - 0.5) * 0.06, // Slight horizontal drift
      color: randomColor,
      spriteId: randomSprite,
      scale: 1,
      targetScale: 1,
      state: 'dancing',
      danceOffset: Math.random() * Math.PI * 2,
      isDj: false,
      points: 0,
    });

    // Camera zooms/pans to welcome new dancer for 3.5 seconds
    this.zoomOn(id, 3500);
    this.triggerFlash(0.3);
  }

  addGiftPoints(id: string, name: string, points: number, avatarUrl?: string) {
    if (!this.dancers.has(id)) {
      this.join(id, name, avatarUrl);
    }
    const dancer = this.dancers.get(id);
    if (dancer) {
      dancer.points = (dancer.points || 0) + points;
      dancer.targetScale = Math.min(2.6, dancer.targetScale + 0.4);
      dancer.vy = -1.6;
      dancer.state = 'jumping';
    }

    this.lastGiftInfo = { senderName: name, giftPoints: points, time: Date.now() };

    // Check for DJ Promotion: Highest points AND at least 10 points becomes TOP DJ
    let topScorer: Dancer | null = null;
    for (const d of Array.from(this.dancers.values())) {
      if ((d.points || 0) >= 10) {
        if (!topScorer || (d.points || 0) > (topScorer.points || 0)) {
          topScorer = d;
        }
      }
    }

    if (topScorer && topScorer.id !== this.currentDjId) {
      // PROMOTION: New TOP DJ replaces the previous DJ
      const oldDj = this.getCurrentDj();
      const oldDjName = oldDj ? oldDj.name : 'DJ Pro';
      this.setDj(topScorer.id);
      this.currentDjId = topScorer.id;
      this.djPromotionToast = {
        oldDjName,
        newDjName: topScorer.name,
        points: topScorer.points,
        time: Date.now(),
      };
      // Celebration fireworks & light show
      for (let i = 0; i < 6; i++) {
        setTimeout(() => this.triggerFirework(), i * 200);
      }
    } else {
      // Normal gift fireworks
      this.triggerFirework();
      setTimeout(() => this.triggerFirework(), 250);
    }

    // TẶNG QUÀ -> KÍCH HOẠT GÓC NHÌN DJ POV NHÌN XUỐNG TOÀN CẢNH SÀN NHẢY
    this.triggerDjPov(10000);
    this.triggerFlash(0.75);
  }

  getTopDancers(limit = 5): Dancer[] {
    return Array.from(this.dancers.values())
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, limit);
  }

  getCurrentDj(): Dancer | null {
    if (this.currentDjId && this.dancers.has(this.currentDjId)) {
      return this.dancers.get(this.currentDjId) || null;
    }
    for (const d of Array.from(this.dancers.values())) {
      if (d.isDj) return d;
    }
    return null;
  }

  jump(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;
    
    // Only jump if near the floor (DJs are at the booth, so they can jump anytime)
    if (dancer.y >= 0.92 || dancer.isDj) {
      dancer.vy = -1.2; // Upward velocity
      dancer.state = 'jumping';
    }
  }

  changeAvatar(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;

    let newSprite = SPRITES[Math.floor(Math.random() * SPRITES.length)];
    while (newSprite === dancer.spriteId && SPRITES.length > 1) {
      newSprite = SPRITES[Math.floor(Math.random() * SPRITES.length)];
    }
    dancer.spriteId = newSprite;
    
    this.jump(id);
    this.zoomOn(id, 2500);
    this.triggerFlash(0.4);
  }

  walk(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;
    dancer.vx = (Math.random() - 0.5) * 0.3;
  }

  grow(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;

    dancer.targetScale = 2.5;
    dancer.vy = -1.5;
    dancer.state = 'jumping';
    this.zoomOn(id, 4000);
    this.triggerFlash(0.6);
  }

  setDj(id: string) {
    // Revoke old DJ
    const dancersArray = Array.from(this.dancers.values());
    for (const dancer of dancersArray) {
      if (dancer.id !== id) {
        if (dancer.isDj) {
          dancer.isDj = false;
          // Fall back to ground
          dancer.vy = 0;
        }
      }
    }

    const newDj = this.dancers.get(id);
    if (newDj) {
      newDj.isDj = true;
      this.currentDjId = newDj.id;
      newDj.targetScale = 1.6;
      // Spawn fireworks for the new DJ
      this.triggerFirework(0.3, 0.3);
      this.triggerFirework(0.5, 0.2);
      this.triggerFirework(0.7, 0.3);
      this.zoomOn(id, 5000);
      this.triggerFlash(1.0);
    }
  }

  zoomOn(id: string, durationMs = 3500) {
    this.camera.lockedOnId = id;
    this.camera.lockTimeout = Date.now() + durationMs;
  }

  rotateCamera(deltaYaw: number, deltaPitch: number) {
    this.camera.isUserDragging = true;
    this.camera.lastUserInteraction = Date.now();
    this.camera.targetYaw += deltaYaw;
    this.camera.targetPitch = Math.max(-0.25, Math.min(0.45, this.camera.targetPitch + deltaPitch));
    this.camera.targetX = 0.5 + Math.sin(this.camera.targetYaw) * 0.32;
    this.camera.targetY = 0.52 + this.camera.targetPitch * 0.15;
  }

  zoomCamera(deltaZoom: number) {
    this.camera.targetScale = Math.max(0.85, Math.min(2.5, this.camera.targetScale + deltaZoom));
    this.camera.lastUserInteraction = Date.now();
  }

  startCameraDrag() {
    this.camera.isUserDragging = true;
    this.camera.lastUserInteraction = Date.now();
  }

  endCameraDrag() {
    this.camera.isUserDragging = false;
    this.camera.lastUserInteraction = Date.now();
  }

  triggerFirework(x?: number, y?: number) {
    this.fireworks.push({
      id: Math.random().toString(36).substr(2, 9),
      x: x !== undefined ? x : Math.random() * 0.8 + 0.1,
      y: y !== undefined ? y : Math.random() * 0.5 + 0.1, // upper half
      createdAt: Date.now()
    });
  }

  public currentShotType: 'WIDE_ORBIT' | 'SPOTLIGHT_ZOOM' | 'CRANE_SWOOP' | 'DJ_POV' = 'WIDE_ORBIT';
  public isAutoDirectorEnabled: boolean = true;
  private nextCinematicShotTime: number = 0;
  private spotlightTargetId: string | null = null;
  private shotEndTime: number = 0;

  triggerDjPov(durationMs = 9000) {
    this.currentShotType = 'DJ_POV';
    this.shotEndTime = Date.now() + durationMs;
    this.nextCinematicShotTime = Date.now() + durationMs + 6000;
  }

  triggerSpotlightZoom(durationMs = 5000, targetId?: string) {
    this.currentShotType = 'SPOTLIGHT_ZOOM';
    const dancersArray = Array.from(this.dancers.values());
    this.spotlightTargetId = targetId || (dancersArray.length > 0 ? dancersArray[Math.floor(Math.random() * dancersArray.length)].id : null);
    this.shotEndTime = Date.now() + durationMs;
    this.nextCinematicShotTime = Date.now() + durationMs + 6000;
  }

  triggerCraneSwoop(durationMs = 6000) {
    this.currentShotType = 'CRANE_SWOOP';
    this.shotEndTime = Date.now() + durationMs;
    this.nextCinematicShotTime = Date.now() + durationMs + 6000;
  }

  triggerWideOrbit(durationMs = 8000) {
    this.currentShotType = 'WIDE_ORBIT';
    this.shotEndTime = Date.now() + durationMs;
    this.nextCinematicShotTime = Date.now() + durationMs + 6000;
  }

  toggleAutoDirector(enabled?: boolean) {
    this.isAutoDirectorEnabled = enabled !== undefined ? enabled : !this.isAutoDirectorEnabled;
  }

  tick(now: number) {
    if (!this.lastTick) this.lastTick = now;
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    const GRAVITY = 2.5;
    const FLOOR = 1.0;
    const BOUNCE = -0.4;

    // Decay flash intensity
    if (this.flashIntensity > 0) {
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 2.5);
    }

    const dancersArray = Array.from(this.dancers.values());
    for (const dancer of dancersArray) {
      // DJ Physics override (Standing right behind the mixer desk)
      if (dancer.isDj) {
        const targetX = 0.5;
        const targetY = 0.435;
        
        // Lerp to DJ position behind the mixer table
        dancer.x += (targetX - dancer.x) * 3 * dt;
        dancer.y += (targetY - dancer.y) * 3 * dt;
        dancer.vx = 0;
        dancer.vy = 0;
      } else {
        // Normal Physics on floor
        dancer.vy += GRAVITY * dt;
        dancer.y += dancer.vy * dt;
        dancer.x += dancer.vx * dt;

        // Floor collision
        if (dancer.y >= FLOOR) {
          dancer.y = FLOOR;
          if (dancer.vy > 0.2) {
            dancer.vy *= BOUNCE;
          } else {
            dancer.vy = 0;
            dancer.state = 'dancing';
          }
        }

        // Wall collision (Wide floor spanning left to right)
        if (dancer.x < 0.04) {
          dancer.x = 0.04;
          dancer.vx *= -1;
        } else if (dancer.x > 0.96) {
          dancer.x = 0.96;
          dancer.vx *= -1;
        }
      }

      // Smooth scaling (shrink back to 1 over time)
      if (dancer.targetScale > 1) {
        dancer.targetScale -= dt * 0.4;
        if (dancer.targetScale < 1) dancer.targetScale = 1;
      }
      // Lerp scale
      dancer.scale += (dancer.targetScale - dancer.scale) * 8 * dt;

      // Dance bobbing
      if (dancer.state === 'dancing' && dancer.vy === 0) {
        dancer.danceOffset += dt * Math.PI * 5; 
        // Random autonomous hops for energetic club atmosphere
        if (Math.random() < 0.005) {
          dancer.vy = -(0.5 + Math.random() * 0.5);
          dancer.state = 'jumping';
        }
        if (Math.random() < 0.01) {
          dancer.vx = (Math.random() - 0.5) * 0.12;
        }
      }
    }

    // -------------------------------------------------------------
    // AUTOMATIC REAL-LIFE CINEMATIC CONCERT CAMERA DIRECTOR
    // -------------------------------------------------------------
    if (this.camera.lockedOnId && now < this.camera.lockTimeout) {
      // Priority event lock (e.g. Gift / Top DJ)
      const lockedDancer = this.dancers.get(this.camera.lockedOnId);
      if (lockedDancer) {
        this.camera.targetX = lockedDancer.x;
        this.camera.targetY = lockedDancer.isDj ? 0.435 : 0.50 + lockedDancer.z * 0.44;
        this.camera.targetScale = 1.75; // Zoom in close & focus
      } else {
        this.camera.lockedOnId = null;
      }
    } else {
      this.camera.lockedOnId = null;

      // Cycle cinematic shots automatically like real concert broadcast
      if (this.isAutoDirectorEnabled && now > this.nextCinematicShotTime) {
        const shotRoll = Math.random();
        if (shotRoll < 0.28 && dancersArray.length > 0) {
          this.triggerSpotlightZoom(4500);
        } else if (shotRoll < 0.52) {
          // View góc nhìn của DJ nhìn xuống khán giả
          this.triggerDjPov(7000);
        } else if (shotRoll < 0.76) {
          this.triggerCraneSwoop(5000);
        } else {
          this.triggerWideOrbit(8000);
        }
      }

      if (this.currentShotType === 'DJ_POV' && now < this.shotEndTime) {
        // View góc nhìn từ bục DJ nhìn xuống toàn cảnh sàn nhảy và khán giả
        this.camera.targetX = 0.5 + Math.sin(now * 0.0004) * 0.05;
        this.camera.targetY = 0.40;
        this.camera.targetPitch = 0.32 + Math.sin(now * 0.0006) * 0.03;
        this.camera.targetYaw = Math.sin(now * 0.00025) * 0.16;
        this.camera.targetScale = 1.40;
      } else if (this.currentShotType === 'SPOTLIGHT_ZOOM' && now < this.shotEndTime && this.spotlightTargetId) {
        const targetDancer = this.dancers.get(this.spotlightTargetId);
        if (targetDancer) {
          this.camera.targetX = targetDancer.x;
          this.camera.targetY = targetDancer.isDj ? 0.435 : 0.50 + targetDancer.z * 0.44;
          this.camera.targetScale = 1.70;
          this.camera.targetYaw += dt * 0.08;
          this.camera.targetPitch = 0.10;
        } else {
          this.currentShotType = 'WIDE_ORBIT';
        }
      } else if (this.currentShotType === 'CRANE_SWOOP' && now < this.shotEndTime) {
        const cranePhase = (this.shotEndTime - now) / 5000;
        this.camera.targetYaw += dt * 0.14;
        this.camera.targetPitch = 0.06 + Math.sin(cranePhase * Math.PI) * 0.18;
        this.camera.targetX = 0.5 + Math.sin(this.camera.targetYaw) * 0.20;
        this.camera.targetY = 0.48 + Math.sin(cranePhase * Math.PI) * 0.08;
        this.camera.targetScale = 1.25 + Math.sin(cranePhase * Math.PI) * 0.15;
      } else {
        // Continuous smooth 3D slow orbital sweep (like a real concert broadcast)
        this.currentShotType = 'WIDE_ORBIT';
        this.camera.targetYaw += dt * 0.12; // slow, gentle continuous orbit
        this.camera.targetPitch = 0.12 + Math.sin(now * 0.0003) * 0.04;
        this.camera.targetX = 0.5 + Math.sin(this.camera.targetYaw) * 0.24;
        this.camera.targetY = 0.52 + Math.cos(this.camera.targetYaw * 0.6) * 0.02;
        this.camera.targetScale = 1.10 + Math.sin(now * 0.0005) * 0.02;
      }
    }

    // Smooth Lerp Camera
    const camSpeed = this.camera.isUserDragging ? 12 : this.camera.lockedOnId ? 4.5 : 2.2;
    this.camera.x += (this.camera.targetX - this.camera.x) * camSpeed * dt;
    this.camera.y += (this.camera.targetY - this.camera.y) * camSpeed * dt;
    this.camera.yaw += (this.camera.targetYaw - this.camera.yaw) * camSpeed * dt;
    this.camera.pitch += (this.camera.targetPitch - this.camera.pitch) * camSpeed * dt;
    this.camera.scale += (this.camera.targetScale - this.camera.scale) * camSpeed * dt;

    // Clean up old fireworks
    this.fireworks = this.fireworks.filter(f => now - f.createdAt < 2000);
  }
}
