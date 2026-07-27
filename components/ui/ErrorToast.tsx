'use client'

import { useEffect } from 'react'
import { useCanvasStore } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'

// Surfaces failed writes. Without this the store's rollbacks would be invisible:
// a node would just pop off the canvas with no explanation.
export function ErrorToast() {
  const lastError = useCanvasStore((s) => s.lastError)
  const setLastError = useCanvasStore((s) => s.setLastError)
  const { isMobile } = useResponsive()

  useEffect(() => {
    if (!lastError) return
    const timer = setTimeout(() => setLastError(null), 6000)
    return () => clearTimeout(timer)
  }, [lastError, setLastError])

  if (!lastError) return null

  return (
    <div
      role="alert"
      onClick={() => setLastError(null)}
      style={{
        position: 'fixed',
        top: isMobile ? '16px' : '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 900,
        maxWidth: isMobile ? 'calc(100vw - 32px)' : '420px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 18px',
        borderRadius: '16px',
        background: 'linear-gradient(160deg, rgba(255,240,240,0.92) 0%, rgba(250,225,225,0.86) 100%)',
        border: '1px solid rgba(200,60,60,0.30)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        color: 'rgba(150,30,30,0.95)',
        fontSize: '13px',
        fontWeight: 500,
        lineHeight: 1.4,
        cursor: 'pointer',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" />
      </svg>
      <span>{lastError}</span>
    </div>
  )
}
