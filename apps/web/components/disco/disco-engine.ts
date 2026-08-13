export interface Dancer {
  id: string; // usually the username
  name: string;
  avatarUrl?: string;
  x: number; // 0 to 1 (percent of screen width)
  y: number; // 0 to 1 (percent of screen height, 1 is floor)
  vy: number;
  vx: number;
  color: string;
  spriteId: string; // 'mushroom_dance', 'mushroom_magic', or 'npc-avatar-00'
  scale: number;
  targetScale: number;
  state: 'idle' | 'dancing' | 'jumping';
  danceOffset: number; // For bobbing up and down
}

export interface Firework {
  id: string;
  x: number;
  y: number;
  createdAt: number;
}

const SPRITES = [
  'mushroom_dance_15',
  'mushroom_magic_02',
  'npc-avatar-00', 'npc-avatar-01', 'npc-avatar-02', 'npc-avatar-03',
  'npc-avatar-04', 'npc-avatar-05', 'npc-avatar-06', 'npc-avatar-07',
  'npc-avatar-08', 'npc-avatar-09', 'npc-avatar-10', 'npc-avatar-11',
  'npc-avatar-12', 'npc-avatar-13', 'npc-avatar-14', 'npc-avatar-15'
];

export class DiscoEngine {
  dancers: Map<string, Dancer> = new Map();
  fireworks: Firework[] = [];
  lastTick: number = 0;
  
  private colors = ['#ff4b4b', '#ff7a4b', '#ffb54b', '#e2ff4b', '#62ff4b', '#4bff9a', '#4be2ff', '#4b7aff', '#9a4bff', '#ff4be2'];

  constructor() {}

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
    });
  }

  jump(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;
    
    // Only jump if near the floor
    if (dancer.y >= 0.95) {
      dancer.vy = -1.2; // Upward velocity
      dancer.state = 'jumping';
    }
  }

  changeAvatar(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;

    // Pick a new random sprite that is different from current
    let newSprite = SPRITES[Math.floor(Math.random() * SPRITES.length)];
    while (newSprite === dancer.spriteId && SPRITES.length > 1) {
      newSprite = SPRITES[Math.floor(Math.random() * SPRITES.length)];
    }
    dancer.spriteId = newSprite;
    
    // Give a little hop
    this.jump(id);
  }

  walk(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;

    // Change horizontal velocity randomly
    dancer.vx = (Math.random() - 0.5) * 0.3;
  }

  grow(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;

    // Scale up temporarily
    dancer.targetScale = 2.5;
    
    // Jump with excitement
    dancer.vy = -1.5;
    dancer.state = 'jumping';
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

    for (const [id, dancer] of this.dancers.entries()) {
      // Apply gravity
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
      }
    }

    // Clean up old fireworks
    this.fireworks = this.fireworks.filter(f => now - f.createdAt < 2000); // 2 seconds
  }
}
