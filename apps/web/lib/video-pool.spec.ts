import { isVideoUrl, isWarm, resetVideoPool, warmVideos, warmedVideo } from './video-pool';

/**
 * Bộ hâm sẵn video hiệu ứng.
 *
 * jsdom không có đường ống media, nên ở đây kiểm được phần *có chuẩn bị hay
 * không* — thẻ có được dựng, có `preload="auto"`, có nằm trong cây DOM — chứ
 * không kiểm được việc trình duyệt thật đã đệm tới đâu. Phần đó chỉ đo được
 * trên máy thật.
 */

describe('video-pool', () => {
  afterEach(() => resetVideoPool());

  it('nhận ra URL video và bỏ qua ảnh', () => {
    expect(isVideoUrl('https://cdn/x/fx_dragon.mp4')).toBe(true);
    expect(isVideoUrl('https://cdn/x/fx_bomb.webm?v=2')).toBe(true);
    expect(isVideoUrl('https://cdn/x/castle_cat.svg')).toBe(false);
    expect(isVideoUrl(undefined)).toBe(false);
  });

  it('dựng một thẻ video sẵn sàng cho mỗi URL', () => {
    warmVideos(['https://cdn/x/fx_dragon.mp4', 'https://cdn/x/castle.svg', undefined]);

    const el = warmedVideo('https://cdn/x/fx_dragon.mp4');
    expect(el).toBeInstanceOf(HTMLVideoElement);
    // `preload="auto"` là điểm mấu chốt: mặc định của `<video>` chỉ lấy metadata,
    // nên tệp vẫn sẽ tải đúng vào lúc nó phải phát.
    expect(el?.getAttribute('preload')).toBe('auto');
    expect(el?.isConnected).toBe(true);

    // Ảnh không thuộc bộ này; chúng đi qua image-cache.
    expect(warmedVideo('https://cdn/x/castle.svg')).toBeNull();
  });

  it('không dựng lại thẻ cho URL đã hâm', () => {
    warmVideos(['https://cdn/x/fx_bomb.mp4']);
    const first = warmedVideo('https://cdn/x/fx_bomb.mp4');

    warmVideos(['https://cdn/x/fx_bomb.mp4']);

    // Dựng lại sẽ vứt bỏ đúng phần đệm mà bộ này tồn tại để tích luỹ.
    expect(warmedVideo('https://cdn/x/fx_bomb.mp4')).toBe(first);
  });

  it('chưa báo sẵn sàng khi trình duyệt chưa nói là đủ dữ liệu', () => {
    warmVideos(['https://cdn/x/fx_meteor.mp4']);

    // `canplaythrough` mới là mốc đúng. `canplay` chỉ nói "phát được vài khung"
    // rồi khựng giữa chừng khi bộ đệm cạn — tệ hơn là chờ thêm một nhịp.
    expect(isWarm('https://cdn/x/fx_meteor.mp4')).toBe(false);
  });

  it('trả lời an toàn cho URL chưa từng được hâm', () => {
    expect(warmedVideo('https://cdn/x/chua-co.mp4')).toBeNull();
    expect(isWarm('https://cdn/x/chua-co.mp4')).toBe(false);
  });
});
