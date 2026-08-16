﻿﻿﻿﻿﻿'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  Suspense,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { GameBattleActionPayload, OverlayAction, RuleActionType } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';

type Character = 'ronaldo' | 'messi';
type GamePhase = 'playing' | 'ronaldo_wins' | 'messi_wins';

const MAX_VISIBLE_BRICKS = 10;

interface BrickItem {
  id: string;
  globalIndex: number;
  falling: boolean;
  donorName: string;
  donorAvatar?: string;
}

function playBrickThud(color: 'red' | 'blue') {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(color === 'red' ? 95 : 75, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    const snap = ctx.createOscillator();
    snap.type = 'square';
    snap.frequency.setValueAtTime(240, now);
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.25, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain); snap.connect(snapGain);
    gain.connect(ctx.destination); snapGain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.25);
    snap.start(now); snap.stop(now + 0.07);
    setTimeout(() => { try { ctx.close(); } catch (_e) { void _e; } }, 500);
  } catch (_e) { void _e; }
}

// Audio fanfares handled inside component with looping audio until new round

const BRICK_FALL_MS = 280;
const BRICK_STAGGER_MS = 70;
const CONFETTI_COUNT = 70;
const WIN_DISPLAY_MS_DEFAULT = 15000;

function makeConfetti(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 5 + Math.random() * 90,
    delay: Math.random() * 1500,
    duration: 1800 + Math.random() * 1800,
    size: 7 + Math.random() * 9,
    color: ['#FFD700','#FF3B30','#007AFF','#34C759','#FF9500','#AF52DE','#FFEAA7'][Math.floor(Math.random() * 7)],
    rotation: Math.random() * 360,
  }));
}

interface IsometricTowerProps {
  character: 'ronaldo' | 'messi';
  bricks: BrickItem[];
  score: number;
  goal: number;
}

// Bảng màu REDS chuẩn từ hình mẫu (DarkRed -> LightSalmon)
const RED_PALETTE = [
  { base: '#8B0000', shadow: '#4d0000', top: '#b81414', stroke: '#ff6666' }, // 0 DarkRed (139,0,0)
  { base: '#B22222', shadow: '#661111', top: '#d93636', stroke: '#ff7a7a' }, // 1 FireBrick (178,34,34)
  { base: '#DC143C', shadow: '#800820', top: '#f03a5e', stroke: '#ff8da2' }, // 2 Crimson (220,20,60)
  { base: '#FF0000', shadow: '#990000', top: '#ff4d4d', stroke: '#ffa6a6' }, // 3 Red (255,0,0)
  { base: '#CD5C5C', shadow: '#782d2d', top: '#df7e7e', stroke: '#ffc2c2' }, // 4 IndianRed (205,92,92)
  { base: '#FA8072', shadow: '#944136', top: '#fca297', stroke: '#ffe0db' }, // 5 Salmon (250,128,114)
  { base: '#E9967A', shadow: '#8a4733', top: '#f1b4a0', stroke: '#ffded4' }, // 6 DarkSalmon (233,150,122)
  { base: '#F08080', shadow: '#913b3b', top: '#f7abab', stroke: '#ffe6e6' }, // 7 LightCoral (240,128,128)
  { base: '#FFA07A', shadow: '#9e4c2e', top: '#ffbea6', stroke: '#ffffff' }, // 8 LightSalmon (255,160,122)
];

// Bảng màu BLUES chuẩn từ hình mẫu (Navy -> IceBlue)
const BLUE_PALETTE = [
  { base: '#023468', shadow: '#011933', top: '#0455a8', stroke: '#4da6ff' }, // 0 Navy Deep
  { base: '#005B9A', shadow: '#002b4a', top: '#007ece', stroke: '#66c2ff' }, // 1 Ocean Blue
  { base: '#006699', shadow: '#00304a', top: '#008ecc', stroke: '#66ccff' }, // 2 Sapphire
  { base: '#006994', shadow: '#003347', top: '#0094cf', stroke: '#80d4ff' }, // 3 Classic Blue
  { base: '#008080', shadow: '#003d3d', top: '#00b3b3', stroke: '#80ffff' }, // 4 Dark Teal
  { base: '#08BBB6', shadow: '#045754', top: '#24e3de', stroke: '#a6ffff' }, // 5 Turquoise
  { base: '#40E0D0', shadow: '#1a6e65', top: '#73ede1', stroke: '#c2fff7' }, // 6 Aqua
  { base: '#82CAFA', shadow: '#3b6887', top: '#b0dffc', stroke: '#e0f3ff' }, // 7 Sky Blue
  { base: '#89D0F0', shadow: '#3b6f87', top: '#b5e3f7', stroke: '#e8f7ff' }, // 8 Baby Blue
  { base: '#AED8E6', shadow: '#4d6c78', top: '#d0ecf5', stroke: '#ffffff' }, // 9 Soft Ice Blue
];

// Hàm sóng Ping-Pong: Đậm -> Nhạt -> Đậm -> Nhạt theo độ cao từng tầng gạch
function getPaletteColor(palette: typeof RED_PALETTE | typeof BLUE_PALETTE, globalIndex: number) {
  const n = palette.length;
  const period = 2 * (n - 1);
  const mod = globalIndex % period;
  const idx = mod < n ? mod : period - mod;
  return palette[idx];
}

function IsometricTower({ character, bricks }: IsometricTowerProps) {
  const isRonaldo = character === 'ronaldo';
  const palette = isRonaldo ? RED_PALETTE : BLUE_PALETTE;
  
  // Khối gạch 3D vuông chuẩn cân đối (True Square Isometric Block)
  const SLAB_H = 15; // Chiều cao phiến gạch vừa vặn, chuẩn hình khối vuông
  const BASE_Y = 235; // Đáy tháp
  const LX = 14; // Góc trái
  const TX = 46; // Đỉnh nóc
  const CX = 58; // Gờ giữa (nghiêng nhẹ sang phải 58/104, tạo khối hộp vuông 3D)
  const RX = 90; // Góc phải
  const TY = 3;  // Độ cao đỉnh nóc
  const LY = 16; // Độ cao góc trái
  const CY = 29; // Độ cao gờ giữa
  const RY = 16; // Độ cao góc phải
  
  return (
    <div className="iso-tower-wrap">
      <svg 
        viewBox="0 0 104 280" 
        className="iso-tower-svg"
      >
        <defs>
          <filter id="isoTowerShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.85" />
          </filter>
        </defs>

        <g filter="url(#isoTowerShadow)">
          {/* Móng trụ khi chưa có gạch */}
          {bricks.length === 0 && (
            <g opacity="0.35">
              <polygon 
                points={`${TX},${BASE_Y + TY} ${RX},${BASE_Y + RY} ${CX},${BASE_Y + CY} ${LX},${BASE_Y + LY}`}
                fill={palette[0].top}
                stroke={palette[0].stroke}
                strokeWidth="1.2"
              />
              <polygon 
                points={`${LX},${BASE_Y + LY} ${CX},${BASE_Y + CY} ${CX},${BASE_Y + CY + SLAB_H} ${LX},${BASE_Y + LY + SLAB_H}`}
                fill={palette[0].base}
                stroke="#000"
                strokeWidth="1"
              />
              <polygon 
                points={`${CX},${BASE_Y + CY} ${RX},${BASE_Y + RY} ${RX},${BASE_Y + RY + SLAB_H} ${CX},${BASE_Y + CY + SLAB_H}`}
                fill={palette[0].shadow}
                stroke="#000"
                strokeWidth="1"
              />
            </g>
          )}

          {/* Các tầng gạch xếp chồng theo độ cao với sóng màu Đậm -> Nhạt -> Đậm -> Nhạt */}
          {bricks.map((br, index) => {
            const y = BASE_Y - index * SLAB_H;
            const isTop = index === bricks.length - 1;
            
            // Lấy màu sắc dựa trên globalIndex của viên gạch để màu biến thiên sóng liên tục
            const item = getPaletteColor(palette, br.globalIndex);
            const seamColor = isRonaldo ? 'rgba(30,0,5,0.85)' : 'rgba(0,14,30,0.85)';

            return (
              <g 
                key={br.id} 
                className={br.falling ? "iso-slab-falling" : ""}
                style={{ transformOrigin: `${CX}px ${y + CY}px` }}
              >
                {/* 1. Mặt Trước - Trái (Khối gạch vuông nhìn chéo) */}
                <polygon
                  points={`${LX},${y + LY} ${CX},${y + CY} ${CX},${y + CY + SLAB_H} ${LX},${y + LY + SLAB_H}`}
                  fill={item.base}
                  stroke={seamColor}
                  strokeWidth="1"
                />

                {/* 2. Mặt Hông - Phải (Đổ bóng 3D chiều sâu) */}
                <polygon
                  points={`${CX},${y + CY} ${RX},${y + RY} ${RX},${y + RY + SLAB_H} ${CX},${y + CY + SLAB_H}`}
                  fill={item.shadow}
                  stroke={seamColor}
                  strokeWidth="1"
                />

                {/* 3. Đường gờ giữa (Center Ridge Line) */}
                <line
                  x1={CX} y1={y + CY}
                  x2={CX} y2={y + CY + SLAB_H}
                  stroke={item.stroke}
                  strokeWidth="1"
                />

                {/* 4. Mép trái (Left Edge Highlight) */}
                <line
                  x1={LX} y1={y + LY}
                  x2={LX} y2={y + LY + SLAB_H}
                  stroke={item.stroke}
                  strokeWidth="1"
                />

                {/* 5. Nóc Kim Cương Isometric (Hiển thị cho tầng trên cùng) */}
                {isTop && (
                  <polygon
                    points={`${TX},${y + TY} ${RX},${y + RY} ${CX},${y + CY} ${LX},${y + LY}`}
                    fill={item.top}
                    stroke={item.stroke}
                    strokeWidth="1.6"
                  />
                )}

                {/* Tên người tặng đặt căn giữa chuẩn xác bên trong mặt trước gạch */}
                {br.donorName && (
                  <g transform={`translate(36, ${y + (LY + CY) / 2 + SLAB_H / 2}) rotate(16.46)`}>
                    <text
                      x="0"
                      y="0"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="7.4"
                      fontWeight="900"
                      fontFamily="'Montserrat', 'Segoe UI', sans-serif"
                      style={{
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.95))',
                      }}
                    >
                      {br.donorName.length > 8 ? br.donorName.slice(0, 7) + '…' : br.donorName}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function BattleOverlayContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const goal = parseInt(searchParams.get('goal') ?? '50', 10) || 50;
  const winDisplayMs = parseInt(searchParams.get('resetAfterMs') ?? String(WIN_DISPLAY_MS_DEFAULT), 10) || WIN_DISPLAY_MS_DEFAULT;
  const ronaldoImg = searchParams.get('ronaldoImg') || '/ronaldo-battle.png';
  const messiImg = searchParams.get('messiImg') || '/messi-battle.png';

  // Configurable Names & Custom Coordinates
  const leftName = searchParams.get('leftName') || 'RONALDO';
  const rightName = searchParams.get('rightName') || 'MESSI';
  const leftNameX = parseFloat(searchParams.get('leftNameX') ?? '8');
  const leftNameY = parseFloat(searchParams.get('leftNameY') ?? '14');
  const rightNameX = parseFloat(searchParams.get('rightNameX') ?? '62');
  const rightNameY = parseFloat(searchParams.get('rightNameY') ?? '14');
  const hudY = parseFloat(searchParams.get('hudY') ?? '4');
  const brickY = parseFloat(searchParams.get('brickY') ?? '88');

  const [ronaldoBricks, setRonaldoBricks] = useState<BrickItem[]>([]);
  const [messiBricks, setMessiBricks] = useState<BrickItem[]>([]);
  const [ronaldoCount, setRonaldoCount] = useState(0);
  const [messiCount, setMessiCount] = useState(0);
  const [phase, setPhase] = useState<GamePhase>('playing');
  const [confetti, setConfetti] = useState<ReturnType<typeof makeConfetti>>([]);

  useEffect(() => {
    if (phase !== 'playing') {
      setConfetti(makeConfetti(CONFETTI_COUNT));
    } else {
      setConfetti([]);
    }
  }, [phase]);
  const [shakeLeft, setShakeLeft] = useState(false);
  const [shakeRight, setShakeRight] = useState(false);

  const brickIdRef = useRef(0);
  const totalRonaldoRef = useRef(0);
  const totalMessiRef = useRef(0);
  const pendingRonaldo = useRef(0);
  const pendingMessi = useRef(0);
  const phaseRef = useRef<GamePhase>('playing');
  phaseRef.current = phase;
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopWinAudio = useCallback(() => {
    if (winAudioRef.current) {
      try {
        winAudioRef.current.pause();
        winAudioRef.current.currentTime = 0;
      } catch (_e) { void _e; }
      winAudioRef.current = null;
    }
  }, []);

  const playWinFanfare = useCallback((winner: Character) => {
    stopWinAudio();
    if (winner === 'ronaldo') {
      try {
        const audio = new Audio('/battle/siuuu.mp3');
        audio.loop = true; // Loop repeatedly until new round!
        audio.volume = 1.0;
        winAudioRef.current = audio;
        audio.play().catch((err) => console.log('Audio autoplay:', err));
      } catch (_e) { void _e; }
    } else {
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance('Messi! Campeón!');
          utter.pitch = 1.2;
          utter.rate = 0.95;
          window.speechSynthesis.speak(utter);
        }
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        [440, 554.37, 659.25, 880, 1108.73].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.14);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, now + idx * 0.14);
          g.gain.linearRampToValueAtTime(0.4, now + 0.05 + idx * 0.14);
          g.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(now + idx * 0.14);
          osc.stop(now + 2.3);
        });
        setTimeout(() => { try { ctx.close(); } catch (_e) { void _e; } }, 3500);
      } catch (_e) { void _e; }
    }
  }, [stopWinAudio]);

  const addBricks = useCallback((character: Character, count: number, donorName = 'Khán giả', donorAvatar?: string) => {
    if (phaseRef.current !== 'playing') return;
    const isRonaldo = character === 'ronaldo';
    const color: 'red' | 'blue' = isRonaldo ? 'red' : 'blue';
    const setBricks = isRonaldo ? setRonaldoBricks : setMessiBricks;
    const setCount = isRonaldo ? setRonaldoCount : setMessiCount;
    const pendingRef = isRonaldo ? pendingRonaldo : pendingMessi;
    const setShake = isRonaldo ? setShakeLeft : setShakeRight;
    const totalRef = isRonaldo ? totalRonaldoRef : totalMessiRef;
    const currentOffset = pendingRef.current;
    pendingRef.current += count;

    for (let b = 0; b < count; b++) {
      const delay = (currentOffset + b) * BRICK_STAGGER_MS;
      setTimeout(() => {
        if (phaseRef.current !== 'playing') return;
        const id = `b${brickIdRef.current++}`;
        const globalIndex = totalRef.current++;
        playBrickThud(color);

        // 1. Thêm đúng 1 viên gạch độc lập lên đỉnh (không lồng trong setCount)
        setBricks(prevBricks => {
          const trimmed = prevBricks.length >= MAX_VISIBLE_BRICKS ? prevBricks.slice(1) : prevBricks;
          return [...trimmed, { id, globalIndex, falling: true, donorName, donorAvatar }];
        });

        // 2. Tăng điểm độc lập
        setCount(prev => {
          const next = prev + 1;
          if (next >= goal) {
            setTimeout(() => {
              setPhase(character === 'ronaldo' ? 'ronaldo_wins' : 'messi_wins');
              playWinFanfare(character);
            }, BRICK_FALL_MS + 40);
          }
          return next;
        });

        setTimeout(() => {
          setBricks(prev => prev.map(br => br.id === id ? { ...br, falling: false } : br));
          setShake(true);
          setTimeout(() => setShake(false), 250);
        }, BRICK_FALL_MS);
      }, delay);
    }
    setTimeout(() => { pendingRef.current = Math.max(0, pendingRef.current - count); },
      (currentOffset + count) * BRICK_STAGGER_MS + BRICK_FALL_MS + 100);
  }, [goal, playWinFanfare]);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === '1' || e.key === 'q' || e.key === 'Q') {
        addBricks('ronaldo', 1, '@Fan_CR7');
      } else if (e.key === '2' || e.key === 'w' || e.key === 'W') {
        addBricks('messi', 1, '@Fan_M10');
      } else if (e.key === '5') {
        addBricks('ronaldo', 5, '@SiuuuKing');
      } else if (e.key === '6') {
        addBricks('messi', 5, '@LeoMessiVN');
      } else if (e.key === 'r' || e.key === 'R') {
        stopWinAudio();
        setRonaldoBricks([]); setMessiBricks([]);
        setRonaldoCount(0); setMessiCount(0);
        setPhase('playing');
        pendingRonaldo.current = 0; pendingMessi.current = 0;
        totalRonaldoRef.current = 0; totalMessiRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addBricks]);

  useEffect(() => {
    if (phase === 'playing') return;
    const t = setTimeout(() => {
      stopWinAudio();
      setRonaldoBricks([]); setMessiBricks([]);
      setRonaldoCount(0); setMessiCount(0);
      setPhase('playing');
      pendingRonaldo.current = 0; pendingMessi.current = 0;
    }, winDisplayMs);
    return () => clearTimeout(t);
  }, [phase, winDisplayMs, stopWinAudio]);

  const handleAction = useCallback((action: OverlayAction) => {
    if (action.type !== RuleActionType.GAME_BATTLE_ACTION) return;
    const p = action.payload as unknown as GameBattleActionPayload;
    if (!p.character) return;
    const donorName = (action as any).event?.senderDisplayName || (action as any).event?.senderUsername || 'Khán giả';
    const donorAvatar = (action as any).event?.senderAvatar;
    addBricks(p.character, Math.max(1, Math.min(20, p.bricks ?? 1)), donorName, donorAvatar);
  }, [addBricks]);

  const { status, rejectionCode } = useOverlaySocket(token, { onAction: handleAction });

  const statusMessage = !token ? 'Thiếu ?token=' :
    status === 'connecting' ? 'Đang kết nối…' :
    status === 'reconnecting' ? 'Mất kết nối — thử lại…' :
    status === 'rejected' ? `Token lỗi (${rejectionCode ?? 'unknown'})` : null;

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        
        /* 9:16 Vertical Container for TikTok Studio (1080x1920) */
        .battle-root { 
          width: 100%; 
          height: 100%; 
          max-width: calc(100vh * (9 / 16)); 
          aspect-ratio: 9 / 16; 
          display: flex; 
          flex-direction: column; 
          background: #000000; 
          overflow: hidden; 
          position: relative; 
          box-shadow: 0 0 50px rgba(0,0,0,0.9);
        }
        
        @media (max-aspect-ratio: 9/16) {
          .battle-root {
            max-width: 100vw;
            height: calc(100vw * (16 / 9));
          }
        }

        /* 1:1 Full Background Arena matching Config Cropper */
        .arena-bg-layer {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          width: 100%;
          height: 100%;
          z-index: 1;
        }

        .bg-half {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .bg-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          display: block;
        }

                /* Dynamic Positioned Separate Progress HUD for Each Side */
        .hud-container {
          position: absolute;
          left: 10px;
          right: 10px;
          z-index: 25;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          pointer-events: none;
        }

        .team-hud {
          display: flex;
          flex-direction: column;
          gap: 5px;
          background: rgba(0, 0, 0, 0.88);
          padding: 8px 12px;
          border-radius: 8px;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
        }
        .team-hud.r {
          border: 1.5px solid rgba(220, 20, 60, 0.6);
          box-shadow: 0 4px 20px rgba(220, 20, 60, 0.25), inset 0 1px 0 rgba(255, 100, 100, 0.3);
        }
        .team-hud.m {
          border: 1.5px solid rgba(0, 153, 255, 0.6);
          box-shadow: 0 4px 20px rgba(0, 153, 255, 0.25), inset 0 1px 0 rgba(100, 200, 255, 0.3);
        }

        .hud-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Bebas Neue', 'Montserrat', sans-serif;
          letter-spacing: 1px;
        }
        .hud-title {
          font-size: 14px;
          font-weight: 900;
        }
        .hud-title.r { color: #ff5566; text-shadow: 0 0 10px rgba(255, 50, 50, 0.6); }
        .hud-title.m { color: #55aaff; text-shadow: 0 0 10px rgba(50, 150, 255, 0.6); }

        .hud-score {
          font-size: 14px;
          font-weight: 900;
        }
        .hud-score.r { color: #ffffff; text-shadow: 0 0 8px #ff4444; }
        .hud-score.m { color: #ffffff; text-shadow: 0 0 8px #3399ff; }

        .hud-track {
          width: 100%;
          height: 12px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.12);
          overflow: hidden;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .hud-fill {
          height: 100%;
          border-radius: 5px;
          transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hud-fill.r {
          background: linear-gradient(90deg, #8B0000, #DC143C, #FF3344);
          box-shadow: 0 0 14px #ff3344;
        }
        .hud-fill.m {
          background: linear-gradient(90deg, #023468, #0066cc, #3399ff);
          box-shadow: 0 0 14px #3399ff;
        }

        /* Dynamic Custom Badges */
        .custom-badge {
          position: absolute;
          z-index: 30;
          font-family: 'Bebas Neue', 'Impact', sans-serif;
          font-size: clamp(1.4rem, 4.5vw, 2.2rem);
          letter-spacing: 2px;
          padding: 4px 14px;
          border-radius: 6px;
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(0,0,0,0.8);
          border: 1.5px solid rgba(255,255,255,0.6);
          pointer-events: none;
        }
        .custom-badge.r {
          background: linear-gradient(135deg, rgba(220,20,60,0.9), rgba(139,0,0,0.9));
          text-shadow: 0 0 15px #ff4444;
        }
        .custom-badge.m {
          background: linear-gradient(135deg, rgba(0,102,204,0.9), rgba(0,34,102,0.9));
          text-shadow: 0 0 15px #3399ff;
        }

        /* Interactive Click Zones */
        .interactive-arena {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: grid;
          grid-template-columns: 1fr 4px 1fr;
        }

        .divider-line { 
          background: linear-gradient(180deg, transparent, rgba(255,255,255,.5) 15%, #ffffff 50%, rgba(255,255,255,.5) 85%, transparent); 
          position: relative; 
          box-shadow: 0 0 16px rgba(255,255,255,0.9);
          z-index: 15;
          pointer-events: none;
        }
        .divider-line::before { 
          content:'⚡'; 
          position:absolute; 
          top:50%; 
          left:50%; 
          transform:translate(-50%,-50%); 
          font-size:1.4rem; 
          background:#000000; 
          padding:5px; 
          border-radius:50%; 
          border:2px solid #fff; 
          box-shadow: 0 0 20px #ffcc00;
        }

        .panel-zone { 
          position:relative; 
          cursor: pointer;
          display:flex; 
          flex-direction:column; 
          justify-content:flex-end;
          padding: 16px;
        }

                /* ─── ISOMETRIC 3D BRICK COLUMN & TILES (Matches Reference Image) ─── */
        .bcol { 
          position: absolute; 
          width: clamp(120px, 32vw, 175px); 
          display: flex; 
          flex-direction: column-reverse; 
          align-items: stretch; 
          z-index: 15; 
          max-height: 52vh;
          overflow: visible;
          filter: drop-shadow(0 8px 22px rgba(0,0,0,0.85));
        }
                .panel-zone.r .bcol { left: 50%; transform: translateX(-50%); }
        .panel-zone.m .bcol { left: 50%; transform: translateX(-50%); }
        .panel-zone.r .sbadge { left: 50%; transform: translateX(-50%); }
        .panel-zone.m .sbadge { left: 50%; transform: translateX(-50%); }

        @keyframes brickFall { 
          0%{transform:translateY(-50vh) scale(0.9);opacity:0} 
          60%{transform:translateY(4px) scale(1.02);opacity:1} 
          80%{transform:translateY(-2px) scale(0.99)} 
          100%{transform:translateY(0) scale(1);opacity:1} 
        }
        
        .brick { 
          height: clamp(22px, 3.2vh, 28px); 
          margin-top: -1px;
          display: flex;
          align-items: center;
          padding: 0 8px;
          gap: 6px;
          position: relative;
          box-sizing: border-box;
        }
        .brick.falling { animation:brickFall ${BRICK_FALL_MS}ms cubic-bezier(.34,1.56,.64,1) both; }
        
        /* 3D Isometric Red Slab (Ronaldo) */
        .brick.rb { 
          background: linear-gradient(180deg, #d61834 0%, #a80e22 55%, #7a0817 100%); 
          border-left: 4px solid #ff4d66;
          border-right: 5px solid #4a000b;
          border-bottom: 2px solid #360007;
          border-top: 1px solid rgba(255,140,160,0.5);
          box-shadow: inset 0 1px 0 rgba(255,200,210,0.4), 0 3px 6px rgba(0,0,0,0.6);
        }
        
        /* 3D Isometric Blue Slab (Messi) */
        .brick.mb { 
          background: linear-gradient(180deg, #0984e3 0%, #0066b8 55%, #004580 100%); 
          border-left: 4px solid #6ad0f5;
          border-right: 5px solid #002244;
          border-bottom: 2px solid #00152b;
          border-top: 1px solid rgba(180,235,255,0.5);
          box-shadow: inset 0 1px 0 rgba(210,245,255,0.4), 0 3px 6px rgba(0,0,0,0.6);
        }

        /* 3D Isometric Top Roof Cap */
        .iso-top-cap {
          position: absolute;
          top: -16px;
          left: -4px;
          right: -5px;
          height: 16px;
          pointer-events: none;
          z-index: 10;
        }
        .iso-top-cap.r {
          background: linear-gradient(135deg, #ff7a8c 0%, #ff4757 50%, #c91834 100%);
          border-top: 2px solid #ffa3af;
          border-left: 2px solid #ff7a8c;
          border-right: 2px solid #800818;
          clip-path: polygon(14% 0%, 86% 0%, 100% 100%, 0% 100%);
          box-shadow: 0 -4px 12px rgba(255,70,90,0.6);
        }
        .iso-top-cap.m {
          background: linear-gradient(135deg, #a0e6ff 0%, #54c3f5 50%, #0984e3 100%);
          border-top: 2px solid #d4f4ff;
          border-left: 2px solid #a0e6ff;
          border-right: 2px solid #004580;
          clip-path: polygon(14% 0%, 86% 0%, 100% 100%, 0% 100%);
          box-shadow: 0 -4px 12px rgba(100,200,255,0.6);
        }

        .brick-avatar {
          width: 17px;
          height: 17px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid rgba(255,255,255,0.8);
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
        .brick-avatar-placeholder {
          font-size: 11px;
          line-height: 1;
          flex-shrink: 0;
          opacity: 0.85;
        }
        .brick-donor-name {
          font-size: clamp(8.5px, 2vw, 10.5px);
          font-weight: 800;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 1px 2px rgba(0,0,0,0.9);
          letter-spacing: 0.3px;
        }

                @keyframes colShake { 
          0%{transform: translateX(-50%)} 
          20%{transform: translateX(calc(-50% - 6px))} 
          40%{transform: translateX(calc(-50% + 6px))} 
          60%{transform: translateX(calc(-50% - 3px))} 
          80%{transform: translateX(calc(-50% + 3px))} 
          100%{transform: translateX(-50%)} 
        }
        .col-shake { animation: colShake .28s ease-in-out; }

        .sbadge { 
          position: absolute; 
          font-family: 'Bebas Neue', 'Impact', sans-serif;
          font-size: clamp(1rem, 3vw, 1.3rem); 
          letter-spacing: 1.5px; 
          padding: 2px 10px; 
          border-radius: 6px; 
          z-index: 16; 
          backdrop-filter: blur(6px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.8);
        }
        .sbadge.r { right: 12px; color: #ffffff; background: rgba(214, 24, 52, 0.9); border: 1.5px solid #ff7a8c; }
        .sbadge.m { left: 12px; color: #ffffff; background: rgba(9, 132, 227, 0.9); border: 1.5px solid #70d3ff; }

        /* ─── RONALDO SIUUU CELEBRATION MODAL ─── */
        .wov { 
          position:absolute; 
          inset:0; 
          display:flex; 
          flex-direction:column; 
          align-items:center; 
          justify-content:center; 
          z-index:100; 
          background:rgba(0,0,0,.88); 
          backdrop-filter:blur(10px); 
          padding: 20px;
        }

        @keyframes siuuuPop { 
          0%{transform:scale(0.3) translateY(40px); opacity:0} 
          50%{transform:scale(1.1) translateY(-10px); opacity:1} 
          70%{transform:scale(0.95) translateY(2px)} 
          100%{transform:scale(1) translateY(0); opacity:1} 
        }

        .celebration-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          animation: siuuuPop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          width: 100%;
          max-width: 420px;
        }

        .wtxt-title { 
          font-family:'Bebas Neue','Impact',sans-serif; 
          font-size:clamp(3rem, 11vw, 5.2rem); 
          letter-spacing:4px; 
          margin-bottom: 8px;
        }
        .wtxt-title.r {
          color: #ff3333;
          text-shadow: 0 0 35px #ff2222, 0 0 70px #ff0000;
        }
        .wtxt-title.m {
          color: #3399ff;
          text-shadow: 0 0 35px #3399ff, 0 0 70px #0066ff;
        }

        .celebration-gif-wrap {
          width: clamp(240px, 75vw, 360px);
          max-height: 48vh;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 0 40px rgba(255, 68, 68, 0.6), 0 0 80px rgba(255, 0, 0, 0.4);
          border: 3px solid #ff4444;
          background: #000;
          margin: 6px 0 12px;
        }
        .celebration-gif-wrap.m {
          box-shadow: 0 0 40px rgba(51, 153, 255, 0.6), 0 0 80px rgba(0, 102, 255, 0.4);
          border: 3px solid #3399ff;
        }

        .celebration-gif {
          width: 100%;
          height: auto;
          display: block;
          object-fit: cover;
        }
        
        .wtrophies { 
          font-size:clamp(2rem, 7vw, 3.5rem); 
          letter-spacing:14px; 
        }

        @keyframes cfall { 
          0%{transform:translateY(-10vh) rotate(0);opacity:1} 
          100%{transform:translateY(110vh) rotate(720deg);opacity:0} 
        }
        .cp { position:absolute; top:0; border-radius:2px; pointer-events:none; }
        .stbadge { position:absolute; top:8px; left:8px; z-index:200; padding:4px 10px; border-radius:6px; background:rgba(0,0,0,.75); color:#fff; font-size:.75rem; pointer-events:none; }
      `}</style>
      
      <div className="battle-root">
        {statusMessage && <div className="stbadge">{statusMessage}</div>}

        {/* Layer 1: Pixel-Perfect Full Background from Config */}
        <div className="arena-bg-layer">
          <div className="bg-half">
            <img 
              src={ronaldoImg} 
              alt={leftName} 
              className="bg-img"
              onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}}
            />
          </div>
          <div className="bg-half">
            <img 
              src={messiImg} 
              alt={rightName} 
              className="bg-img"
              onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}}
            />
          </div>
        </div>

        {/* Layer 2: Custom Draggable Left & Right Names */}
        <div className="custom-badge r" style={{ top: `${leftNameY}%`, left: `${leftNameX}%` }}>
          {leftName}
        </div>
        <div className="custom-badge m" style={{ top: `${rightNameY}%`, left: `${rightNameX}%` }}>
          {rightName}
        </div>

                {/* Layer 3: Separate Progress HUD for Each Side */}
        <div className="hud-container" style={{ top: `${hudY}%` }}>
          {/* Left Progress Box (Ronaldo) */}
          <div className="team-hud r">
            <div className="hud-header">
              <span className="hud-title r">🧱 {leftName}</span>
              <span className="hud-score r">{ronaldoCount} / {goal}</span>
            </div>
            <div className="hud-track">
              <div
                className="hud-fill r"
                style={{ width: `${Math.min(100, (ronaldoCount / goal) * 100)}%` }}
              />
            </div>
          </div>

          {/* Right Progress Box (Messi) */}
          <div className="team-hud m">
            <div className="hud-header">
              <span className="hud-title m">🧱 {rightName}</span>
              <span className="hud-score m">{messiCount} / {goal}</span>
            </div>
            <div className="hud-track">
              <div
                className="hud-fill m"
                style={{ width: `${Math.min(100, (messiCount / goal) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Layer 4: Interactive Click Zones & Bricks with Avatars */}
        <div className="interactive-arena">
          {/* Left Zone (Ronaldo) */}
          <div className="panel-zone r" title="Phe Ronaldo - nhấn Q để test">
            <div className={`iso-tower-wrap${shakeLeft ? ' col-shake' : ''}`} style={{ bottom: `${100 - brickY}%` }}>
              <IsometricTower character="ronaldo" bricks={ronaldoBricks} score={ronaldoCount} goal={goal} />
            </div>
            <div className="sbadge r" style={{ bottom: `${Math.max(10, 100 - brickY - 6)}%` }}>
              {ronaldoCount.toString().padStart(2,'0')} / {goal}
            </div>
          </div>

          {/* Center Lightning Divider */}
          <div className="divider-line"/>

          {/* Right Zone (Messi) */}
          <div className="panel-zone m" title="Phe Messi - nhấn W để test">
            <div className={`iso-tower-wrap${shakeRight ? ' col-shake' : ''}`} style={{ bottom: `${100 - brickY}%` }}>
              <IsometricTower character="messi" bricks={messiBricks} score={messiCount} goal={goal} />
            </div>
            <div className="sbadge m" style={{ bottom: `${Math.max(10, 100 - brickY - 6)}%` }}>
              {messiCount.toString().padStart(2,'0')} / {goal}
            </div>
          </div>
        </div>

        {/* Winner Overlay Modal (User's Exact SIUUU GIF + MP3 Sound) */}
        {phase !== 'playing' && (
          <div className="wov">
            <div className="celebration-card">
              {phase === 'ronaldo_wins' ? (
                <>
                  <div className="wtxt-title r">RONALDO WINS!</div>
                  <div className="celebration-gif-wrap r">
                    <img 
                      src="/battle/ronaldo-siu.gif" 
                      alt="Ronaldo SIU" 
                      className="celebration-gif" 
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="wtxt-title m">{rightName.toUpperCase()} WINS!</div>
                  <div className="celebration-gif-wrap m" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '180px' }}>
                    <div style={{ fontSize: '4rem' }}>👑⚽🏆</div>
                    <div style={{ color: '#3399ff', fontWeight: 900, fontSize: '1.4rem', marginTop: '8px' }}>CAMPEÓN DEL MUNDO</div>
                  </div>
                </>
              )}
              <div className="wtrophies">🏆 ⭐ 🏆</div>
            </div>
            {confetti.map(c => (
              <div
                key={c.id}
                className="cp"
                style={{
                  left: `${c.x}%`,
                  width: `${c.size}px`,
                  height: `${c.size * 1.5}px`,
                  backgroundColor: c.color,
                  animation: `cfall ${c.duration}ms linear infinite`,
                  animationDelay: `${c.delay}ms`,
                  transform: `rotate(${c.rotation}deg)`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BattleOverlayPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: '100vw', height: '100vh', background: 'transparent' }} />;
  }

  return (
    <Suspense fallback={<div style={{ width: '100vw', height: '100vh', background: 'transparent' }} />}>
      <BattleOverlayContent />
    </Suspense>
  );
}
