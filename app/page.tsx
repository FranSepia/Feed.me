'use client'

import { useEffect } from 'react'
import { Canvas3D } from '@/components/canvas/Canvas3D'
import { BottomBar } from '@/components/ui/BottomBar'
import { ProfilePanel } from '@/components/ui/ProfilePanel'
import { EditModeButton } from '@/components/ui/EditModeButton'
import { ProfileButton } from '@/components/ui/ProfileButton'
import { FilterButton } from '@/components/ui/FilterButton'
import { useCanvasStore } from '@/lib/store'

export default function Home() {
  const loadFromSupabase = useCanvasStore((s) => s.loadFromSupabase)
  const playingVideoUrl = useCanvasStore((s) => s.playingVideoUrl)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)

  useEffect(() => {
    loadFromSupabase()
  }, [])

  return (
    <main className="w-full h-screen relative" style={{ background: '#0a0a0a' }}>
      <Canvas3D />
      <BottomBar />
      <FilterButton />
      <EditModeButton />
      <ProfileButton />
      <ProfilePanel />

      {/* Local video modal — rendered in regular DOM, outside Three.js canvas */}
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
