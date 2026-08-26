import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/lib/auth-context'
import { TouchBlocker } from '@/components/ui/TouchBlocker'
// Analítica DataFast — para quitarla, borra esta línea, la de <DataFast /> más
// abajo, y el archivo components/analytics/DataFast.tsx. Nada más depende de él.
import { DataFast } from '@/components/analytics/DataFast'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Feed.Me',
  description:
    'A 3D canvas for the things that matter to you: photos, videos, songs, notes and links. ' +
    'No feed, no algorithm, no followers. Your space, at one link.',
  icons: {
    icon: '/icons/FeedMe_logo-removebg-32x32.png',
    apple: '/icons/FeedMe_logo-removebg-32x32.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Analítica DataFast — borra esta línea y components/analytics/DataFast.tsx para quitarla */}
        <DataFast />
      </head>
      <body>
        <TouchBlocker />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
