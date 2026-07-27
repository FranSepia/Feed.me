'use client'

import { Suspense, Component, ReactNode, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import { useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'
import { Scene } from './Scene'

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error) { console.error('[Feed.Me] Canvas render error:', error) }
  render() { if (this.state.hasError) return null; return this.props.children }
}

export function Canvas3D() {
  const bgColor = useCanvasStore((s) => s.bgColor)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const [contextLost, setContextLost] = useState(false)

  // Use window dimensions at init time for camera setup (not state — only needs to be right at first load)
  const isMobileInit = typeof window !== 'undefined' && window.innerWidth < 600
  const initZ = isMobileInit ? 34 : 20
  const initFov = isMobileInit ? 65 : 60

  // A phone that runs out of GPU memory kills the WebGL context. Left alone that
  // reads as "the page broke"; calling preventDefault lets the browser hand the
  // context back, and until it does we say what happened instead of showing a
  // frozen canvas.
  const onCreated = useCallback(({ gl }: RootState) => {
    const canvas = gl.domElement
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      console.error('[Feed.Me] WebGL context lost — GPU memory exhausted')
      setContextLost(true)
    })
    canvas.addEventListener('webglcontextrestored', () => setContextLost(false))
  }, [])

  return (
    <div className="w-full h-full absolute inset-0">
      {contextLost && <ContextLostNotice light={isLightBg(bgColor)} />}
      <Canvas
        camera={{ position: [0, 0, initZ], fov: initFov, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: bgColor }}
        // Full device pixel ratio. Capping this at 1.5 on mobile bought frame rate
        // but softened everything on screen, which cost more in perceived quality
        // than the texture sizes did.
        dpr={[1, 2]}
        onCreated={onCreated}
        onPointerMissed={() => setSelectedNode(null)}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 50, 120]} />
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <Suspense fallback={null}>
          <CanvasErrorBoundary>
            <Scene />
          </CanvasErrorBoundary>
        </Suspense>
      </Canvas>
    </div>
  )
}

function ContextLostNotice({ light }: { light: boolean }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 300,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '14px', padding: '24px', textAlign: 'center',
      background: light ? 'rgba(255,255,255,0.82)' : 'rgba(15,15,15,0.82)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      color: light ? 'rgba(40,40,40,0.92)' : 'rgba(240,240,240,0.92)',
    }}>
      <span style={{ fontSize: '15px', fontWeight: 600 }}>Se quedó sin memoria de video</span>
      <span style={{ fontSize: '13px', maxWidth: '300px', lineHeight: 1.5, opacity: 0.75 }}>
        Este canvas tiene demasiado contenido para este dispositivo. Recargá la página para volver a intentarlo.
      </span>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '4px', padding: '9px 22px', borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(80,100,250,0.9), rgba(50,70,220,0.9))',
          color: 'white', fontSize: '14px', fontWeight: 600,
        }}
      >
        Recargar
      </button>
    </div>
  )
}
