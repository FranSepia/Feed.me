'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Nothing at this address — the home canvas is the only useful place to be. */
export default function NotFound() {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/'), 1200)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#ede8de',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '12px', padding: '24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '26px', fontWeight: 700, color: 'rgba(43,46,60,0.93)', letterSpacing: '-0.03em' }}>
        Feed<span style={{ color: 'rgba(50,54,78,0.34)' }}>.</span>Me
      </div>
      <div style={{ color: 'rgba(50,54,78,0.6)', fontSize: '14px' }}>
        Nothing lives at this address. Taking you home…
      </div>
    </div>
  )
}
