'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useCanvasStore } from '@/lib/store'
import { Scene } from './Scene'

export function Canvas3D() {
  const bgColor = useCanvasStore((s) => s.bgColor)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)

  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 20], fov: 60, near: 0.1, far: 200 }}
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
