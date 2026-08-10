'use client';

import React, { useEffect, useRef } from 'react';
import type { AvatarMotionPayload } from '@livenova/shared';
import { DEFAULT_LIGHTING, type LightingSettings } from '../../lib/vrm/lighting';
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
  lighting?: LightingSettings;
  modelUrl?: string;
}

export function VrmAvatarLayer({ motion, lighting = DEFAULT_LIGHTING, modelUrl = '/lab/model.vrm' }: Props) {
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
  const pendingRef = useRef<{ id: string; payload: AvatarMotionPayload } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const stage = new VrmStage(host, {
      modelUrl,
      transparent: true,
      lighting: lightingRef.current,
    });
    stageRef.current = stage;

    if (pendingRef.current) {
      stage.play(pendingRef.current.id, pendingRef.current.payload);
      pendingRef.current = null;
    }

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [modelUrl]);

  useEffect(() => {
    stageRef.current?.setLighting(lighting);
  }, [lighting]);

  useEffect(() => {
    if (!motion) return;
    const stage = stageRef.current;
    if (stage) stage.play(motion.id, motion.payload);
    else pendingRef.current = motion;
  }, [motion]);

  return (
    <div
      ref={hostRef}
      data-testid="vrm-avatar-layer"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
}
