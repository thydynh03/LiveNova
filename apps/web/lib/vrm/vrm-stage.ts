import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { createVRMAnimationClip, VRMAnimationLoaderPlugin, VRMAnimation } from '@pixiv/three-vrm-animation';
import { AvatarExpression, type AvatarMotionPayload } from '@livenova/shared';
import { DEFAULT_LIGHTING, type LightingSettings } from './lighting';
import {
  blendPose,
  clipCycleMs,
  idlePose,
  samplePose,
  type BoneKey,
  type Pose,
} from './motion-clips';
import { MotionQueue } from './motion-queue';

/**
 * Sân khấu VRM — một cảnh Three.js không phụ thuộc React.
 *
 * Tồn tại vì hai bề mặt phải dùng *chung một* bộ dựng hình: studio ánh sáng
 * trong khu quản trị, và overlay phát sóng trong OBS. Nếu mỗi bên tự dựng cảnh
 * riêng thì bộ thông số tinh chỉnh trong studio không tái hiện được trên sóng,
 * và cả công cụ mất luôn lý do tồn tại. Đóng gói thành class thay vì hook vì
 * vòng đời của nó là vòng đời của ngữ cảnh WebGL, không phải của cây React.
 */

/** Độ phân giải sân khấu phát sóng. */
export const STAGE_W = 1080;
export const STAGE_H = 1920;

export type CameraPreset = 'full' | 'half' | 'face';

/** Hệ số khoảng cách và độ cao ngắm, tính theo chiều cao thật của mô hình. */
const CAMERA_PRESETS: Record<CameraPreset, { dist: number; aimY: number }> = {
  full: { dist: 1.12, aimY: 0.5 },
  half: { dist: 0.62, aimY: 0.72 },
  face: { dist: 0.26, aimY: 0.93 },
};

export interface StageStats {
  workP50: number;
  workP95: number;
  fps: number;
  triangles: number;
  calls: number;
  /** Số động tác đang chờ tới lượt. */
  pending: number;
}

export interface VrmStageOptions {
  modelUrl: string;
  /**
   * Nền trong suốt cho OBS chromakey. Khi bật, `bgColor` bị bỏ qua — overlay
   * phải để lộ cảnh phía dưới, không phải phủ một màu lên nó.
   */
  transparent?: boolean;
  lighting?: LightingSettings;
  onStatus?: (status: string, ok: boolean) => void;
  onStats?: (stats: StageStats) => void;
}

function percentile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/** Biểu cảm bị đặt lại mỗi khung, nên phải biết hết danh sách để xoá cái cũ. */
const ALL_EXPRESSIONS = Object.values(AvatarExpression);

export class VrmStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private readonly host: HTMLElement;
  private readonly opts: VrmStageOptions;
  private readonly ambient: THREE.AmbientLight;
  private readonly key: THREE.DirectionalLight;
  private readonly fill: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;
  private readonly motions = new MotionQueue();
  private readonly resizeObserver: ResizeObserver;

  private vrm: VRM | null = null;
  private raf = 0;
  private disposed = false;
  private stageResolution = false;
  private cameraPreset: CameraPreset = 'full';
  private lighting: LightingSettings;

  private animationMixer: THREE.AnimationMixer | null = null;
  private currentAnimationUrl: string | null = null;
  private isDancePlaying = false;

  // ── Dance clip — đoạn nhảy ngắn kích hoạt bằng quà ─────────────────────
  private danceAnimCache = new Map<string, VRMAnimation | THREE.AnimationClip>();
  private activeDance: {
    mixer: THREE.AnimationMixer;
    action: THREE.AnimationAction;
    audio: HTMLAudioElement | null;
    blendMs: number;
    durationMs: number;
    startedAt: number;
    fadingOut: boolean;
    onEnd: (() => void) | null;
  } | null = null;

  private modelHeight = 1.6;
  private modelCentre = new THREE.Vector3(0, 0.8, 0);
  private modelBaseY = 0;

  private readonly clock = new THREE.Clock();
  private readonly work: number[] = [];
  private readonly frames: number[] = [];
  private lastFrameAt = performance.now();
  private lastReportAt = performance.now();

  /** Camera của người dùng (OrbitControls) cần được nhắc cập nhật mỗi khung. */
  onBeforeRender: (() => void) | null = null;

  constructor(host: HTMLElement, opts: VrmStageOptions) {
    this.host = host;
    this.opts = opts;
    this.lighting = opts.lighting ?? DEFAULT_LIGHTING;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Đặt tường minh thay vì dựa vào mặc định của three: màu tinh chỉnh trong
    // studio chỉ dùng được nếu overlay diễn giải màu y hệt, và một bản nâng cấp
    // three đổi mặc định là đủ để cả bộ thông số lệch mà không ai nhận ra.
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    if (!opts.transparent) this.scene.background = new THREE.Color(this.lighting.bgColor);

    this.camera = new THREE.PerspectiveCamera(28, STAGE_W / STAGE_H, 0.1, 20);
    this.camera.position.set(0, 1.25, 2.6);

    this.ambient = new THREE.AmbientLight();
    this.key = new THREE.DirectionalLight();
    this.fill = new THREE.DirectionalLight();
    this.rim = new THREE.DirectionalLight();
    this.scene.add(this.ambient, this.key, this.fill, this.rim);
    this.setLighting(this.lighting);

    this.applySize();
    this.resizeObserver = new ResizeObserver(() => this.applySize());
    this.resizeObserver.observe(host);

    this.load();
    this.tick();
  }

  // ── Ánh sáng ────────────────────────────────────────────────────────────
  setLighting(s: LightingSettings): void {
    this.lighting = s;
    if (!this.opts.transparent) {
      this.scene.background = new THREE.Color(s.bgColor);
    }
    this.ambient.color.set(s.ambientColor);
    this.ambient.intensity = s.ambientIntensity;
    this.key.color.set(s.keyColor);
    this.key.intensity = s.keyIntensity;
    this.key.position.set(s.keyPosX, s.keyPosY, s.keyPosZ);
    this.fill.color.set(s.fillColor);
    this.fill.intensity = s.fillIntensity;
    this.fill.position.set(s.fillPosX, s.fillPosY, s.fillPosZ);
    this.rim.color.set(s.rimColor);
    this.rim.intensity = s.rimIntensity;
    this.rim.position.set(s.rimPosX, s.rimPosY, s.rimPosZ);
  }

  // ── Động tác ────────────────────────────────────────────────────────────
  play(id: string, payload: AvatarMotionPayload): void {
    this.motions.push(id, payload, performance.now());
  }

  clearMotions(): void {
    this.motions.clear();
  }

  // ── Điệu nhảy ──────────────────────────────────────────────────────────
  async loadDance(vrmaUrl: string | null): Promise<void> {
    if (this.currentAnimationUrl === vrmaUrl) return;
    this.currentAnimationUrl = vrmaUrl;
    
    if (!vrmaUrl) {
      if (this.animationMixer) this.animationMixer.stopAllAction();
      this.animationMixer = null;
      return;
    }

    if (!this.vrm) return;

    if (vrmaUrl.toLowerCase().includes('.vmd')) {
      try {
        const { loadVmdAsVrmAnimationClip } = await import('./vmd-retarget');
        const clip = await loadVmdAsVrmAnimationClip(vrmaUrl, this.vrm);
        if (this.disposed || this.currentAnimationUrl !== vrmaUrl) return;
        
        this.animationMixer = new THREE.AnimationMixer(this.vrm.scene);
        const action = this.animationMixer.clipAction(clip);
        action.play();
      } catch (err) {
        console.error('Không tải được tệp VMD:', err);
      }
      return;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    loader.load(
      vrmaUrl,
      (gltf) => {
        if (this.disposed || this.currentAnimationUrl !== vrmaUrl) return;
        const vrmAnimation = gltf.userData.vrmAnimations?.[0];
        if (vrmAnimation && this.vrm) {
          const clip = createVRMAnimationClip(vrmAnimation, this.vrm);
          this.animationMixer = new THREE.AnimationMixer(this.vrm.scene);
          const action = this.animationMixer.clipAction(clip);
          action.play();
        }
      },
      undefined,
      (err) => console.error('Không tải được tệp VRMA:', err)
    );
  }

  syncDanceTime(timeInSeconds: number): void {
    if (this.animationMixer) {
      this.animationMixer.setTime(timeInSeconds);
    }
  }

  setDancePlaying(isPlaying: boolean): void {
    this.isDancePlaying = isPlaying;
  }

  // ── Dance clip — đoạn nhảy ngắn kích hoạt bằng quà ─────────────────────

  /**
   * Tải trước một clip nhảy (.vrma) vào bộ nhớ.
   *
   * Gọi khi overlay khởi động để quà đến là phát ngay — không phải đợi tải
   * qua mạng, vốn thêm 200–800ms đủ để người xem thấy nhân vật đứng yên.
   */
  async preloadDanceClip(vrmaUrl: string): Promise<void> {
    if (this.danceAnimCache.has(vrmaUrl)) return;
    if (!this.vrm) return;

    if (vrmaUrl.toLowerCase().includes('.vmd')) {
      try {
        const { loadVmdAsVrmAnimationClip } = await import('./vmd-retarget');
        const clip = await loadVmdAsVrmAnimationClip(vrmaUrl, this.vrm);
        this.danceAnimCache.set(vrmaUrl, clip);
      } catch (err) {
        console.error('Không tải trước được VMD:', err);
      }
      return;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    loader.load(
      vrmaUrl,
      (gltf) => {
        const anim = gltf.userData.vrmAnimations?.[0] as VRMAnimation | undefined;
        if (anim) this.danceAnimCache.set(vrmaUrl, anim);
      },
      undefined,
      (err) => console.error('Không tải trước được clip nhảy:', err),
    );
  }

  /**
   * Phát một đoạn nhảy ngắn kèm nhạc. Gọi khi có quà.
   *
   * Tự dừng sau `durationMs`, hoà trộn đầu cuối qua `blendMs`. Nếu đang có
   * đoạn nhảy khác, dừng nó trước — nhân vật không nhảy hai bài cùng lúc.
   *
   * `applyPose()` bị tắt trong suốt đoạn nhảy: mixer độc quyền điều khiển
   * xương, tránh hai nguồn ghi xung đột làm nhân vật giật.
   */
  playDanceClip(opts: {
    clipUrl: string;
    audioUrl?: string;
    durationMs: number;
    blendMs: number;
    volume: number;
    onEnd?: () => void;
  }): void {
    this.stopDanceClip();
    if (!this.vrm) return;

    const startClip = (anim: VRMAnimation | THREE.AnimationClip) => {
      if (this.disposed || !this.vrm) return;

      const clip = anim instanceof THREE.AnimationClip ? anim : createVRMAnimationClip(anim, this.vrm);
      const mixer = new THREE.AnimationMixer(this.vrm.scene);
      const action = mixer.clipAction(clip);

      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.fadeIn(opts.blendMs / 1000);
      action.play();

      let audio: HTMLAudioElement | null = null;
      if (opts.audioUrl) {
        audio = new Audio(opts.audioUrl);
        audio.volume = Math.min(Math.max(opts.volume, 0), 1);
        // Trình duyệt chặn autoplay có tiếng cho tới khi có tương tác.
        // OBS browser source thường đã có quyền, nhưng không đảm bảo.
        audio.play().catch(() => { /* autoplay blocked — chấp nhận im lặng */ });
      }

      this.activeDance = {
        mixer,
        action,
        audio,
        blendMs: opts.blendMs,
        durationMs: opts.durationMs,
        startedAt: performance.now(),
        fadingOut: false,
        onEnd: opts.onEnd ?? null,
      };
    };

    const cached = this.danceAnimCache.get(opts.clipUrl);
    if (cached) {
      startClip(cached);
      return;
    }

    if (opts.clipUrl.toLowerCase().includes('.vmd')) {
      import('./vmd-retarget').then(({ loadVmdAsVrmAnimationClip }) => {
        if (!this.vrm) return;
        loadVmdAsVrmAnimationClip(opts.clipUrl, this.vrm).then((clip) => {
          this.danceAnimCache.set(opts.clipUrl, clip);
          startClip(clip);
        }).catch(err => console.error('Không tải được VMD:', err));
      });
      return;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    loader.load(
      opts.clipUrl,
      (gltf) => {
        const anim = gltf.userData.vrmAnimations?.[0] as VRMAnimation | undefined;
        if (!anim) return;
        this.danceAnimCache.set(opts.clipUrl, anim);
        startClip(anim);
      },
      undefined,
      (err) => console.error('Không tải được clip nhảy:', err),
    );
  }

  /**
   * Dừng đoạn nhảy đang chạy và trả điều khiển xương cho `applyPose()`.
   */
  stopDanceClip(): void {
    const d = this.activeDance;
    if (!d) return;

    d.action.stop();
    d.mixer.stopAllAction();
    if (this.vrm) d.mixer.uncacheRoot(this.vrm.scene);

    if (d.audio) {
      d.audio.pause();
      d.audio.src = '';
    }

    const onEnd = d.onEnd;
    this.activeDance = null;
    onEnd?.();
  }

  get isDanceClipActive(): boolean {
    return this.activeDance !== null;
  }

  // ── Khung hình ──────────────────────────────────────────────────────────
  setModelVisible(visible: boolean): void {
    if (this.vrm) this.vrm.scene.visible = visible;
  }

  setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    this.frameCamera();
  }

  frameCamera(): void {
    const { dist, aimY } = CAMERA_PRESETS[this.cameraPreset];
    const fovRad = (this.camera.fov * Math.PI) / 180;
    let d = (this.modelHeight / 2 / Math.tan(fovRad / 2)) * dist;
    
    // Khi xoay dọc (portrait), FOV ngang bị hẹp lại. Ta cần lùi camera ra xa thêm 
    // để không bị cắt mất hai bên tay của nhân vật.
    if (this.camera.aspect < 1) {
      // Hệ số 0.65 là ước lượng tỉ lệ chiều rộng / chiều cao của nhân vật lúc vung tay.
      const dWidth = (this.modelHeight * 0.65 / 2 / Math.tan(fovRad / 2) / this.camera.aspect) * dist;
      d = Math.max(d, dWidth);
    }
    
    const target = new THREE.Vector3(
      this.modelCentre.x,
      this.modelBaseY + this.modelHeight * aimY,
      this.modelCentre.z,
    );
    this.camera.position.set(target.x, target.y, target.z + d);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.onFramed?.(target);
  }

  /** Cho phép OrbitControls đồng bộ tâm ngắm với khung hình vừa chọn. */
  onFramed: ((target: THREE.Vector3) => void) | null = null;

  setStageResolution(on: boolean): void {
    this.stageResolution = on;
    this.applySize();
  }

  private applySize(): void {
    if (this.disposed) return;
    if (this.stageResolution) {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(STAGE_W, STAGE_H, false);
      this.camera.aspect = STAGE_W / STAGE_H;
    } else {
      const w = Math.max(1, this.host.clientWidth);
      const h = Math.max(1, this.host.clientHeight);
      // Trần 2: trên màn hình dpr 3 thì số điểm ảnh gấp 9 lần mà mắt gần như
      // không phân biệt được với 2.
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
    }
    this.camera.updateProjectionMatrix();
  }

  // ── Tải mô hình ─────────────────────────────────────────────────────────
  private load(): void {
    // Một URL rỗng làm `GLTFLoader` ném lỗi đồng bộ ngay trong hàm dựng của
    // `VrmStage`, và lỗi đó hạ cả overlay — mất luôn khói, pháo giấy và mọi thứ
    // không liên quan gì đến nhân vật. Vắng mô hình chỉ nên là vắng nhân vật.
    if (!this.opts.modelUrl) {
      this.opts.onStatus?.('Chưa cấu hình mô hình VRM', false);
      return;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const t0 = performance.now();

    loader.load(
      this.opts.modelUrl,
      (gltf) => {
        if (this.disposed) return;
        const loaded = gltf.userData.vrm as VRM;

        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        // VRM 0.x quay lưng về phía camera. Không xoay thì cả buổi phát là lưng.
        VRMUtils.rotateVRM0(loaded);

        this.vrm = loaded;
        this.scene.add(loaded.scene);

        // Tắt frustum culling vì animation có thể làm lệch bounding box
        loaded.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });

        // Sử dụng xương thay vì Bounding Box để tính chiều cao và tâm ngắm, 
        // tránh lỗi bounding box bị phình to do tóc hoặc xương vật lý.
        loaded.scene.updateMatrixWorld(true);
        const head = loaded.humanoid?.getNormalizedBoneNode('head');
        const hips = loaded.humanoid?.getNormalizedBoneNode('hips');
        const leftFoot = loaded.humanoid?.getNormalizedBoneNode('leftFoot');

        if (head && leftFoot && hips) {
          const headPos = new THREE.Vector3();
          head.getWorldPosition(headPos);
          const footPos = new THREE.Vector3();
          leftFoot.getWorldPosition(footPos);
          const hipsPos = new THREE.Vector3();
          hips.getWorldPosition(hipsPos);
          
          this.modelBaseY = footPos.y;
          // Thêm 0.15m từ khớp cổ/đầu lên đỉnh đầu
          this.modelHeight = headPos.y - footPos.y + 0.15; 
          this.modelCentre.set(hipsPos.x, this.modelBaseY + this.modelHeight / 2, hipsPos.z);
        } else {
          const box = new THREE.Box3().setFromObject(loaded.scene);
          this.modelCentre = box.getCenter(new THREE.Vector3());
          this.modelHeight = box.getSize(new THREE.Vector3()).y;
          this.modelBaseY = box.min.y;
        }

        this.frameCamera();

        this.opts.onStatus?.(`Đã tải mô hình VRM · ${Math.round(performance.now() - t0)}ms`, true);
        
        // Cập nhật lại mixer nếu đang có hoạt ảnh
        if (this.currentAnimationUrl) {
          const url = this.currentAnimationUrl;
          this.currentAnimationUrl = null;
          this.loadDance(url);
        }
      },
      undefined,
      (err) => this.opts.onStatus?.(`Không tải được mô hình: ${String(err)}`, false),
    );
  }

  // ── Vòng lặp ────────────────────────────────────────────────────────────
  private tick = (): void => {
    this.raf = requestAnimationFrame(this.tick);

    const now = performance.now();
    this.frames.push(now - this.lastFrameAt);
    this.lastFrameAt = now;

    const delta = this.clock.getDelta();
    const started = performance.now();

    if (this.vrm) {
      // Khi đoạn nhảy đang chiếm quyền xương, tắt tư thế procedural — nếu cả
      // hai cùng ghi lên bone thì nhân vật giật một cái mỗi khung.
      if (!this.activeDance) {
        this.applyPose(now / 1000, now);
      }

      // Đoạn nhảy ngắn (quà tặng)
      if (this.activeDance) {
        const d = this.activeDance;
        const elapsed = now - d.startedAt;

        // Bắt đầu mờ dần trước khi hết — nếu đợi đúng lúc hết thì sẽ có
        // một khung nhảy từ tư thế nhảy sang tư thế nghỉ.
        if (!d.fadingOut && elapsed >= d.durationMs - d.blendMs) {
          d.fadingOut = true;
          d.action.fadeOut(d.blendMs / 1000);
          if (d.audio) {
            // Giảm âm lượng dần cùng tốc độ với hình
            const fadeAudio = () => {
              if (!d.audio || d.audio.paused) return;
              d.audio.volume = Math.max(0, d.audio.volume - 0.05);
              if (d.audio.volume > 0) requestAnimationFrame(fadeAudio);
            };
            fadeAudio();
          }
        }

        if (elapsed >= d.durationMs) {
          this.stopDanceClip();
        } else {
          d.mixer.update(delta);
        }
      }

      // Điệu nhảy studio (đồng bộ với audio bên ngoài, không phải quà)
      if (this.animationMixer && this.isDancePlaying && !this.activeDance) {
        this.animationMixer.update(delta);
      }

      this.vrm.update(delta);
    }

    this.onBeforeRender?.();
    this.renderer.render(this.scene, this.camera);
    this.work.push(performance.now() - started);

    // Nửa giây một lần: đủ nhanh để thấy tác động của một thay đổi, đủ chậm để
    // bản thân việc báo cáo không thành một khoản chi phí đáng kể.
    if (now - this._lastStatsTime >= 1000 && this.opts.onStats) {
      this._lastStatsTime = now;
      const w = [...this.work].sort((a, b) => a - b);
      const f = [...this.frames].sort((a, b) => a - b);
      this.opts.onStats({
        workP50: +percentile(w, 0.5).toFixed(2),
        workP95: +percentile(w, 0.95).toFixed(2),
        fps: Math.round(1000 / Math.max(0.001, percentile(f, 0.5))),
        triangles: this.renderer.info.render.triangles,
        calls: this.renderer.info.render.calls,
        pending: this.motions.pendingCount,
      });
      this.work.length = 0;
      this.frames.length = 0;
    }
  };

  private _lastStatsTime = 0;

  /**
   * Dựng tư thế của khung này: bắt đầu từ tư thế nghỉ rồi trộn dần từng lớp
   * động tác lên trên.
   *
   * Trộn tuần tự chứ không cộng trọng số có chuẩn hoá — lớp đang mờ đi và lớp
   * đang hiện lên không cần cộng lại thành 1, và phép nội suy tuần tự luôn cho
   * ra một tư thế hợp lệ kể cả khi cả hai đang ở trọng số thấp.
   */
  private applyPose(timeSec: number, nowMs: number): void {
    const vrm = this.vrm;
    if (!vrm?.humanoid) return;

    const sample = this.motions.sample(nowMs, clipCycleMs);

    let pose: Pose = idlePose({ t: 0, time: timeSec, intensity: 1 });
    for (const layer of sample.layers) {
      if (layer.weight <= 0) continue;
      const clipPose = samplePose(layer.clip, {
        t: layer.t,
        time: timeSec,
        intensity: layer.intensity,
      });
      pose = blendPose(pose, clipPose, layer.weight);
    }

    (Object.keys(pose.rot) as BoneKey[]).forEach((bone) => {
      const node = vrm.humanoid?.getNormalizedBoneNode(bone);
      const rot = pose.rot[bone];
      if (node && rot) node.rotation.set(rot[0], rot[1], rot[2]);
    });

    const hips = vrm.humanoid.getNormalizedBoneNode('hips');
    if (hips) hips.position.y = pose.hipsY;

    // Biểu cảm rẻ hơn động tác rất nhiều mà hiệu quả hình ảnh lại cao. Đặt lại
    // toàn bộ mỗi khung: nếu chỉ ghi cái đang bật thì biểu cảm của món quà
    // trước sẽ dính lại trên mặt cho tới hết buổi phát.
    const em = vrm.expressionManager;
    if (em) {
      ALL_EXPRESSIONS.forEach((name) => {
        if (name === AvatarExpression.NEUTRAL) return;
        em.setValue(name, sample.expression?.name === name ? sample.expression.weight : 0);
      });
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.stopDanceClip();
    this.danceAnimCache.clear();
    // `renderer.dispose()` một mình không thu hồi geometry và texture của mô
    // hình. Thiếu dòng này thì mỗi lần hot-reload là một bản VRM nữa nằm lại
    // trong bộ nhớ GPU cho tới khi tab bị đóng.
    if (this.vrm) VRMUtils.deepDispose(this.vrm.scene);
    this.vrm = null;
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
