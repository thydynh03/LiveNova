'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '../../components/common/Sidebar';
import { TopBar } from '../../components/common/TopBar';
import { LoadingState } from '../../components/common/States';
import { useAuth } from '../../context/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuth();

  /**
   * Ngăn kéo điều hướng, chỉ dùng dưới 1024px.
   *
   * Trạng thái nằm ở đây chứ không phải trong `Sidebar` vì cả lớp nền mờ lẫn
   * nút mở trên `TopBar` đều cần chạm tới nó.
   */
  const [navOpen, setNavOpen] = useState(false);

  // Đóng ngăn kéo sau khi chuyển trang. Nếu không, người dùng bấm một mục rồi
  // vẫn phải tự tay đóng cái ngăn kéo đang che trang vừa mở.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Escape đóng ngăn kéo — không có phím này thì người dùng bàn phím bị kẹt.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  useEffect(() => {
    if (status === 'anonymous') {
      const next = encodeURIComponent(pathname ?? '/dashboard');
      router.replace(`/login?next=${next}`);
    }
  }, [status, pathname, router]);

  if (status !== 'authenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <LoadingState
          label={status === 'loading' ? 'Đang kiểm tra phiên…' : 'Chuyển tới đăng nhập…'}
        />
      </div>
    );
  }

  // Điều hướng chỉ nằm ở sidebar, không lặp lại trên header. Trước đây mỗi đích
  // đến xuất hiện hai lần với hai kiểu khác nhau, và bản trên header là bản bị
  // cuộn mất.
  return (
    <div className="ln-shell">
      <Sidebar open={navOpen} />

      {/* Nền mờ khi ngăn kéo mở. `aria-hidden` vì Escape và nút đóng đã đủ cho
          người dùng bàn phím; đây chỉ là lối tắt cho chuột. */}
      <div
        className="ln-scrim"
        data-open={navOpen}
        aria-hidden="true"
        onClick={() => setNavOpen(false)}
      />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar navOpen={navOpen} onToggleNav={() => setNavOpen((v) => !v)} />
        {/* Đích của liên kết bỏ qua điều hướng ở layout gốc. `tabIndex={-1}` để
            tiêu điểm thật sự nhảy được tới đây thay vì kẹt lại ở sidebar. */}
        <main
          id="main-content"
          tabIndex={-1}
          className="ln-main"
          style={{ flex: 1, background: 'hsl(var(--background))' }}
        >
          <div className="ln-main-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
