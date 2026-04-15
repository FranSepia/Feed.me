'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useResponsive } from '@/lib/useResponsive'
import { useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'

export function PublicBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { isMobile } = useResponsive()
  const bgColor = useCanvasStore((s) => s.bgColor)
  const light = isLightBg(bgColor)

  if (dismissed) return null

  // Adaptive colors: dark text on light bg, light text on dark bg
  const textColor = light ? 'rgba(50,54,78,0.65)' : 'rgba(255,255,255,0.7)'
  const boldColor = light ? 'rgba(50,54,78,0.90)' : 'rgba(255,255,255,0.95)'
  const dismissColor = light ? 'rgba(50,54,78,0.35)' : 'rgba(255,255,255,0.3)'

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? '16px' : '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 500,
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '10px' : '16px',
      // Same neumorphic glass as BottomBar buttons
      background: light
        ? 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)'
        : 'linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)',
      borderTop: light ? '1px solid rgba(255,255,255,0.90)' : '1px solid rgba(255,255,255,0.12)',
      borderLeft: light ? '1px solid rgba(255,255,255,0.90)' : '1px solid rgba(255,255,255,0.12)',
      borderBottom: light ? '1px solid rgba(180,180,180,0.35)' : '1px solid rgba(255,255,255,0.06)',
      borderRight: light ? '1px solid rgba(180,180,180,0.35)' : '1px solid rgba(255,255,255,0.06)',
      borderRadius: '60px',
      padding: isMobile ? '10px 16px' : '12px 24px',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      boxShadow: light
        ? '0 6px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.85)'
        : '0 6px 28px rgba(0,0,0,0.15)',
      maxWidth: isMobile ? 'calc(100vw - 24px)' : '600px',
      width: isMobile ? 'calc(100vw - 24px)' : 'auto',
    }}>
      <div style={{
        color: textColor,
        fontSize: isMobile ? '11px' : '13px',
        fontWeight: 400,
        lineHeight: 1.4,
        fontStyle: 'italic',
        flex: 1,
        minWidth: 0,
      }}>
        <span style={{ color: boldColor, fontWeight: 600, fontStyle: 'normal' }}>
          No likes, no followers.
        </span>{' '}
        Just You Being You.{' '}
        <span style={{ fontWeight: 600, fontStyle: 'normal' }}>Feed.Me</span>
      </div>

      <Link href="/register" style={{
        padding: isMobile ? '8px 16px' : '9px 20px',
        borderRadius: '50px',
        background: light
          ? 'linear-gradient(145deg, rgba(255,255,255,0.72) 0%, rgba(230,232,238,0.55) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(230,230,230,0.9) 100%)',
        boxShadow: light
          ? '3px 3px 8px rgba(120,125,140,0.30), -2px -2px 6px rgba(255,255,255,0.70)'
          : '0 2px 8px rgba(0,0,0,0.2)',
        border: light ? '1px solid rgba(255,255,255,0.82)' : 'none',
        color: light ? 'rgba(50,54,78,0.95)' : '#111',
        fontSize: isMobile ? '11px' : '13px',
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'transform 0.15s',
        flexShrink: 0,
      }}>
        Create yours
      </Link>

      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          color: dismissColor,
          cursor: 'pointer',
          fontSize: '16px',
          padding: '2px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
