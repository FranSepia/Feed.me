'use client'

import { useState } from 'react'
import { useCanvasStore, SOCIAL_PLATFORMS } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'

const PRESET_COLORS = [
  '#ede8de', '#f5f0e8', '#f7f3ec', '#ffffff',
  '#e8ede8', '#e8e8ed', '#1a1a1a', '#0d1117',
  '#0f0e17', '#1a0a2e', '#0a1628', '#16213e',
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
              <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Color del canvas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
                {PRESET_COLORS.map((color) => (
                  <button key={color} onClick={() => setBgColor(color)} style={{
                    width: '100%', aspectRatio: '1', borderRadius: '8px', background: color,
                    border: bgColor === color ? '2.5px solid #111' : '2px solid rgba(0,0,0,0.1)',
                    cursor: 'pointer', transition: 'border 0.15s',
                  }} />
                ))}
              </div>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ color: 'rgba(0,0,0,0.4)', fontSize: '12px' }}>Custom:</label>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', width: '36px', height: '26px' }} />
                <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px', fontFamily: 'monospace' }}>{bgColor}</span>
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
