import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://fleekiprs.co.ke'),
  title: {
    default: 'Fleek IPRS — Instant Identity Verification for Africa',
    template: '%s | Fleek IPRS',
  },
  description:
    'Verify customer identities instantly against IPRS, KRA, telecom and mobile-money records. Built by Fleektech LTD for lenders, SACCOs and fintechs.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/brand/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Fleek IPRS — Instant Identity Verification for Africa',
    description: 'Identity. Verification. Intelligence.',
    images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'IPRS logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fleek IPRS — Instant Identity Verification for Africa',
    description: 'Identity. Verification. Intelligence.',
    images: ['/brand/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
