'use client'

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { NodeData, useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'

interface Props {
  node: NodeData
  isSelected: boolean
  isDimmed: boolean
  isOrbit: boolean
  targetPosition: [number, number, number]
}

export function TextNode({ node, isSelected, isDimmed, isOrbit, targetPosition }: Props) {
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const editMode = useCanvasStore((s) => s.editMode)
  const bgColor = useCanvasStore((s) => s.bgColor)
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  const light = isLightBg(bgColor)
  // Adaptive colors based on canvas background
  const cardBg      = light ? 'rgba(0,0,0,0.07)'        : 'rgba(255,255,255,0.07)'
  const cardBorder  = light ? 'rgba(0,0,0,0.12)'         : 'rgba(255,255,255,0.15)'
  const titleColor  = light ? 'rgba(0,0,0,0.45)'         : 'rgba(255,255,255,0.5)'
  const textColor   = light ? 'rgba(0,0,0,0.85)'         : 'rgba(255,255,255,0.9)'
  const tagBg       = light ? 'rgba(0,0,0,0.08)'         : 'rgba(255,255,255,0.1)'
  const tagColor    = light ? 'rgba(0,0,0,0.55)'         : 'rgba(255,255,255,0.6)'

  // Random entrance — computed once on mount
  const entranceFrom = useRef({
    position: [
      targetPosition[0] + (Math.random() - 0.5) * 60,
      targetPosition[1] + (Math.random() - 0.5) * 40,
      targetPosition[2] - 10 - Math.random() * 20,
    ] as [number, number, number],
    delay: Math.floor(Math.random() * 500),
  })

  const orbitScale = 0.66 * (0.80 + Math.abs(Math.sin(node.seed * 127.1 + 311.7)) * 0.40)

  const springs = useSpring({
    from: { position: entranceFrom.current.position, scale: 0, opacity: 0 },
    position: targetPosition,
    scale: isSelected ? 1.12 : isOrbit ? (hovered ? orbitScale + 0.07 : orbitScale) : hovered ? 1.04 : 1,
    opacity: isDimmed ? 0.4 : 1,
    config: { mass: 1.4, tension: 120, friction: 28 },
    delay: entranceFrom.current.delay,
  })

  useFrame(() => {
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion)
  })

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setSelectedNode(isSelected ? null : node.id)
  }

  return (
    <animated.mesh
      ref={meshRef}
      position={springs.position as unknown as [number,number,number]}
      // Always square: 3.5 × 3.5
      scale={springs.scale.to((s) => [s * 3.5, s * 3.5, 1] as [number,number,number])}
      onClick={handleClick}
      onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[1, 1]} />
      <animated.meshBasicMaterial transparent opacity={springs.opacity.to((o) => o * 0)} color="#fff" />

      {/* Card — square, fixed 200×200, overflow scroll */}
      <Html
        center
        distanceFactor={10}
        zIndexRange={[15, 5]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{ position: 'relative' }}>
          {/* Tags — CSS-positioned above the card, left-aligned */}
          {isSelected && node.tags.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0,
              display: 'flex', gap: '5px', flexWrap: 'nowrap', paddingBottom: '6px',
            }}>
              {node.tags.map((tag) => (
                <span key={tag} style={{
                  background: light ? 'rgba(255,255,255,0.75)' : 'rgba(20,20,20,0.65)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)'}`,
                  color: light ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)',
                  fontSize: '11px', padding: '4px 11px', borderRadius: '20px', whiteSpace: 'nowrap',
                }}>#{tag}</span>
              ))}
            </div>
          )}
          <div style={{
            width: '200px', height: '200px',
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '14px',
            padding: '16px',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            opacity: isDimmed ? 0.4 : 1,
            transition: 'opacity 0.4s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overflow: 'hidden',
            boxShadow: light
              ? '0 4px 24px rgba(0,0,0,0.08)'
              : '0 4px 24px rgba(0,0,0,0.3)',
          }}>
            {node.title && (
              <div style={{ color: titleColor, fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                {node.title}
              </div>
            )}
            <div style={{ color: textColor, fontSize: '13px', lineHeight: '1.55', flex: 1, overflow: 'hidden', wordBreak: 'break-word' }}>
              {node.content}
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', flexShrink: 0 }}>
              {node.tags.map((tag) => (
                <span key={tag} style={{ background: tagBg, color: tagColor, fontSize: '10px', padding: '2px 7px', borderRadius: '20px' }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {editMode && (
            <div style={{ position: 'absolute', top: '-8px', right: '-8px', pointerEvents: 'all', zIndex: 40 }}>
              <DeleteButton onDelete={() => removeNode(node.id)} />
            </div>
          )}
        </div>
      </Html>
    </animated.mesh>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onDelete() }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: hover ? 'rgba(220,50,50,0.95)' : 'rgba(20,20,20,0.82)',
        border: '1.5px solid rgba(255,255,255,0.25)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        transition: 'background 0.15s, transform 0.12s',
        transform: hover ? 'scale(1.15)' : 'scale(1)', padding: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
      </svg>
    </button>
  )
}
