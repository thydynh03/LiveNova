'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { KingdomWarState, KingdomFactionState, KingdomFactionId } from '@livenova/shared';

const DEFAULT_FACTIONS: Record<KingdomFactionId, KingdomFactionState> = {
  cat: {
    id: 'cat',
    name: 'Mèo Neon',
    emoji: '🐱',
    color: '#ff2a70',
    hp: 1000,
    maxHp: 1000,
    level: 1,
    troops: 12,
    mvpDisplayName: 'Top 100 SVXS',
    mvpScore: 1250,
  },
  dog: {
    id: 'dog',
    name: 'Chó Sói',
    emoji: '🐶',
    color: '#00f0ff',
    hp: 850,
    maxHp: 1000,
    level: 1,
    troops: 8,
    mvpDisplayName: 'Autumn Bolz',
    mvpScore: 800,
  },
  bear: {
    id: 'bear',
    name: 'Gấu Dũng Sĩ',
    emoji: '🐻',
    color: '#00ff87',
    hp: 920,
    maxHp: 1000,
    level: 1,
    troops: 15,
    mvpDisplayName: 'Dynh Thy',
    mvpScore: 950,
  },
  capybara: {
    id: 'capybara',
    name: 'Capybara Vàng',
    emoji: '🦫',
    color: '#ffb703',
    hp: 780,
    maxHp: 1000,
    level: 1,
    troops: 20,
    mvpDisplayName: 'Nao Ra Truong',
    mvpScore: 600,
  },
};

export default function KingdomWarOverlayPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [gameState, setGameState] = useState<KingdomWarState>({
    channelId: 'default',
    factions: DEFAULT_FACTIONS,
    status: 'active',
    lastAction: {
      type: 'summon',
      factionId: 'cat',
      actorDisplayName: 'Top 100 SVXS',
      description: '💥 Top 100 SVXS triệu hồi 5 Lính Mèo xông trận!',
      timestamp: Date.now(),
    },
  });

  const [activeEffect, setActiveEffect] = useState<'none' | 'cannon' | 'dragon' | 'repair'>('none');
  const [effectText, setEffectText] = useState('');

  useEffect(() => {
    const backendUrl =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? 'https://livenova-api.railway.app'
        : 'http://localhost:3001');

    const socket: Socket = io(`${backendUrl}/events`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', () => {
      if (token) {
        socket.emit('authenticate', { token });
      }
    });

    socket.on('kingdom_war_update', (data: KingdomWarState) => {
      setGameState(data);
      if (data.lastAction) {
        setEffectText(data.lastAction.description);
        if (data.lastAction.type === 'dragon') {
          setActiveEffect('dragon');
          setTimeout(() => setActiveEffect('none'), 4000);
        } else if (data.lastAction.type === 'cannon') {
          setActiveEffect('cannon');
          setTimeout(() => setActiveEffect('none'), 2500);
        } else if (data.lastAction.type === 'repair') {
          setActiveEffect('repair');
          setTimeout(() => setActiveEffect('none'), 2000);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const factionsList = Object.values(gameState.factions) as KingdomFactionState[];

  return (
    <main
      className="relative w-screen h-screen overflow-hidden p-6 select-none"
      style={{ backgroundColor: 'transparent' }}
    >
      {/* Dynamic Screen Shake effect when Cannon or Dragon hits */}
      <style jsx global>{`
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          20% { transform: translate(-3px, 0px) rotate(-1deg); }
          40% { transform: translate(3px, 2px) rotate(1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          80% { transform: translate(3px, 1px) rotate(-1deg); }
          100% { transform: translate(1px, -2px) rotate(0deg); }
        }
        @keyframes dragonFly {
          0% { transform: translateX(-120%) translateY(20%) scale(0.6); opacity: 0; }
          30% { opacity: 1; transform: translateX(-20%) translateY(-10%) scale(1.1); }
          70% { opacity: 1; transform: translateX(40%) translateY(0%) scale(1.2); }
          100% { transform: translateX(140%) translateY(-30%) scale(0.8); opacity: 0; }
        }
        @keyframes fireBreath {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 0.9; transform: scale(1.3); }
        }
        .animate-shake {
          animation: shake 0.5s infinite;
        }
        .animate-dragon {
          animation: dragonFly 3.8s ease-in-out forwards;
        }
        .animate-fire {
          animation: fireBreath 1.5s ease-in-out infinite;
        }
      `}</style>

      {/* Top Title Banner */}
      <div className="flex justify-center mb-4">
        <div className="bg-black/75 backdrop-blur-md border border-amber-500/50 rounded-2xl px-6 py-2 shadow-2xl flex items-center gap-3">
          <span className="text-2xl">🏰</span>
          <h1 className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 drop-shadow">
            KINGDOM WAR · CUỘC CHIẾN 4 VƯƠNG QUỐC
          </h1>
          <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold px-2 py-0.5 rounded-full">
            LIVE
          </span>
        </div>
      </div>

      {/* Latest Action Announcement Bar */}
      {gameState.lastAction && (
        <div className="flex justify-center mb-6">
          <div className="bg-slate-950/85 backdrop-blur-lg border border-amber-400/60 text-amber-200 px-6 py-2 rounded-xl text-sm font-bold shadow-xl animate-pulse flex items-center gap-2">
            <span>⚔️</span>
            <span>{gameState.lastAction.description}</span>
          </div>
        </div>
      )}

      {/* Dragon Ultimate Animation Overlay */}
      {activeEffect === 'dragon' && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
          <div className="animate-dragon flex flex-col items-center">
            <div className="text-9xl filter drop-shadow-[0_0_35px_rgba(255,100,0,0.9)]">🐉</div>
            <div className="animate-fire text-7xl -mt-6">🔥💥🔥</div>
          </div>
        </div>
      )}

      {/* Cannon Impact Effect Overlay */}
      {activeEffect === 'cannon' && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-red-950/20 animate-shake">
          <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white font-black text-3xl px-8 py-3 rounded-2xl shadow-2xl border-2 border-yellow-300 transform scale-125">
            💥 BẮN ĐẠI BÁC XUỐNG CÁC THÀNH TRÌ!
          </div>
        </div>
      )}

      {/* 4 Kingdoms Grid Layout */}
      <div className={`grid grid-cols-2 gap-6 max-w-5xl mx-auto ${activeEffect === 'cannon' ? 'animate-shake' : ''}`}>
        {factionsList.map((faction) => {
          const hpPercent = Math.max(0, Math.round((faction.hp / faction.maxHp) * 100));
          const isDead = faction.hp <= 0;

          return (
            <div
              key={faction.id}
              className={`relative rounded-3xl p-5 border-2 transition-all duration-300 backdrop-blur-xl ${
                isDead
                  ? 'bg-slate-950/60 border-slate-800 opacity-50 grayscale'
                  : 'bg-slate-900/80 border-amber-500/40 shadow-[0_0_25px_rgba(0,0,0,0.5)] hover:border-amber-400'
              }`}
              style={{
                boxShadow: isDead ? undefined : `0 0 30px ${faction.color}25`,
              }}
            >
              {/* Castle Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-3xl border shadow-lg"
                    style={{ backgroundColor: `${faction.color}20`, borderColor: faction.color }}
                  >
                    {faction.emoji}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white tracking-wide">{faction.name}</h2>
                    <div className="text-xs text-slate-400 font-medium">
                      Lính xông trận: <span className="text-amber-300 font-bold">{faction.troops}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className="text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider border"
                    style={{
                      color: faction.color,
                      backgroundColor: `${faction.color}15`,
                      borderColor: `${faction.color}40`,
                    }}
                  >
                    LV.{faction.level}
                  </span>
                </div>
              </div>

              {/* HP Bar */}
              <div className="relative mb-3">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-300">HP THÀNH TRÌ</span>
                  <span style={{ color: faction.color }}>
                    {faction.hp} / {faction.maxHp} HP
                  </span>
                </div>

                <div className="w-full h-4 bg-slate-950/90 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${hpPercent}%`,
                      backgroundColor: faction.color,
                      boxShadow: `0 0 10px ${faction.color}`,
                    }}
                  />
                </div>
              </div>

              {/* Top MVP Contributor Banner */}
              <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-xl px-3 py-1.5 border border-slate-800">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold truncate">
                  <span>👑 Top Tướng:</span>
                  <span className="text-white font-bold truncate">
                    {faction.mvpDisplayName || 'Chưa có'}
                  </span>
                </div>
                <div className="text-slate-400 font-medium">
                  {faction.mvpScore.toLocaleString()} điểm
                </div>
              </div>

              {/* Dead Overlay Badge */}
              {isDead && (
                <div className="absolute inset-0 rounded-3xl bg-black/75 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-red-500 font-black text-2xl border-2 border-red-500 px-6 py-2 rounded-2xl rotate-[-12deg] tracking-widest shadow-2xl bg-black">
                    THẤT THỦ
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Winner Banner */}
      {gameState.status === 'ended' && gameState.winningFactionId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-bounce">
          <div className="text-8xl mb-2">
            {gameState.factions[gameState.winningFactionId]?.emoji}
          </div>
          <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 mb-2 drop-shadow-lg">
            VƯƠNG QUỐC {gameState.factions[gameState.winningFactionId]?.name.toUpperCase()} THẮNG TRẬN!
          </h2>
          <p className="text-amber-200 text-lg font-bold">
            Vương quốc xuất sắc nhất đã chinh phục toàn bộ 4 cõi! 🏆
          </p>
        </div>
      )}
    </main>
  );
}
