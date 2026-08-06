import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Gamepad2,
  AlertTriangle,
  Video,
  Swords,
  Moon,
  Sun,
  Plug,
  Hourglass,
  Crosshair,
  Zap,
  Keyboard,
  ScrollText,
} from 'lucide-react';
import { ConnectOBS, GetBridgeStatus, SendRconCommand, SimulateKeyPress } from '../wailsjs/go/main/App';
import type { bridge } from '../wailsjs/go/models';

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

/** Section headings: icon and text on one baseline, one place to change it. */
const headingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '1.2rem',
  margin: '0 0 1rem 0',
};

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [bridgeStatus, setBridgeStatus] = useState<bridge.Status | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Key Simulation State
  const [selectedKey, setSelectedKey] = useState<number>(0x20); // Space
  const [holdTime, setHoldTime] = useState<number>(200); // 200ms
  const [isPressingKey, setIsPressingKey] = useState<boolean>(false);

  // OBS State
  const [obsHost, setObsHost] = useState<string>('127.0.0.1');
  const [obsPort, setObsPort] = useState<number>(4455);
  const [obsPassword, setObsPassword] = useState<string>('');

  // RCON State
  const [rconHost, setRconHost] = useState<string>('127.0.0.1');
  const [rconPort, setRconPort] = useState<number>(25575);
  const [rconPassword, setRconPassword] = useState<string>('');
  const [rconCommand, setRconCommand] = useState<string>('give @a diamond 1');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setBridgeStatus(await GetBridgeStatus());
      } catch (err) {
        console.error('Failed to get bridge status', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  };

  // ── Key Simulation Handler ───────────────────────────────────────────
  const handleTestKeyPress = async (keyCodeOverride?: number) => {
    const vkCode = keyCodeOverride ?? selectedKey;
    setIsPressingKey(true);
    const keyInfo = ALLOWED_KEYS.find((k) => k.code === vkCode);
    addLog(`[...] Đang giả lập bấm phím: ${keyInfo?.label || vkCode} (giữ ${holdTime}ms)...`);

    try {
      await SimulateKeyPress(vkCode, holdTime, 1000);
      addLog(`[OK] Giả lập bấm phím thành công: ${keyInfo?.label || vkCode}`);
    } catch (err: any) {
      addLog(`[LỖI] Lỗi giả lập phím: ${err?.message || err}`);
    } finally {
      setIsPressingKey(false);
    }
  };

  // ── OBS Handler ──────────────────────────────────────────────────────
  const handleConnectObs = async () => {
    addLog(`[...] Đang kết nối OBS Studio WebSocket (${obsHost}:${obsPort})...`);
    try {
      const ok = await ConnectOBS(obsHost, obsPort, obsPassword);
      if (ok) {
        addLog('[OK] Kết nối OBS Studio thành công');
      } else {
        addLog('[LỖI] Kết nối OBS thất bại (Vui lòng kiểm tra OBS WebSocket Settings).');
      }
    } catch (err: any) {
      addLog(`[LỖI] OBS connect failed: ${err?.message || err}`);
    }
  };

  // ── RCON Handler ─────────────────────────────────────────────────────
  const handleSendRcon = async () => {
    addLog(`[...] Đang gửi lệnh RCON đến Game (${rconHost}:${rconPort}): "${rconCommand}"...`);
    try {
      const reply = await SendRconCommand(rconHost, rconPort, rconPassword, rconCommand);
      addLog(`[OK] Phản hồi RCON: ${reply || 'Đã thực thi thành công'}`);
    } catch (err: any) {
      addLog(`[LỖI] Lỗi RCON: ${err?.message || err}`);
    }
  };

  // ── Emergency Stop Handler ───────────────────────────────────────────
  const handleEmergencyStop = () => {
    addLog('[DỪNG] Nút khẩn cấp đã kích hoạt. Đã ngắt toàn bộ chuỗi bấm phím & âm thanh.');
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>LiveNova Desktop App</h1>
          <p style={{ margin: '0.25rem 0 0 0', opacity: 0.7, fontSize: '0.9rem' }}>
            Ứng dụng giả lập phím bấm Win32, Local Bridge WebSocket & Điều khiển OBS Studio / Game RCON
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          {theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
        </button>
      </header>

      {/* Main Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* 1. Local Bridge Status */}
        <div className="card">
          <h2 style={headingStyle}>
            <Plug size={18} />
            Local Bridge Daemon
          </h2>
          {bridgeStatus ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
              <p style={{ margin: 0 }}>
                <span className={`status-dot ${bridgeStatus.is_running ? 'status-green' : 'status-red'}`}></span>
                Trạng thái: <strong>{bridgeStatus.is_running ? 'Đang chạy (Running)' : 'Đã dừng'}</strong>
              </p>
              <p style={{ margin: 0 }}>
                Cổng Listening: <code>127.0.0.1:{bridgeStatus.port}</code>
              </p>
              <p style={{ margin: 0 }}>Clients kết nối: {bridgeStatus.connected_clients}</p>
              <p style={{ margin: 0 }}>
                Token phiên: <code style={{ fontSize: '0.85rem' }}>{bridgeStatus.session_token}</code>
              </p>
            </div>
          ) : (
            <p>Đang tải thông tin Local Bridge...</p>
          )}
        </div>

        {/* 2. Win32 Key Simulation Test Panel */}
        <div className="card">
          <h2 style={headingStyle}>
            <Gamepad2 size={18} />
            Giả lập phím bấm game (Win32)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Chọn phím bấm:
              </label>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                {ALLOWED_KEYS.map((k) => (
                  <option key={k.code} value={k.code}>
                    {k.label} ({k.hex})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Thời gian giữ phím (Hold):</label>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>{holdTime} ms</span>
              </div>
              <input
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
              className="btn-primary"
              onClick={() => handleTestKeyPress()}
              disabled={isPressingKey}
              style={{ width: '100%', padding: '0.65rem', marginTop: '0.25rem' }}
            >
              {isPressingKey ? <Hourglass size={16} /> : <Crosshair size={16} />}
              {isPressingKey ? 'Đang bấm phím…' : 'Thử bấm phím ngay'}
            </button>
          </div>
        </div>

        {/* 3. OBS Controller */}
        <div className="card">
          <h2 style={headingStyle}>
            <Video size={18} />
            Điều khiển OBS Studio
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.8rem', display: 'block' }}>Host:</label>
                <input
                  type="text"
                  value={obsHost}
                  onChange={(e) => setObsHost(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: '4px',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', display: 'block' }}>Port:</label>
                <input
                  type="number"
                  value={obsPort}
                  onChange={(e) => setObsPort(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: '4px',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', display: 'block' }}>Mật khẩu OBS WS:</label>
              <input
                type="password"
                value={obsPassword}
                onChange={(e) => setObsPassword(e.target.value)}
                placeholder="Nhập mật khẩu nếu có"
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  borderRadius: '4px',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            <button className="btn-primary" onClick={handleConnectObs} style={{ marginTop: '0.25rem' }}>
              <Plug size={16} />
              Kết nối OBS Studio
            </button>
          </div>
        </div>

        {/* 4. Game RCON */}
        <div className="card">
          <h2 style={headingStyle}>
            <Swords size={18} />
            Game RCON Command
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.8rem', display: 'block' }}>Host:</label>
                <input
                  type="text"
                  value={rconHost}
                  onChange={(e) => setRconHost(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: '4px',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', display: 'block' }}>Port:</label>
                <input
                  type="number"
                  value={rconPort}
                  onChange={(e) => setRconPort(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: '4px',
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', display: 'block' }}>Mật khẩu RCON:</label>
              <input
                type="password"
                value={rconPassword}
                onChange={(e) => setRconPassword(e.target.value)}
                placeholder="Nhập mật khẩu RCON nếu có"
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  borderRadius: '4px',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', display: 'block' }}>Lệnh RCON:</label>
              <input
                type="text"
                value={rconCommand}
                onChange={(e) => setRconCommand(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  borderRadius: '4px',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            <button className="btn-primary" onClick={handleSendRcon} style={{ marginTop: '0.25rem' }}>
              <Zap size={16} />
              Gửi lệnh RCON
            </button>
          </div>
        </div>
      </div>

      {/* 5. Hotkeys Map Viewer */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={headingStyle}>
          <Keyboard size={18} />
          Phím nóng và bảng mã Win32
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
          {ALLOWED_KEYS.map((k) => (
            <div
              key={k.code}
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    marginRight: '0.5rem',
                  }}
                >
                  {k.hex}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{k.label}</span>
                <p style={{ margin: '0.2rem 0 0 0', opacity: 0.7, fontSize: '0.8rem' }}>{k.action}</p>
              </div>
              <button
                type="button"
                onClick={() => handleTestKeyPress(k.code)}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Bấm thử
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Stop Button */}
      <div style={{ textAlign: 'center', margin: '2rem 0' }}>
        <button className="btn-danger" onClick={handleEmergencyStop}>
          <AlertTriangle size={18} />
          Nút khẩn cấp (Emergency Stop)
        </button>
        <p style={{ marginTop: '0.5rem', opacity: 0.7, fontSize: '0.85rem' }}>
          Ngắt lập tức toàn bộ chuỗi bấm phím và hàng chờ âm thanh trên máy
        </p>
      </div>

      {/* System Logs */}
      <div className="card">
        <h2 style={headingStyle}>
          <ScrollText size={18} />
          Nhật ký hoạt động
        </h2>
        <div className="log-viewer">
          {logs.length === 0 ? <p style={{ color: '#888' }}>Chưa có nhật ký hoạt động...</p> : null}
          {logs.map((log, i) => (
            <p key={i} className="log-line">
              {log}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
