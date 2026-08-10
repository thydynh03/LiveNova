'use client';

/**
 * Bàn đo hiệu năng cho một nhân vật VRM trên sân khấu.
 *
 * Đây **không phải** overlay phát sóng. Overlay `STAGE` là việc đang làm dở của
 * người khác; trang này chỉ tồn tại để trả lời một câu hỏi trước khi ai đó viết
 * mã sản phẩm: một nhân vật VRM có xương, chạy liên tục ở khổ dọc 1080×1920,
 * tốn bao nhiêu mỗi khung hình.
 *
 * Bài học từ `BattleArena3D` và `frameBudget`: overlay chạy trên đúng cái máy
 * đang mã hoá 1080p60, và khi overlay giành tài nguyên thì thứ giật là **buổi
 * phát**, không phải overlay. Nên con số đáng quan tâm không phải FPS — trình
 * duyệt luôn cố giữ 60 và giấu chi phí đi — mà là **mili giây CPU/GPU cho mỗi
 * khung**, và phần trăm nó chiếm trong ngân sách 16.7ms.
 *
 * Vì vậy trang này đo p50/p95 thời gian dựng hình, tách riêng phần cập nhật
 * xương với phần vẽ, và cho bật/tắt nhân vật để lấy **đường nền** — chi phí của
 * một khung trống trên cùng máy đó. Hiệu số giữa hai lần đo mới là giá của nhân
 * vật; con số tuyệt đối thì lẫn cả chi phí của trình duyệt và màn hình.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

/** Khổ phát sóng thật. Đo ở kích thước khác thì số đo không dùng được. */
const STAGE_W = 1080;
const STAGE_H = 1920;

interface Sample {
  /** Thời gian giữa hai khung — chịu ảnh hưởng của vsync, không phải chi phí. */
  frameMs: number;
  /** Thời gian ta thực sự chiếm giữ luồng chính để cập nhật và vẽ. */
  workMs: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[i];
}

export function VrmStageLab() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState('Đang tải mô hình…');
  const [showModel, setShowModel] = useState(true);
  const [report, setReport] = useState<string[]>([]);
  const [info, setInfo] = useState('');

  const showModelRef = useRef(showModel);
  showModelRef.current = showModel;

  const samplesRef = useRef<Sample[]>([]);
  const measureRef = useRef<{ label: string; until: number } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Ghim tỉ lệ điểm ảnh về 1. OBS dựng hình ở đúng độ phân giải nguồn, nên đo
    // với devicePixelRatio của màn hình lập trình sẽ ra một con số không tồn tại
    // trên máy phát sóng.
    renderer.setPixelRatio(1);
    renderer.setSize(STAGE_W, STAGE_H, false);
    renderer.domElement.style.cssText = 'width:270px;height:480px;display:block;';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, STAGE_W / STAGE_H, 0.1, 20);
    camera.position.set(0, 1.25, 2.6);

    // Hai đèn, không bóng đổ. Bóng đổ là thứ đắt nhất trong một cảnh thế này và
    // trên nền video sân khấu thì gần như không ai nhìn thấy.
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(1, 2, 2);
    scene.add(key);

    let vrm: VRM | null = null;
    let disposed = false;
    /** Khoảng cách đóng khung ban đầu, giữ lại để phép đo thu nhỏ không cộng dồn. */
    let baseDist = 2.6;
    /** Tâm đóng khung đã chốt lúc tải, để phép đo không phụ thuộc tư thế hiện tại. */
    let frameCentre = new THREE.Vector3();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const t0 = performance.now();
    loader.load(
      '/lab/model.vrm',
      (gltf) => {
        if (disposed) return;
        const loaded = gltf.userData.vrm as VRM;

        // Cả hai đều là khuyến nghị của three-vrm cho cảnh chỉ xem: gộp các
        // primitive để bớt lệnh vẽ, và bỏ những đỉnh không khớp nào không dùng.
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);

        // VRM 0.x quay lưng về phía camera. Không xoay thì màn đo là đo lưng.
        VRMUtils.rotateVRM0(loaded);

        vrm = loaded;
        scene.add(loaded.scene);

        // Đóng khung theo hộp bao thật của mô hình thay vì đặt camera bằng số
        // đoán. Mỗi mô hình VRM có chiều cao và gốc toạ độ riêng; một camera
        // ghim cứng sẽ đúng với mô hình này và cắt mất đầu của mô hình sau.
        const box = new THREE.Box3().setFromObject(loaded.scene);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const fovRad = (camera.fov * Math.PI) / 180;
        // Khoảng cách vừa đủ để chiều cao mô hình lấp khung, chừa 12% lề.
        const dist = (size.y / 2 / Math.tan(fovRad / 2)) * 1.12;
        baseDist = dist;
        frameCentre = centre.clone();
        camera.position.set(centre.x, centre.y, centre.z + dist);
        camera.lookAt(centre);
        camera.updateProjectionMatrix();

        const loadMs = Math.round(performance.now() - t0);
        setStatus(`Đã tải trong ${loadMs}ms · cao ${size.y.toFixed(2)}m`);
      },
      undefined,
      (err) => setStatus(`Không tải được: ${String(err)}`),
    );

    let raf = 0;
    let lastInfo = 0;
    let last = performance.now();
    const clock = new THREE.Clock();

    /**
     * Đo chạy thẳng, không đi qua `requestAnimationFrame`.
     *
     * rAF bị trình duyệt treo khi cửa sổ không hiển thị, nên trong một phiên
     * đo tự động thì vòng rAF không chạy khung nào và mọi con số thu được là
     * số của một vòng lặp đứng yên.
     *
     * Nó cũng đo đúng thứ cần hơn: rAF bị vsync ghìm ở 60fps và **giấu** chi
     * phí thật đi — một cảnh tốn 5ms và một cảnh tốn 15ms đều hiện ra là
     * 60fps. Cái quyết định buổi phát có giật hay không là bao nhiêu mili giây
     * bị chiếm mất khỏi ngân sách 16.7ms, và đây đo đúng cái đó.
     *
     * `readPixels` sau mỗi lần vẽ để ép chờ GPU: lệnh WebGL xếp hàng bất đồng
     * bộ, nên nếu chỉ bấm giờ quanh `render()` thì ta đo thời gian *ra lệnh*,
     * không phải thời gian *làm xong*.
     */
    const bench = (frames: number, withModel: boolean, skipUpdate = false) => {
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      const work: number[] = [];
      if (vrm) vrm.scene.visible = withModel;

      // Vài khung khởi động: khung đầu phải biên dịch shader và tải kết cấu lên
      // GPU, đắt gấp nhiều lần và không đại diện cho trạng thái đang phát sóng.
      for (let i = 0; i < 10; i += 1) {
        if (vrm && withModel) vrm.update(1 / 60);
        renderer.render(scene, camera);
      }
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);

      for (let i = 0; i < frames; i += 1) {
        const t = i / 60;
        const s = performance.now();
        // `skipUpdate` để tách hai khoản chi phí có hai cách giảm hoàn toàn
        // khác nhau: nếu phần lớn nằm ở `vrm.update` thì phải tắt bớt vật lý
        // tóc và váy; nếu nằm ở lệnh vẽ thì phải giảm số tam giác của mô hình.
        if (vrm && withModel && !skipUpdate) {
          const hips = vrm.humanoid?.getNormalizedBoneNode('hips');
          const armL = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
          const armR = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
          if (hips) {
            hips.position.y = Math.sin(t * 2.2) * 0.02;
            hips.rotation.y = Math.sin(t * 0.9) * 0.12;
          }
          if (armL) armL.rotation.z = 1.0 + Math.sin(t * 2.0) * 0.25;
          if (armR) armR.rotation.z = -1.0 - Math.sin(t * 2.0 + 1) * 0.25;
          vrm.update(1 / 60);
        }
        renderer.render(scene, camera);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        work.push(performance.now() - s);
      }

      work.sort((a, b) => a - b);
      return {
        label: withModel ? 'có nhân vật' : 'đường nền',
        frames,
        p50: +percentile(work, 0.5).toFixed(3),
        p95: +percentile(work, 0.95).toFixed(3),
        max: +work[work.length - 1].toFixed(3),
        triangles: renderer.info.render.triangles,
        calls: renderer.info.render.calls,
        textures: renderer.info.memory.textures,
      };
    };

    (window as unknown as { __vrmBench?: unknown }).__vrmBench = (
      frames = 300,
      withModel = true,
      skipUpdate = false,
      /**
       * Nhân khoảng cách camera. 2 nghĩa là nhân vật chiếm khoảng một nửa
       * chiều cao khung.
       *
       * Câu hỏi thiết kế nằm sau tham số này: chi phí bị chặn bởi số điểm ảnh
       * phải tô hay bởi số tam giác? Nếu là điểm ảnh thì đặt nhân vật nhỏ hơn
       * trên sân khấu là một cách giảm tải thật; nếu là tam giác thì thu nhỏ
       * chẳng được gì và phải chọn mô hình nhẹ hơn.
       */
      zoomOut = 1,
    ) => {
      if (!vrm) return { error: 'mô hình chưa tải xong' };
      // Dùng tâm và khoảng cách đã chốt lúc tải, không tính lại.
      //
      // Hai lý do, cả hai đều đã cắn tôi một lần. Tính từ vị trí camera hiện
      // tại thì mỗi lần gọi nhân tiếp lên lần trước, và tới lần thứ ba mô hình
      // nằm ngoài tầm nhìn — phép đo trả về 0 tam giác, một con số rất đẹp cho
      // một khung hình trống rỗng. Còn tính lại hộp bao thì nó phình ra theo tư
      // thế: sau vài khung tay đã giơ lên, hộp cao hơn lúc đứng yên, camera lùi
      // ra xa, và nhãn "đầy khung" mô tả một khung hình mà nhân vật chỉ chiếm
      // một góc.
      camera.position.set(frameCentre.x, frameCentre.y, frameCentre.z + baseDist * zoomOut);
      camera.lookAt(frameCentre);

      const out = bench(frames, withModel, skipUpdate);
      // Không tam giác nào được vẽ nghĩa là phép đo này đo một cảnh trống, bất
      // kể con số mili giây trông hợp lý đến đâu.
      const valid = !withModel || out.triangles > 0;
      return { ...out, zoomOut, valid };
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);

      const now = performance.now();
      const frameMs = now - last;
      last = now;

      const delta = clock.getDelta();
      const workStart = performance.now();

      if (vrm) {
        vrm.scene.visible = showModelRef.current;
        if (showModelRef.current) {
          // Nhịp thở và đung đưa, sinh bằng công thức chứ không phải tệp động
          // tác. Đủ để bắt bộ máy xương chạy thật mỗi khung — đó là phần chi phí
          // ta cần đo. Một điệu nhảy thật sẽ nặng hơn ở khâu nội suy khung hình,
          // nhưng bộ xương vẫn phải cập nhật đúng ngần này.
          const t = now / 1000;
          const hips = vrm.humanoid?.getNormalizedBoneNode('hips');
          const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
          const head = vrm.humanoid?.getNormalizedBoneNode('head');
          const armL = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
          const armR = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
          if (hips) {
            hips.position.y = Math.sin(t * 2.2) * 0.02;
            hips.rotation.y = Math.sin(t * 0.9) * 0.12;
          }
          if (spine) spine.rotation.z = Math.sin(t * 1.1) * 0.05;
          if (head) head.rotation.z = Math.sin(t * 0.7) * 0.06;
          if (armL) armL.rotation.z = 1.0 + Math.sin(t * 2.0) * 0.25;
          if (armR) armR.rotation.z = -1.0 - Math.sin(t * 2.0 + 1) * 0.25;

          // Đây mới là phần đắt: cập nhật xương chuẩn hoá, biểu cảm, hướng nhìn
          // và vật lý tóc/váy.
          vrm.update(delta);
        }
      }

      renderer.render(scene, camera);
      const workMs = performance.now() - workStart;

      // Đọc `renderer.info` **sau** một lần vẽ, không phải ngay sau khi tải.
      // Các bộ đếm trong `render` được đặt lại mỗi lần vẽ và phản ánh lần vẽ vừa
      // xong, nên đọc lúc tải xong thì luôn ra 0 — đúng như lần đo đầu của tôi.
      if (now - lastInfo > 1000) {
        lastInfo = now;
        setInfo(
          `${renderer.info.render.triangles.toLocaleString('vi-VN')} tam giác · ` +
            `${renderer.info.render.calls} lệnh vẽ · ` +
            `${renderer.info.memory.textures} kết cấu · ` +
            `${renderer.info.programs?.length ?? 0} shader`,
        );
      }

      const run = measureRef.current;
      if (run && now < run.until) {
        samplesRef.current.push({ frameMs, workMs });
      } else if (run) {
        const work = samplesRef.current.map((s) => s.workMs).sort((a, b) => a - b);
        const frame = samplesRef.current.map((s) => s.frameMs).sort((a, b) => a - b);
        const n = work.length;
        setReport((prev) => [
          `${run.label}: n=${n} · công việc p50 ${percentile(work, 0.5).toFixed(2)}ms · ` +
            `p95 ${percentile(work, 0.95).toFixed(2)}ms · ` +
            `khung p50 ${percentile(frame, 0.5).toFixed(1)}ms ` +
            `(${(1000 / Math.max(0.001, percentile(frame, 0.5))).toFixed(0)} fps)`,
          ...prev,
        ]);
        measureRef.current = null;
      }
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const measure = (label: string) => {
    samplesRef.current = [];
    // Bỏ qua giây đầu bằng cách đo trong sáu giây và chỉ lấy phần sau: khung
    // đầu tiên sau khi đổi trạng thái luôn đắt bất thường vì trình duyệt biên
    // dịch shader và nạp kết cấu.
    measureRef.current = { label, until: performance.now() + 6000 };
  };

  return (
    <div style={{ display: 'flex', gap: 24, padding: 24, fontFamily: 'system-ui', color: '#e2e8f0' }}>
      <div ref={hostRef} style={{ background: '#0f172a', borderRadius: 8 }} />
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Bàn đo sân khấu VRM</h1>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px' }}>
          Dựng hình ở đúng khổ phát sóng 1080×1920, tỉ lệ điểm ảnh ghim về 1. Khung xem bên trái bị
          thu nhỏ bằng CSS nhưng bộ đệm phía sau vẫn ở kích thước thật.
        </p>
        <p style={{ fontSize: 13 }} data-testid="status">{status}</p>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>{info}</p>

        <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setShowModel(true); measure('Có nhân vật'); }}>
            Đo 6 giây — có nhân vật
          </button>
          <button type="button" onClick={() => { setShowModel(false); measure('Đường nền (không nhân vật)'); }}>
            Đo 6 giây — đường nền
          </button>
        </div>

        <ul style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 18 }} data-testid="report">
          {report.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
          Con số đáng đọc là <strong>công việc p95</strong> so với ngân sách 16.7ms, và hiệu số giữa
          hai lần đo. FPS ở đây gần như luôn bằng 60 vì trình duyệt tự giới hạn theo vsync — nó
          không cho biết còn dư bao nhiêu cho bộ mã hoá của OBS.
        </p>
      </div>
    </div>
  );
}
