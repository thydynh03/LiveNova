import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { themeInitScript } from '../lib/theme-script';
import { siteUrl, SITE_NAME, SITE_DESCRIPTION } from '../lib/site';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  // metadataBase makes every relative OG/canonical URL resolve correctly.
  // Without it Next warns, and social cards get relative image paths that no
  // crawler can fetch.
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — Tự động hoá livestream TikTok`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // The audited competitor had no description and no OG title on any page, so
  // every share into Facebook and Zalo — its own main distribution channels —
  // rendered a preview with no text at all. That is the mistake this avoids.
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
    languages: {
      'vi-VN': '/',
      'x-default': '/',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  // No `maximum-scale`: capping zoom is a WCAG 1.4.4 failure, and it was one of
  // the findings on the audited site.
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b12' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Must run before paint — see lib/theme-script.ts. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
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
