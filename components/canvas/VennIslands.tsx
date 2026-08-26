'use client'

import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { VennIsland } from '@/lib/vennLayout'
import { useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'
import { htmlDepth } from '@/lib/nodeMotion'

// The circles behind the cards in the Venn view: one per tag, drawn large enough
// to hold everything that carries it, so wherever two of them cross you are
// looking at the cards that carry both.

/** Well behind the cards, which sit at z ≈ 0 in this view */
const PLANE_Z = -3

export function VennIslands({ islands }: { islands: VennIsland[] }) {
  const bgColor = useCanvasStore((s) => s.bgColor)
  const light = isLightBg(bgColor)

  return (
    <group>
      {islands.map((island, i) => (
        <Island key={island.tag} island={island} light={light} index={i} />
      ))}
    </group>
  )
}

function Island({ island, light, index }: { island: VennIsland; light: boolean; index: number }) {
  const color = useMemo(
    () => new THREE.Color().setHSL(island.hue / 360, 0.58, light ? 0.45 : 0.62),
    [island.hue, light]
  )

  // Staggered so the diagram assembles itself rather than snapping into place
  const springs = useSpring({
    from: { fill: 0, edge: 0 },
    to: { fill: 1, edge: 1 },
    delay: 120 + index * 70,
    config: { mass: 1, tension: 90, friction: 24 },
  })

  const { radius } = island
  const position: [number, number, number] = [island.center[0], island.center[1], PLANE_Z]

  return (
    <group position={position}>
      {/* Fill. Deliberately faint: two of them crossing have to read as a third,
          denser shade, which is the whole point of the diagram. */}
      <mesh raycast={() => null}>
        <circleGeometry args={[radius, 96]} />
        <animated.meshBasicMaterial
          color={color}
          transparent
          opacity={springs.fill.to((v) => v * (light ? 0.1 : 0.13))}
          depthWrite={false}
        />
      </mesh>

      {/* Edge */}
      <mesh raycast={() => null} position={[0, 0, 0.01]}>
        <ringGeometry args={[radius - radius * 0.006 - 0.04, radius, 128]} />
        <animated.meshBasicMaterial
          color={color}
          transparent
          opacity={springs.edge.to((v) => v * 0.55)}
          depthWrite={false}
        />
      </mesh>

      {/* No distanceFactor on purpose: the camera pulls right back to frame a big
          diagram, and a label that scaled with it would be unreadable exactly when
          you most need to know which circle is which */}
      <Html
        center
        position={[0, radius, 0.02]}
        zIndexRange={htmlDepth(false)}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
          padding: '5px 13px',
          borderRadius: '20px',
          whiteSpace: 'nowrap',
          background: light ? 'rgba(255,255,255,0.80)' : 'rgba(20,20,20,0.70)',
          border: `1px solid ${color.getStyle()}`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: light ? '0 2px 10px rgba(0,0,0,0.10)' : '0 2px 10px rgba(0,0,0,0.45)',
        }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: light ? 'rgba(30,32,45,0.92)' : 'rgba(255,255,255,0.94)',
          }}>#{island.tag}</span>
          <span style={{
            fontSize: '11px',
            color: light ? 'rgba(30,32,45,0.50)' : 'rgba(255,255,255,0.55)',
          }}>{island.count}</span>
        </div>
      </Html>
    </group>
  )
}
