import * as THREE from 'three';
import { MMDLoader } from 'three-stdlib';
import type { VRM } from '@pixiv/three-vrm';

const VMD_TO_VRM_BONE_MAP: Record<string, string> = {
  'センター': 'hips',
  '上半身': 'spine',
  '上半身2': 'chest',
  '首': 'neck',
  '頭': 'head',
  '左肩': 'leftShoulder',
  '左腕': 'leftUpperArm',
  '左ひじ': 'leftLowerArm',
  '左手首': 'leftHand',
  '右肩': 'rightShoulder',
  '右腕': 'rightUpperArm',
  '右ひじ': 'rightLowerArm',
  '右手首': 'rightHand',
  '左足': 'leftUpperLeg',
  '左ひざ': 'leftLowerLeg',
  '左足首': 'leftFoot',
  '右足': 'rightUpperLeg',
  '右ひざ': 'rightLowerLeg',
  '右足首': 'rightFoot',
};

export async function loadVmdAsVrmAnimationClip(vmdUrl: string, vrm: VRM): Promise<THREE.AnimationClip> {
  const loader = new MMDLoader();
  
  return new Promise((resolve, reject) => {
    // Tạo lưới giả với bộ xương chứa tên xương MMD
    // Nếu không có, MMDLoader sẽ tự động bỏ qua các track của xương không khớp
    const mmdBones = Object.keys(VMD_TO_VRM_BONE_MAP).map(name => {
      const b = new THREE.Bone();
      b.name = name;
      return b;
    });
    const skeleton = new THREE.Skeleton(mmdBones);
    const dummyMesh = new THREE.SkinnedMesh();
    dummyMesh.bind(skeleton);

    loader.loadAnimation(
      vmdUrl,
      dummyMesh,
      (vmdClip) => {
        const retargetedTracks: THREE.KeyframeTrack[] = [];
        const clip = vmdClip as THREE.AnimationClip;

        // Bù trừ A-Pose của MMD sang T-Pose của VRM
        // MMD tay xuôi xuống 40 độ -> Cần xoay lên để về chuẩn ngang trước khi áp dụng
        const armOffsetQuatL = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI * 40 / 180));
        const armOffsetQuatR = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI * 40 / 180));

        for (const track of clip.tracks) {
          const trackNameParts = track.name.split('.');
          const mmdBoneName = trackNameParts[0];
          const property = trackNameParts[1];

          const vrmBoneName = VMD_TO_VRM_BONE_MAP[mmdBoneName];
          if (!vrmBoneName) continue;

          const vrmNode = vrm.humanoid?.getRawBoneNode(vrmBoneName as any);
          if (!vrmNode) continue;

          // Tạo track mới nhắm vào UUID của xương thực tế trên mô hình VRM
          const newTrackName = `${vrmNode.uuid}.${property}`;
          const values = new Float32Array(track.values);

          if (property === 'quaternion') {
            const tempQuat = new THREE.Quaternion();
            for (let i = 0; i < values.length; i += 4) {
              tempQuat.set(values[i], values[i + 1], values[i + 2], values[i + 3]);

              if (mmdBoneName === '左腕') {
                tempQuat.premultiply(armOffsetQuatL);
              } else if (mmdBoneName === '右腕') {
                tempQuat.premultiply(armOffsetQuatR);
              }

              values[i] = tempQuat.x;
              values[i + 1] = tempQuat.y;
              values[i + 2] = tempQuat.z;
              values[i + 3] = tempQuat.w;
            }
            retargetedTracks.push(new THREE.QuaternionKeyframeTrack(newTrackName, track.times as any, values));
          } else if (property === 'position') {
            if (vrmBoneName === 'hips') {
              // Tỉ lệ MMD khoảng 10-20 unit, VRM là 1-2 unit (mét). Scale lại 0.08
              for (let i = 0; i < values.length; i += 3) {
                values[i] *= 0.08;
                values[i + 1] *= 0.08;
                values[i + 2] *= 0.08;
              }
              retargetedTracks.push(new THREE.VectorKeyframeTrack(newTrackName, track.times as any, values));
            }
          }
        }

        const newClip = new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
        resolve(newClip);
      },
      undefined,
      reject
    );
  });
}
