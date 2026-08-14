export interface Dancer {
  id: string; // usually the username
  name: string;
  avatarUrl?: string;
  x: number; // 0 to 1 (percent of screen width)
  y: number; // 0 to 1 (percent of screen height, 1 is floor)
  vy: number;
  vx: number;
  color: string;
  spriteId: string; // 'mushroom_dance_15', 'hanhan_video_dance', 'char_a', etc.
  scale: number;
  targetScale: number;
  state: 'idle' | 'dancing' | 'jumping';
  danceOffset: number; // For bobbing up and down
  isDj?: boolean; // DJ flag
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
  lockedOnId: string | null;
  lockTimeout: number;
}

export const SPRITES = [
  'mushroom_dance_15',
  'mushroom_dance_01',
  'mushroom_magic_02',
  'hanhan_video_dance',
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
    x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1, lockedOnId: null, lockTimeout: 0
  };
  lastTick: number = 0;
  
  private colors = ['#ff4b4b', '#ff7a4b', '#ffb54b', '#e2ff4b', '#62ff4b', '#4bff9a', '#4be2ff', '#4b7aff', '#9a4bff', '#ff4be2'];

  constructor() {
    this.addDemoDancers(5);
  }

  addDemoDancers(count = 5) {
    const demoNames = [
      { id: 'bot_dj_pro', name: '🎧 DJ Pro LiveNova', sprite: 'char_dj_pro', isDj: true },
      { id: 'bot_panda_cry', name: '😭 Gấu Trúc Khóc Nhè', sprite: 'char_panda_cry', isDj: false },
      { id: 'bot_yaoming', name: '😂 Thánh Cười YaoMing', sprite: 'char_yaoming_laugh', isDj: false },
      { id: 'bot_hoe_fighter', name: '⛏️ Cuốc Một Phát', sprite: 'char_hoe_fighter', isDj: false },
      { id: 'bot_slipper_slap', name: '🩴 Thánh Cầm Dép', sprite: 'char_slipper_slap', isDj: false },
      { id: 'bot_panda_smug', name: '😏 Nụ Cười Đã Tắt', sprite: 'char_panda_smug', isDj: false },
      { id: 'bot_disco_king', name: '👑 King Nấm Quẩy', sprite: 'char_disco_king', isDj: false },
      { id: 'bot_super_duck', name: '🕶️ Vịt ThugLife', sprite: 'char_super_duck', isDj: false },
    ];

    const toAdd = demoNames.slice(0, count);
    for (const item of toAdd) {
      if (!this.dancers.has(item.id)) {
        const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];
        this.dancers.set(item.id, {
          id: item.id,
          name: item.name,
          x: item.isDj ? 0.5 : Math.random() * 0.7 + 0.15,
          y: item.isDj ? 0.25 : 0.95,
          vy: 0,
          vx: (Math.random() - 0.5) * 0.05,
          color: randomColor,
          spriteId: item.sprite,
          scale: 1,
          targetScale: 1,
          state: 'dancing',
          danceOffset: Math.random() * Math.PI * 2,
          isDj: item.isDj,
        });
      }
    }
  }

  clear() {
    this.dancers.clear();
    this.fireworks = [];
    this.camera.lockedOnId = null;
    this.camera.targetScale = 1;
    this.camera.targetX = 0.5;
    this.camera.targetY = 0.5;
  }

  join(id: string, name: string, avatarUrl?: string) {
    if (this.dancers.has(id)) {
      this.jump(id);
      return;
    }

    const randomSprite = SPRITES[Math.floor(Math.random() * SPRITES.length)];
    const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];

    this.dancers.set(id, {
      id,
      name,
      avatarUrl,
      x: Math.random() * 0.8 + 0.1, // Random x between 10% and 90%
      y: -0.1, // Start slightly above screen to fall in
      vy: 0,
      vx: (Math.random() - 0.5) * 0.1, // Slight horizontal drift
      color: randomColor,
      spriteId: randomSprite,
      scale: 1,
      targetScale: 1,
      state: 'dancing',
      danceOffset: Math.random() * Math.PI * 2,
      isDj: false,
    });
  }

  jump(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;
    
    // Only jump if near the floor (DJs are floating, so they can jump anytime)
    if (dancer.y >= 0.95 || dancer.isDj) {
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
      // Spawn some fireworks for the new DJ
      this.triggerFirework(0.3, 0.3);
      this.triggerFirework(0.5, 0.2);
      this.triggerFirework(0.7, 0.3);
    }
  }

  zoomOn(id: string) {
    this.camera.lockedOnId = id;
    this.camera.lockTimeout = Date.now() + 3500; // Lock for 3.5 seconds
  }

  triggerFirework(x?: number, y?: number) {
    this.fireworks.push({
      id: Math.random().toString(36).substr(2, 9),
      x: x !== undefined ? x : Math.random() * 0.8 + 0.1,
      y: y !== undefined ? y : Math.random() * 0.5 + 0.1, // upper half
      createdAt: Date.now()
    });
  }

  tick(now: number) {
    if (!this.lastTick) this.lastTick = now;
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    const GRAVITY = 2.5;
    const FLOOR = 1.0;
    const BOUNCE = -0.4;

    const dancersArray = Array.from(this.dancers.values());
    for (const dancer of dancersArray) {
      // DJ Physics override
      if (dancer.isDj) {
        // DJs float at the top center
        const targetX = 0.5;
        const targetY = 0.25;
        
        // Lerp to DJ position
        dancer.x += (targetX - dancer.x) * 2 * dt;
        dancer.y += (targetY - dancer.y) * 2 * dt;
        dancer.vx = 0;
        dancer.vy = 0;

      } else {
        // Normal Physics
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

        // Wall collision
        if (dancer.x < 0.05) {
          dancer.x = 0.05;
          dancer.vx *= -1;
        } else if (dancer.x > 0.95) {
          dancer.x = 0.95;
          dancer.vx *= -1;
        }
      }

      // Smooth scaling (shrink back to 1 over time)
      if (dancer.targetScale > 1) {
        dancer.targetScale -= dt * 0.5; // Shrink speed
        if (dancer.targetScale < 1) dancer.targetScale = 1;
      }
      // Lerp scale
      dancer.scale += (dancer.targetScale - dancer.scale) * 10 * dt;

      // Dance bobbing
      if (dancer.state === 'dancing' && dancer.vy === 0) {
        dancer.danceOffset += dt * Math.PI * 5; 
        // Random autonomous hops for energetic club atmosphere
        if (Math.random() < 0.004) {
          dancer.vy = -(0.6 + Math.random() * 0.6);
          dancer.state = 'jumping';
        }
        if (Math.random() < 0.008) {
          dancer.vx = (Math.random() - 0.5) * 0.12;
        }
      }
    }

    // Camera logic
    if (this.camera.lockedOnId && now < this.camera.lockTimeout) {
      const lockedDancer = this.dancers.get(this.camera.lockedOnId);
      if (lockedDancer) {
        this.camera.targetX = lockedDancer.x;
        this.camera.targetY = lockedDancer.y;
        this.camera.targetScale = 1.6; // Zoom in 1.6x
      }
    } else {
      this.camera.lockedOnId = null;
      this.camera.targetX = 0.5; // Center
      this.camera.targetY = 0.5;
      this.camera.targetScale = 1.0;
    }

    // Lerp Camera
    this.camera.x += (this.camera.targetX - this.camera.x) * 5 * dt;
    this.camera.y += (this.camera.targetY - this.camera.y) * 5 * dt;
    this.camera.scale += (this.camera.targetScale - this.camera.scale) * 5 * dt;

    // Clean up old fireworks
    this.fireworks = this.fireworks.filter(f => now - f.createdAt < 2000); // 2 seconds
  }
}
