'use client'

import { useState } from 'react'
import { useCanvasStore, SOCIAL_PLATFORMS } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'

const PRESET_COLORS = [
  { hex: '#ede8de', label: 'Beige' },
  { hex: '#ffffff', label: 'Blanco' },
  { hex: '#000000', label: 'Negro' },
]

type Tab = 'profile' | 'socials'

export function ProfilePanel() {
  const showProfilePanel = useCanvasStore((s) => s.showProfilePanel)
  const setShowProfilePanel = useCanvasStore((s) => s.setShowProfilePanel)
  const bgColor = useCanvasStore((s) => s.bgColor)
  const setBgColor = useCanvasStore((s) => s.setBgColor)
  const socials = useCanvasStore((s) => s.socials)
  const setSocial = useCanvasStore((s) => s.setSocial)
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const { isMobile } = useResponsive()

  if (!showProfilePanel) return null

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0,
      width: isMobile ? '100%' : '300px',
      background: 'rgba(252,249,244,0.97)',
      borderLeft: isMobile ? 'none' : '1px solid rgba(0,0,0,0.08)',
      backdropFilter: 'blur(24px)', zIndex: 200,
      display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['profile', 'socials'] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: activeTab === tab ? 'rgba(0,0,0,0.08)' : 'transparent',
              border: 'none', borderRadius: '8px', padding: '6px 12px',
              color: activeTab === tab ? '#111' : 'rgba(0,0,0,0.4)',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {tab === 'profile' ? 'Perfil' : 'Redes'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowProfilePanel(false)} style={{
          background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)',
          cursor: 'pointer', fontSize: '22px', lineHeight: 1,
        }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.06)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '28px',
              }}>
                👤
              </div>
              <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: '14px' }}>@username</div>
            </div>

            {/* Canvas color */}
            <div>
              <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: '11px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Color del canvas
              </div>
              {/* 3 presets + custom picker as one unified row */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => setBgColor(c.hex)}
                    title={c.label}
                    style={{
                      flex: 1,
                      height: '40px',
                      borderRadius: '10px',
                      background: c.hex,
                      border: bgColor === c.hex
                        ? '2.5px solid #111'
                        : '1.5px solid rgba(0,0,0,0.12)',
                      cursor: 'pointer',
                      transition: 'border 0.15s, transform 0.12s',
                      transform: bgColor === c.hex ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: bgColor === c.hex ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                    }}
                  />
                ))}
                {/* Custom color — styled to look like a 4th chip */}
                <label
                  title="Color personalizado"
                  style={{
                    flex: 1, height: '40px', borderRadius: '10px', cursor: 'pointer',
                    border: !PRESET_COLORS.some(c => c.hex === bgColor)
                      ? '2.5px solid #111'
                      : '1.5px solid rgba(0,0,0,0.12)',
                    background: !PRESET_COLORS.some(c => c.hex === bgColor) ? bgColor : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', position: 'relative',
                    transition: 'border 0.15s',
                    boxShadow: !PRESET_COLORS.some(c => c.hex === bgColor) ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                </label>
              </div>
              <div style={{ marginTop: '8px', textAlign: 'right' }}>
                <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: '10px', fontFamily: 'monospace' }}>{bgColor}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'socials' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '12px', marginBottom: '4px' }}>
              Agrega tus redes sociales.
            </p>
            {SOCIAL_PLATFORMS.map((p) => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                  background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: p.key === 'snapchat' ? '#000' : '#fff',
                }}>
                  {p.icon}
                </div>
                <input
                  placeholder={p.label}
                  value={socials[p.key] ?? ''}
                  onChange={(e) => setSocial(p.key, e.target.value)}
                  style={{
                    ...fieldStyle,
                    border: socials[p.key] ? `1px solid ${p.color}66` : '1px solid rgba(0,0,0,0.1)',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.04)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: '9px',
  padding: '10px 12px',
  color: '#111',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
}
