import type { DiscoEngine } from './disco-engine';
import { speakMessage } from './disco-engine';
import type { DiscoSyncPayload } from './apply-disco-action';

/**
 * Kịch bản trình diễn sẵn cho trang Kiểm thử.
 *
 * Trước đây bốn kịch bản là bốn nhánh `if` dài với `setTimeout` lồng nhau, mỗi
 * bước tự tay đẩy timer vào một mảng ref — khoảng 200 dòng gần như giống hệt
 * nhau. Mô tả bằng dữ liệu thì thêm một bước là thêm một dòng, và bộ chạy chỉ
 * cần viết một lần (kèm việc dọn timer, thứ dễ quên nhất ở bản cũ).
 */

export type ScenarioId = 'concert' | 'dj_battle' | 'fx_party' | 'gift_showcase';

/** Những gì một bước kịch bản được phép làm. */
export interface ScenarioContext {
  engine: DiscoEngine;
  sync: (payload: DiscoSyncPayload & { musicUrl?: string; trackTitle?: string }) => void;
  setMusic: (url: string, title: string) => void;
  effect: (name: 'smoke_blast' | 'confetti' | 'strobe' | 'laser_show' | 'firework_burst') => void;
  camera: (shot: 'DJ_POV' | 'SPOTLIGHT_ZOOM' | 'CRANE_SWOOP' | 'WIDE_ORBIT') => void;
}

export interface ScenarioStep {
  /** Mili-giây kể từ lúc bấm chạy. Bước đầu để 0. */
  at: number;
  log: string;
  run: (ctx: ScenarioContext) => void;
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  /** Câu mô tả ngắn, hiện dưới nhãn nút. */
  hint: string;
  steps: ScenarioStep[];
  /** Câu chốt khi chạy xong, hiện sau bước cuối vài giây. */
  doneLog: string;
  doneAfterMs: number;
}

const CONCERT: Scenario = {
  id: 'concert',
  label: 'Đêm nhạc hội',
  hint: '6 bước · 20 giây',
  doneLog: '✅ Kịch bản Đêm Nhạc Hội đã diễn ra thành công.',
  doneAfterMs: 5000,
  steps: [
    {
      at: 0,
      log: '🎵 Khởi động nhạc EDM và sân khấu đại nhạc hội',
      run: ({ setMusic, effect }) => {
        setMusic(
          'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=electronic-future-beats-117997.mp3',
          '⚡ Vinahouse Future Beat',
        );
        effect('strobe');
      },
    },
    {
      at: 3000,
      log: '🕺 Bốn khán giả vào sàn',
      run: ({ engine }) => {
        engine.join('@dancer_alex', 'Alex Dancer 🔥');
        engine.join('@bella_cute', 'Bella Cute 💃');
        engine.join('@tony_viet', 'Tony Việt 🕺');
        engine.join('@super_star', 'Super Star 🌟');
      },
    },
    {
      at: 6000,
      log: '💃 Khán giả nhảy và đổi trang phục',
      run: ({ engine, effect }) => {
        engine.jump('@dancer_alex');
        engine.jump('@bella_cute');
        engine.changeAvatar('@tony_viet');
        engine.changeAvatar('@super_star');
        effect('confetti');
      },
    },
    {
      at: 9000,
      log: '👑 @super_star tặng quà VIP (+15đ) và lên hạng nhất',
      run: ({ engine }) => engine.enqueueGift('@super_star', 'Super Star 🌟', 15),
    },
    {
      at: 12000,
      log: '🎧 Góc nhìn từ DJ xuống toàn cảnh sàn nhảy, 10 giây',
      run: ({ camera }) => camera('DJ_POV'),
    },
    {
      at: 15000,
      log: '🎆 Xịt khói, laser và pháo hoa kết màn',
      run: ({ effect }) => {
        effect('smoke_blast');
        effect('firework_burst');
        effect('laser_show');
      },
    },
  ],
};

const DJ_BATTLE: Scenario = {
  id: 'dj_battle',
  label: 'Tranh ngôi hạng nhất',
  hint: '5 bước · 18 giây',
  doneLog: '✅ Kịch bản Tranh Ngôi Hạng Nhất đã kết thúc.',
  doneAfterMs: 4000,
  steps: [
    {
      at: 0,
      log: '⚔️ @nguyen_nam và @tran_phuong vào sàn',
      run: ({ engine }) => {
        engine.join('@nguyen_nam', 'Nguyễn Nam 🎧');
        engine.join('@tran_phuong', 'Trần Phương 👑');
      },
    },
    {
      at: 3000,
      log: '🎁 @nguyen_nam tặng 12 điểm và dẫn đầu',
      run: ({ engine }) => engine.enqueueGift('@nguyen_nam', 'Nguyễn Nam 🎧', 12),
    },
    {
      at: 7000,
      log: '🚀 @tran_phuong phản công 25 điểm và soán ngôi',
      run: ({ engine }) => engine.enqueueGift('@tran_phuong', 'Trần Phương 👑', 25),
    },
    {
      at: 11000,
      log: '🔍 Camera zoom cận cảnh người dẫn đầu mới',
      run: ({ camera }) => camera('SPOTLIGHT_ZOOM'),
    },
    {
      at: 14000,
      log: '🏆 Vinh danh bằng pháo hoa',
      run: ({ effect }) => {
        effect('firework_burst');
        effect('confetti');
      },
    },
  ],
};

const FX_PARTY: Scenario = {
  id: 'fx_party',
  label: 'Đại tiệc hiệu ứng',
  hint: '6 bước · 19 giây',
  doneLog: '✅ Kịch bản Đại Tiệc Hiệu Ứng đã hoàn thành.',
  doneAfterMs: 4000,
  steps: [
    { at: 0, log: '💨 Xịt khói CO2 sân khấu', run: ({ effect }) => effect('smoke_blast') },
    { at: 3000, log: '⚡ Đèn chớp vũ trường', run: ({ effect }) => effect('strobe') },
    { at: 6000, log: '🔴 Laser đa chùm xoay 360 độ', run: ({ effect }) => effect('laser_show') },
    { at: 9000, log: '🎊 Mưa hoa giấy bảy màu', run: ({ effect }) => effect('confetti') },
    { at: 12000, log: '🏗️ Cần cẩu lia máy toàn cảnh', run: ({ camera }) => camera('CRANE_SWOOP') },
    { at: 15000, log: '🎆 Pháo hoa liên hoàn kết màn', run: ({ effect }) => effect('firework_burst') },
  ],
};

const GIFT_SHOWCASE: Scenario = {
  id: 'gift_showcase',
  label: 'Trình diễn quà tặng',
  hint: '5 bước · 24 giây',
  doneLog: '✅ Kịch bản Trình Diễn Quà Tặng đã kết thúc.',
  doneAfterMs: 6000,
  steps: [
    {
      at: 0,
      log: '💬 @minh_anh gõ "Hey" và vào sàn',
      run: ({ engine }) => engine.join('@minh_anh', 'Minh Anh 💃'),
    },
    {
      at: 3500,
      log: '🌹 @hoang_nam tặng 1 Rose, camera zoom 7 giây',
      run: ({ engine, sync }) => {
        engine.join('@hoang_nam', 'Hoàng Nam 🕺');
        engine.addGiftPoints('@hoang_nam', 'Hoàng Nam 🕺', 1);
        engine.triggerSpotlightZoom(7000, '@hoang_nam');
        sync({ cameraShot: 'SPOTLIGHT_ZOOM', duration: 7000, targetId: '@hoang_nam' });
      },
    },
    {
      at: 8000,
      log: '🎵 @thu_ha tặng 1 TikTok và đổi trang phục',
      run: ({ engine }) => {
        engine.join('@thu_ha', 'Thu Hà ✨');
        engine.changeAvatar('@thu_ha');
        engine.addGiftPoints('@thu_ha', 'Thu Hà ✨', 1);
        engine.jump('@thu_ha');
      },
    },
    {
      at: 12500,
      log: '💖 @thanh_dat tặng 1 Rosa, có lời cảm ơn bằng giọng nói',
      run: ({ engine, sync }) => {
        engine.join('@thanh_dat', 'Thành Đạt 🌟');
        engine.addGiftPoints('@thanh_dat', 'Thành Đạt 🌟', 5);
        engine.triggerSpotlightZoom(7000, '@thanh_dat');
        const speech = 'Cảm ơn Thành Đạt đã tặng Rosa cho phòng nhảy! Quẩy lên nào!';
        speakMessage(speech);
        sync({ cameraShot: 'SPOTLIGHT_ZOOM', duration: 7000, targetId: '@thanh_dat', speechText: speech });
      },
    },
    {
      at: 18000,
      log: '🎊 @dai_gia_vip tặng Pháo Hoa Giấy và lên bục hạng nhất',
      run: ({ engine, sync }) => {
        engine.promoteToTop1('@dai_gia_vip', 'Đại Gia VIP 👑');
        const speech = 'Chúc mừng Đại Gia VIP đã tặng Pháo Hoa Giấy và đăng quang TOP 1 đêm nay!';
        speakMessage(speech);
        sync({ cameraShot: 'DJ_POV', duration: 10000, effect: 'confetti', speechText: speech });
      },
    },
  ],
};

export const SCENARIOS: readonly Scenario[] = [CONCERT, DJ_BATTLE, FX_PARTY, GIFT_SHOWCASE];

export function findScenario(id: ScenarioId): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
