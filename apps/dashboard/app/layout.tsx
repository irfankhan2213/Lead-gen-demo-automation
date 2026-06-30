import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Acquisition Engine — Evolve Expert Agency',
  description: 'Automated B2B lead generation, demo site builder, and cold outreach system for Evolve Expert Agency.',
  robots: 'noindex, nofollow', // Private internal tool
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='26' font-size='28'>🎯</text></svg>" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
