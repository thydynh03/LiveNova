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

interface BrickItem {
  id: string;
  stackIndex: number;
  falling: boolean;
}

function playBrickThud(color: 'red' | 'blue') {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(color === 'red' ? 90 : 70, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    const snap = ctx.createOscillator();
    snap.type = 'square';
    snap.frequency.setValueAtTime(220, now);
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.2, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain); snap.connect(snapGain);
    gain.connect(ctx.destination); snapGain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.25);
    snap.start(now); snap.stop(now + 0.07);
    setTimeout(() => { try { ctx.close(); } catch (_e) { void _e; } }, 500);
  } catch (_e) { void _e; }
}

function playWinFanfare(winner: Character) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = winner === 'ronaldo' ? [523.25, 659.25, 783.99, 1046.5] : [493.88, 622.25, 739.99, 987.77];
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.15;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.65);
    });
    setTimeout(() => { try { ctx.close(); } catch (_e) { void _e; } }, 2500);
  } catch (_e) { void _e; }
}

const BRICK_FALL_MS = 320;
const BRICK_STAGGER_MS = 80;
const CONFETTI_COUNT = 60;
const WIN_DISPLAY_MS_DEFAULT = 15000;

function makeConfetti(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 20 + Math.random() * 60,
    delay: Math.random() * 1200,
    duration: 1500 + Math.random() * 1500,
    size: 6 + Math.random() * 8,
    color: ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7'][Math.floor(Math.random() * 6)],
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

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  useEffect(() => {
    if (phase === 'playing') return;
    const t = setTimeout(() => {
      setRonaldoBricks([]); setMessiBricks([]);
      setRonaldoCount(0); setMessiCount(0);
      setPhase('playing');
      pendingRonaldo.current = 0; pendingMessi.current = 0;
    }, winDisplayMs);
    return () => clearTimeout(t);
  }, [phase, winDisplayMs]);

  const addBricks = useCallback((character: Character, count: number) => {
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
        setBricks(prev => [...prev, { id, stackIndex: prev.length, falling: true }]);
        setTimeout(() => {
          setBricks(prev => prev.map(br => br.id === id ? { ...br, falling: false } : br));
          setShake(true);
          setTimeout(() => setShake(false), 300);
        }, BRICK_FALL_MS);
        setCount(prev => {
          const next = prev + 1;
          if (next >= goal) {
            setTimeout(() => {
              setPhase(character === 'ronaldo' ? 'ronaldo_wins' : 'messi_wins');
              playWinFanfare(character);
            }, BRICK_FALL_MS + 50);
          }
          return next;
        });
      }, delay);
    }
    setTimeout(() => { pendingRef.current = Math.max(0, pendingRef.current - count); },
      (currentOffset + count) * BRICK_STAGGER_MS + BRICK_FALL_MS + 100);
  }, [goal]);

  const handleAction = useCallback((action: OverlayAction) => {
    if (action.type !== RuleActionType.GAME_BATTLE_ACTION) return;
    const p = action.payload as GameBattleActionPayload;
    if (!p.character) return;
    addBricks(p.character, Math.max(1, Math.min(20, p.bricks ?? 1)));
  }, [addBricks]);

  const { status, rejectionCode } = useOverlaySocket(token, { onAction: handleAction });

  const statusMessage = !token ? 'Thiếu ?token=' :
    status === 'connecting' ? 'Đang kết nối…' :
    status === 'reconnecting' ? 'Mất kết nối — thử lại…' :
    status === 'rejected' ? `Token lỗi (${rejectionCode ?? 'unknown'})` : null;

  const hasWinner = phase !== 'playing';
  const winnerIsRonaldo = phase === 'ronaldo_wins';

  return (
    <div style={{ width:'100vw', height:'100vh', overflow:'hidden', position:'relative', background:'transparent', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        .battle-root { width:100vw; height:100vh; display:flex; flex-direction:column; background:linear-gradient(180deg,#0a0a1a 0%,#0d0d1e 100%); overflow:hidden; position:relative; }
        .battle-root::before { content:''; position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px); background-size:40px 40px; pointer-events:none; }
        .hdr { display:flex; align-items:center; justify-content:center; padding:10px 0 4px; position:relative; z-index:10; gap:16px; }
        .hdr-name { font-family:'Bebas Neue','Impact',sans-serif; font-size:clamp(2rem,5vw,3.5rem); letter-spacing:4px; text-shadow:0 0 30px currentColor; }
        .hdr-name.r { color:#ff4444; }
        .hdr-name.m { color:#44aaff; }
        .hdr-vs { font-family:'Bebas Neue','Impact',sans-serif; font-size:clamp(1rem,2.5vw,1.6rem); color:#fff; opacity:.5; letter-spacing:6px; }
        .prow { display:grid; grid-template-columns:1fr 1fr; gap:2px; padding:0 16px 6px; position:relative; z-index:10; }
        .pbwrap { display:flex; flex-direction:column; gap:3px; }
        .pbtrack { height:10px; border-radius:5px; background:rgba(255,255,255,.1); overflow:hidden; }
        .pbfill { height:100%; border-radius:5px; transition:width .4s cubic-bezier(.4,0,.2,1); }
        .pbfill.r { background:linear-gradient(90deg,#cc0000,#ff6666); box-shadow:0 0 10px #ff4444; }
        .pbfill.m { background:linear-gradient(90deg,#0044cc,#44aaff); box-shadow:0 0 10px #44aaff; }
        .plbl { font-size:10px; font-weight:700; letter-spacing:1px; opacity:.8; }
        .plbl.r { color:#ff4444; }
        .plbl.m { color:#44aaff; text-align:right; }
        .arena { flex:1; display:grid; grid-template-columns:1fr 4px 1fr; position:relative; z-index:5; min-height:0; }
        .divider { background:linear-gradient(180deg,transparent,rgba(255,255,255,.3) 20%,rgba(255,255,255,.5) 50%,rgba(255,255,255,.3) 80%,transparent); position:relative; }
        .divider::before { content:'⚡'; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:1.2rem; background:#0a0a1a; padding:4px; border-radius:50%; border:2px solid rgba(255,255,255,.4); }
        .panel { display:flex; flex-direction:column; align-items:center; justify-content:flex-end; position:relative; overflow:hidden; padding:0 8px 8px; }
        .panel.r { background:linear-gradient(135deg,rgba(180,0,0,.15) 0%,rgba(80,0,0,.05) 100%); }
        .panel.m { background:linear-gradient(225deg,rgba(0,80,200,.15) 0%,rgba(0,40,100,.05) 100%); }
        .pglow { position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:80%; height:70%; border-radius:50%; pointer-events:none; }
        .panel.r .pglow { background:radial-gradient(ellipse,rgba(255,50,50,.18) 0%,transparent 70%); }
        .panel.m .pglow { background:radial-gradient(ellipse,rgba(50,120,255,.18) 0%,transparent 70%); }
        .pimg { position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:85%; width:auto; object-fit:contain; object-position:bottom; z-index:2; pointer-events:none; filter:drop-shadow(0 0 20px rgba(255,255,255,.2)); }
        .bcol { position:absolute; bottom:0; width:clamp(32px,7vw,56px); display:flex; flex-direction:column-reverse; align-items:stretch; z-index:3; }
        .panel.r .bcol { right:8px; }
        .panel.m .bcol { left:8px; }
        @keyframes brickFall { 0%{transform:translateY(-80vh);opacity:0} 60%{transform:translateY(4px);opacity:1} 80%{transform:translateY(-2px)} 100%{transform:translateY(0);opacity:1} }
        .brick { height:clamp(8px,1.8vh,18px); border-radius:3px; margin:1px 0; }
        .brick.falling { animation:brickFall ${BRICK_FALL_MS}ms cubic-bezier(.34,1.56,.64,1) both; }
        .brick.rb { background:linear-gradient(90deg,#cc2200,#ff5533); border-top:2px solid #ff7755; border-bottom:2px solid #aa1100; box-shadow:0 0 6px rgba(255,50,0,.5); }
        .brick.mb { background:linear-gradient(90deg,#0044cc,#2277ff); border-top:2px solid #55aaff; border-bottom:2px solid #0033aa; box-shadow:0 0 6px rgba(0,100,255,.5); }
        @keyframes colShake { 0%{transform:translateX(0)} 20%{transform:translateX(-3px)} 40%{transform:translateX(3px)} 60%{transform:translateX(-2px)} 80%{transform:translateX(2px)} 100%{transform:translateX(0)} }
        .col-shake { animation:colShake .28s ease-in-out; }
        .sbadge { position:absolute; bottom:8px; font-size:clamp(.6rem,1.3vw,.85rem); font-weight:900; letter-spacing:1px; padding:3px 8px; border-radius:20px; z-index:4; }
        .sbadge.r { right:8px; color:#ff4444; background:rgba(180,0,0,.3); border:1px solid rgba(255,50,50,.4); }
        .sbadge.m { left:8px; color:#44aaff; background:rgba(0,50,180,.3); border:1px solid rgba(50,120,255,.4); }
        .wov { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:100; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); }
        @keyframes winPop { 0%{transform:scale(.3) rotate(-5deg);opacity:0} 60%{transform:scale(1.15) rotate(2deg)} 80%{transform:scale(.95) rotate(-1deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
        .wtxt { font-family:'Bebas Neue','Impact',sans-serif; font-size:clamp(2.5rem,9vw,6rem); letter-spacing:6px; text-shadow:0 0 60px currentColor,0 0 120px currentColor; animation:winPop .7s cubic-bezier(.34,1.56,.64,1) both; }
        .wtxt.r { color:#ff4444; }
        .wtxt.m { color:#44aaff; }
        .wtrophies { font-size:clamp(1.8rem,5vw,3.5rem); animation:winPop .7s cubic-bezier(.34,1.56,.64,1) .3s both; letter-spacing:12px; }
        @keyframes cfall { 0%{transform:translateY(-10vh) rotate(0);opacity:1} 100%{transform:translateY(110vh) rotate(720deg);opacity:0} }
        .cp { position:absolute; top:0; border-radius:2px; pointer-events:none; }
        .stbadge { position:absolute; top:8px; left:8px; z-index:200; padding:4px 10px; border-radius:6px; background:rgba(0,0,0,.75); color:#fff; font-size:.75rem; pointer-events:none; }
      `}</style>
      <div className="battle-root">
        {statusMessage && <div className="stbadge">{statusMessage}</div>}
        <div className="hdr">
          <span className="hdr-name r">RONALDO</span>
          <span style={{fontSize:'clamp(1.4rem,3.5vw,2.5rem)'}}>⚽</span>
          <span className="hdr-vs">VS</span>
          <span style={{fontSize:'clamp(1.4rem,3.5vw,2.5rem)'}}>⚽</span>
          <span className="hdr-name m">MESSI</span>
        </div>
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
        <div className="arena">
          <div className="panel r">
            <div className="pglow"/>
            <img src={ronaldoImg} alt="Ronaldo" className="pimg" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>
            <div className={`bcol${shakeLeft?' col-shake':''}`}>
              {ronaldoBricks.map(br=><div key={br.id} className={`brick rb${br.falling?' falling':''}`}/>)}
            </div>
            <div className="sbadge r">{ronaldoCount.toString().padStart(2,'0')} / {goal}</div>
          </div>
          <div className="divider"/>
          <div className="panel m">
            <div className="pglow"/>
            <img src={messiImg} alt="Messi" className="pimg" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>
            <div className={`bcol${shakeRight?' col-shake':''}`}>
              {messiBricks.map(br=><div key={br.id} className={`brick mb${br.falling?' falling':''}`}/>)}
            </div>
            <div className="sbadge m">{messiCount.toString().padStart(2,'0')} / {goal}</div>
          </div>
        </div>
      </div>
      {hasWinner && (
        <div className="wov">
          {confetti.map(c=>(
            <div key={c.id} className="cp" style={{left:`${c.x}%`,width:c.size,height:c.size*.6,backgroundColor:c.color,animationName:'cfall',animationDuration:`${c.duration}ms`,animationDelay:`${c.delay}ms`,animationTimingFunction:'linear',animationFillMode:'both',animationIterationCount:'infinite',transform:`rotate(${c.rotation}deg)`}}/>
          ))}
          <div className={`wtxt ${winnerIsRonaldo?'r':'m'}`}>{winnerIsRonaldo?'🏆 RONALDO THẮNG!':'🏆 MESSI THẮNG!'}</div>
          <div className="wtrophies">🏆 🏆 🏆</div>
          <div style={{marginTop:14,color:'rgba(255,255,255,.5)',fontSize:'.8rem',letterSpacing:2}}>Reset sau {Math.ceil(winDisplayMs/1000)}s...</div>
        </div>
      )}
    </div>
  );
}

export default function BattleOverlayPage() {
  return (
    <Suspense fallback={null}>
      <BattleOverlayContent />
    </Suspense>
  );
}