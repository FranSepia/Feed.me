'use client'

import { useState } from 'react'
import { useResponsive } from '@/lib/useResponsive'
import { useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'

interface Props {
  username?: string
}

export function ShareButton({ username }: Props) {
  const [copied, setCopied] = useState(false)
  const [hover, setHover] = useState(false)
  const { isMobile } = useResponsive()
  const bgColor = useCanvasStore((s) => s.bgColor)
  const light = isLightBg(bgColor)

  if (!username) return null

  const handleCopy = async () => {
    const url = `${window.location.origin}/${username}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }
  }

  // Toast colors — adaptive to bg
  const toastBg = light
    ? 'linear-gradient(160deg, rgba(255,255,255,0.72) 0%, rgba(240,240,240,0.55) 100%)'
    : 'rgba(255,255,255,0.12)'
  const toastBorder = light ? '1px solid rgba(255,255,255,0.85)' : '1px solid rgba(255,255,255,0.18)'
  const toastColor = light ? 'rgba(50,54,78,0.90)' : 'rgba(255,255,255,0.85)'
  const toastShadow = light
    ? '3px 3px 10px rgba(120,125,140,0.25), -2px -2px 6px rgba(255,255,255,0.70)'
    : '0 4px 16px rgba(0,0,0,0.3)'

  return (
    <div style={{
      position: 'fixed',
      top: isMobile ? '16px' : '24px',
      right: '24px',
      zIndex: 500,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      {copied && (
        <div style={{
          background: toastBg,
          border: toastBorder,
          borderRadius: '50px',
          padding: '8px 16px',
          color: toastColor,
          fontSize: '13px',
          fontWeight: 600,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: toastShadow,
          animation: 'fadeInOut 2.2s ease',
          whiteSpace: 'nowrap',
        }}>
          Link copied! 🎉
        </div>
      )}
      <button
        onClick={handleCopy}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Share your Feed.Me"
        style={{
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>
      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(8px); }
          15% { opacity: 1; transform: translateX(0); }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
