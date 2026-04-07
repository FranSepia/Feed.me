'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useCanvasStore } from '@/lib/store'
import { Scene } from './Scene'

export function Canvas3D() {
  const bgColor = useCanvasStore((s) => s.bgColor)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)

  // Use window dimensions at init time for camera setup (not state — only needs to be right at first load)
  const isMobileInit = typeof window !== 'undefined' && window.innerWidth < 600
  const initZ = isMobileInit ? 34 : 20
  const initFov = isMobileInit ? 65 : 60

  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, initZ], fov: initFov, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: bgColor }}
        dpr={[1, 2]}
        onPointerMissed={() => setSelectedNode(null)}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 50, 120]} />
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}
