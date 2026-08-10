/**
 * Thông số ánh sáng sân khấu.
 *
 * Sống ở `lib/` chứ không nằm trong component studio vì overlay phát sóng cũng
 * đọc chính kiểu này. Studio mà định nghĩa riêng bộ thông số của nó thì thứ
 * người ta tinh chỉnh và thứ khán giả nhìn thấy là hai cảnh khác nhau.
 */
export interface LightingSettings {
  ambientColor: string;
  ambientIntensity: number;
  keyColor: string;
  keyIntensity: number;
  keyPosX: number;
  keyPosY: number;
  keyPosZ: number;
  fillColor: string;
  fillIntensity: number;
  fillPosX: number;
  fillPosY: number;
  fillPosZ: number;
  rimColor: string;
  rimIntensity: number;
  rimPosX: number;
  rimPosY: number;
  rimPosZ: number;
  bgColor: string;
}

export const DEFAULT_LIGHTING: LightingSettings = {
  ambientColor: '#ffffff',
  ambientIntensity: 1.6,
  keyColor: '#ffffff',
  keyIntensity: 1.4,
  keyPosX: 1,
  keyPosY: 2,
  keyPosZ: 2,
  fillColor: '#8899ff',
  fillIntensity: 0.5,
  fillPosX: -2,
  fillPosY: 1,
  fillPosZ: 1.5,
  rimColor: '#ffd9a0',
  rimIntensity: 0.8,
  rimPosX: -1,
  rimPosY: 2.4,
  rimPosZ: -2.5,
  bgColor: '#0f172a',
};

export interface LightingPreset {
  id: string;
  label: string;
  hint: string;
  settings: LightingSettings;
}

/**
 * Các bộ đèn dựng sẵn.
 *
 * Không phải để tiết kiệm thao tác mà để có điểm xuất phát đúng: người chưa
 * quen sẽ kéo ambient lên hết rồi tự hỏi sao nhân vật trông bẹt. Ba đèn đặt
 * đúng chỗ giải quyết việc đó trước khi họ chạm vào thanh trượt đầu tiên.
 */
export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: 'neutral',
    label: 'Studio trung tính',
    hint: 'Nền để so sánh, không nhuộm màu da',
    settings: DEFAULT_LIGHTING,
  },
  {
    id: 'warm',
    label: 'Ấm buổi tối',
    hint: 'Key ngả vàng, viền hồng nhạt',
    settings: {
      ...DEFAULT_LIGHTING,
      ambientColor: '#ffeeda',
      ambientIntensity: 1.1,
      keyColor: '#ffd2a1',
      keyIntensity: 1.8,
      fillColor: '#ff9e7a',
      fillIntensity: 0.4,
      rimColor: '#ff7ab8',
      rimIntensity: 1.1,
      bgColor: '#2a1420',
    },
  },
  {
    id: 'neon',
    label: 'Neon lạnh',
    hint: 'Key xanh lơ, viền tím — hợp nền tối',
    settings: {
      ...DEFAULT_LIGHTING,
      ambientColor: '#c7d9ff',
      ambientIntensity: 0.8,
      keyColor: '#7fe6ff',
      keyIntensity: 2.1,
      fillColor: '#4455ff',
      fillIntensity: 0.7,
      rimColor: '#c86bff',
      rimIntensity: 1.6,
      bgColor: '#080c1a',
    },
  },
  {
    id: 'backlit',
    label: 'Ngược sáng kịch tính',
    hint: 'Key yếu, viền mạnh — tách nhân vật khỏi nền',
    settings: {
      ...DEFAULT_LIGHTING,
      ambientColor: '#8fa3c0',
      ambientIntensity: 0.45,
      keyColor: '#ffffff',
      keyIntensity: 0.7,
      keyPosX: 1.6,
      fillColor: '#3d5a80',
      fillIntensity: 0.35,
      rimColor: '#fff4d6',
      rimIntensity: 2.6,
      rimPosZ: -3,
      bgColor: '#05070c',
    },
  },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Chỉ nhận các khoá đã biết, đúng kiểu.
 *
 * Dùng cho cả file JSON người dùng nhập vào lẫn cấu hình đọc từ `localStorage`
 * — cấu hình cũ sau một lần đổi schema cũng là dữ liệu ngoài, và một
 * `keyIntensity` là chuỗi rỗng đủ để tắt hẳn đèn chính.
 */
export function sanitiseLighting(raw: unknown): LightingSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out = { ...DEFAULT_LIGHTING };
  let matched = 0;

  (Object.keys(DEFAULT_LIGHTING) as (keyof LightingSettings)[]).forEach((k) => {
    const v = src[k];
    if (typeof DEFAULT_LIGHTING[k] === 'number') {
      if (typeof v === 'number' && Number.isFinite(v)) {
        (out[k] as number) = v;
        matched += 1;
      }
    } else if (typeof v === 'string' && HEX.test(v)) {
      (out[k] as string) = v;
      matched += 1;
    }
  });

  return matched > 0 ? out : null;
}
