import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Opportunity Radar — Live Opportunities for Indian College Students',
  description:
    'Discover currently open internships, hackathons, competitions, scholarships, fellowships and open-source programs matching your profile from 20 trusted Indian & global sources using live web data.',
  keywords: [
    'internships India',
    'student hackathons',
    'engineering scholarships',
    'fellowships 2026',
    'open source programs',
    'opportunity radar',
  ],
  authors: [{ name: 'Opportunity Radar' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
