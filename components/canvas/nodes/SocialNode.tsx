'use client'

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { NodeData, useCanvasStore, SOCIAL_PLATFORMS } from '@/lib/store'

interface Props {
  node: NodeData
  isSelected: boolean
  isDimmed: boolean
  isOrbit: boolean
  targetPosition: [number, number, number]
}

export function SocialNode({ node, isSelected, isDimmed, isOrbit, targetPosition }: Props) {
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const editMode = useCanvasStore((s) => s.editMode)
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  const platform = SOCIAL_PLATFORMS.find((p) => p.key === node.title)
  const color  = platform?.color ?? '#555'
  const icon   = platform?.icon  ?? '?'
  const label  = platform?.label ?? node.title ?? ''

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
    from: { position: entranceFrom.current.position, scale: 0 },
    position: targetPosition,
    scale: isSelected ? 1.1 : isOrbit ? (hovered ? orbitScale + 0.07 : orbitScale) : hovered ? 1.04 : 1,
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

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    let url = node.content
    if (!/^https?:\/\//.test(url)) url = 'https://' + url
    window.open(url, '_blank', 'noopener')
  }

  // Truncate URL for display
  const displayUrl = node.content.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

  return (
    <animated.mesh
      ref={meshRef}
      position={springs.position as unknown as [number, number, number]}
      scale={springs.scale.to((s) => [s * 3.2, s * 1.4, 1] as [number, number, number])}
      onClick={handleClick}
      onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0} />

      <Html
        center
        distanceFactor={10}
        zIndexRange={[15, 5]}
        style={{ pointerEvents: (isSelected || hovered) ? 'all' : 'none' }}
      >
        <div style={{ position: 'relative', opacity: isDimmed ? 0.32 : 1, transition: 'opacity 0.4s' }}>
          {/* Tags when selected */}
          {isSelected && (
            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', marginBottom: '6px' }}>
              <span style={{
                background: `${color}22`, backdropFilter: 'blur(8px)',
                border: `1px solid ${color}55`, color: color,
                fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
              }}>#social</span>
            </div>
          )}

          {/* Card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: isSelected ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${color}44`,
            borderLeft: `4px solid ${color}`,
            borderRadius: '12px',
            padding: isSelected ? '14px 16px' : '10px 14px',
            minWidth: '200px',
            maxWidth: '240px',
            cursor: 'pointer',
            boxShadow: isSelected
              ? `0 8px 32px ${color}30, 0 2px 8px rgba(0,0,0,0.12)`
              : `0 2px 12px rgba(0,0,0,0.1)`,
            transition: 'all 0.2s',
          }}>
            {/* Platform badge */}
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 800,
              color: node.title === 'snapchat' ? '#000' : '#fff',
              boxShadow: `0 3px 10px ${color}55`,
            }}>
              {icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: isSelected ? '#111' : 'rgba(255,255,255,0.9)',
                fontSize: '13px', fontWeight: 600, marginBottom: '2px',
              }}>
                {label}
              </div>
              <div style={{
                color: isSelected ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)',
                fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayUrl}
              </div>
            </div>

            {/* Open button when selected */}
            {isSelected && (
              <button
                onClick={handleOpen}
                style={{
                  background: color, color: node.title === 'snapchat' ? '#000' : '#fff',
                  border: 'none', borderRadius: '8px', padding: '6px 12px',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  flexShrink: 0, boxShadow: `0 2px 8px ${color}44`,
                }}
              >
                Abrir
              </button>
            )}
          </div>

          {/* Delete button */}
          {editMode && (
            <div style={{ position: 'absolute', top: '-8px', right: '-8px', pointerEvents: 'all' }}>
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
