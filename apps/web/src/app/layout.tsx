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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
