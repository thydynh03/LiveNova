'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';

/**
 * Khung render cố định cho overlay.
 *
 * Vấn đề nó giải quyết: overlay từng render đúng bằng kích thước khung Browser
 * Source (`100vw × 100vh`). Khung mặc định của TikTok Live Studio là ngang,
 * không khớp sàn nhảy dọc, nên streamer phải kéo giãn cho vừa — và TikTok Studio
 * phóng to *ảnh bitmap đã render*, chứ không bảo trang vẽ lại ở độ phân giải cao
 * hơn. Kết quả là hình mờ và rỗ.
 *
 * Cách sửa: luôn render ở một khung cố định (mặc định 1080×1920), rồi chỉ dùng
 * `transform: scale()` để vừa vào viewport. Streamer đặt Browser Source đúng
 * 1080×1920 và không phải kéo gì cả; nếu có kéo, thứ bị kéo là một khung đã
 * render ở đúng độ phân giải gốc.
 */

/** Khung mặc định — dọc 9:16, đúng tỉ lệ khung hình TikTok. */
export const DEFAULT_FRAME_WIDTH = 1080;
export const DEFAULT_FRAME_HEIGHT = 1920;

/** Độ mờ mặc định của lớp phủ trên màn LED. */
export const DEFAULT_LED_DIM = 0.28;

export interface FrameSpec {
  width: number;
  height: number;
  /**
   * Hệ số nhân độ phân giải render.
   *
   * Tách khỏi `devicePixelRatio` có chủ đích: trong OBS và TikTok Live Studio
   * giá trị đó luôn bằng 1, nên bám vào nó có nghĩa là không bao giờ render
   * được sắc nét hơn kích thước CSS.
   */
  quality: number;
}

const RATIO_PRESETS: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
};

/** Giới hạn trên để một tham số URL gõ nhầm không cấp phát canvas khổng lồ. */
const MAX_DIMENSION = 3840;
const MAX_QUALITY = 3;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readPositiveInt(raw: string | null, fallback: number, max: number): number {
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return clampNumber(parsed, 1, max);
}

/**
 * Đọc kích thước khung từ query string.
 *
 * `?ratio=9:16|16:9|1:1` chọn preset; `?w=` và `?h=` ghi đè từng chiều;
 * `?quality=` nhân độ phân giải render lên cho máy khoẻ.
 */
export function readFrameFromParams(
  params: ReadonlyURLSearchParams | URLSearchParams | null,
): FrameSpec {
  const get = (key: string) => (params ? params.get(key) : null);

  const preset = RATIO_PRESETS[get('ratio') ?? ''] ?? {
    width: DEFAULT_FRAME_WIDTH,
    height: DEFAULT_FRAME_HEIGHT,
  };

  const quality = Number.parseFloat(get('quality') ?? '');

  return {
    width: readPositiveInt(get('w'), preset.width, MAX_DIMENSION),
    height: readPositiveInt(get('h'), preset.height, MAX_DIMENSION),
    quality: Number.isFinite(quality) ? clampNumber(quality, 0.5, MAX_QUALITY) : 1,
  };
}

/** Đọc độ mờ màn LED từ query string, kẹp trong [0, 1]. */
export function readLedDimFromParams(
  params: ReadonlyURLSearchParams | URLSearchParams | null,
): number {
  const raw = params ? params.get('leddim') : null;
  if (raw === null) return DEFAULT_LED_DIM;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? clampNumber(parsed, 0, 1) : DEFAULT_LED_DIM;
}

export interface FixedFrameProps {
  frame: FrameSpec;
  children: React.ReactNode;
}

export function FixedFrame({ frame, children }: FixedFrameProps) {
  const [scale, setScale] = useState(1);
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    const fit = () => {
      const availableWidth = outer.clientWidth || frame.width;
      const availableHeight = outer.clientHeight || frame.height;
      // `min` chứ không phải `max`: khung phải lọt hẳn vào trong, thừa viền còn
      // hơn bị cắt mất chân sàn nhảy.
      setScale(Math.min(availableWidth / frame.width, availableHeight / frame.height));
    };

    fit();

    // ResizeObserver chứ không phải sự kiện `resize` của window: trong OBS,
    // đổi kích thước Browser Source không phải lúc nào cũng bắn `resize`.
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [frame.width, frame.height]);

  return (
    <div
      ref={outerRef}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      {/*
        Định vị tuyệt đối rồi tự dịch vào giữa, thay vì nhờ grid căn giúp.

        Khung con luôn lớn hơn khung cha (1080×1920 so với vài trăm pixel), và
        cách một item tràn ra ngoài được căn trong grid thì mỗi trình duyệt một
        kiểu — bản đầu tiên bị đẩy hẳn xuống góc dưới bên phải. `left/top: 50%`
        cộng `translate(-50%, -50%)` cho kết quả như nhau ở mọi nơi, kể cả khi
        khung con tràn.
      */}
      <div
        data-testid="fixed-frame-inner"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: frame.width,
          height: frame.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
