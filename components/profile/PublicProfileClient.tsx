'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { FilterButton } from '@/components/ui/FilterButton'
import { PublicBanner } from '@/components/ui/PublicBanner'
import { useCanvasStore } from '@/lib/store'
import type { Profile } from '@/lib/auth-context'

const Canvas3D = dynamic(
  () => import('@/components/canvas/Canvas3D').then((mod) => mod.Canvas3D),
  { ssr: false }
)

export function PublicProfileClient({ profile }: { profile: Profile }) {
  const [loading, setLoading] = useState(true)

  const loadFromSupabase = useCanvasStore((s) => s.loadFromSupabase)
  const setUserId = useCanvasStore((s) => s.setUserId)
  const setReadOnly = useCanvasStore((s) => s.setReadOnly)
  const setBgColor = useCanvasStore((s) => s.setBgColor)
  const resetCanvas = useCanvasStore((s) => s.resetCanvas)

  useEffect(() => {
    const init = async () => {
      // Load canvas in read-only mode
      resetCanvas()
      setUserId(profile.id)
      setReadOnly(true)
      setBgColor(profile.bg_color || '#ede8de')
      await loadFromSupabase(profile.id)
      setLoading(false)
    }

    init()
  }, [profile]) // Re-run if profile changes

  // We immediately return the HTML frame so the user isn't stuck on a black screen.
  // The Canvas3D will take a bit to render.
  return (
    <main className="w-full h-screen relative" style={{ background: profile.bg_color || '#ede8de' }}>
      {/* Username header — neumorphic glass chip */}
      <div style={{
        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 200, display: 'flex', alignItems: 'center', gap: '8px',
        background: 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.90)',
        borderLeft: '1px solid rgba(255,255,255,0.90)',
        borderBottom: '1px solid rgba(180,180,180,0.35)',
        borderRight: '1px solid rgba(180,180,180,0.35)',
        borderRadius: '50px',
        padding: profile.avatar_url ? '5px 20px 5px 5px' : '8px 20px',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        boxShadow: '0 6px 28px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}>
        {profile.avatar_url && (
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: `url(${profile.avatar_url}) center/cover`,
            border: '1px solid rgba(255,255,255,0.6)',
            flexShrink: 0,
          }} />
        )}
        <span style={{ color: 'rgba(68,72,96,0.45)', fontSize: '14px' }}>@</span>
        <span style={{ color: 'rgba(50,54,78,0.90)', fontSize: '14px', fontWeight: 600 }}>
          {profile.display_name || profile.username}
        </span>
      </div>

      <Canvas3D />
      <FilterButton />
      <PublicBanner />
        
      {/* Loading overlay for the 3D canvas */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: profile.bg_color || '#ede8de',
        }}>
          <div style={{
            width: '24px', height: '24px',
            border: '2.5px solid rgba(0,0,0,0.15)',
            borderTopColor: 'rgba(0,0,0,0.7)',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </main>
  )
}
