import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import FrameProtection from '@/components/ui/frame-protection'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LocalGuru',
  description: 'Your local guide to everything',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <FrameProtection />
        {children}
      </body>
    </html>
  )
} 