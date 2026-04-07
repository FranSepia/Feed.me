'use client'

import { useState } from 'react'
import { useCanvasStore } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'

export function EditModeButton() {
  const editMode = useCanvasStore((s) => s.editMode)
  const setEditMode = useCanvasStore((s) => s.setEditMode)
  const [hover, setHover] = useState(false)
  const { isMobile } = useResponsive()

  return (
    <button
      onClick={() => setEditMode(!editMode)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={editMode ? 'Exit edit mode' : 'Edit mode'}
      style={{
        position: 'fixed',
        bottom: isMobile ? '90px' : '24px',
        left: '24px',
        zIndex: 100,
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        border: editMode
          ? '1.5px solid rgba(255,180,0,0.5)'
          : '1.5px solid rgba(255,255,255,0.12)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transition: 'all 0.18s',
        transform: hover ? 'scale(1.08)' : 'scale(1)',
        // Aqua glassy style matching the bar
        background: editMode
          ? [
              'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 52%)',
              'linear-gradient(175deg, #ffb300 0%, #e65c00 100%)',
            ].join(', ')
          : [
              'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 52%)',
              'linear-gradient(175deg, rgba(60,60,60,0.55) 0%, rgba(15,15,15,0.7) 100%)',
            ].join(', '),
        boxShadow: editMode
          ? '0 4px 18px rgba(255,150,0,0.4), 0 1px 4px rgba(0,0,0,0.4)'
          : '0 2px 10px rgba(0,0,0,0.4)',
        color: editMode ? 'white' : 'rgba(255,255,255,0.45)',
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
