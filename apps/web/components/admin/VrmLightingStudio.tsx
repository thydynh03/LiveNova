'use client';

import React, { useEffect, useRef, useState } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AvatarMotionPayload } from '@livenova/shared';
import type { LightingSettings } from '../../lib/vrm/lighting';
import { LOCAL_DEV_MODEL_URL, resolveVrmModelUrl } from '../../lib/vrm/model';
import { VrmStage, type CameraPreset, type StageStats } from '../../lib/vrm/vrm-stage';

export type { CameraPreset, StageStats };
export type { LightingSettings };

/**
 * Khung xem của studio ánh sáng.
 *
 * Toàn bộ phần dựng hình nằm ở `lib/vrm/vrm-stage.ts` và dùng chung với overlay
 * phát sóng. Component này chỉ thêm những thứ *chỉ* studio mới cần: điều khiển
 * camera bằng chuột, và chuyển các prop của React thành lệnh gọi lên sân khấu.
 */

interface Props {
  /** Đổi giá trị này sẽ dựng lại cảnh với mô hình mới. */
  modelUrl?: string;
  settings: LightingSettings;
  showModel: boolean;
  cameraPreset: CameraPreset;
  /** Tăng số này để ép camera về đúng khung của preset hiện tại. */
  resetToken: number;
  stageResolution: boolean;
  /** Động tác cần diễn thử. Mỗi lần đổi định danh là một lần diễn. */
  motionRequest: { id: string; payload: AvatarMotionPayload } | null;
  onStats?: (stats: StageStats) => void;
  /** Hoạt ảnh nhảy (VRMA) */
  danceUrl?: string | null;
  danceTime?: number;
  isDancePlaying?: boolean;
}

export function VrmLightingStudio({
  modelUrl,
  settings,
  showModel,
  cameraPreset,
  resetToken,
  stageResolution,
  motionRequest,
  onStats,
  danceUrl,
  danceTime,
  isDancePlaying,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<VrmStage | null>(null);
  const [status, setStatus] = useState('Đang tải mô hình…');

  // `onStats` và `settings` đổi định danh mỗi lần cha render. Đưa chúng vào
  // deps của effect dựng cảnh sẽ huỷ ngữ cảnh WebGL và tải lại mô hình sau mỗi
  // lần kéo thanh trượt, nên chúng đi qua ref.
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const url = modelUrl ?? resolveVrmModelUrl();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    setStatus('Đang tải mô hình…');

    const stage = new VrmStage(host, {
      modelUrl: url,
      lighting: settingsRef.current,
      // Thông báo mặc định chỉ nói "404". Khi vẫn đang trỏ vào mô hình đo tại
      // chỗ — thứ không tồn tại trên bản phát hành vì giấy phép cấm dùng thương
      // mại — nguyên nhân gần như luôn là chưa có mô hình, nên nói cách sửa.
      onStatus: (text, ok) =>
        setStatus(
          ok
            ? text
            : url === LOCAL_DEV_MODEL_URL
            ? 'Chưa có mô hình VRM. Tải lên tệp .vrm ở bảng “Mô hình nhân vật” bên trên.'
            : text,
        ),
      onStats: (s) => onStatsRef.current?.(s),
    });
    stageRef.current = stage;

    const controls = new OrbitControls(stage.camera, stage.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.25;
    controls.maxDistance = 8;
    // Chặn camera chui xuống dưới sàn và lật qua đỉnh đầu — hai góc không nói
    // lên điều gì về ánh sáng sân khấu và rất dễ kéo nhầm vào.
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = Math.PI / 2 + 0.25;
    controls.target.set(0, 1.1, 0);

    // Sân khấu tự đóng khung sau khi tải xong mô hình; nếu không đồng bộ tâm
    // ngắm thì cú kéo chuột đầu tiên sẽ giật camera về tâm cũ.
    stage.onFramed = (target) => {
      controls.target.copy(target);
      controls.update();
    };
    stage.onBeforeRender = () => controls.update();

    return () => {
      stage.onBeforeRender = null;
      stage.onFramed = null;
      controls.dispose();
      stage.dispose();
      stageRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    stageRef.current?.setLighting(settings);
  }, [settings]);

  useEffect(() => {
    stageRef.current?.setModelVisible(showModel);
  }, [showModel]);

  useEffect(() => {
    stageRef.current?.setCameraPreset(cameraPreset);
  }, [cameraPreset, resetToken]);

  useEffect(() => {
    stageRef.current?.setStageResolution(stageResolution);
  }, [stageResolution]);

  useEffect(() => {
    if (motionRequest) stageRef.current?.play(motionRequest.id, motionRequest.payload);
  }, [motionRequest]);

  useEffect(() => {
    stageRef.current?.loadDance(danceUrl ?? null);
  }, [danceUrl]);

  useEffect(() => {
    stageRef.current?.setDancePlaying(isDancePlaying ?? false);
  }, [isDancePlaying]);

  useEffect(() => {
    if (danceTime !== undefined) {
      stageRef.current?.syncDanceTime(danceTime);
    }
  }, [danceTime]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          padding: '0.7rem 1.1rem',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flex: 'none',
        }}
      >
        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>{status}</span>
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'hsl(var(--primary))',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="live-dot" />
          Xem trực tiếp
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          ref={hostRef}
          title="Kéo để xoay · lăn chuột để phóng to"
          style={{
            height: '100%',
            aspectRatio: '9 / 16',
            maxWidth: '100%',
            cursor: 'grab',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-lg)',
            background: settings.bgColor,
            overflow: 'hidden',
            border: '1px solid hsl(var(--border))',
          }}
        />
      </div>
    </div>
  );
}
