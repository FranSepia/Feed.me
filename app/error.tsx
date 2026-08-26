'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * What a visitor sees when a canvas breaks under them.
 *
 * Someone else's profile failing is not their problem to solve, so after a few
 * seconds they are taken home, where there is always something to do — read what
 * this is, or sign in. The exception is the home canvas breaking: sending it
 * back to itself would be a loop, so there it only offers to retry.
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [atHome, setAtHome] = useState(true)

  useEffect(() => {
    console.error('[Feed.Me] Route error:', error)
  }, [error])

  useEffect(() => {
    const home = window.location.pathname === '/'
    setAtHome(home)
    if (home) return
    const timer = setTimeout(() => router.replace('/'), 5000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#ede8de',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '14px', padding: '24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '26px', fontWeight: 700, color: 'rgba(43,46,60,0.93)', letterSpacing: '-0.03em' }}>
        Feed<span style={{ color: 'rgba(50,54,78,0.34)' }}>.</span>Me
      </div>
      <div style={{ color: 'rgba(50,54,78,0.72)', fontSize: '15px', maxWidth: '340px', lineHeight: 1.55 }}>
        Something broke on this screen.
        {!atHome && ' Taking you home in a moment.'}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button onClick={reset} style={quietButton}>Try again</button>
        <button onClick={() => router.replace('/')} style={solidButton}>Go home</button>
      </div>
    </div>
  )
}

const quietButton: React.CSSProperties = {
  padding: '11px 22px', borderRadius: '12px', cursor: 'pointer',
  background: 'rgba(43,46,60,0.07)', border: '1px solid rgba(120,125,145,0.20)',
  color: 'rgba(43,46,60,0.9)', fontSize: '14px', fontWeight: 500,
}

const solidButton: React.CSSProperties = {
  padding: '11px 22px', borderRadius: '12px', cursor: 'pointer', border: 'none',
  background: 'linear-gradient(135deg, #2f3342 0%, #1e212c 100%)',
  color: '#f2efe7', fontSize: '14px', fontWeight: 600,
}
