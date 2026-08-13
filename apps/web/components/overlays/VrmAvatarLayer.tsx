'use client';

import React, { useEffect, useRef } from 'react';
import type { AvatarDancePayload, AvatarMotionPayload } from '@livenova/shared';
import { DEFAULT_LIGHTING, type LightingSettings } from '../../lib/vrm/lighting';
import { resolveVrmModelUrl } from '../../lib/vrm/model';
import { VrmStage } from '../../lib/vrm/vrm-stage';

/**
 * Nhân vật VRM trên overlay phát sóng.
 *
 * Dùng chung `VrmStage` với studio ánh sáng trong khu quản trị — đó là điều
 * kiện để bộ thông số tinh chỉnh ở đó tái hiện được ở đây. Khác biệt duy nhất
 * là nền: overlay chạy trong suốt để OBS chồng được lên cảnh phía dưới.
 */

interface Props {
  /** Động tác mới nhất. Đổi định danh là một lần diễn. */
  motion: { id: string; payload: AvatarMotionPayload } | null;
  /** Đoạn nhảy mới nhất. Đổi định danh là một lần nhảy. */
  dance: { id: string; payload: AvatarDancePayload } | null;
  lighting?: LightingSettings;
  modelUrl?: string;
  danceUrl?: string;
}

export function VrmAvatarLayer({ motion, dance, lighting = DEFAULT_LIGHTING, modelUrl, danceUrl }: Props) {
  const url = modelUrl ?? resolveVrmModelUrl();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<VrmStage | null>(null);
  const lightingRef = useRef(lighting);
  lightingRef.current = lighting;

  /**
   * Động tác đến trước khi mô hình gắn xong không được rơi mất.
   *
   * Một browser source vừa mở ra giữa buổi phát có thể nhận lại các hành động
   * được phát lại ngay trong mili-giây đầu tiên, trước khi effect này chạy.
   */
  const pendingMotionRef = useRef<{ id: string; payload: AvatarMotionPayload } | null>(null);
  const pendingDanceRef = useRef<{ id: string; payload: AvatarDancePayload } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const stage = new VrmStage(host, {
      modelUrl: url,
      transparent: true,
      lighting: lightingRef.current,
    });
    stageRef.current = stage;
    
    // Load initial background dance
    if (danceUrl) {
      stage.loadDance(danceUrl);
      stage.setDancePlaying(true);
    }

    if (pendingMotionRef.current) {
      stage.play(pendingMotionRef.current.id, pendingMotionRef.current.payload);
      pendingMotionRef.current = null;
    }
    if (pendingDanceRef.current) {
      const p = pendingDanceRef.current.payload;
      stage.playDanceClip({
        clipUrl: p.clipUrl,
        audioUrl: p.audioUrl,
        durationMs: p.durationMs,
        blendMs: p.blendMs,
        volume: p.volume,
      });
      pendingDanceRef.current = null;
    }

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    stageRef.current?.setLighting(lighting);
  }, [lighting]);

  useEffect(() => {
    if (stageRef.current) {
      stageRef.current.loadDance(danceUrl ?? null);
      stageRef.current.setDancePlaying(!!danceUrl);
    }
  }, [danceUrl]);

  useEffect(() => {
    if (!motion) return;
    const stage = stageRef.current;
    if (stage) stage.play(motion.id, motion.payload);
    else pendingMotionRef.current = motion;
  }, [motion]);

  useEffect(() => {
    if (!dance) return;
    const stage = stageRef.current;
    if (stage) {
      const p = dance.payload;
      stage.playDanceClip({
        clipUrl: p.clipUrl,
        audioUrl: p.audioUrl,
        durationMs: p.durationMs,
        blendMs: p.blendMs,
        volume: p.volume,
      });
    } else {
      pendingDanceRef.current = dance;
    }
  }, [dance]);

  return (
    <div
      ref={hostRef}
      data-testid="vrm-avatar-layer"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
}
