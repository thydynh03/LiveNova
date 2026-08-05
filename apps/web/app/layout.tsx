import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '../context/ThemeContext';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'TikTok LIVE Auto - Premium Automation Platform',
  description: 'Automate your TikTok LIVE streams with TTS, interactive overlays, and advanced rules.',
  openGraph: {
    title: 'TikTok LIVE Auto',
    description: 'Automate your TikTok LIVE streams with TTS, interactive overlays, and advanced rules.',
    url: 'https://tiktokliveauto.com',
    siteName: 'TikTok LIVE Auto',
    images: [
      {
        url: 'https://tiktokliveauto.com/og.jpg',
        width: 1200,
        height: 630,
      }
    ],
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
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
