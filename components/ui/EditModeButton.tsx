'use client'

import { useState } from 'react'
import { useCanvasStore } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'

export function EditModeButton() {
  const editMode = useCanvasStore((s) => s.editMode)
  const setEditMode = useCanvasStore((s) => s.setEditMode)
  const readOnly = useCanvasStore((s) => s.readOnly)
  const [hover, setHover] = useState(false)
  const { isMobile } = useResponsive()

  if (readOnly) return null

  return (
    <button
      onClick={() => setEditMode(!editMode)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={editMode ? 'Exit Edit Mode' : 'Edit Mode'}
      style={{
        position: 'fixed',
        bottom: isMobile ? '21px' : '29px',
        left: '24px',
        zIndex: 500,
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        borderTop: editMode ? '1px solid rgba(255,220,100,0.9)' : '1px solid rgba(255,255,255,0.90)',
        borderLeft: editMode ? '1px solid rgba(255,220,100,0.9)' : '1px solid rgba(255,255,255,0.90)',
        borderBottom: editMode ? '1px solid rgba(180,120,0,0.4)' : '1px solid rgba(180,180,180,0.35)',
        borderRight: editMode ? '1px solid rgba(180,120,0,0.4)' : '1px solid rgba(180,180,180,0.35)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition: 'all 0.18s',
        transform: editMode ? 'translateY(-1px)' : hover ? 'scale(1.05)' : 'scale(1)',
        background: editMode
          ? 'linear-gradient(145deg, rgba(255,220,100,0.92) 0%, rgba(220,150,20,0.82) 100%)'
          : 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)',
        boxShadow: editMode
          ? '4px 4px 10px rgba(140,100,0,0.3), -3px -3px 8px rgba(255,240,180,0.7)'
          : 'inset 2px 2px 6px rgba(160,160,160,0.35), inset -2px -2px 6px rgba(255,255,255,0.75)',
        color: editMode ? 'rgba(80,45,0,0.95)' : 'rgba(68,72,96,0.80)',
      }}
    >
      {editMode ? <IconPencilActive /> : <IconPencil />}
    </button>
  )
}

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconPencilActive() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      <line x1="5" y1="19" x2="19" y2="19" strokeOpacity="0.5" />
    </svg>
  )
}
