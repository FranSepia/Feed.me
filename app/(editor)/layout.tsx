'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a',
      }}>
        <div style={{
          width: '24px', height: '24px',
          border: '2.5px solid rgba(255,255,255,0.15)',
          borderTopColor: 'rgba(255,255,255,0.7)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
