'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveEvent, LiveEventType, interpretDiscoEvent } from '@livenova/shared';
import { useApi } from '../../lib/use-api';
import { api, ApiError } from '../../lib/api-client';
import { useEventsSocket } from '../../lib/use-events-socket';
import { useToast } from '../ui/Toast';
import { copyText } from '../../lib/copy-text';
import { describeError } from '../../lib/describe-error';
import {
  DEFAULT_FRAME_WIDTH,
  DEFAULT_FRAME_HEIGHT,
  DEFAULT_LED_DIM,
} from '../overlays/FixedFrame';
import { DiscoEngine } from './disco-engine';
import { applyDiscoAction, type DiscoSyncPayload } from './apply-disco-action';
import { SCENARIOS, findScenario, type ScenarioId, type ScenarioContext } from './scenarios';

/**
 * Toàn bộ trạng thái và hành vi của màn hình Sàn Nhảy.
 *
 * Tách khỏi JSX vì trang cũ dài 1932 dòng và trộn lẫn ba thứ: dựng giao diện,
 * điều khiển engine 3D, và một bộ chạy kịch bản. Ở dạng đó không thể đọc phần
 * nào mà không cuộn qua hai phần kia, và không thể thử logic mà không dựng WebGL.
 */

export interface Channel {
  id: string;
  name: string;
}

interface OverlayItem {
  id: string;
  type: string;
  publicToken: string;
  config?: unknown;
}

/** Phần cấu hình sàn nhảy nằm trong `config` của overlay. */
export interface DiscoOverlayConfig {
  musicUrl?: string;
  trackTitle?: string;
  videoUrl?: string;
  isMuted?: boolean;
  ledDim?: number;
}

/**
 * Đọc cấu hình sàn nhảy từ trường `config` tự do của overlay.
 *
 * Kiểm từng trường một chứ không ép kiểu cả cục: `config` là JSON tuỳ ý trong
 * cơ sở dữ liệu, có thể do bản cũ ghi hoặc do người dùng sửa tay, và một giá trị
 * sai kiểu lọt vào sẽ làm hỏng sân khấu giữa buổi live.
 */
function readDiscoConfig(raw: unknown): DiscoOverlayConfig {
  if (typeof raw !== 'object' || raw === null) return {};
  const o = raw as Record<string, unknown>;

  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined;

  return {
    musicUrl: str(o.musicUrl),
    trackTitle: str(o.trackTitle),
    videoUrl: str(o.videoUrl),
    isMuted: typeof o.isMuted === 'boolean' ? o.isMuted : undefined,
    ledDim: num(o.ledDim),
  };
}

/** Mẫu video nền gợi ý cho màn LED. */
export const VIDEO_PRESETS = [
  { label: 'Mặc định (visualizer)', url: '' },
  { label: 'YouTube DJ club', url: 'https://www.youtube.com/watch?v=kYbgc0wSrnM' },
  {
    label: 'Neon cyber loop',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  },
] as const;

/** Mẫu nhạc sàn gợi ý. */
export const MUSIC_PRESETS = [
  {
    label: 'Vinahouse Future Beat',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=electronic-future-beats-117997.mp3',
  },
  {
    label: 'EDM Nightclub',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=lofi-study-112191.mp3',
  },
] as const;

/**
 * Thời lượng mỗi cú máy, giữ khớp giữa bản xem trước và overlay.
 *
 * Ngoài hook chứ không trong: hằng số khai báo trong thân hook là một đối tượng
 * mới mỗi lần render, nên không dùng làm phụ thuộc của `useCallback` được.
 */
const CAMERA_MS = {
  DJ_POV: 9000,
  SPOTLIGHT_ZOOM: 5000,
  CRANE_SWOOP: 6000,
  WIDE_ORBIT: 8000,
} as const;

type CameraShot = keyof typeof CAMERA_MS;

const LS_VIDEO = 'livenova_disco_video_url';
const LS_MUSIC = 'livenova_disco_current_music';
const LS_TITLE = 'livenova_disco_current_title';

export function useDiscoController() {
  const toast = useToast();
  const engine = useMemo(() => new DiscoEngine(), []);

  // ── Phát sóng ─────────────────────────────────────────────────────────────
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [overlayId, setOverlayId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Media ─────────────────────────────────────────────────────────────────
  const [musicUrl, setMusicUrl] = useState('');
  const [trackTitle, setTrackTitle] = useState('EDM Nightclub Mix');
  const [djVideoUrl, setDjVideoUrl] = useState('');
  const [isDjVideoMuted, setIsDjVideoMuted] = useState(true);
  const [ledDim, setLedDim] = useState(DEFAULT_LED_DIM);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Đạo diễn ──────────────────────────────────────────────────────────────
  const [isAutoDirector, setIsAutoDirector] = useState(true);

  // ── Kiểm thử ──────────────────────────────────────────────────────────────
  const [testUsername, setTestUsername] = useState('@streamer_pro');
  const [testDisplayName, setTestDisplayName] = useState('Khán Giả 999');
  const [customComment, setCustomComment] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const channels = useApi<Channel[]>('/channels');
  const channelIds = useMemo(() => (channels.data ?? []).map((c) => c.id), [channels.data]);

  const addLog = useCallback((msg: string) => {
    const stamp = new Date().toLocaleTimeString('vi-VN');
    setLogs((prev) => [`[${stamp}] ${msg}`, ...prev.slice(0, 19)]);
  }, []);

  // ── Đồng bộ tới overlay ───────────────────────────────────────────────────

  /**
   * Đẩy một thay đổi tới overlay đang phát sóng.
   *
   * Socket qua server là đường chính vì nó vượt được ranh giới tiến trình.
   * `BroadcastChannel` chỉ chạy trong cùng một trình duyệt nên giữ làm dự phòng
   * cho lúc xem thử ở tab kế bên khi chưa gắn overlay.
   */
  const sync = useCallback(
    (
      data: DiscoSyncPayload & {
        musicUrl?: string;
        trackTitle?: string;
        videoUrl?: string;
        isMuted?: boolean;
        ledDim?: number;
      },
    ) => {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const channel = new BroadcastChannel('livenova_disco_sync');
          channel.postMessage({ type: 'SYNC_DISCO_MEDIA', ...data, timestamp: Date.now() });
          channel.close();
        } catch {
          // Đường dự phòng hỏng không đáng làm phiền: socket mới là đường thật.
        }
      }

      if (!overlayId) return;

      api
        .post(`/overlays/${overlayId}/disco-sync`, {
          musicUrl: data.musicUrl,
          trackTitle: data.trackTitle,
          videoUrl: data.videoUrl,
          isMuted: data.isMuted,
          ledDim: data.ledDim,
          cameraShot: data.cameraShot,
          cameraDurationMs: data.duration,
          cameraTargetId: data.targetId,
          effect: data.effect,
          speechText: data.speechText,
        })
        .catch((err) => {
          toast.error('Không đẩy được thay đổi lên overlay', describeError(err));
        });
    },
    [overlayId, toast],
  );

  // ── Nạp trạng thái đã lưu ─────────────────────────────────────────────────

  /**
   * `localStorage` chỉ còn là bộ nhớ đệm khởi động nhanh.
   *
   * Đọc trước để màn hình không nhấp nháy giá trị mặc định trong lúc chờ mạng;
   * cấu hình thật nằm trên server và sẽ ghi đè ngay khi tải xong. Trước đây đây
   * là nơi lưu duy nhất, nên đổi máy hay xoá cache là mất sạch, và dashboard với
   * overlay ở hai máy khác nhau thì mỗi bên một bài nhạc.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedVideo = localStorage.getItem(LS_VIDEO);
    if (savedVideo) setDjVideoUrl(savedVideo);
    const savedMusic = localStorage.getItem(LS_MUSIC);
    const savedTitle = localStorage.getItem(LS_TITLE);
    if (savedMusic) setMusicUrl(savedMusic);
    if (savedTitle) setTrackTitle(savedTitle);
  }, []);

  useEffect(() => {
    async function loadOverlay() {
      try {
        const overlays = await api.get<OverlayItem[]>('/overlays');
        const stage =
          overlays.find((o) => o.type === 'STAGE' || o.type === 'GAME_BATTLE') || overlays[0];

        if (!stage) {
          toast.info(
            'Chưa có overlay nào',
            'Tạo một overlay ở mục Hiệu ứng trước, rồi quay lại đây để lấy link.',
          );
          return;
        }

        setPublicToken(stage.publicToken);
        setOverlayId(stage.id);

        // Cấu hình đã lưu trên server thắng bộ nhớ đệm cục bộ.
        const saved = readDiscoConfig(stage.config);
        if (saved.videoUrl !== undefined) setDjVideoUrl(saved.videoUrl);
        if (saved.musicUrl !== undefined) setMusicUrl(saved.musicUrl);
        if (saved.trackTitle !== undefined) setTrackTitle(saved.trackTitle);
        if (saved.isMuted !== undefined) setIsDjVideoMuted(saved.isMuted);
        if (saved.ledDim !== undefined) setLedDim(saved.ledDim);
      } catch (err) {
        toast.error('Không tải được cấu hình sàn nhảy', describeError(err));
      }
    }
    loadOverlay();
  }, [toast]);

  /**
   * Ghi cấu hình lên server.
   *
   * Gộp nhịp (debounce) vì thanh trượt độ mờ bắn hàng chục sự kiện mỗi giây —
   * gửi từng cái sẽ dội bom API mà chỉ giá trị cuối có ý nghĩa. Lệnh đồng bộ
   * thời gian thực tới overlay vẫn đi ngay lập tức, không qua chỗ này.
   */
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistConfig = useCallback(
    (patch: DiscoOverlayConfig) => {
      if (!overlayId) return;
      if (persistTimer.current) clearTimeout(persistTimer.current);

      persistTimer.current = setTimeout(() => {
        api
          .patch(`/overlays/${overlayId}/config`, { config: patch })
          .catch((err) => toast.error('Không lưu được cấu hình', describeError(err)));
      }, 600);
    },
    [overlayId, toast],
  );

  useEffect(() => () => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
  }, []);

  // ── Media ─────────────────────────────────────────────────────────────────

  const setVideo = useCallback(
    (url: string) => {
      setDjVideoUrl(url);
      if (typeof window !== 'undefined') {
        // Blob và data URL chỉ sống trong phiên này, lưu lại thì lần sau là link hỏng.
        if (url.startsWith('blob:') || url.startsWith('data:')) localStorage.removeItem(LS_VIDEO);
        else localStorage.setItem(LS_VIDEO, url);
      }
      sync({ videoUrl: url });
      persistConfig({ videoUrl: url });
    },
    [persistConfig, sync],
  );

  const setMusic = useCallback(
    (url: string, title: string) => {
      setMusicUrl(url);
      setTrackTitle(title);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_MUSIC, url);
        localStorage.setItem(LS_TITLE, title);
      }
      sync({ musicUrl: url, trackTitle: title });
      persistConfig({ musicUrl: url, trackTitle: title });
      if (audioRef.current && url) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => undefined);
      }
    },
    [persistConfig, sync],
  );

  const setMuted = useCallback(
    (next: boolean) => {
      setIsDjVideoMuted(next);
      sync({ isMuted: next });
      persistConfig({ isMuted: next });
    },
    [persistConfig, sync],
  );

  const setDim = useCallback(
    (next: number) => {
      setLedDim(next);
      sync({ ledDim: next });
      persistConfig({ ledDim: next });
    },
    [persistConfig, sync],
  );

  // ── Hiệu ứng và camera ────────────────────────────────────────────────────

  const effect = useCallback(
    (name: 'smoke_blast' | 'confetti' | 'strobe' | 'laser_show' | 'firework_burst') => {
      if (name === 'smoke_blast') engine.triggerSmokeEffect();
      else engine.triggerEffect(name);

      if (name === 'firework_burst') {
        for (let i = 0; i < 8; i++) setTimeout(() => engine.triggerFirework(), i * 150);
      }
      sync({ effect: name });
    },
    [engine, sync],
  );

  const camera = useCallback(
    (shot: CameraShot) => {
      const duration = CAMERA_MS[shot];
      if (shot === 'DJ_POV') engine.triggerDjPov(duration);
      else if (shot === 'SPOTLIGHT_ZOOM') engine.triggerSpotlightZoom(duration);
      else if (shot === 'CRANE_SWOOP') engine.triggerCraneSwoop(duration);
      else engine.triggerWideOrbit(duration);
      sync({ cameraShot: shot, duration });
    },
    [engine, sync],
  );

  const toggleAutoDirector = useCallback(() => {
    setIsAutoDirector((prev) => {
      const next = !prev;
      engine.toggleAutoDirector(next);
      return next;
    });
  }, [engine]);

  // ── Sự kiện live ──────────────────────────────────────────────────────────

  /**
   * Áp sự kiện lên bản xem trước cục bộ.
   *
   * Không đọc bằng giọng nói (`speak: false`): overlay mới là thứ đang lên sóng,
   * hai bên cùng đọc thì streamer nghe hai giọng chồng nhau.
   */
  const handleEvent = useCallback(
    (event: LiveEvent) => {
      const action = interpretDiscoEvent(event);
      if (action) applyDiscoAction(engine, action, { speak: false });
    },
    [engine],
  );

  const { status } = useEventsSocket({
    channelIds,
    onEvent: handleEvent,
    enabled: channelIds.length > 0,
  });

  // ── Kiểm thử ──────────────────────────────────────────────────────────────

  /**
   * Bắn một sự kiện giả qua đúng đường mà sự kiện thật đi.
   *
   * Bản cũ có mười hai hàm gần như giống hệt nhau, chỉ khác nội dung comment
   * hoặc tên quà. Một hàm nhận tham số thì thêm một nút thử là thêm một dòng.
   */
  const simulate = useCallback(
    (payload: Partial<LiveEvent> & { type: LiveEventType }, logMsg: string) => {
      const id = testUsername.trim() || '@streamer_pro';
      const name = testDisplayName.trim() || 'Khán Giả 999';

      handleEvent({
        id: `test_${Date.now()}`,
        channelId: channelIds[0] || 'test_chan',
        senderUsername: id,
        senderDisplayName: name,
        occurredAt: new Date(),
        ...payload,
      } as LiveEvent);

      addLog(`${logMsg} — ${name}`);
    },
    [addLog, channelIds, handleEvent, testDisplayName, testUsername],
  );

  const simulateComment = useCallback(
    (content: string, logMsg: string) =>
      simulate({ type: LiveEventType.COMMENT, content }, logMsg),
    [simulate],
  );

  const simulateGift = useCallback(
    (giftName: string, giftCoinValue: number, logMsg: string) =>
      simulate({ type: LiveEventType.GIFT, giftName, giftCoinValue }, logMsg),
    [simulate],
  );

  const addRandomDancers = useCallback(() => {
    const nicks = ['Mèo Con', 'Gấu Bắc Cực', 'Cá Heo', 'Bắp Rang', 'Vịt Vàng', 'Gà Siêu Đẳng'];
    for (let i = 0; i < 3; i++) {
      engine.join(
        `@user_${Math.floor(Math.random() * 9000 + 1000)}`,
        nicks[Math.floor(Math.random() * nicks.length)],
      );
    }
    addLog('👥 Thêm 3 khán giả ngẫu nhiên');
  }, [addLog, engine]);

  const clearFloor = useCallback(() => {
    engine.clear();
    addLog('🧹 Dọn sạch sàn nhảy');
  }, [addLog, engine]);

  // ── Bộ chạy kịch bản ──────────────────────────────────────────────────────

  const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stopScenario = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setActiveScenario(null);
    setStepIndex(0);
  }, []);

  // Dọn timer khi rời trang, nếu không kịch bản vẫn chạy tiếp trên một engine
  // đã bị gỡ và React cảnh báo setState sau unmount.
  useEffect(() => stopScenario, [stopScenario]);

  const runScenario = useCallback(
    (id: ScenarioId) => {
      stopScenario();
      const scenario = findScenario(id);
      if (!scenario) return;

      setActiveScenario(id);
      setTotalSteps(scenario.steps.length);
      setLogs([]);

      const ctx: ScenarioContext = { engine, sync, setMusic, effect, camera };

      scenario.steps.forEach((step, index) => {
        const fire = () => {
          setStepIndex(index + 1);
          addLog(`▶️ [Bước ${index + 1}/${scenario.steps.length}] ${step.log}`);
          step.run(ctx);
        };
        // Bước ở mốc 0 vẫn qua setTimeout để mọi bước dọn được như nhau.
        timers.current.push(setTimeout(fire, step.at));
      });

      const last = scenario.steps[scenario.steps.length - 1];
      timers.current.push(
        setTimeout(() => {
          addLog(scenario.doneLog);
          setActiveScenario(null);
        }, last.at + scenario.doneAfterMs),
      );
    },
    [addLog, camera, effect, engine, setMusic, stopScenario, sync],
  );

  // ── Link overlay ──────────────────────────────────────────────────────────

  const overlayUrl = useMemo(() => {
    let origin = typeof window === 'undefined' ? '' : window.location.origin;
    if (process.env.NEXT_PUBLIC_OVERLAY_URL) {
      origin = process.env.NEXT_PUBLIC_OVERLAY_URL.replace(/\/$/, '');
    }
    const params = new URLSearchParams();
    if (publicToken) params.set('token', publicToken);
    if (djVideoUrl.trim()) params.set('video', djVideoUrl);
    const query = params.toString();
    return query ? `${origin}/overlays/disco?${query}` : `${origin}/overlays/disco`;
  }, [publicToken, djVideoUrl]);

  const copyUrl = useCallback(async () => {
    if ((await copyText(overlayUrl)) === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return;
    }
    toast.error(
      'Không chép được link',
      'Trình duyệt chặn clipboard trên kết nối HTTP. Hãy bôi đen link rồi nhấn Ctrl+C.',
    );
  }, [overlayUrl, toast]);

  const copySize = useCallback(async () => {
    const size = `${DEFAULT_FRAME_WIDTH}x${DEFAULT_FRAME_HEIGHT}`;
    if ((await copyText(size)) === 'copied') {
      toast.success(`Đã chép ${size}`, 'Dán vào ô Width × Height của Browser Source.');
    } else {
      toast.info(`Kích thước cần đặt: ${size}`, 'Nhập tay vào Browser Source.');
    }
  }, [toast]);

  return {
    engine,
    audioRef,
    status,
    channels,

    // media
    musicUrl, trackTitle, djVideoUrl, isDjVideoMuted, ledDim,
    setVideo, setMusic, setMuted, setDim,

    // đạo diễn
    isAutoDirector, toggleAutoDirector, effect, camera,

    // kiểm thử
    testUsername, setTestUsername,
    testDisplayName, setTestDisplayName,
    customComment, setCustomComment,
    simulateComment, simulateGift, addRandomDancers, clearFloor,
    logs,

    // kịch bản
    scenarios: SCENARIOS, activeScenario, stepIndex, totalSteps, runScenario, stopScenario,

    // phát sóng
    overlayUrl, copyUrl, copySize, copied, hasOverlay: Boolean(overlayId),
  };
}

export type DiscoController = ReturnType<typeof useDiscoController>;

/** Lỗi bị nuốt trong `useApi` vẫn cần hiện ra — dùng lại kiểu lỗi chung. */
export { ApiError };
