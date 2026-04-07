import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Feed.Me',
  description: 'Your personal 3D content canvas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
