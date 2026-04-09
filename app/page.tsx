'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace('/editor')
    } else {
      router.replace('/login')
    }
  }, [user, loading, router])

  // Loading state while checking auth
  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
      }}>
        <div style={{
          fontSize: '28px', fontWeight: 700, color: 'white',
          letterSpacing: '-0.02em',
        }}>
          Feed<span style={{ color: 'rgba(255,255,255,0.4)' }}>.</span>Me
        </div>
        <div style={{
          width: '24px', height: '24px',
          border: '2.5px solid rgba(255,255,255,0.15)',
          borderTopColor: 'rgba(255,255,255,0.7)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
