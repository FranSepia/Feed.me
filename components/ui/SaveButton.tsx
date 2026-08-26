'use client'

import { useState } from 'react'

// Shares the neumorphic language of the AquaButtons in BottomBar so the save
// action doesn't look bolted on. Kept in one place because it is used by both
// the node editor and the socials panel.

interface SaveButtonProps {
  onClick: () => void
  saving?: boolean
  saved?: boolean
  error?: string | null
  label?: string
  fullWidth?: boolean
}

export function SaveButton({
  onClick,
  saving = false,
  saved = false,
  error = null,
  label = 'Save',
  fullWidth = false,
}: SaveButtonProps) {
  const [hovered, setHovered] = useState(false)

  const text = saving ? 'Guardando…' : error ? `✕ ${error}` : saved ? '✓ Guardado' : label

  const tint = error
    ? { fg: 'rgba(170,45,45,0.95)', bg: 'linear-gradient(145deg, rgba(255,238,238,0.85) 0%, rgba(245,215,215,0.65) 100%)' }
    : saved
      ? { fg: 'rgba(30,110,65,0.95)', bg: 'linear-gradient(145deg, rgba(235,250,240,0.88) 0%, rgba(215,240,225,0.65) 100%)' }
      : { fg: 'rgba(50,54,78,0.95)', bg: 'linear-gradient(145deg, rgba(255,255,255,0.78) 0%, rgba(230,232,238,0.58) 100%)' }

  return (
    <button
      onClick={saving ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={saving}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '7px',
        padding: '9px 22px',
        width: fullWidth ? '100%' : undefined,
        borderRadius: '50px',
        border: '1px solid rgba(255,255,255,0.82)',
        borderTop: '1px solid rgba(255,255,255,0.95)',
        borderLeft: '1px solid rgba(255,255,255,0.95)',
        borderBottom: '1px solid rgba(180,185,205,0.5)',
        borderRight: '1px solid rgba(180,185,205,0.5)',
        cursor: saving ? 'default' : 'pointer',
        transition: 'all 0.16s ease',
        transform: hovered && !saving ? 'translateY(-1px)' : 'translateY(0)',
        background: tint.bg,
        boxShadow: hovered && !saving
          ? '4px 4px 10px rgba(120,125,140,0.34), -2px -2px 7px rgba(255,255,255,0.75)'
          : '3px 3px 8px rgba(120,125,140,0.30), -2px -2px 6px rgba(255,255,255,0.70)',
        color: tint.fg,
        fontSize: '13px',
        fontWeight: 600,
        letterSpacing: '0.01em',
        outline: 'none',
        opacity: saving ? 0.75 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {saving && <Spinner />}
      {text}
    </button>
  )
}

function Spinner() {
  return (
    <span
      style={{
        width: '12px', height: '12px', borderRadius: '50%',
        border: '2px solid rgba(50,54,78,0.25)',
        borderTopColor: 'rgba(50,54,78,0.8)',
        animation: 'savebtn-spin 0.7s linear infinite',
        display: 'inline-block', flexShrink: 0,
      }}
    >
      <style>{`@keyframes savebtn-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  )
}
