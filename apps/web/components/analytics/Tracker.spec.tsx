import React, { StrictMode } from 'react';
import { render, act } from '@testing-library/react';

/**
 * Bộ đếm lưu lượng.
 *
 * Hai ca đầu khoá lại đúng hai lỗi mà dữ liệu thật đã phơi ra ngay giờ đầu chạy,
 * chứ không phải hai lỗi tưởng tượng ra khi ngồi viết test:
 *
 *  1. Mỗi lần chuyển cửa sổ lại sinh một sự kiện LEAVE. Một người alt-tab qua
 *     lại tạo 17 bản ghi cho cùng một trang trong một phút, có cái dài 18ms —
 *     và thời gian ở lại trung vị tính trên đống đó đo tốc độ alt-tab chứ không
 *     đo thời gian đọc.
 *  2. Mỗi lần tải trang ghi hai VIEW, do React gắn–tháo–gắn lại effect ở chế độ
 *     nghiêm ngặt. Mọi con số đọc trong lúc phát triển đều gấp đôi.
 */

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

process.env.NEXT_PUBLIC_API_URL = 'http://api.test';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Tracker } = require('./Tracker') as typeof import('./Tracker');

interface Sent {
  kind: string;
  path: string;
  dwellMs?: number;
  label?: string;
}

function sentPayloads(): Sent[] {
  const fromFetch = (global.fetch as jest.Mock).mock.calls.map((c) =>
    JSON.parse(c[1].body as string),
  );
  const fromBeacon = (navigator.sendBeacon as jest.Mock).mock.calls.map((c) =>
    JSON.parse((c[1] as { __body: string }).__body),
  );
  return [...fromFetch, ...fromBeacon];
}

beforeEach(() => {
  mockPathname = '/';
  sessionStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));

  global.fetch = jest.fn(() => Promise.resolve({ ok: true } as Response)) as jest.Mock;

  // jsdom không có Blob().text() đồng bộ, nên giữ lại phần thân ngay trên đối
  // tượng truyền vào để test đọc được.
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    writable: true,
    value: jest.fn(),
  });
  (global as unknown as { Blob: unknown }).Blob = class {
    __body: string;
    constructor(parts: string[]) {
      this.__body = parts.join('');
    }
  };

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('Tracker', () => {
  it('chỉ ghi một VIEW cho mỗi lần tải trang, kể cả ở chế độ nghiêm ngặt', () => {
    render(
      <StrictMode>
        <Tracker />
      </StrictMode>,
    );

    const views = sentPayloads().filter((p) => p.kind === 'VIEW');
    expect(views).toHaveLength(1);
    expect(views[0].path).toBe('/');
  });

  it('chuyển cửa sổ không sinh ra LEAVE — chỉ tạm dừng đồng hồ', () => {
    render(<Tracker />);
    (global.fetch as jest.Mock).mockClear();

    // Nhìn 4 giây, ẩn đi, hiện lại, nhìn tiếp 4 giây: vẫn là một lượt xem.
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    setVisibility('hidden');
    setVisibility('visible');
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    setVisibility('hidden');
    setVisibility('visible');

    expect(sentPayloads().filter((p) => p.kind === 'LEAVE')).toHaveLength(0);
  });

  it('chốt LEAVE một lần khi đóng tab, với tổng thời gian thật sự nhìn', () => {
    render(<Tracker />);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // Ẩn 60 giây: quãng này không được tính là thời gian đọc.
    setVisibility('hidden');
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    setVisibility('visible');
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    const leaves = sentPayloads().filter((p) => p.kind === 'LEAVE');
    expect(leaves).toHaveLength(1);
    expect(leaves[0].dwellMs).toBe(8000);
  });

  it('bỏ qua lượt ghé dưới một giây, thứ chỉ làm nhiễu trung vị', () => {
    render(<Tracker />);
    act(() => {
      jest.advanceTimersByTime(400);
    });
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(sentPayloads().filter((p) => p.kind === 'LEAVE')).toHaveLength(0);
  });

  it('không đếm khu quản trị và nguồn OBS', () => {
    mockPathname = '/admin/analytics';
    render(<Tracker />);
    expect(sentPayloads()).toHaveLength(0);

    (global.fetch as jest.Mock).mockClear();
    mockPathname = '/overlays/stage';
    render(<Tracker />);
    expect(sentPayloads()).toHaveLength(0);
  });

  it('ghi lượt bấm vào phần tử có data-track, bỏ qua phần tử không có', () => {
    render(
      <>
        <Tracker />
        <button type="button" data-track="Nút thử">
          <span>Bấm</span>
        </button>
        <button type="button">Không theo dõi</button>
      </>,
    );
    (global.fetch as jest.Mock).mockClear();

    // Bấm vào <span> bên trong: closest() phải tìm ra nút cha.
    act(() => {
      document.querySelector('[data-track] span')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });
    act(() => {
      document.querySelectorAll('button')[1].dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });

    const clicks = sentPayloads().filter((p) => p.kind === 'CLICK');
    expect(clicks).toHaveLength(1);
    expect(clicks[0].label).toBe('Nút thử');
  });
});
