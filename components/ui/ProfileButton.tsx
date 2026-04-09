'use client'

import { useState } from 'react'
import { useCanvasStore } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'

export function ProfileButton() {
  const showProfilePanel = useCanvasStore((s) => s.showProfilePanel)
  const setShowProfilePanel = useCanvasStore((s) => s.setShowProfilePanel)
  const readOnly = useCanvasStore((s) => s.readOnly)
  const [hover, setHover] = useState(false)
  const { isMobile } = useResponsive()

  if (readOnly) return null

  return (
    <button
      onClick={() => setShowProfilePanel(!showProfilePanel)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={showProfilePanel ? "Close Panel" : "Profile"}
      style={{
        position: 'fixed',
        bottom: isMobile ? '21px' : '29px',
        right: '24px',
        zIndex: 500,
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        borderTop: '1px solid rgba(255,255,255,0.90)',
        borderLeft: '1px solid rgba(255,255,255,0.90)',
        borderBottom: '1px solid rgba(180,180,180,0.35)',
        borderRight: '1px solid rgba(180,180,180,0.35)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition: 'all 0.18s',
        transform: hover ? 'scale(1.08)' : 'scale(1)',
        background: 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)',
        boxShadow: hover
          ? '4px 4px 10px rgba(0,0,0,0.12), -3px -3px 8px rgba(255,255,255,0.85)'
          : 'inset 2px 2px 6px rgba(160,160,160,0.35), inset -2px -2px 6px rgba(255,255,255,0.75)',
        color: 'rgba(68,72,96,0.80)',
        outline: 'none',
      }}
    >
      {showProfilePanel ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      )}
    </button>
  )
}
