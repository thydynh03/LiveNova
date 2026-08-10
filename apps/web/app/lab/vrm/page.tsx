import dynamic from 'next/dynamic';

/**
 * Trang đo, không phải trang phát sóng.
 *
 * `ssr: false` vì WebGL và `performance.now()` không tồn tại lúc dựng phía máy
 * chủ, và vì mọi thứ ở đây chỉ có nghĩa khi chạy trong một trình duyệt thật.
 */
const VrmStageLab = dynamic(() => import('./VrmStageLab').then((m) => m.VrmStageLab), {
  ssr: false,
});

export const metadata = {
  title: 'Bàn đo sân khấu VRM',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#020617' }}>
      <VrmStageLab />
    </main>
  );
}
