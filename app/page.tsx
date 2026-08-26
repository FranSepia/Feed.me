'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LandingCanvas } from '@/components/landing/LandingCanvas'

/**
 * Home is the landing canvas, and the landing canvas is where you sign in.
 *
 * Signed-in visitors never see it — for them this route is a stop on the way to
 * their own canvas, so it holds the splash until the redirect lands rather than
 * flashing a page that is trying to sell them something they already have.
 */
export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace('/editor')
  }, [user, loading, router])

  if (loading || user) return <Splash />

  return <LandingCanvas />
}

function Splash() {
  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '16px',
      // The landing's own background, so arriving is a fade rather than a flash
      background: '#ede8de',
    }}>
      <div style={{
        fontSize: '28px', fontWeight: 700, color: 'rgba(43,46,60,0.93)', letterSpacing: '-0.03em',
      }}>
        Feed<span style={{ color: 'rgba(50,54,78,0.34)' }}>.</span>Me
      </div>
      <div style={{
        width: '22px', height: '22px',
        border: '2.5px solid rgba(50,54,78,0.15)',
        borderTopColor: 'rgba(50,54,78,0.6)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
