'use client';

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
  stackIndex: number;
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
  const [confetti] = useState(() => makeConfetti(CONFETTI_COUNT));
  const [shakeLeft, setShakeLeft] = useState(false);
  const [shakeRight, setShakeRight] = useState(false);

  const brickIdRef = useRef(0);
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
    const currentOffset = pendingRef.current;
    pendingRef.current += count;

    for (let b = 0; b < count; b++) {
      const delay = (currentOffset + b) * BRICK_STAGGER_MS;
      setTimeout(() => {
        if (phaseRef.current !== 'playing') return;
        const id = `b${brickIdRef.current++}`;
        playBrickThud(color);

        setBricks(prev => {
          const trimmed = prev.length >= MAX_VISIBLE_BRICKS ? prev.slice(1) : prev;
          return [...trimmed, { id, stackIndex: prev.length, falling: true, donorName, donorAvatar }];
        });

        setTimeout(() => {
          setBricks(prev => prev.map(br => br.id === id ? { ...br, falling: false } : br));
          setShake(true);
          setTimeout(() => setShake(false), 250);
        }, BRICK_FALL_MS);

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
      }, delay);
    }
    setTimeout(() => { pendingRef.current = Math.max(0, pendingRef.current - count); },
      (currentOffset + count) * BRICK_STAGGER_MS + BRICK_FALL_MS + 100);
  }, [goal]);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    const handleKeyDown = (e: KeyboardEvent) => {
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

        /* Dynamic Draggable Positioned Progress HUD Layer */
        .dynamic-hud {
          position: absolute;
          left: 12px;
          right: 12px;
          z-index: 25;
          display: flex;
          flex-direction: column;
          background: rgba(0,0,0,0.85);
          padding: 8px 12px;
          border-radius: 8px;
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.2);
          box-shadow: 0 8px 24px rgba(0,0,0,0.8);
        }

        .prow { 
          display:grid; 
          grid-template-columns:1fr 1fr; 
          gap: 12px; 
        }
        .pbwrap { display:flex; flex-direction:column; gap:4px; }
        .pbtrack { height:12px; border-radius:6px; background:rgba(255,255,255,.18); overflow:hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.6); }
        .pbfill { height:100%; border-radius:6px; transition:width .35s cubic-bezier(.4,0,.2,1); }
        .pbfill.r { background:linear-gradient(90deg,#cc0000,#ff4444); box-shadow:0 0 14px #ff4444; }
        .pbfill.m { background:linear-gradient(90deg,#0055ff,#3399ff); box-shadow:0 0 14px #3399ff; }
        .plbl { font-size:12px; font-weight:900; letter-spacing:1px; }
        .plbl.r { color:#ff4444; }
        .plbl.m { color:#3399ff; text-align:right; }

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

        /* Brick Columns with Customizable Bottom Offset */
        .bcol { 
          position:absolute; 
          width: clamp(105px, 28vw, 155px); 
          display: flex; 
          flex-direction: column-reverse; 
          align-items: stretch; 
          z-index: 15; 
          max-height: 45vh;
          overflow: hidden;
        }
        .panel-zone.r .bcol { right: 12px; }
        .panel-zone.m .bcol { left: 12px; }

        @keyframes brickFall { 
          0%{transform:translateY(-60vh) scaleY(0.8);opacity:0} 
          55%{transform:translateY(5px) scaleY(1.04);opacity:1} 
          75%{transform:translateY(-2px) scaleY(0.98)} 
          100%{transform:translateY(0) scaleY(1);opacity:1} 
        }
        
        .brick { 
          height: clamp(28px, 4.2vh, 38px); 
          border-radius: 5px 5px 3px 3px; 
          margin: 2px 0 0; 
          display: flex;
          align-items: center;
          padding: 0 8px;
          gap: 6px;
          overflow: hidden;
          position: relative;
        }
        .brick::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 35%;
          background: linear-gradient(to bottom, rgba(255,255,255,0.22), rgba(255,255,255,0));
          border-radius: 5px 5px 0 0;
          pointer-events: none;
          z-index: 2;
        }
        .brick > * { position: relative; z-index: 3; }
        .brick.falling { animation:brickFall ${BRICK_FALL_MS}ms cubic-bezier(.34,1.56,.64,1) both; }
        
        .brick.rb { 
          background: linear-gradient(180deg, #ff6644 0%, #cc1100 45%, #8a0a00 100%); 
          border-top: 2px solid #ff9977;
          border-bottom: 3px solid #550800;
          border-left: 1.5px solid #dd3311;
          border-right: 1.5px solid #990d00;
          box-shadow: 0 4px 0 0 #440600, 0 6px 18px rgba(220,30,0,0.8), inset 0 -2px 4px rgba(0,0,0,0.3);
        }
        .brick.mb { 
          background: linear-gradient(180deg, #55aaff 0%, #0055cc 45%, #003388 100%); 
          border-top: 2px solid #88ccff;
          border-bottom: 3px solid #002266;
          border-left: 1.5px solid #1166ee;
          border-right: 1.5px solid #0044aa;
          box-shadow: 0 4px 0 0 #001844, 0 6px 18px rgba(0,100,220,0.8), inset 0 -2px 4px rgba(0,0,0,0.3);
        }

        .brick-avatar {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid #ffffff;
          flex-shrink: 0;
        }
        .brick-avatar-placeholder {
          font-size: 14px;
          line-height: 1;
          flex-shrink: 0;
        }
        .brick-donor-name {
          font-size: clamp(9px, 2.2vw, 11px);
          font-weight: 800;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 1px 3px rgba(0,0,0,0.9);
          letter-spacing: 0.5px;
        }

        @keyframes colShake { 
          0%{transform:translateX(0)} 
          20%{transform:translateX(-5px)} 
          40%{transform:translateX(5px)} 
          60%{transform:translateX(-3px)} 
          80%{transform:translateX(3px)} 
          100%{transform:translateX(0)} 
        }
        .col-shake { animation:colShake .28s ease-in-out; }

        .sbadge { 
          position:absolute; 
          font-size:clamp(.8rem, 2.2vw, 1.1rem); 
          font-weight:900; 
          letter-spacing:1px; 
          padding:4px 10px; 
          border-radius:20px; 
          z-index:16; 
          backdrop-filter:blur(8px);
        }
        .sbadge.r { right:12px; color:#ff4444; background:rgba(180,0,0,.6); border:1px solid rgba(255,50,50,.8); }
        .sbadge.m { left:12px; color:#44aaff; background:rgba(0,50,180,.6); border:1px solid rgba(50,120,255,.8); }

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

        {/* Layer 3: Custom Draggable Progress HUD */}
        <div className="dynamic-hud" style={{ top: `${hudY}%` }}>
          <div className="prow">
            <div className="pbwrap">
              <div className="plbl r">🧱 {ronaldoCount} / {goal}</div>
              <div className="pbtrack"><div className="pbfill r" style={{width:`${Math.min(100,(ronaldoCount/goal)*100)}%`}}/></div>
            </div>
            <div className="pbwrap" style={{alignItems:'flex-end'}}>
              <div className="plbl m">🧱 {messiCount} / {goal}</div>
              <div className="pbtrack"><div className="pbfill m" style={{width:`${Math.min(100,(messiCount/goal)*100)}%`}}/></div>
            </div>
          </div>
        </div>

        {/* Layer 4: Interactive Click Zones & Bricks with Avatars */}
        <div className="interactive-arena">
          {/* Left Zone */}
          <div className="panel-zone r" onClick={() => addBricks('ronaldo', 1, '@Fan_CR7')} title={`Bấm để test +1 gạch ${leftName}`}>
            <div className={`bcol${shakeLeft?' col-shake':''}`} style={{ bottom: `${100 - brickY}%` }}>
              {ronaldoBricks.map(br=>(
                <div key={br.id} className={`brick rb${br.falling?' falling':''}`}>
                  {br.donorAvatar ? (
                    <img src={br.donorAvatar} alt="" className="brick-avatar" />
                  ) : (
                    <span className="brick-avatar-placeholder">👤</span>
                  )}
                  <span className="brick-donor-name">{br.donorName}</span>
                </div>
              ))}
            </div>
            <div className="sbadge r" style={{ bottom: `${Math.max(10, 100 - brickY - 6)}%` }}>
              {ronaldoCount.toString().padStart(2,'0')} / {goal}
            </div>
          </div>

          {/* Center Lightning Divider */}
          <div className="divider-line"/>

          {/* Right Zone */}
          <div className="panel-zone m" onClick={() => addBricks('messi', 1, '@Fan_M10')} title={`Bấm để test +1 gạch ${rightName}`}>
            <div className={`bcol${shakeRight?' col-shake':''}`} style={{ bottom: `${100 - brickY}%` }}>
              {messiBricks.map(br=>(
                <div key={br.id} className={`brick mb${br.falling?' falling':''}`}>
                  {br.donorAvatar ? (
                    <img src={br.donorAvatar} alt="" className="brick-avatar" />
                  ) : (
                    <span className="brick-avatar-placeholder">👤</span>
                  )}
                  <span className="brick-donor-name">{br.donorName}</span>
                </div>
              ))}
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
  return (
    <Suspense fallback={<div>Đang tải Overlay...</div>}>
      <BattleOverlayContent />
    </Suspense>
  );
}
