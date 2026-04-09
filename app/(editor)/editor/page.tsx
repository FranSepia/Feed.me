'use client'

import { useEffect } from 'react'
import { Canvas3D } from '@/components/canvas/Canvas3D'
import { BottomBar } from '@/components/ui/BottomBar'
import { ProfilePanel } from '@/components/ui/ProfilePanel'
import { EditModeButton } from '@/components/ui/EditModeButton'
import { ProfileButton } from '@/components/ui/ProfileButton'
import { FilterButton } from '@/components/ui/FilterButton'
import { ShareButton } from '@/components/ui/ShareButton'
import { NodeEditor } from '@/components/ui/NodeEditor'
import { useCanvasStore } from '@/lib/store'
import { useAuth } from '@/lib/auth-context'

export default function EditorPage() {
  const { user, profile } = useAuth()
  const loadFromSupabase = useCanvasStore((s) => s.loadFromSupabase)
  const setUserId = useCanvasStore((s) => s.setUserId)
  const setReadOnly = useCanvasStore((s) => s.setReadOnly)
  const setBgColor = useCanvasStore((s) => s.setBgColor)
  const resetCanvas = useCanvasStore((s) => s.resetCanvas)
  const playingVideoUrl = useCanvasStore((s) => s.playingVideoUrl)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)

  useEffect(() => {
    if (!user) return
    resetCanvas()
    setUserId(user.id)
    setReadOnly(false)
    loadFromSupabase(user.id)
  }, [user?.id])

  // Sync bg color from profile
  useEffect(() => {
    if (profile?.bg_color) setBgColor(profile.bg_color)
  }, [profile?.bg_color])

  return (
    <main className="w-full h-screen relative" style={{ background: '#0a0a0a' }}>
      <Canvas3D />
      <BottomBar />
      <FilterButton />
      <EditModeButton />
      <ProfileButton />
      <ShareButton username={profile?.username} />
      <ProfilePanel />
      <NodeEditor />

      {/* Local video modal */}
      {playingVideoUrl && (
        <div
          onClick={() => setSelectedNode(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <video
              src={playingVideoUrl}
              controls
              autoPlay
              style={{ display: 'block', maxWidth: '90vw', maxHeight: '80vh', borderRadius: '16px' }}
            />
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                position: 'absolute', top: '10px', right: '10px',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)',
                color: 'white', fontSize: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
            >✕</button>
          </div>
        </div>
      )}
    </main>
  )
}
