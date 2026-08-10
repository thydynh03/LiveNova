'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AVATAR_MOTION_LIMITS,
  AvatarExpression,
  AvatarMotionKind,
  type AvatarMotionPayload,
} from '@livenova/shared';
import { AdminPageHeader, Panel, StatusPill } from '../../../../components/admin/AdminShell';
import {
  DEFAULT_LIGHTING,
  LIGHTING_PRESETS,
  sanitiseLighting,
  type LightingSettings,
} from '../../../../lib/vrm/lighting';
import { resolveVrmModelUrl } from '../../../../lib/vrm/model';
import { VrmModelPanel } from '../../../../components/admin/VrmModelPanel';
import {
  VrmLightingStudio,
  type CameraPreset,
  type StageStats,
} from '../../../../components/admin/VrmLightingStudio';

/**
 * Studio ánh sáng và động tác VRM.
 *
 * Dự án không dùng Tailwind — mọi class tiện ích kiểu `text-sm` ở đây sẽ không
 * có tác dụng gì. Style vì vậy đi bằng token trong `globals.css`
 * (`--muted-foreground`, `--radius`, `.admin-panel`, `.btn`) hoặc inline.
 */

const STORAGE_KEY = 'admin:vrm-studio:lighting:v1';

const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'full', label: 'Toàn thân' },
  { id: 'half', label: 'Nửa người' },
  { id: 'face', label: 'Cận mặt' },
];

const MOTION_LABELS: Record<AvatarMotionKind, string> = {
  [AvatarMotionKind.WAVE]: 'Vẫy tay',
  [AvatarMotionKind.BOW]: 'Cúi chào',
  [AvatarMotionKind.JUMP]: 'Nhảy lên',
  [AvatarMotionKind.CLAP]: 'Vỗ tay',
  [AvatarMotionKind.HEART]: 'Thả tim',
  [AvatarMotionKind.SPIN]: 'Xoay một vòng',
};

const EXPRESSION_LABELS: Record<AvatarExpression, string> = {
  [AvatarExpression.NEUTRAL]: 'Bình thường',
  [AvatarExpression.HAPPY]: 'Vui',
  [AvatarExpression.ANGRY]: 'Giận',
  [AvatarExpression.SAD]: 'Buồn',
  [AvatarExpression.RELAXED]: 'Thư giãn',
  [AvatarExpression.SURPRISED]: 'Ngạc nhiên',
};

/**
 * Các mức quà giả lập.
 *
 * Đây là thứ biến trang này từ "chỉnh đèn" thành nơi chỉnh được cả nhịp diễn:
 * độ ưu tiên và cửa sổ hợp nhất chỉ lộ ra vấn đề khi có nhiều quà chồng nhau,
 * và không ai muốn phát hiện điều đó lần đầu giữa buổi livestream thật.
 */
const GIFT_TIERS: {
  id: string;
  label: string;
  coins: number;
  payload: AvatarMotionPayload;
}[] = [
  {
    id: 'rose',
    label: 'Hoa hồng',
    coins: 1,
    payload: {
      clip: AvatarMotionKind.WAVE,
      expression: AvatarExpression.HAPPY,
      loop: true,
      durationMs: 1800,
      priority: 1,
      intensity: 0.5,
      blendMs: 180,
    },
  },
  {
    id: 'bear',
    label: 'Gấu bông',
    coins: 100,
    payload: {
      clip: AvatarMotionKind.CLAP,
      expression: AvatarExpression.HAPPY,
      loop: true,
      durationMs: 2600,
      priority: 3,
      intensity: 0.7,
      blendMs: 200,
    },
  },
  {
    id: 'diamond',
    label: 'Kim cương',
    coins: 500,
    payload: {
      clip: AvatarMotionKind.HEART,
      expression: AvatarExpression.RELAXED,
      loop: false,
      durationMs: 3200,
      priority: 6,
      intensity: 0.85,
      blendMs: 250,
    },
  },
  {
    id: 'rocket',
    label: 'Tên lửa',
    coins: 5000,
    payload: {
      clip: AvatarMotionKind.SPIN,
      expression: AvatarExpression.SURPRISED,
      loop: false,
      durationMs: 2400,
      priority: 9,
      intensity: 1,
      blendMs: 220,
    },
  },
];

/** Ngân sách một khung ở 60fps. Con số p95 chỉ có nghĩa khi đặt cạnh nó. */
const FRAME_BUDGET_MS = 16.7;

/** Các khoá có giá trị là số — dùng cho nhóm thanh trượt vị trí. */
type NumericKey = {
  [K in keyof LightingSettings]: LightingSettings[K] extends number ? K : never;
}[keyof LightingSettings];

const LABEL: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  color: 'hsl(var(--foreground))',
};

const VALUE: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'hsl(var(--muted-foreground))',
  fontVariantNumeric: 'tabular-nums',
};

const SELECT: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  minHeight: '38px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  fontSize: '0.85rem',
};

function Slider({
  label,
  value,
  min,
  max,
  step = 0.05,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
        <label style={LABEL}>{label}</label>
        <span style={VALUE}>{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'hsl(var(--primary))', minHeight: 0 }}
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
      <label style={LABEL}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ ...VALUE, fontFamily: 'var(--font-mono), monospace' }}>{value.toUpperCase()}</span>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 34,
            height: 34,
            minHeight: 0,
            padding: 2,
            background: 'transparent',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Ba thanh trượt vị trí thay cho ba ô nhập số.
 *
 * Ô nhập số cho phép chuỗi rỗng, và `parseFloat('')` là `NaN`. Gán `NaN` vào
 * `light.position` làm ma trận của đèn hỏng và đèn tắt hẳn cho tới khi tải lại
 * trang — đúng vào lúc người dùng đang xoá số để gõ lại.
 */
function PositionGroup({
  settings,
  prefix,
  onChange,
}: {
  settings: LightingSettings;
  prefix: 'key' | 'fill' | 'rim';
  onChange: (key: NumericKey, v: number) => void;
}) {
  const kx = `${prefix}PosX` as NumericKey;
  const ky = `${prefix}PosY` as NumericKey;
  const kz = `${prefix}PosZ` as NumericKey;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <Slider label="Vị trí X (trái ↔ phải)" value={settings[kx]} min={-5} max={5} step={0.1} onChange={(v) => onChange(kx, v)} />
      <Slider label="Vị trí Y (thấp ↔ cao)" value={settings[ky]} min={-3} max={5} step={0.1} onChange={(v) => onChange(ky, v)} />
      <Slider label="Vị trí Z (sau ↔ trước)" value={settings[kz]} min={-5} max={5} step={0.1} onChange={(v) => onChange(kz, v)} />
    </div>
  );
}

export default function VrmStudioPage() {
  const [settings, setSettings] = useState<LightingSettings>(DEFAULT_LIGHTING);
  const [showModel, setShowModel] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('full');
  const [resetToken, setResetToken] = useState(0);
  const [stageResolution, setStageResolution] = useState(false);
  const [stats, setStats] = useState<StageStats | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState(resolveVrmModelUrl);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ── Bảng thử động tác ──────────────────────────────────────────────────
  const [motion, setMotion] = useState<AvatarMotionPayload>({
    clip: AvatarMotionKind.WAVE,
    expression: AvatarExpression.HAPPY,
    loop: true,
    durationMs: 2500,
    priority: 5,
    intensity: 0.7,
    blendMs: AVATAR_MOTION_LIMITS.DEFAULT_BLEND_MS,
  });
  const [request, setRequest] = useState<{ id: string; payload: AvatarMotionPayload } | null>(null);
  const requestSeq = useRef(0);

  const send = useCallback((payload: AvatarMotionPayload) => {
    requestSeq.current += 1;
    setRequest({ id: `studio-${requestSeq.current}`, payload });
  }, []);

  // Đọc sau khi gắn kết chứ không phải trong `useState`: server không có
  // `localStorage`, và dựng lần đầu khác nhau giữa server với trình duyệt là
  // lỗi hydration.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? sanitiseLighting(JSON.parse(raw)) : null;
      if (parsed) {
        setSettings(parsed);
        setNote('Đã khôi phục cấu hình lưu lần trước');
      }
    } catch {
      /* Cấu hình hỏng thì dùng mặc định, không có gì phải báo động. */
    }
  }, []);

  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(null), 3000);
    return () => window.clearTimeout(id);
  }, [note]);

  const set = useCallback(<K extends keyof LightingSettings>(key: K, value: LightingSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setNum = useCallback((key: NumericKey, value: number) => {
    if (!Number.isFinite(value)) return;
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setNote('Đã lưu vào trình duyệt này');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vrm-lighting.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const parsed = sanitiseLighting(JSON.parse(await file.text()));
      if (!parsed) {
        setNote('File không chứa thông số ánh sáng hợp lệ');
        return;
      }
      setSettings(parsed);
      setNote('Đã nạp cấu hình từ file');
    } catch {
      setNote('Không đọc được file JSON');
    }
  };

  /**
   * Bắn 20 quà trong khoảng một giây — đúng nhịp giờ cao điểm.
   *
   * Đây là phép thử quan trọng nhất trên trang: nếu hàng đợi không hợp nhất,
   * nhân vật sẽ diễn hết hai mươi lượt nối đuôi và vẫn còn đang vẫy tay hàng
   * chục giây sau khi luồng quà đã dứt.
   */
  const simulateSpam = () => {
    const tier = GIFT_TIERS[0];
    for (let i = 0; i < 20; i += 1) {
      window.setTimeout(() => send(tier.payload), i * 50);
    }
    setNote('Đã bắn 20 “Hoa hồng” trong 1 giây');
  };

  const onStats = useCallback((s: StageStats) => setStats(s), []);

  const budgetTone = useMemo<'good' | 'warn' | 'bad'>(() => {
    if (!stats) return 'good';
    if (stats.workP95 > FRAME_BUDGET_MS) return 'bad';
    if (stats.workP95 > FRAME_BUDGET_MS * 0.6) return 'warn';
    return 'good';
  }, [stats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <AdminPageHeader
        title="Studio Ánh Sáng & Động Tác VRM"
        description="Tinh chỉnh ba nguồn sáng, thử động tác nhân vật và giả lập luồng quà tặng. Kéo trong khung xem để xoay, lăn chuột để phóng to."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {note && <span style={VALUE}>{note}</span>}
            <button type="button" className="btn btn-secondary" onClick={() => setShowModel((v) => !v)}>
              {showModel ? 'Ẩn nhân vật' : 'Hiện nhân vật'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSettings(DEFAULT_LIGHTING);
                setNote('Đã trả về mặc định (chưa lưu)');
              }}
            >
              Đặt lại
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Lưu cấu hình
            </button>
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
          gap: '1.25rem',
          alignItems: 'stretch',
          height: 'min(calc(100vh - 15rem), 860px)',
          minHeight: '560px',
        }}
      >
        {/* ── Bảng điều khiển ────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            overflowY: 'auto',
            paddingRight: '0.5rem',
            minHeight: 0,
          }}
        >
          <VrmModelPanel modelUrl={modelUrl} onModelUrlChange={setModelUrl} onNote={setNote} />

          <Panel title="Giả lập quà tặng" subtitle="Bấm để xem nhân vật phản ứng đúng như trên sóng.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {GIFT_TIERS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => send(g.payload)}
                  title={`${MOTION_LABELS[g.payload.clip]} · ưu tiên ${g.payload.priority}`}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.6rem', height: 'auto', minHeight: '40px' }}
                >
                  {g.label} · {g.coins.toLocaleString('vi-VN')}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={simulateSpam}
              style={{ fontSize: '0.8rem', width: '100%' }}
            >
              Bắn 20 quà trong 1 giây (thử hợp nhất)
            </button>
            <p style={{ ...VALUE, margin: 0, lineHeight: 1.5 }}>
              Quà ưu tiên cao cắt ngang quà đang diễn. Quà giống nhau đến trong{' '}
              {AVATAR_MOTION_LIMITS.MERGE_WINDOW_MS}ms thì gộp thành một lượt mạnh hơn thay vì xếp hàng.
            </p>
          </Panel>

          <Panel title="Thử động tác thủ công" subtitle="Chỉnh từng thông số của một AVATAR_MOTION.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={LABEL}>Động tác</label>
              <select
                style={SELECT}
                value={motion.clip}
                onChange={(e) => setMotion((m) => ({ ...m, clip: e.target.value as AvatarMotionKind }))}
              >
                {Object.values(AvatarMotionKind).map((k) => (
                  <option key={k} value={k}>
                    {MOTION_LABELS[k]}
                  </option>
                ))}
              </select>

              <label style={LABEL}>Biểu cảm</label>
              <select
                style={SELECT}
                value={motion.expression ?? AvatarExpression.NEUTRAL}
                onChange={(e) =>
                  setMotion((m) => ({ ...m, expression: e.target.value as AvatarExpression }))
                }
              >
                {Object.values(AvatarExpression).map((k) => (
                  <option key={k} value={k}>
                    {EXPRESSION_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <Slider
              label="Cường độ (biên độ)"
              value={motion.intensity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => setMotion((m) => ({ ...m, intensity: v }))}
            />
            <Slider
              label="Thời lượng"
              value={motion.durationMs}
              min={AVATAR_MOTION_LIMITS.MIN_DURATION_MS}
              max={8000}
              step={100}
              format={(v) => `${(v / 1000).toFixed(1)}s`}
              onChange={(v) => setMotion((m) => ({ ...m, durationMs: v }))}
            />
            <Slider
              label="Hoà trộn vào/ra"
              value={motion.blendMs}
              min={AVATAR_MOTION_LIMITS.MIN_BLEND_MS}
              max={AVATAR_MOTION_LIMITS.MAX_BLEND_MS}
              step={10}
              format={(v) => `${Math.round(v)}ms`}
              onChange={(v) => setMotion((m) => ({ ...m, blendMs: v }))}
            />
            <Slider
              label="Độ ưu tiên"
              value={motion.priority}
              min={AVATAR_MOTION_LIMITS.MIN_PRIORITY}
              max={AVATAR_MOTION_LIMITS.MAX_PRIORITY}
              step={1}
              format={(v) => String(Math.round(v))}
              onChange={(v) => setMotion((m) => ({ ...m, priority: v }))}
            />

            <label
              style={{ ...LABEL, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={motion.loop}
                onChange={(e) => setMotion((m) => ({ ...m, loop: e.target.checked }))}
                style={{ accentColor: 'hsl(var(--primary))', minHeight: 0 }}
              />
              Lặp cho tới hết thời lượng
            </label>

            <button type="button" className="btn btn-primary" onClick={() => send(motion)} style={{ width: '100%' }}>
              Diễn thử
            </button>
          </Panel>

          <Panel title="Bộ đèn dựng sẵn" subtitle="Điểm xuất phát đúng, rồi tinh chỉnh từ đó.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {LIGHTING_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn-secondary"
                  title={p.hint}
                  onClick={() => {
                    setSettings(p.settings);
                    setNote(`Đã áp dụng “${p.label}”`);
                  }}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.6rem', height: 'auto', minHeight: '40px' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Ánh sáng nền (Ambient)" subtitle="Sáng đều mọi hướng. Cao quá thì nhân vật mất khối.">
            <Slider
              label="Cường độ"
              value={settings.ambientIntensity}
              min={0}
              max={5}
              onChange={(v) => set('ambientIntensity', v)}
            />
            <ColorRow label="Màu" value={settings.ambientColor} onChange={(v) => set('ambientColor', v)} />
          </Panel>

          <Panel title="Đèn chính (Key)" subtitle="Nguồn sáng quyết định hình khối và hướng bóng.">
            <Slider
              label="Cường độ"
              value={settings.keyIntensity}
              min={0}
              max={5}
              onChange={(v) => set('keyIntensity', v)}
            />
            <ColorRow label="Màu" value={settings.keyColor} onChange={(v) => set('keyColor', v)} />
            <PositionGroup settings={settings} prefix="key" onChange={setNum} />
          </Panel>

          <Panel title="Đèn phụ (Fill)" subtitle="Đặt đối diện đèn chính để làm mềm vùng tối.">
            <Slider
              label="Cường độ"
              value={settings.fillIntensity}
              min={0}
              max={5}
              onChange={(v) => set('fillIntensity', v)}
            />
            <ColorRow label="Màu" value={settings.fillColor} onChange={(v) => set('fillColor', v)} />
            <PositionGroup settings={settings} prefix="fill" onChange={setNum} />
          </Panel>

          <Panel title="Đèn viền (Rim / Back)" subtitle="Đặt phía sau (Z âm) để viền sáng tách nhân vật khỏi nền.">
            <Slider
              label="Cường độ"
              value={settings.rimIntensity}
              min={0}
              max={5}
              onChange={(v) => set('rimIntensity', v)}
            />
            <ColorRow label="Màu" value={settings.rimColor} onChange={(v) => set('rimColor', v)} />
            <PositionGroup settings={settings} prefix="rim" onChange={setNum} />
          </Panel>

          <Panel title="Môi trường & chia sẻ">
            <ColorRow label="Màu nền sân khấu" value={settings.bgColor} onChange={(v) => set('bgColor', v)} />
            <p style={{ ...VALUE, margin: 0, lineHeight: 1.5 }}>
              Overlay phát sóng dùng nền trong suốt cho OBS — màu này chỉ áp dụng cho khung xem ở đây.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleExport}
                style={{ flex: 1, fontSize: '0.82rem' }}
              >
                Xuất JSON
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
                style={{ flex: 1, fontSize: '0.82rem' }}
              >
                Nhập JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImport(f);
                  e.target.value = '';
                }}
              />
            </div>
          </Panel>
        </div>

        {/* ── Khung xem trực tiếp ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: 0 }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', flex: 'none' }}>
            <div className="admin-segmented" role="group" aria-label="Khung hình camera">
              {CAMERA_PRESETS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cameraPreset === c.id ? 'is-active' : undefined}
                  onClick={() => {
                    setCameraPreset(c.id);
                    setResetToken((t) => t + 1);
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setResetToken((t) => t + 1)}
              style={{ fontSize: '0.8rem', minHeight: '36px', padding: '0.35rem 0.8rem' }}
            >
              Đưa camera về khung
            </button>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                color: 'hsl(var(--muted-foreground))',
                cursor: 'pointer',
              }}
              title="Dựng ở đúng 1080×1920 như sân khấu phát sóng. Chỉ khi bật thì p95 mới phản ánh tải thật."
            >
              <input
                type="checkbox"
                checked={stageResolution}
                onChange={(e) => setStageResolution(e.target.checked)}
                style={{ accentColor: 'hsl(var(--primary))', minHeight: 0 }}
              />
              Độ phân giải sân khấu (1080×1920)
            </label>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {stats ? (
                <>
                  <StatusPill tone={budgetTone}>
                    p95 {stats.workP95.toFixed(1)}ms / {FRAME_BUDGET_MS}ms
                  </StatusPill>
                  <span style={{ ...VALUE, fontFamily: 'var(--font-mono), monospace' }}>
                    p50 {stats.workP50.toFixed(1)}ms · {stats.fps}fps · {stats.calls} lệnh vẽ ·{' '}
                    {stats.triangles.toLocaleString('vi-VN')} tam giác · hàng đợi {stats.pending}
                  </span>
                </>
              ) : (
                <span style={VALUE}>Đang đo…</span>
              )}
            </div>
          </div>

          {/* Không dùng `.glass-panel`: hiệu ứng hover của nó nhấc panel lên 2px,
              tức là khung xem nhảy chỗ mỗi khi con trỏ đi vào để kéo xoay. */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <VrmLightingStudio
              modelUrl={modelUrl}
              settings={settings}
              showModel={showModel}
              cameraPreset={cameraPreset}
              resetToken={resetToken}
              stageResolution={stageResolution}
              motionRequest={request}
              onStats={onStats}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
