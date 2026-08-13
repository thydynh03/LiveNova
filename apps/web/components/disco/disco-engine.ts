export interface Dancer {
  id: string; // usually the username
  name: string;
  avatarUrl?: string;
  x: number; // 0 to 1 (percent of screen width)
  y: number; // 0 to 1 (percent of screen height, 1 is floor)
  vy: number;
  vx: number;
  color: string;
  emoji: string;
  scale: number;
  state: 'idle' | 'dancing' | 'jumping';
  danceOffset: number; // For bobbing up and down
}

export class DiscoEngine {
  dancers: Map<string, Dancer> = new Map();
  lastTick: number = 0;
  
  private emojis = ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄', '🦖', '🐉'];
  private colors = ['#ff4b4b', '#ff7a4b', '#ffb54b', '#e2ff4b', '#62ff4b', '#4bff9a', '#4be2ff', '#4b7aff', '#9a4bff', '#ff4be2'];

  constructor() {}

  join(id: string, name: string, avatarUrl?: string) {
    if (this.dancers.has(id)) {
      // If already joined, maybe just jump
      this.jump(id);
      return;
    }

    const randomEmoji = this.emojis[Math.floor(Math.random() * this.emojis.length)];
    const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];

    this.dancers.set(id, {
      id,
      name,
      avatarUrl,
      x: Math.random() * 0.8 + 0.1, // Random x between 10% and 90%
      y: -0.1, // Start slightly above screen to fall in
      vy: 0,
      vx: (Math.random() - 0.5) * 0.05, // Slight horizontal drift
      color: randomColor,
      emoji: randomEmoji,
      scale: 1,
      state: 'dancing',
      danceOffset: Math.random() * Math.PI * 2,
    });
  }

  jump(id: string) {
    const dancer = this.dancers.get(id);
    if (!dancer) return;
    
    // Only jump if near the floor
    if (dancer.y >= 0.95) {
      dancer.vy = -0.8; // Upward velocity
      dancer.state = 'jumping';
    }
  }

  tick(now: number) {
    if (!this.lastTick) this.lastTick = now;
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    const GRAVITY = 2.0;
    const FLOOR = 1.0;
    const BOUNCE = -0.3;

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

      // Dance bobbing
      if (dancer.state === 'dancing' && dancer.vy === 0) {
        // Bounce to a 120BPM beat (2 beats per second)
        dancer.danceOffset += dt * Math.PI * 4; 
      }
    }
  }
}
