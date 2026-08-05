import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'LiveNova — Tự động hoá livestream TikTok',
  description:
    'Đọc bình luận bằng giọng nói, hiệu ứng quà tặng và overlay tương tác cho streamer TikTok LIVE.',
  openGraph: {
    title: 'LiveNova',
    description:
      'Đọc bình luận bằng giọng nói, hiệu ứng quà tặng và overlay tương tác cho streamer TikTok LIVE.',
    siteName: 'LiveNova',
    locale: 'vi_VN',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
