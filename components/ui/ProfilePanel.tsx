'use client'

import { useState, useRef } from 'react'
import { useCanvasStore, SOCIAL_PLATFORMS } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
  const readOnly = useCanvasStore((s) => s.readOnly)
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const { isMobile } = useResponsive()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const router = useRouter()

  if (!showProfilePanel || readOnly) return null

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !supabase || !user) return

    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `avatars/${user.id}.${ext}`

      // Upload (upsert to overwrite existing)
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage.from('media').getPublicUrl(path)
      const avatarUrl = data.publicUrl + `?t=${Date.now()}` // cache bust

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)
      if (updateError) throw updateError

      await refreshProfile()
    } catch (err) {
      console.error('Avatar upload error:', err)
      alert('Error al subir la foto de perfil')
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <>
      <div 
        onClick={() => setShowProfilePanel(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 199, background: 'transparent'
        }}
      />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: isMobile ? '100%' : '320px',
        // Neumorphic glass panel matching BottomBar aesthetic
        background: 'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(245,243,238,0.65) 100%)',
        borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.90)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.10), inset 1px 0 0 rgba(255,255,255,0.85)',
      }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['profile', 'socials'] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: activeTab === tab
                ? 'linear-gradient(145deg, rgba(255,255,255,0.72) 0%, rgba(230,232,238,0.55) 100%)'
                : 'transparent',
              boxShadow: activeTab === tab
                ? '3px 3px 8px rgba(120,125,140,0.20), -2px -2px 6px rgba(255,255,255,0.70)'
                : 'none',
              border: activeTab === tab ? '1px solid rgba(255,255,255,0.82)' : '1px solid transparent',
              borderRadius: '50px',
              padding: '7px 14px',
              color: activeTab === tab ? 'rgba(50,54,78,0.95)' : 'rgba(50,54,78,0.45)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {tab === 'profile' ? 'Perfil' : 'Redes'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Avatar + upload */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
              <div
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: profile?.avatar_url
                    ? `url(${profile.avatar_url}) center/cover`
                    : 'linear-gradient(135deg, rgba(200,195,185,0.5) 0%, rgba(180,175,165,0.3) 100%)',
                  border: '2px solid rgba(255,255,255,0.7)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)',
                  display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {avatarUploading ? (
                  <div style={{
                    width: '20px', height: '20px',
                    border: '2px solid rgba(50,54,78,0.2)',
                    borderTopColor: 'rgba(50,54,78,0.7)',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                ) : !profile?.avatar_url ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(50,54,78,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                ) : null}
                {/* Camera overlay on hover */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.15s',
                  borderRadius: '50%',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </div>
              <div style={{ color: 'rgba(50,54,78,0.90)', fontSize: '16px', fontWeight: 600 }}>
                {profile?.display_name || profile?.username || 'User'}
              </div>
              <div style={{ color: 'rgba(50,54,78,0.45)', fontSize: '13px' }}>
                @{profile?.username || '...'}
              </div>
            </div>

            {/* Canvas color */}
            <div>
              <div style={{
                color: 'rgba(50,54,78,0.45)', fontSize: '11px', marginBottom: '12px',
                textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
              }}>
                Color del canvas
              </div>
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
                        ? '2.5px solid rgba(50,54,78,0.8)'
                        : '1.5px solid rgba(0,0,0,0.12)',
                      cursor: 'pointer',
                      transition: 'border 0.15s, transform 0.12s',
                      transform: bgColor === c.hex ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: bgColor === c.hex ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                    }}
                  />
                ))}
                <label
                  title="Color personalizado"
                  style={{
                    flex: 1, height: '40px', borderRadius: '10px', cursor: 'pointer',
                    border: !PRESET_COLORS.some(c => c.hex === bgColor)
                      ? '2.5px solid rgba(50,54,78,0.8)'
                      : '1.5px solid rgba(0,0,0,0.12)',
                    background: !PRESET_COLORS.some(c => c.hex === bgColor) ? bgColor : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', position: 'relative',
                    transition: 'border 0.15s',
                    boxShadow: !PRESET_COLORS.some(c => c.hex === bgColor) ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(50,54,78,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                <span style={{ color: 'rgba(50,54,78,0.3)', fontSize: '10px', fontFamily: 'monospace' }}>{bgColor}</span>
              </div>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '50px',
                // Neumorphic sunken style
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.55)',
                boxShadow: 'inset 1px 1px 4px rgba(140,145,160,0.35), inset -1px -1px 4px rgba(255,255,255,0.55)',
                color: 'rgba(180,60,60,0.75)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Cerrar sesión
            </button>
          </div>
        )}

        {activeTab === 'socials' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ color: 'rgba(50,54,78,0.45)', fontSize: '12px', marginBottom: '4px' }}>
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
                    border: socials[p.key] ? `1px solid ${p.color}66` : '1px solid rgba(50,54,78,0.12)',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
    </>
  )
}

const fieldStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(50,54,78,0.12)',
  borderRadius: '50px',
  padding: '10px 14px',
  color: 'rgba(50,54,78,0.85)',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
}
