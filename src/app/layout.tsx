import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pixeldrop.com';

export const metadata: Metadata = {
  title: {
    default: 'PixelDropp — Beautiful Digital Wallpapers',
    template: '%s | PixelDropp',
  },
  description:
    'Hand-crafted wallpapers for iPhone, desktop and beyond. Instant delivery to your inbox.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'PixelDropp',
    title: 'PixelDropp — Beautiful Digital Wallpapers',
    description:
      'Hand-crafted wallpapers for iPhone, desktop and beyond. Instant delivery to your inbox.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PixelDropp — Beautiful Digital Wallpapers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PixelDropp — Beautiful Digital Wallpapers',
    description:
      'Hand-crafted wallpapers for iPhone, desktop and beyond. Instant delivery to your inbox.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light');}catch(e){}})();` }} />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
