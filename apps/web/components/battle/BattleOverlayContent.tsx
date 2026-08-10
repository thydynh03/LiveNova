'use client';

/*
 * Extracted from app/overlays/battle/page.tsx.
 *
 * A Next.js page module may only export `default` plus a fixed set of route
 * options; exporting the component as well made `next build` fail. The
 * simulator needs the same renderer, so it lives here and both import it.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { OverlayState, BattleState, CINEMATIC_ACTIONS, troopSpriteUrl, resolveBattleAssets } from '@livenova/shared';
import { useOverlaySocket } from '../../lib/use-overlay-socket';
import { BattleMap, CASTLE_ANCHORS, type LaneKey } from './BattleMap';
import { TroopCanvas, type TroopCanvasHandle, type Troop } from './TroopCanvas';
import { CastleLayer } from './CastleLayer';
import { preload } from '../../lib/image-cache';
import { warmVideos } from '../../lib/video-pool';
import { SkillCinematic, type CinematicRequest } from './SkillCinematic';
import { BattleVictory } from './BattleVictory';
import { frameBudget } from '../../lib/frame-budget';
import { buildFillerSquad } from '../../lib/filler-troops';
/**
 * three.js is loaded only if a streamer actually switches to 3D.
 *
 * Imported statically it lands in the overlay bundle for everyone, including
 * the 2D default — roughly 600KB of parser and GPU setup that an OBS browser
 * source pays for at every scene start and never uses. `ssr: false` because the
 * renderer touches WebGL on construction.
 */
const BattleArena3D = dynamic(() => import('./BattleArena3D').then((m) => m.BattleArena3D), {
  ssr: false,
  loading: () => null,
});

/** Lane each kingdom marches down, and the colour its units are drawn in. */
const LANE_OF: Record<string, string> = {
  cat: 'cat',
  dog: 'dog',
  bear: 'bear',
  capy: 'capy',
};

/** Bốn phe, theo thứ tự cố định — quân nền chia đều vòng tròn cho chúng. */
const TEAM_KEYS = ['cat', 'dog', 'bear', 'capy'];

const TEAM_COLOUR: Record<string, string> = {
  cat: '#c084fc',
  dog: '#60a5fa',
  bear: '#fb923c',
  capy: '#34d399',
};

/**
 * Số đoạn phim kỹ năng được phép chờ.
 *
 * Ba là ước lượng chứ không phải số đo: mỗi đoạn khoảng hai tới sáu giây, nên
 * ba mục nghĩa là món quà cuối cùng trong hàng vẫn được thấy trong khoảng hai
 * mươi giây — vẫn còn trong trí nhớ của phòng. Nếu sau này có số liệu thật về
 * độ dài đoạn phim thì nên tính lại từ đó.
 */
const MAX_QUEUED_CINEMATICS = 3;

interface Shockwave {
  id: string;
  x: number;
  y: number;
  type: 'clash' | 'bomb' | 'dragon' | 'meteor' | 'cannon';
  createdAt: number;
}

interface FloatingText {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  createdAt: number;
}

const DEFAULT_4_KINGDOMS_STATE: BattleState = {
  kind: 'battle',
  battleId: 'demo_kingdom_war',
  title: 'CUỘC CHIẾN 4 VƯƠNG QUỐC',
  teams: [
    {
      key: 'cat',
      name: 'VƯƠNG QUỐC MÈO',
      color: '#c084fc',
      score: 3400,
      energy: 85,
      castleHp: 1000,
      maxHp: 1000,
      giftNames: ['Rose', 'Hoa Hồng'],
      quote: 'MEOW~ ĐỨA NÀO CẢN BỔN TỌA? 😼',
      motto: 'ĂN CHƠI KHÔNG SỢ MƯA RƠI 🐾',
      position: 'top-left',
      soldierCount: 1000,
    },
    {
      key: 'dog',
      name: 'VƯƠNG QUỐC CHÓ',
      color: '#60a5fa',
      score: 2200,
      energy: 70,
      castleHp: 1000,
      maxHp: 1000,
      giftNames: ['Perfume', 'Nước Hoa'],
      quote: 'GÂU GÂU! ĐẾN ĐÂY XEM AI GÂU HƠN! 🐶',
      motto: 'ĐOÀN KẾT LÀ SỨC MẠNH GÂU! 💪',
      position: 'top-right',
      soldierCount: 650,
    },
    {
      key: 'bear',
      name: 'VƯƠNG QUỐC GẤU',
      color: '#fb923c',
      score: 2400,
      energy: 90,
      castleHp: 1000,
      maxHp: 1000,
      giftNames: ['Donut', 'Bánh Donut'],
      quote: 'GRÙÙÙ! AI ĐỤNG VÀO LÀ ĐẬP NÁT! 🐻',
      motto: 'GẤU CHỐNG NGẠI AI? CHỈ NGẠI ĐÓI!',
      position: 'bottom-left',
      soldierCount: 800,
    },
    {
      key: 'capy',
      name: 'VƯƠNG QUỐC CAPYBARA',
      color: '#34d399',
      score: 2000,
      energy: 100,
      castleHp: 1000,
      maxHp: 1000,
      giftNames: ['Dragon', 'Thần Rồng'],
      quote: 'BÌNH TĨNH SỐNG CHILL PHÁ LÀNG TỪ TỪ... 🌿',
      motto: 'CHILL LÀ SỨC MẠNH CAPY! 😎',
      position: 'bottom-right',
      soldierCount: 500,
    },
  ],
  topDonors: [
    { username: '@meo_cutee', nickname: 'MèoCutee', teamKey: 'cat', totalScore: 25600 },
    { username: '@doggo_boss', nickname: 'DoggoBoss', teamKey: 'dog', totalScore: 18700 },
    { username: '@gau_truc_no1', nickname: 'GấuTrúcNo1', teamKey: 'bear', totalScore: 15300 },
    { username: '@capy_chill', nickname: 'CapyChill', teamKey: 'capy', totalScore: 12900 },
  ],
  recentEvents: [],
  winnerTeamKey: null,
  endsAtMs: Date.now() + 1127000, // 00:18:47
  active: true,
};

export function BattleOverlayContent({
  customState,
  onCardClick,
  fillerCount = 8,
}: {
  customState?: BattleState;
  onCardClick?: (actionKey: string, giftName: string, power: number) => void;
  /**
   * Số quân nền đi lại khi chưa có ai tham gia. 0 để tắt.
   *
   * Mặc định bật: một bản đồ trống ở phút đầu trông như phần mềm hỏng, và
   * người xem đầu tiên không có lý do gì để bước vào một chỗ không có ai.
   */
  fillerCount?: number;
}) {
  const searchParams = useSearchParams();
  const token = searchParams ? searchParams.get('token') : null;
  const [battle, setBattle] = useState<BattleState>(customState || DEFAULT_4_KINGDOMS_STATE);
  // Template media over the built-in defaults, so a round is playable before
  // anyone commissions art and an upload still wins.
  const assets = resolveBattleAssets(battle.assets);

  const troopCanvasRef = useRef<TroopCanvasHandle | null>(null);
  const [cinematic, setCinematic] = useState<CinematicRequest | null>(null);
  const cinematicQueueRef = useRef<CinematicRequest[]>([]);
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [screenShake, setScreenShake] = useState(false);
  const [activeSpeech, setActiveSpeech] = useState<Record<string, string>>({});
  /**
   * Id các sự kiện đã dựng hiệu ứng.
   *
   * Trước đây chỗ này là một bộ đếm so sánh `recentEvents.length`, và nó hỏng
   * theo hai cách cùng lúc. Một, chỉ `recentEvents[0]` được xử lý — nên khi năm
   * người tặng quà trong khoảng giữa hai lần đẩy trạng thái, bốn người không có
   * lính, không có chữ bay, không có gì cả. Hai, danh sách bị cắt ở 20 phần tử
   * nên độ dài bão hoà, và sau đó phép so sánh không còn phát hiện được sự kiện
   * mới nào nữa.
   */
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (customState) {
      setBattle(customState);
    }
  }, [customState]);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  // Started here rather than inside either renderer: both draw into the same
  // window and compete for the same frame, so the measurement belongs to the
  // overlay as a whole. Two monitors would each see the other's cost and both
  // degrade.
  useEffect(() => {
    frameBudget.start();
    return () => frameBudget.stop();
  }, []);

  const handleState = useCallback((state: OverlayState) => {
    if (state.kind === 'battle') {
      setBattle(state);
    }
  }, []);

  const noop = useCallback(() => undefined, []);
  useOverlaySocket(token, {
    onAction: noop,
    onState: handleState,
  });

  // Calculate percentage of each kingdom
  const teamCat = battle.teams.find((t) => t.key === 'cat') || battle.teams[0];
  const teamDog = battle.teams.find((t) => t.key === 'dog') || battle.teams[1];
  const teamBear = battle.teams.find((t) => t.key === 'bear') || battle.teams[2];
  const teamCapy = battle.teams.find((t) => t.key === 'capy') || battle.teams[3];

  const totalScore = Math.max(1, (teamCat?.score || 0) + (teamDog?.score || 0) + (teamBear?.score || 0) + (teamCapy?.score || 0));
  const catPct = Math.round(((teamCat?.score || 0) / totalScore) * 100);
  const bearPct = Math.round(((teamBear?.score || 0) / totalScore) * 100);
  const dogPct = Math.round(((teamDog?.score || 0) / totalScore) * 100);
  const capyPct = Math.max(0, 100 - (catPct + bearPct + dogPct));

  // Whether the field art already has four castles on it. The vector map draws
  // none, so there the overlay still has to supply the buildings itself.
  // Mirrors the branch in BattleMap: everything except the vector theme ends up
  // showing a painted field, either an uploaded background or the preset's.
  const hasPaintedMap = battle.mapTheme !== 'vector_runic_river';

  /**
   * Quân nền, cho tới khi có người thật.
   *
   * Điều kiện dừng là `battle.recentEvents.length > 0`, không phải một bộ đếm
   * thời gian: khoảnh khắc món quà đầu tiên tới nơi thì bản đồ phải là của
   * người đó. Một đợt quân trang trí đi lẫn vào đợt quân họ vừa mua sẽ làm loãng
   * đúng cái mà họ vừa trả tiền để nhìn thấy.
   *
   * Chúng chỉ được sinh ra và tự đi hết bản đồ như mọi đơn vị khác; không có
   * bước xoá, vì xoá giữa chừng sẽ là một nhóm lính biến mất trước mắt khán giả.
   */
  const fillerSeqRef = useRef(0);
  const hasRealEvents = battle.recentEvents.length > 0;
  useEffect(() => {
    if (fillerCount <= 0 || hasRealEvents || !battle.active) return;

    const emit = () => {
      fillerSeqRef.current += 1;
      troopCanvasRef.current?.spawn(
        buildFillerSquad(fillerSeqRef.current, {
          count: fillerCount,
          teamKeys: TEAM_KEYS,
          colourOf: (k) => TEAM_COLOUR[k] ?? '#e2e8f0',
          laneOf: (k) => (LANE_OF[k] ?? 'cat') as LaneKey,
          spriteOf: (k) => troopSpriteUrl(k, assets),
        }),
      );
    };

    emit();
    // Thưa hơn nhịp quà thật rõ rệt. Đây là hậu cảnh có người qua lại, không
    // phải một trận đấu đang diễn ra — dày quá thì lúc người thật tặng quà sẽ
    // không thấy có gì thay đổi.
    const id = setInterval(emit, 4000);
    return () => clearInterval(id);
  }, [fillerCount, hasRealEvents, battle.active, assets]);

  // Spawn troops & floating texts on recent events
  useEffect(() => {
    // `recentEvents` xếp mới nhất trước; đảo lại để phát hiệu ứng theo đúng thứ
    // tự chúng xảy ra, nếu không một loạt quà sẽ chạy ngược.
    const fresh = [...battle.recentEvents]
      .reverse()
      .filter((e) => e && !seenEventIdsRef.current.has(e.id));

    for (const newEvt of fresh) {
      seenEventIdsRef.current.add(newEvt.id);
      {
        // Off the castle the gift bought, not a second hard-coded set of
        // corners. The two lists had already drifted apart, so the "+50 ⚔️"
        // popped up in open field a few percent away from the keep it came from.
        const origin = CASTLE_ANCHORS[newEvt.teamKey] ?? CASTLE_ANCHORS.cat;
        const startX = origin.x;
        const startY = origin.y;

        // Stage 2 of the response: the march. This is where the audience sees
        // a gift turn into force, so it starts immediately and takes a second
        // or two rather than snapping to the middle.
        const colour = TEAM_COLOUR[newEvt.teamKey] ?? '#e2e8f0';
        const isBig = CINEMATIC_ACTIONS.includes(newEvt.actionKey);
        const squad: Troop[] = Array.from({ length: isBig ? 6 : 3 }).map((_, i) => ({
          id: `${newEvt.id}_${i}`,
          teamKey: newEvt.teamKey,
          lane: (LANE_OF[newEvt.teamKey] ?? 'cat') as LaneKey,
          type: newEvt.actionKey || 'soldier',
          colour,
          // Negative start staggers the squad so it reads as a column, not a dot.
          progress: i * -0.08,
          speed: isBig ? 0.85 : 0.55,
          offset: (Math.random() - 0.5) * 22,
          spriteUrl: troopSpriteUrl(newEvt.teamKey, assets),
        }));
        troopCanvasRef.current?.spawn(squad);

        // Stage 3 for the expensive tiers: the screen itself reacts. Queued so
        // two whales in the same second do not fight over the video element.
        const fxUrl = battle.assets?.[`fx_${newEvt.actionKey}`];
        if (isBig && fxUrl) {
          enqueueCinematic({
            id: newEvt.id,
            actionKey: newEvt.actionKey,
            videoUrl: fxUrl,
            senderLabel: `${newEvt.sender} · ${newEvt.giftName ?? ''}`.trim(),
          });
        }

        // Spawn floating combat text
        const powerText = newEvt.actionKey === 'meteor' ? '☄️ METEOR +999!' : newEvt.actionKey === 'dragon' ? '🐉 DRAGON +99!' : newEvt.actionKey === 'bomb' ? '💣 BOOM +50!' : `+${newEvt.powerAdded} ⚔️`;
        const color = newEvt.teamKey === 'cat' ? '#c084fc' : newEvt.teamKey === 'dog' ? '#60a5fa' : newEvt.teamKey === 'bear' ? '#fb923c' : '#34d399';
        
        setFloatingTexts((prev) => [
          ...prev.slice(-8),
          {
            id: `ft_${Date.now()}_${Math.random()}`,
            text: powerText,
            color,
            x: startX + (Math.random() - 0.5) * 6,
            y: startY + (Math.random() - 0.5) * 6,
            createdAt: Date.now(),
          },
        ]);

        // Pop speech bubble
        if (newEvt.quote) {
          setActiveSpeech((prev) => ({ ...prev, [newEvt.teamKey]: newEvt.quote || '' }));
          setTimeout(() => {
            setActiveSpeech((prev) => {
              const updated = { ...prev };
              delete updated[newEvt.teamKey];
              return updated;
            });
          }, 3500);
        }

        // Action shockwave & screen tremor
        if (['bomb', 'dragon', 'cannon', 'meteor'].includes(newEvt.actionKey)) {
          setScreenShake(true);
          setTimeout(() => setScreenShake(false), 450);
          setShockwaves((prev) => [
            ...prev.slice(-4),
            { id: `shock_${Date.now()}`, x: 50, y: 50, type: newEvt.actionKey as Shockwave['type'], createdAt: Date.now() },
          ]);
        }
      }
    }

    // Tập id chỉ để chống dựng lại hiệu ứng cho cùng một sự kiện, nên nó không
    // cần nhớ quá lịch sử mà máy chủ còn giữ. Giữ gấp đôi cửa sổ đó là đủ rộng
    // để không bỏ sót, và đủ hẹp để một buổi live dài không làm nó phình ra.
    if (seenEventIdsRef.current.size > 200) {
      const keep = new Set(battle.recentEvents.map((e) => e.id));
      seenEventIdsRef.current = keep;
    }
  }, [battle.recentEvents]);

  // Housekeeping only. Motion lives in TroopCanvas, driven by
  // requestAnimationFrame — the old 30ms setInterval re-rendered the whole
  // React tree 33 times a second while OBS was encoding.
  useEffect(() => {
    const timer = setInterval(() => {
      setFloatingTexts((prev) => prev.filter((ft) => Date.now() - ft.createdAt < 1500));
      setShockwaves((prev) => prev.filter((sw) => Date.now() - sw.createdAt < 1000));
    }, 200);
    return () => clearInterval(timer);
  }, []);


  // Decode the artwork while the round is quiet. A dragon that finishes
  // loading after the gift summoning it has passed may as well not exist.
  const assetKey = Object.values(assets).join('|');
  useEffect(() => {
    // Ảnh và video đi hai đường khác nhau. `preload` dựng `new Image()`, thứ
    // với một tệp `.mp4` sẽ tải hỏng rồi ghi nhớ là "hỏng" — không giúp gì mà
    // còn kết luận sai. Video cần một thẻ `<video>` thật để trình duyệt chuẩn
    // bị đường ống giải mã trước khi món quà gọi nó.
    preload(Object.values(assets));
    warmVideos(Object.values(assets));
    // Compared by value through assetKey; depending on the object itself would
    // re-run on every state frame the socket delivers.
  }, [assetKey]);

  /**
   * Xếp một đoạn phim kỹ năng vào hàng đợi.
   *
   * Hàng đợi có sẵn từ trước, nhưng nó không có trần và không gộp trùng. Hai
   * thiếu sót đó chỉ lộ ra đúng lúc tệ nhất — khi phòng đang sôi nổi nhất:
   *
   * - **Không trần.** Hai mươi con rồng trong mười giây nghĩa là overlay phát
   *   phim thêm gần một phút sau khi khoảnh khắc đã trôi qua. Người tặng thứ
   *   hai mươi thấy hiệu ứng của mình lúc chẳng còn ai nhớ họ đã tặng.
   * - **Không gộp.** Mười con rồng giống hệt nhau chạy nối đuôi nhau vừa nhàm
   *   vừa chặn mất những kỹ năng khác đang đợi phía sau.
   *
   * Nên trùng nhau thì gộp thành một lượt phát kèm bội số, và hàng đợi có trần.
   * Khi tràn, thứ bị bỏ là mục **cũ nhất**: một đoạn phim đã đợi quá lâu thì
   * phát ra cũng vô nghĩa, còn món quà vừa tới vẫn đang được người ta chờ xem.
   */
  const enqueueCinematic = useCallback((next: CinematicRequest) => {
    const queue = cinematicQueueRef.current;

    const twin = queue.find((q) => q.actionKey === next.actionKey);
    if (twin) {
      twin.repeat = (twin.repeat ?? 1) + 1;
      twin.senderLabel = next.senderLabel;
    } else {
      queue.push(next);
      if (queue.length > MAX_QUEUED_CINEMATICS) queue.shift();
    }

    setCinematic((current) => current ?? cinematicQueueRef.current.shift() ?? null);
  }, []);

  const handleCinematicDone = useCallback(() => {
    setCinematic(cinematicQueueRef.current.shift() ?? null);
  }, []);

  // Format time mm:ss
  const formatTime = (endsAt: number) => {
    const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        // Viewport units, not percentages. `height: 100%` resolves against a
        // body with no height of its own, so the whole overlay collapsed to
        // zero and rendered nothing at all — the layers were there, the socket
        // was connected, and the broadcast showed an empty box.
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
        color: '#ffffff',
        background: 'radial-gradient(circle at center, #132b20 0%, #0c1a14 55%, #050d0a 100%)',
        transform: screenShake ? 'translate(3px, -3px)' : 'none',
        transition: 'transform 0.05s ease',
      }}
    >
      {/* ── 3D THREE.JS WEBGL ARENA vs 2D MAP/CASTLES ──────────────────── */}
      {battle.renderEngine === '3d' ? (
        <BattleArena3D state={battle} isDark={true} />
      ) : (
        <>
          {/* Layer 1: the battlefield. High-res generated map or vector fallback */}
          <BattleMap backgroundUrl={battle.assets?.map_background} mapTheme={battle.mapTheme} />

          {/* Layer 2: the four strongholds, drawn at their map anchors. */}
          <CastleLayer teams={battle.teams} assets={assets} paintedCastles={hasPaintedMap} />
        </>
      )}

      {/* Kingdom banter, on the keep that said it. It used to live inside the
          corner panels; those are gone, but the line itself is game content —
          it is what a gift makes a kingdom say. */}
      {Object.entries(activeSpeech).map(([teamKey, line]) => {
        const anchor = CASTLE_ANCHORS[teamKey];
        if (!anchor || !line) return null;
        return (
          <div
            key={teamKey}
            style={{
              position: 'absolute',
              left: `${anchor.x}%`,
              top: `${anchor.y}%`,
              transform: 'translate(-50%, -150%)',
              zIndex: 46,
              pointerEvents: 'none',
              maxWidth: 'clamp(110px, 30vw, 180px)',
              padding: '3px 8px',
              borderRadius: 10,
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 'clamp(0.55rem, 2vw, 0.68rem)',
              fontWeight: 800,
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            }}
          >
            {line}
          </div>
        );
      })}

      {/* Layer 4: the moment an expensive gift buys. */}
      <SkillCinematic request={cinematic} onDone={handleCinematicDone} />

      {/* Layer 5: the moment the whole session was paying for. Mounted only
          once the round is closed, so its timers never run during play. */}
      {battle.active === false && <BattleVictory battle={battle} />}

      <style>{`
        @keyframes runeSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes dragonHover {
          0% { transform: translate(-50%, -50%) translateY(-5px) scale(1); }
          50% { transform: translate(-50%, -50%) translateY(5px) scale(1.05); }
          100% { transform: translate(-50%, -50%) translateY(-5px) scale(1); }
        }
        @keyframes shockwavePulse {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes floatUpFade {
          0% { transform: translate(-50%, 0) scale(0.85); opacity: 0; }
          20% { transform: translate(-50%, -6px) scale(1.08); opacity: 1; }
          100% { transform: translate(-50%, -32px) scale(0.9); opacity: 0; }
        }
        @keyframes crownShine {
          0% { filter: drop-shadow(0 0 4px #facc15); }
          50% { filter: drop-shadow(0 0 14px #f59e0b); }
          100% { filter: drop-shadow(0 0 4px #facc15); }
        }
      `}</style>

      {/* ── TOP HEADER HUD: LIVE STATS & FLOATING SCORE CLASH CAPSULE ──────── */}
      <header
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          right: 12,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Portrait-first. The old row put streamer / timer+title /
            donors side by side, which needs width this format does not have:
            at 1080 wide the title broke to four lines and the donor strip ran
            off the right edge. Two short rows survive the narrow canvas. */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(12px)',
              padding: '3px 10px',
              borderRadius: 18,
              border: '1px solid rgba(255, 255, 255, 0.18)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '0.65rem',
              }}
            >
              👑
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.7rem', color: '#f8fafc', whiteSpace: 'nowrap' }}>
              {battle.title || 'KINGDOM WAR'}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(12px)',
              padding: '3px 12px',
              borderRadius: 18,
              border: '1px solid rgba(245, 158, 11, 0.45)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#fde047', whiteSpace: 'nowrap' }}>
              ⏱️ {formatTime(battle.endsAtMs)}
            </span>
          </div>
        </div>

        {/* Center Floating Score Tug-of-War Bar (Score Clash Bar) - Compact Responsive Width */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 'clamp(280px, 45vw, 440px)',
            height: '20px',
            borderRadius: '10px',
            overflow: 'hidden',
            background: 'rgba(15, 23, 42, 0.92)',
            display: 'flex',
            border: '1.5px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* MÈO (Purple) */}
          <div
            style={{
              width: `${catPct}%`,
              background: 'linear-gradient(90deg, #7c3aed, #c084fc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.62rem',
              transition: 'width 0.4s ease',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {catPct > 12 ? `${catPct}% Mèo` : `${catPct}%`}
          </div>

          {/* GẤU (Orange) */}
          <div
            style={{
              width: `${bearPct}%`,
              background: 'linear-gradient(90deg, #ea580c, #fb923c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.62rem',
              transition: 'width 0.4s ease',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {bearPct > 12 ? `${bearPct}% Gấu` : `${bearPct}%`}
          </div>

          {/* CHÓ (Blue) */}
          <div
            style={{
              width: `${dogPct}%`,
              background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.62rem',
              transition: 'width 0.4s ease',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {dogPct > 12 ? `${dogPct}% Chó` : `${dogPct}%`}
          </div>

          {/* CAPYBARA (Green) */}
          <div
            style={{
              width: `${capyPct}%`,
              background: 'linear-gradient(90deg, #059669, #34d399)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.62rem',
              transition: 'width 0.4s ease',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {capyPct > 12 ? `${capyPct}% Capy` : `${capyPct}%`}
          </div>

          {/* Center VS Emblem */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#dc2626',
              border: '1.5px solid #ffffff',
              borderRadius: '50%',
              width: 18,
              height: 18,
              display: 'grid',
              placeItems: 'center',
              fontSize: '0.55rem',
              fontWeight: 900,
              boxShadow: '0 0 8px #dc2626',
            }}
          >
            VS
          </div>
        </div>

        {/* Gift standings, on their own row. Kept — this is who is paying, and
            it is the one number an audience acts on. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
          {battle.topDonors.slice(0, 3).map((d, idx) => (
            <div
              key={d.username + idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: '0.6rem',
                background: 'rgba(15, 23, 42, 0.82)',
                border: '1px solid rgba(255,255,255,0.14)',
                padding: '1px 6px',
                borderRadius: 8,
                maxWidth: '32%',
              }}
            >
              <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
              <span
                style={{
                  fontWeight: 700,
                  color: '#fde047',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.nickname}
              </span>
              <span style={{ color: '#6ee7b7', fontWeight: 700 }}>{(d.totalScore / 1000).toFixed(1)}k</span>
            </div>
          ))}
        </div>
      </header>

      {/* ── CENTER ARENA: IMPACT ONLY ──────────────────────────────────────
          The spinning rune ring, the hovering 🐉 and the 💥 used to sit here
          permanently. The map already paints a rune plaza with a fountain at
          this exact spot, so all three were decoration stacked on decoration —
          and they were the busiest thing on screen at the one moment nothing
          was happening. What is left fires only on a skill. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 40,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Dynamic Expanding Shockwaves */}
        {shockwaves.map((sw) => (
          <div
            key={sw.id}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              border: sw.type === 'meteor' ? '4px solid #ec4899' : sw.type === 'dragon' ? '4px solid #38bdf8' : '4px solid #f59e0b',
              boxShadow: sw.type === 'meteor' ? '0 0 30px #ec4899' : sw.type === 'dragon' ? '0 0 30px #38bdf8' : '0 0 30px #f59e0b',
              animation: 'shockwavePulse 0.9s ease-out forwards',
            }}
          />
        ))}
      </div>

      {/* ── MARCHING TROOPS SPRITES ALONG 4 BRIDGES ───────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 35,
        }}
      >
        {/* Layer 3: every marching unit on one canvas (2D mode). */}
        {battle.renderEngine !== '3d' && <TroopCanvas ref={troopCanvasRef} />}


        {/* Floating Combat Text */}
        {floatingTexts.map((ft) => (
          <div
            key={ft.id}
            style={{
              position: 'absolute',
              left: `${ft.x}%`,
              top: `${ft.y}%`,
              color: ft.color,
              fontWeight: 900,
              fontSize: '0.9rem',
              textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 10px currentColor',
              animation: 'floatUpFade 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
            }}
          >
            {ft.text}
          </div>
        ))}
      </div>

      {/* ── BOTTOM HUD: INTERACTION DECK & LIVE CHAT & MINIMAP ─────────────── */}
      <footer
        style={{
          position: 'absolute',
          bottom: 6,
          left: 12,
          right: 12,
          zIndex: 55,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        {/* Center: 6 Skill Gift Cards & Big Action Button */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {/* Big Highlight Action Button: NÉM BOM 💣 */}
          <button
            type="button"
            onClick={() => onCardClick?.('bomb', 'Bomb', 50)}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#000000',
              border: '1.5px solid #fef08a',
              borderRadius: 12,
              padding: '4px 18px',
              fontSize: '0.78rem',
              fontWeight: 900,
              letterSpacing: '0.03em',
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.7)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'transform 0.1s ease',
            }}
          >
            <span>🔥 NÉM BOM KHẨN CẤP</span>
            <span style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 6, fontSize: '0.68rem' }}>🪙 199</span>
          </button>

          {/* 6 Skill Gift Cards */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'soldier', name: 'Triệu hồi lính', icon: '🐱', cost: '🌹 1', power: 1, gift: 'Rose', border: '#c084fc' },
              { key: 'castle', name: 'Xây thành', icon: '🏰', cost: '🌸 10', power: 10, gift: 'Perfume', border: '#60a5fa' },
              { key: 'bomb', name: 'Ném bom', icon: '💣', cost: '🍩 50', power: 50, gift: 'Donut', border: '#fb923c' },
              { key: 'dragon', name: 'Gọi rồng', icon: '🐉', cost: '🐲 99', power: 99, gift: 'Dragon', border: '#34d399' },
              { key: 'cannon', name: 'Bắn đại bác', icon: '💥', cost: '🎆 199', power: 199, gift: 'Cannon', border: '#facc15' },
              { key: 'meteor', name: 'Thiên thạch', icon: '☄️', cost: '🌌 999', power: 999, gift: 'Meteor', border: '#ec4899' },
            ].map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => onCardClick?.(card.key, card.gift, card.power)}
                style={{
                  background: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(8px)',
                  border: `1.5px solid ${card.border}`,
                  borderRadius: 8,
                  padding: '3px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  color: '#ffffff',
                  boxShadow: `0 2px 6px ${card.border}33`,
                  transition: 'all 0.15s ease',
                  minWidth: 'clamp(48px, 6vw, 62px)',
                }}
              >
                <span style={{ fontSize: '0.55rem', fontWeight: 800, color: card.border }}>{card.name}</span>
                <span style={{ fontSize: '1rem' }}>{card.icon}</span>
                <span
                  style={{
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    background: 'rgba(255,255,255,0.1)',
                    padding: '1px 4px',
                    borderRadius: 4,
                  }}
                >
                  {card.cost}
                </span>
              </button>
            ))}
          </div>
        </div>

      </footer>
    </div>
  );
}
