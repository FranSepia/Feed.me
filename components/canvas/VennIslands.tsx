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
  // One neutral ink for every circle. Colour would have made the tags easy to tell
  // apart, but it would also have been the loudest thing on a canvas whose whole
  // look is glass over the background — the labels say which circle is which.
  const color = useMemo(
    () => new THREE.Color(light ? '#2b2e3c' : '#e8ebf2'),
    [light]
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
          opacity={springs.fill.to((v) => v * (light ? 0.055 : 0.075))}
          depthWrite={false}
        />
      </mesh>

      {/* Edge */}
      <mesh raycast={() => null} position={[0, 0, 0.01]}>
        <ringGeometry args={[radius - radius * 0.006 - 0.04, radius, 128]} />
        <animated.meshBasicMaterial
          color={color}
          transparent
          opacity={springs.edge.to((v) => v * (light ? 0.34 : 0.40))}
          depthWrite={false}
        />
      </mesh>

      {/* Hung at the island's own angle rather than straight up, so two labels
          never stack — including when two tags always travel together and their
          circles come out in the same place.

          No distanceFactor on purpose: the camera pulls right back to frame a big
          diagram, and a label that scaled with it would be unreadable exactly when
          you most need to know which circle is which. */}
      <Html
        center
        position={[
          Math.cos(island.labelAngle) * radius,
          Math.sin(island.labelAngle) * radius,
          0.02,
        ]}
        zIndexRange={htmlDepth(false)}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {/* Same glass as the buttons, so the diagram belongs to the same set of
            surfaces as the rest of the interface */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
          padding: '5px 13px',
          borderRadius: '20px',
          whiteSpace: 'nowrap',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.90)',
          borderLeft: '1px solid rgba(255,255,255,0.90)',
          borderBottom: '1px solid rgba(180,180,180,0.35)',
          borderRight: '1px solid rgba(180,180,180,0.35)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '3px 3px 8px rgba(0,0,0,0.10), -2px -2px 6px rgba(255,255,255,0.80)',
        }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(50,54,78,0.95)',
          }}>#{island.tag}</span>
          <span style={{
            fontSize: '11px',
            color: 'rgba(68,72,96,0.55)',
          }}>{island.count}</span>
        </div>
      </Html>
    </group>
  )
}
