'use client'

import { useState } from 'react'
import { useCanvasStore } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'

export function FilterButton() {
  const [open, setOpen] = useState(false)
  const filterTags = useCanvasStore((s) => s.filterTags)
  const setFilterTags = useCanvasStore((s) => s.setFilterTags)
  const nodes = useCanvasStore((s) => s.nodes)
  const { isMobile } = useResponsive()

  const allTags = Array.from(new Set(nodes.flatMap((n) => n.tags))).sort()
  const isActive = filterTags.length > 0

  const toggleTag = (tag: string) => {
    setFilterTags(
      filterTags.includes(tag)
        ? filterTags.filter((t) => t !== tag)
        : [...filterTags, tag]
    )
  }

  if (allTags.length === 0) return null

  return (
    <>
      {/* Backdrop to close dropdown */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 498 }}
        />
      )}

      <div style={{
        position: 'fixed',
        top: isMobile ? '16px' : '24px',
        left: '24px',
        zIndex: 499,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
      }}>

        {/* Trigger button — identical glass style to EditModeButton/ProfileButton */}
        <button
          onClick={() => setOpen((v) => !v)}
          title="Filtrar por tag"
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
            transform: (isActive || open) ? 'translateY(-1px)' : 'scale(1)',
            background: 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)',
            boxShadow: (isActive || open)
              ? '4px 4px 10px rgba(0,0,0,0.12), -3px -3px 8px rgba(255,255,255,0.85)'
              : 'inset 2px 2px 6px rgba(160,160,160,0.35), inset -2px -2px 6px rgba(255,255,255,0.75)',
            color: 'rgba(68,72,96,0.80)',
            outline: 'none',
          }}
        >
          <FunnelIcon />
        </button>

        {/* Active selected tags — always visible, no container, just chips */}
        {isActive && !open && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
            {filterTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                title="Quitar filtro"
                style={chipStyle(true)}
              >
                #{tag} ×
              </button>
            ))}
          </div>
        )}

        {/* All tags shown when dropdown is open — no container, just chips */}
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
            {allTags.map((tag) => {
              const active = filterTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={chipStyle(active)}
                >
                  {active ? `#${tag} ×` : `#${tag}`}
                </button>
              )
            })}
            {isActive && (
              <button
                onClick={() => { setFilterTags([]); setOpen(false) }}
                style={{
                  marginTop: '2px',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'rgba(68,72,96,0.50)',
                  border: '1px solid rgba(68,72,96,0.18)',
                  backdropFilter: 'blur(12px)',
                  outline: 'none',
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    transition: 'all 0.15s',
    outline: 'none',
    background: active
      ? 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)'
      : 'linear-gradient(160deg, rgba(255,255,255,0.50) 0%, rgba(235,235,235,0.38) 100%)',
    borderTop: '1px solid rgba(255,255,255,0.90)',
    borderLeft: '1px solid rgba(255,255,255,0.90)',
    borderBottom: '1px solid rgba(180,180,180,0.35)',
    borderRight: '1px solid rgba(180,180,180,0.35)',
    boxShadow: active
      ? '3px 3px 8px rgba(0,0,0,0.10), -2px -2px 6px rgba(255,255,255,0.80)'
      : 'inset 1px 1px 4px rgba(140,145,160,0.30), inset -1px -1px 3px rgba(255,255,255,0.55)',
    color: active ? 'rgba(50,54,78,0.95)' : 'rgba(68,72,96,0.60)',
    transform: active ? 'translateY(-1px)' : 'translateY(0)',
  }
}

function FunnelIcon() {
  return (
    <svg
      width="16" height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" />
    </svg>
  )
}
