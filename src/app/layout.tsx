// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import BackToTop from './components/BackToTop'

export const metadata: Metadata = {
  title: '6S Audit MVM',
  description: 'Sistem audit 6S lingkungan kerja',
  viewport: 'width=device-width, initial-scale=1',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}<BackToTop /></body>
    </html>
  )
}
