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
  const activeCount = filterTags.length

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
      }}>
        {/* Trigger button */}
        <button
          onClick={() => setOpen((v) => !v)}
          title="Filtrar por tag"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: activeCount > 0 ? '8px 14px 8px 12px' : '10px 14px',
            borderRadius: '50px',
            background: activeCount > 0
              ? 'linear-gradient(145deg, rgba(90,110,240,0.88), rgba(60,80,200,0.78))'
              : 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)',
            borderTop: activeCount > 0 ? '1px solid rgba(160,180,255,0.6)' : '1px solid rgba(255,255,255,0.90)',
            borderLeft: activeCount > 0 ? '1px solid rgba(160,180,255,0.6)' : '1px solid rgba(255,255,255,0.90)',
            borderBottom: activeCount > 0 ? '1px solid rgba(40,60,180,0.5)' : '1px solid rgba(180,180,180,0.35)',
            borderRight: activeCount > 0 ? '1px solid rgba(40,60,180,0.5)' : '1px solid rgba(180,180,180,0.35)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            cursor: 'pointer',
            color: activeCount > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(68,72,96,0.80)',
            fontSize: '13px', fontWeight: 600,
            boxShadow: activeCount > 0
              ? '3px 3px 8px rgba(40,60,180,0.25), -2px -2px 6px rgba(180,200,255,0.4)'
              : 'inset 2px 2px 6px rgba(160,160,160,0.35), inset -2px -2px 6px rgba(255,255,255,0.75)',
            outline: 'none',
            transition: 'all 0.15s',
          }}
        >
          <FunnelIcon active={activeCount > 0} />
          {activeCount > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 700 }}>{activeCount}</span>
          )}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            background: 'linear-gradient(160deg, rgba(255,255,255,0.90) 0%, rgba(245,245,245,0.80) 100%)',
            border: '1px solid rgba(255,255,255,0.9)',
            borderRadius: '18px',
            padding: '12px',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '160px',
            maxWidth: '260px',
            zIndex: 1,
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {allTags.map((tag) => {
                const active = filterTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: active
                        ? 'linear-gradient(135deg, rgba(90,110,240,0.85), rgba(60,80,200,0.75))'
                        : 'rgba(0,0,0,0.06)',
                      color: active ? 'white' : 'rgba(0,0,0,0.65)',
                      border: active
                        ? '1px solid rgba(120,140,255,0.5)'
                        : '1px solid rgba(0,0,0,0.10)',
                      outline: 'none',
                      transition: 'all 0.12s',
                    }}
                  >
                    #{tag}
                  </button>
                )
              })}
            </div>

            {activeCount > 0 && (
              <button
                onClick={() => { setFilterTags([]); setOpen(false) }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'rgba(0,0,0,0.38)',
                  border: '1px solid rgba(0,0,0,0.12)',
                  alignSelf: 'flex-start',
                  outline: 'none',
                }}
              >
                Limpiar filtro
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function FunnelIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="14" height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'rgba(255,255,255,0.95)' : 'rgba(68,72,96,0.80)'}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" />
    </svg>
  )
}
