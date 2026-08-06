import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { themeInitScript } from '../lib/theme-script';
import { siteUrl, SITE_NAME, SITE_DESCRIPTION } from '../lib/site';
import './globals.css';

/**
 * Be Vietnam Pro, not Inter.
 *
 * Inter is the font every AI-generated interface reaches for, and more to the
 * point it was not drawn with Vietnamese in mind: stacked diacritics on capital
 * letters collide at display sizes, which is unavoidable in a product whose
 * entire interface and audience are Vietnamese. Be Vietnam Pro was designed for
 * this script, so the marks sit correctly at every weight.
 *
 * One family across display and body, separated by weight rather than by
 * mixing two typefaces. Mixed-family emphasis is the amateur move.
 */
const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

/** Numbers only: coin counts and credit balances jitter in proportional figures. */
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — Tự động hoá livestream TikTok`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'livestream TikTok',
    'đọc bình luận livestream',
    'hiệu ứng quà tặng TikTok',
    'overlay OBS',
    'tự động hoá livestream',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Tự động hoá livestream TikTok`,
    description: SITE_DESCRIPTION,
    locale: 'vi_VN',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Tự động hoá livestream TikTok`,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: '/',
    languages: { 'vi-VN': '/', 'x-default': '/' },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  // No maximum-scale: capping zoom fails WCAG 1.4.4.
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdf8f6' },
    { media: '(prefers-color-scheme: dark)', color: '#161311' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Runs before paint so a dark-mode visitor never sees a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Bỏ qua điều hướng
        </a>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
