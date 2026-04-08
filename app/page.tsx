'use client'

import { useEffect } from 'react'
import { Canvas3D } from '@/components/canvas/Canvas3D'
import { BottomBar } from '@/components/ui/BottomBar'
import { ProfilePanel } from '@/components/ui/ProfilePanel'
import { EditModeButton } from '@/components/ui/EditModeButton'
import { ProfileButton } from '@/components/ui/ProfileButton'
import { useCanvasStore } from '@/lib/store'

export default function Home() {
  const loadFromSupabase = useCanvasStore((s) => s.loadFromSupabase)

  useEffect(() => {
    loadFromSupabase()
  }, [])

  return (
    <main className="w-full h-screen relative" style={{ background: '#0a0a0a' }}>
      <Canvas3D />
      <BottomBar />
      <EditModeButton />
      <ProfileButton />
      <ProfilePanel />
    </main>
  )
}
