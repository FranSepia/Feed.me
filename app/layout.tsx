import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/lib/auth-context'
import { TouchBlocker } from '@/components/ui/TouchBlocker'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Feed.Me',
  description: 'Your personal 3D content canvas',
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
      <body>
        <TouchBlocker />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
