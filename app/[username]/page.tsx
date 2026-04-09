'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Canvas3D } from '@/components/canvas/Canvas3D'
import { FilterButton } from '@/components/ui/FilterButton'
import { PublicBanner } from '@/components/ui/PublicBanner'
import { useCanvasStore } from '@/lib/store'
import type { Profile } from '@/lib/auth-context'

export default function PublicProfilePage() {
  const params = useParams()
  const username = params.username as string
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadFromSupabase = useCanvasStore((s) => s.loadFromSupabase)
  const setUserId = useCanvasStore((s) => s.setUserId)
  const setReadOnly = useCanvasStore((s) => s.setReadOnly)
  const setBgColor = useCanvasStore((s) => s.setBgColor)
  const resetCanvas = useCanvasStore((s) => s.resetCanvas)

  useEffect(() => {
    if (!supabase || !username) return

    const loadProfile = async () => {
      if (!supabase) { setNotFound(true); setLoading(false); return }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .maybeSingle()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const p: Profile = {
        id: data.id,
        username: data.username,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        bio: data.bio,
        bg_color: data.bg_color ?? '#ede8de',
      }
      setProfile(p)

      // Load canvas in read-only mode
      resetCanvas()
      setUserId(p.id)
      setReadOnly(true)
      setBgColor(p.bg_color)
      await loadFromSupabase(p.id)
      setLoading(false)
    }

    loadProfile()
  }, [username])

  if (loading) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
        }}>
          <div style={{
            fontSize: '24px', fontWeight: 700, color: 'white',
            letterSpacing: '-0.02em',
          }}>
            Feed<span style={{ color: 'rgba(255,255,255,0.4)' }}>.</span>Me
          </div>
          <div style={{
            width: '24px', height: '24px',
            border: '2.5px solid rgba(255,255,255,0.15)',
            borderTopColor: 'rgba(255,255,255,0.7)',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a',
        flexDirection: 'column', gap: '20px',
      }}>
        <div style={{
          fontSize: '28px', fontWeight: 700, color: 'white',
          letterSpacing: '-0.02em',
        }}>
          Feed<span style={{ color: 'rgba(255,255,255,0.4)' }}>.</span>Me
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>
          @{username} does not exist
        </div>
        <a href="/register" style={{
          marginTop: '8px',
          padding: '12px 28px',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'white',
          fontSize: '14px',
          textDecoration: 'none',
          fontWeight: 500,
          transition: 'all 0.15s',
        }}>
          Create your Feed.Me
        </a>
      </div>
    )
  }

  return (
    <main className="w-full h-screen relative" style={{ background: '#0a0a0a' }}>
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
        padding: profile?.avatar_url ? '5px 20px 5px 5px' : '8px 20px',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        boxShadow: '0 6px 28px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.85)',
      }}>
        {profile?.avatar_url && (
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: `url(${profile.avatar_url}) center/cover`,
            border: '1px solid rgba(255,255,255,0.6)',
            flexShrink: 0,
          }} />
        )}
        <span style={{ color: 'rgba(68,72,96,0.45)', fontSize: '14px' }}>@</span>
        <span style={{ color: 'rgba(50,54,78,0.90)', fontSize: '14px', fontWeight: 600 }}>
          {profile?.display_name || profile?.username}
        </span>
      </div>

      <Canvas3D />
      <FilterButton />
      <PublicBanner />
    </main>
  )
}
