import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import brokenScreenImg from './assets/broken-screen.png';
import {
  CheckCircle2,
  AlertTriangle,
  Moon,
  Sun,
  ChevronRight,
  ChevronDown,
  Gauge,
  Users,
  Clock,
  Video,
  Swords,
  Gamepad2,
  ScrollText,
} from 'lucide-react';
import {
  ConnectOBS,
  GetBridgeStatus,
  SendRconCommand,
  SetOBSScene,
  SimulateKeyPress,
  EmergencyStop,
  ResumeAfterStop,
  IsHalted,
  GetActivity,
} from '../wailsjs/go/main/App';
import type { bridge } from '../wailsjs/go/models';
import { EventsOn } from '../wailsjs/runtime/runtime';

function playTVStaticSound(durationMs = 5000) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const bufferSize = ctx.sampleRate * (durationMs / 1000);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Crackling harsh TV static sound "tusttttt"
      data[i] = (Math.random() * 2 - 1) * 0.75 + (Math.sin(i * 0.05) > 0 ? 0.1 : -0.1);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.9;

    noise.connect(filter);
    filter.connect(ctx.destination);
    noise.start();

    setTimeout(() => {
      try {
        noise.stop();
        ctx.close();
      } catch {}
    }, durationMs);
  } catch (e) {
    console.error('TV Static sound error:', e);
  }
}

function playCSGOFlashbangSound(durationMs = 5000) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const durSec = durationMs / 1000;

    // 1. CS:GO Grenade Explosion Bang (Noise Burst + Low Frequency Sub-Bass Kick)
    const bangBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const bangData = bangBuffer.getChannelData(0);
    for (let i = 0; i < bangData.length; i++) {
      bangData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    }
    const bangSource = ctx.createBufferSource();
    bangSource.buffer = bangBuffer;

    const bangGain = ctx.createGain();
    bangGain.gain.setValueAtTime(1.0, now);
    bangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    bangSource.connect(bangGain);
    bangGain.connect(ctx.destination);
    bangSource.start(now);

    // Sub-bass impact oscillator
    const kickOsc = ctx.createOscillator();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(160, now);
    kickOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

    const kickGain = ctx.createGain();
    kickGain.gain.setValueAtTime(0.95, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    kickOsc.connect(kickGain);
    kickGain.connect(ctx.destination);
    kickOsc.start(now);
    kickOsc.stop(now + 0.3);

    // 2. Iconic CS:GO High-Pitched Tinnitus Ear Ringing Tone (4200 Hz Sine Wave)
    const ringOsc = ctx.createOscillator();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(4200, now); // Iconic CS:GO tinnitus pitch

    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0.5, now + 0.05); // Starts right after bang
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

    ringOsc.connect(ringGain);
    ringGain.connect(ctx.destination);
    ringOsc.start(now + 0.05);
    ringOsc.stop(now + durSec);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, durationMs + 200);
  } catch (e) {
    console.error('CS:GO Flashbang sound error:', e);
  }
}

interface KeyOption {
  label: string;
  code: number;
  hex: string;
  action: string;
}

const ALLOWED_KEYS: KeyOption[] = [
  { label: 'Phím Space', code: 0x20, hex: '0x20', action: 'Nhảy (Jump)' },
  { label: 'Phím W', code: 0x57, hex: '0x57', action: 'Di chuyển tiến' },
  { label: 'Phím S', code: 0x53, hex: '0x53', action: 'Di chuyển lùi' },
  { label: 'Phím A', code: 0x41, hex: '0x41', action: 'Di chuyển trái' },
  { label: 'Phím D', code: 0x44, hex: '0x44', action: 'Di chuyển phải' },
  { label: 'Phím F', code: 0x46, hex: '0x46', action: 'Tương tác / Nhặt đồ' },
  { label: 'Phím Enter', code: 0x0d, hex: '0x0D', action: 'Xác nhận / Chat Game' },
  { label: 'Phím F1', code: 0x70, hex: '0x70', action: 'Phím tắt Macro 1' },
  { label: 'Phím F5', code: 0x74, hex: '0x74', action: 'F5 Refresh / Quà lớn' },
  { label: 'Phím 1', code: 0x31, hex: '0x31', action: 'Chọn ô item 1' },
  { label: 'Phím 2', code: 0x32, hex: '0x32', action: 'Chọn ô item 2' },
  { label: 'Phím 3', code: 0x33, hex: '0x33', action: 'Chọn ô item 3' },
];

/** A collapsed section. Everything technical lives inside one of these. */
function Disclosure({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button type="button" className="disclosure" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {icon}
        {title}
      </button>
      {open && <div style={{ marginTop: '0.875rem' }}>{children}</div>}
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ color: 'var(--muted-foreground)', display: 'flex' }}>{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
          {label}
        </span>
        <strong style={{ fontSize: '1rem' }}>{value}</strong>
      </span>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [bridgeStatus, setBridgeStatus] = useState<bridge.Status | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [halted, setHalted] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [uptime, setUptime] = useState('0 phút');
  const [blindData, setBlindData] = useState<{ type: string; caption?: string; durationMs: number } | null>(null);

  useEffect(() => {
    const unsubBlind = EventsOn('desktop-blind', (data: any) => {
      const durationMs = data?.durationMs || 5000;
      if (data?.type === 'flashbang') {
        playCSGOFlashbangSound(durationMs);
      } else {
        playTVStaticSound(durationMs);
      }
      setBlindData({
        type: data?.type || 'blackout',
        caption: data?.caption || '🙈 MÀN HÌNH BỊ CHE (5s)!',
        durationMs,
      });
    });

    const unsubBlindEnd = EventsOn('desktop-blind-end', () => {
      setBlindData(null);
    });

    return () => {
      if (unsubBlind) unsubBlind();
      if (unsubBlindEnd) unsubBlindEnd();
    };
  }, []);

  const [selectedKey, setSelectedKey] = useState<number>(0x20);
  const [holdTime, setHoldTime] = useState<number>(200);
  const [isPressingKey, setIsPressingKey] = useState<boolean>(false);

  const [obsHost, setObsHost] = useState<string>('127.0.0.1');
  const [obsPort, setObsPort] = useState<number>(4455);
  const [obsPassword, setObsPassword] = useState<string>('');
  const [obsScene, setObsScene] = useState<string>('');

  const [rconHost, setRconHost] = useState<string>('127.0.0.1');
  const [rconPort, setRconPort] = useState<number>(25575);
  const [rconPassword, setRconPassword] = useState<string>('');
  const [rconCommand, setRconCommand] = useState<string>('');

  /**
   * Nhật ký hoạt động của Local Bridge.
   *
   * Cho tới giờ ứng dụng này chỉ nói được "bridge đang chạy". Khi một món quà
   * đáng lẽ bấm phím vào game mà không có gì xảy ra, đó là bốn khả năng khác
   * nhau — lệnh chưa tới, phím ngoài danh sách, còn cooldown, hay đang dừng
   * khẩn cấp — và bốn cách sửa khác nhau. Giữa buổi live thì không có thời gian
   * để đoán.
   */
  const [activity, setActivity] = useState<bridge.Entry[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [status, isHalted, log] = await Promise.all([
          GetBridgeStatus(),
          IsHalted(),
          GetActivity(),
        ]);
        setBridgeStatus(status);
        setHalted(isHalted);
        setActivity(log ?? []);
        setStatusError(false);
      } catch (err) {
        console.error('Failed to get bridge status', err);
        setStatusError(true);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = () => {
      const mins = Math.floor((Date.now() - startedAt) / 60000);
      setUptime(mins < 60 ? `${mins} phút` : `${Math.floor(mins / 60)} giờ ${mins % 60} phút`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [startedAt]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const handleTestKeyPress = async (keyCodeOverride?: number) => {
    const vkCode = keyCodeOverride ?? selectedKey;
    setIsPressingKey(true);
    const keyInfo = ALLOWED_KEYS.find((k) => k.code === vkCode);
    addLog(`Đang thử bấm: ${keyInfo?.label || vkCode} (giữ ${holdTime}ms)`);

    try {
      await SimulateKeyPress(vkCode, holdTime, 1000);
      addLog(`Bấm thử thành công: ${keyInfo?.label || vkCode}`);
    } catch (err: any) {
      addLog(`Không bấm được: ${err?.message || err}`);
    } finally {
      setIsPressingKey(false);
    }
  };

  const handleConnectObs = async () => {
    addLog(`Đang kết nối OBS (${obsHost}:${obsPort})`);
    try {
      const ok = await ConnectOBS(obsHost, obsPort, obsPassword);
      addLog(ok ? 'Đã kết nối OBS' : 'Không kết nối được OBS — kiểm tra lại cài đặt WebSocket trong OBS');
    } catch (err: any) {
      addLog(`Không kết nối được OBS: ${err?.message || err}`);
    }
  };

  const handleSetObsScene = async () => {
    addLog(`Đang đổi cảnh OBS sang "${obsScene}"`);
    try {
      await SetOBSScene(obsHost, obsPort, obsPassword, obsScene);
      addLog(`Đã đổi sang cảnh "${obsScene}"`);
    } catch (err: any) {
      // Lý do OBS đưa ra được giữ nguyên: "không có cảnh nào tên đó" và "sai
      // mật khẩu" dẫn tới hai chỗ sửa khác nhau.
      addLog(`Không đổi được cảnh: ${err?.message || err}`);
    }
  };

  const handleSendRcon = async () => {
    addLog(`Đang gửi lệnh tới máy chủ game (${rconHost}:${rconPort})`);
    try {
      const reply = await SendRconCommand(rconHost, rconPort, rconPassword, rconCommand);
      addLog(`Máy chủ trả lời: ${reply || 'đã thực thi'}`);
    } catch (err: any) {
      addLog(`Lỗi gửi lệnh: ${err?.message || err}`);
    }
  };

  /**
   * This now calls into Go and genuinely blocks every further key press,
   * including ones triggered by gifts arriving over the Local Bridge. It used
   * to only append a log line.
   */
  const handleEmergencyStop = async () => {
    try {
      await EmergencyStop();
      setHalted(true);
      addLog('ĐÃ DỪNG KHẨN CẤP — mọi thao tác bấm phím bị chặn');
    } catch (err: any) {
      addLog(`Không dừng được: ${err?.message || err}`);
    }
  };

  const handleResume = async () => {
    try {
      await ResumeAfterStop();
      setHalted(false);
      addLog('Đã bật lại — thao tác bấm phím hoạt động bình thường');
    } catch (err: any) {
      addLog(`Không bật lại được: ${err?.message || err}`);
    }
  };

  const running = Boolean(bridgeStatus?.is_running) && !statusError;
  const healthy = running && !halted;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--card-bg)',
        }}
      >
        <strong style={{ fontSize: '1rem' }}>LiveNova trên máy tính</strong>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          {theme === 'light' ? 'Nền tối' : 'Nền sáng'}
        </button>
      </header>

      <main style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* One calm sentence. Ports, tokens and client counts are facts about
            the software, not answers to the question the user is asking. */}
        <section
          className="card"
          style={{
            textAlign: 'center',
            padding: '2rem 1.25rem',
            borderColor: healthy ? 'var(--border)' : 'var(--warning)',
            background: healthy ? 'var(--card-bg)' : 'rgba(217, 119, 6, 0.06)',
          }}
        >
          <span style={{ display: 'inline-flex', color: healthy ? 'var(--success)' : 'var(--warning)' }}>
            {healthy ? <CheckCircle2 size={44} /> : <AlertTriangle size={44} />}
          </span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.75rem 0 0.35rem' }}>
            {halted
              ? 'Đang tạm dừng theo yêu cầu của bạn'
              : healthy
                ? 'Mọi thứ đang chạy tốt'
                : 'Chưa kết nối được'}
          </h1>
          <p style={{ margin: 0, color: 'var(--muted-foreground)' }}>
            {halted
              ? 'Bạn đã bấm dừng khẩn cấp. Bấm “Bật lại” khi muốn tiếp tục.'
              : healthy
                ? 'Ứng dụng đang kết nối với LiveNova và sẵn sàng làm việc với OBS.'
                : 'Hãy thử khởi động lại ứng dụng. Nếu vẫn vậy, khởi động lại máy giúp mình nhé.'}
          </p>

          {halted && (
            <button type="button" className="btn-primary" style={{ marginTop: '1rem' }} onClick={handleResume}>
              Bật lại
            </button>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          <Tile
            icon={<Gauge size={18} />}
            label="Kết nối"
            value={running ? 'Rất tốt' : 'Chưa có'}
          />
          <Tile
            icon={<Users size={18} />}
            label="Hiệu ứng đang mở"
            value={`${bridgeStatus?.connected_clients ?? 0}`}
          />
          <Tile icon={<Clock size={18} />} label="Đang chạy" value={uptime} />
        </div>

        {/* Mã kết nối Session Token & Test Che màn hình */}
        <div
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            padding: '1rem 1.25rem',
            marginTop: '0.75rem',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
              🔑 Mã kết nối Local Bridge (Session Token):
            </span>
            <code
              style={{
                display: 'inline-block',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                background: 'var(--muted-bg, rgba(0,0,0,0.1))',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                marginTop: '0.25rem',
                wordBreak: 'break-all',
                color: 'var(--primary, #3b82f6)',
              }}
            >
              {bridgeStatus?.session_token || 'Đang lấy mã...'}
            </code>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              onClick={() => {
                if (bridgeStatus?.session_token) {
                  navigator.clipboard.writeText(bridgeStatus.session_token);
                  alert('Đã copy Mã kết nối Session Token vào Clipboard!');
                }
              }}
            >
              📋 Copy Mã Kết Nối
            </button>
            <button
              type="button"
              className="btn-danger"
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem', whiteSpace: 'nowrap', background: '#e11d48', color: '#fff' }}
              onClick={() => {
                setBlindData({
                  type: 'blackout',
                  caption: '🙈 DÙNG THỬ CHE MÀN HÌNH MÁY TÍNH 5s GÂY ỨC CHẾ 😈',
                  durationMs: 5000,
                });
                setTimeout(() => setBlindData(null), 5000);
              }}
            >
              ⚡ Thử Che Màn Hình (5s)
            </button>
          </div>
        </div>

        <Disclosure title="Nhật ký hoạt động" icon={<ScrollText size={16} />}>
          {activity.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: 0 }}>
              Chưa có gì. Khi bảng điều khiển kết nối và quà bắt đầu bấm phím, mọi thứ sẽ hiện ở đây.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 260, overflowY: 'auto' }}>
              {activity.map((e, i) => (
                <li
                  key={`${e.atMs}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.6rem',
                    padding: '0.35rem 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.82rem',
                  }}
                >
                  <span style={{ color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(e.atMs).toLocaleTimeString('vi-VN')}
                  </span>
                  {/* Đỏ cho dòng bị từ chối. Một lệnh hỏng trôi qua cùng màu với
                      một lệnh thành công thì nhật ký này chẳng giúp được gì. */}
                  <span style={{ color: e.ok ? 'var(--foreground)' : 'var(--danger, #ef4444)', flex: 1 }}>
                    {e.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Disclosure>

        <Disclosure title="Cài đặt OBS" icon={<Video size={16} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 2 }}>
                <label className="field-label" htmlFor="obs-host">Địa chỉ</label>
                <input id="obs-host" className="field-input" type="text" value={obsHost} onChange={(e) => setObsHost(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="obs-port">Cổng</label>
                <input id="obs-port" className="field-input" type="number" value={obsPort} onChange={(e) => setObsPort(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="obs-pass">Mật khẩu (nếu OBS có đặt)</label>
              <input id="obs-pass" className="field-input" type="password" value={obsPassword} onChange={(e) => setObsPassword(e.target.value)} />
            </div>
            <button type="button" className="btn-primary" onClick={handleConnectObs}>
              Kết nối OBS
            </button>
            <div>
              {/* Đổi cảnh là việc duy nhất một luồng quà thực sự cần ở OBS, nên
                  nó là lệnh duy nhất được mở ra — thay vì một đường gọi tuỳ ý
                  khiến mọi lệnh OBS trong tương lai tự động nằm sau ranh giới
                  tin cậy này. */}
              <label className="field-label" htmlFor="obs-scene">Đổi sang cảnh</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="obs-scene"
                  className="field-input"
                  type="text"
                  value={obsScene}
                  placeholder="Tên cảnh trong OBS"
                  onChange={(e) => setObsScene(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn-secondary" onClick={handleSetObsScene}>
                  Đổi cảnh
                </button>
              </div>
            </div>
          </div>
        </Disclosure>

        <Disclosure title="Điều khiển game" icon={<Gamepad2 size={16} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label className="field-label" htmlFor="key-select">Phím muốn thử</label>
              <select
                id="key-select"
                className="field-input"
                value={selectedKey}
                onChange={(e) => setSelectedKey(Number(e.target.value))}
              >
                {ALLOWED_KEYS.map((k) => (
                  <option key={k.code} value={k.code}>
                    {k.label} — {k.action}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label className="field-label" htmlFor="hold-time">Giữ phím bao lâu</label>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{holdTime} ms</span>
              </div>
              <input
                id="hold-time"
                type="range"
                min="50"
                max="1000"
                step="50"
                value={holdTime}
                onChange={(e) => setHoldTime(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleTestKeyPress()}
              disabled={isPressingKey || halted}
            >
              {isPressingKey ? 'Đang bấm…' : 'Bấm thử'}
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.5rem' }}>
              {ALLOWED_KEYS.map((k) => (
                <div
                  key={k.code}
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <span>
                    <strong style={{ fontSize: '0.85rem' }}>{k.label}</strong>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                      {k.action}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ minHeight: '32px', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={() => handleTestKeyPress(k.code)}
                    disabled={halted}
                  >
                    Thử
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Disclosure>

        <Disclosure title="Gửi lệnh tới máy chủ game" icon={<Swords size={16} />}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 2 }}>
                <label className="field-label" htmlFor="rcon-host">Địa chỉ</label>
                <input id="rcon-host" className="field-input" type="text" value={rconHost} onChange={(e) => setRconHost(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label" htmlFor="rcon-port">Cổng</label>
                <input id="rcon-port" className="field-input" type="number" value={rconPort} onChange={(e) => setRconPort(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="rcon-pass">Mật khẩu</label>
              <input id="rcon-pass" className="field-input" type="password" value={rconPassword} onChange={(e) => setRconPassword(e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="rcon-cmd">Lệnh</label>
              <input
                id="rcon-cmd"
                className="field-input"
                type="text"
                value={rconCommand}
                placeholder="Ví dụ: give @a diamond 1"
                onChange={(e) => setRconCommand(e.target.value)}
              />
            </div>
            <button type="button" className="btn-primary" onClick={handleSendRcon} disabled={!rconCommand.trim()}>
              Gửi lệnh
            </button>
          </div>
        </Disclosure>

        <Disclosure title="Nhật ký kỹ thuật">
          <div className="log-viewer">
            {logs.length === 0 ? (
              <p className="log-line">Chưa có gì để xem — đó là dấu hiệu tốt.</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className="log-line">
                  {log}
                </p>
              ))
            )}
          </div>
          {bridgeStatus && (
            <p style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
              Địa chỉ nội bộ 127.0.0.1:{bridgeStatus.port} · {bridgeStatus.connected_clients} kết nối
            </p>
          )}
        </Disclosure>
      </main>

      {/* Always reachable, never scrolls away. */}
      <footer
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid var(--border)',
          background: 'var(--card-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
          Dừng ngay mọi thao tác tự động lên game và OBS.
        </span>
        <button
          type="button"
          className="btn-danger"
          onClick={handleEmergencyStop}
          disabled={halted}
        >
          <AlertTriangle size={18} />
          DỪNG KHẨN CẤP
        </button>
      </footer>

      {/* Desktop Physical Screen Blackout / Flashbang Overlay */}
      {blindData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999999,
            backgroundImage: blindData.type === 'flashbang' ? 'none' : `url(${brokenScreenImg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: blindData.type === 'flashbang' ? '#ffffff' : '#000000',
          }}
        />
      )}
    </div>
  );
}
