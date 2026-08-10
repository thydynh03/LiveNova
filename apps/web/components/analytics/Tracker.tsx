'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Bộ đếm lưu lượng, tự viết.
 *
 * Không nhúng Google Analytics, không đặt cookie, không lưu IP. `visitorId` nằm
 * trong `sessionStorage` — nó phân biệt được hai phiên trong cùng một ngày và
 * biến mất khi đóng tab, nên đủ để đếm phiên mà không đủ để theo dõi một người
 * qua thời gian. Đó là chủ ý, không phải giới hạn kỹ thuật.
 *
 * Vì không có cookie và không có định danh bền, trang không phải hiện banner
 * xin phép cookie — thứ mà chính người dùng cũng ghét bấm.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * Đường dẫn không đếm.
 *
 * `/overlays` là nguồn trình duyệt của OBS: nó tải lại theo lịch riêng và sẽ
 * bơm hàng nghìn "lượt xem" của đúng một người. `/admin` là chính mình đang
 * xem báo cáo — đếm vào đó là tự làm nhiễu số liệu mình sắp đọc.
 */
const IGNORED_PREFIXES = ['/overlays', '/admin'];

function visitorId(): string {
  const KEY = 'ln_vid';
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Trình duyệt chặn storage (chế độ riêng tư trên vài bản Safari). Vẫn đếm
    // được lượt xem, chỉ là mỗi lượt tính như một khách mới.
    return 'no-storage';
  }
}

interface Payload {
  kind: 'VIEW' | 'CLICK' | 'LEAVE';
  path: string;
  label?: string;
  dwellMs?: number;
  referrer?: string;
  visitorId: string;
}

function send(payload: Payload, beacon = false): void {
  if (!API) return;
  const url = `${API}/analytics/collect`;
  const body = JSON.stringify(payload);

  // `sendBeacon` cho sự kiện rời trang: một `fetch` thường bị huỷ khi tab đóng,
  // nên thời gian ở lại — con số duy nhất chỉ đo được lúc rời đi — sẽ mất đúng
  // vào lúc cần ghi.
  if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    return;
  }

  // `keepalive` để lần điều hướng tiếp theo không cắt mất yêu cầu này.
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Đo đạc hỏng thì im lặng. Một cái toast báo "không gửi được số liệu" là
    // đem vấn đề nội bộ ra làm phiền người đọc trang.
  });
}

export function Tracker() {
  const pathname = usePathname();
  /** Mốc bắt đầu của quãng đang-nhìn hiện tại. 0 nghĩa là tab đang ẩn. */
  const visibleSince = useRef<number>(0);
  /** Tổng thời gian đã nhìn trang này, cộng dồn qua các lần chuyển tab. */
  const accumulated = useRef<number>(0);
  const trackedPath = useRef<string | null>(null);
  /** Đã gửi LEAVE cho lượt xem này chưa. */
  const left = useRef<boolean>(false);

  useEffect(() => {
    if (!pathname || IGNORED_PREFIXES.some((p) => pathname.startsWith(p))) {
      trackedPath.current = null;
      return;
    }

    const vid = visitorId();
    const path = pathname;

    /**
     * Effect chạy lại cho cùng một trang không phải là một lượt xem mới.
     *
     * React 18 gắn–tháo–gắn lại effect trong chế độ nghiêm ngặt, nên mỗi lần
     * tải trang sinh ra đúng hai VIEW cách nhau vài chục mili-giây. Bản dựng
     * production không như vậy, nhưng nếu tin điều đó mà không chặn thì mọi
     * con số đọc trong lúc phát triển đều gấp đôi, và không ai biết là gấp đôi.
     */
    const isRemount = trackedPath.current === path && !left.current;

    /**
     * Gửi LEAVE, đúng một lần cho mỗi lượt xem.
     *
     * Bản đầu gửi LEAVE ở *mỗi* lần `visibilitychange` sang hidden. Dữ liệu
     * thật cho thấy ngay vấn đề: một người chuyển qua lại giữa các cửa sổ sinh
     * ra 17 sự kiện cho cùng một trang trong một phút, nhiều cái dài 18ms. Thời
     * gian ở lại trung vị tính trên đống đó là con số vô nghĩa — nó đo tốc độ
     * alt-tab, không đo thời gian đọc.
     *
     * Giờ thời gian nhìn được cộng dồn, và chỉ chốt một lần: khi đổi trang,
     * hoặc khi tab bị đóng.
     */
    const flush = (previousPath: string | null) => {
      if (!previousPath || left.current) return;
      // Cộng nốt quãng đang mở, nếu tab đang hiện.
      if (visibleSince.current) {
        accumulated.current += Date.now() - visibleSince.current;
        visibleSince.current = 0;
      }
      // Dưới một giây thì không phải một lượt đọc. Ghi lại chỉ làm nhiễu trung vị.
      if (accumulated.current < 1000) return;
      left.current = true;
      send(
        { kind: 'LEAVE', path: previousPath, dwellMs: accumulated.current, visitorId: vid },
        true,
      );
    };

    if (!isRemount) {
      flush(trackedPath.current);

      accumulated.current = 0;
      visibleSince.current = document.visibilityState === 'visible' ? Date.now() : 0;
      trackedPath.current = path;
      left.current = false;

      send({
        kind: 'VIEW',
        path,
        // Chỉ gửi nguồn giới thiệu khi nó là trang ngoài. Điều hướng nội bộ tự
        // đặt referrer là chính trang này, và đếm nó sẽ báo cáo rằng nguồn truy
        // cập lớn nhất của mình là… chính mình.
        referrer:
          typeof document !== 'undefined' &&
          document.referrer &&
          !document.referrer.startsWith(window.location.origin)
            ? document.referrer
            : undefined,
        visitorId: vid,
      });
    }

    // Chuyển tab chỉ *tạm dừng* đồng hồ, không kết thúc lượt xem. Thời gian tab
    // bị ẩn không được tính là thời gian đọc, mà cũng không được cắt lượt xem
    // thành nhiều mảnh.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (visibleSince.current) {
          accumulated.current += Date.now() - visibleSince.current;
          visibleSince.current = 0;
        }
      } else {
        visibleSince.current = Date.now();
      }
    };

    // `pagehide` chứ không phải `beforeunload`: Safari trên iOS không bắn
    // `beforeunload` khi người dùng chuyển app hay đóng tab, nên phần lớn lượt
    // rời trang trên di động sẽ không bao giờ được ghi.
    const onPageHide = () => flush(trackedPath.current);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest?.('[data-track]');
      if (!target) return;
      const label = target.getAttribute('data-track');
      if (!label) return;
      send({ kind: 'CLICK', path, label: label.slice(0, 120), visitorId: vid });
    };

    document.addEventListener('click', onClick, { capture: true });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
    };
  }, [pathname]);

  return null;
}
