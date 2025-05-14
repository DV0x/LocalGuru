import './globals.css';
import { Providers } from './providers';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6F1ED6',
};

export const metadata = {
  title: 'LocalGuru PWA',
  description: 'Mobile experience for LocalGuru',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LocalGuru'
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="max-w-md mx-auto bg-background min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
} 