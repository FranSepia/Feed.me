'use client'

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture, Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { NodeData, useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

interface Props {
  node: NodeData
  isSelected: boolean
  isDimmed: boolean
  isOrbit: boolean
  targetPosition: [number, number, number]
}

export function ImageNode({ node, isSelected, isDimmed, isOrbit, targetPosition }: Props) {
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const editMode = useCanvasStore((s) => s.editMode)
  const bgColor = useCanvasStore((s) => s.bgColor)
  const [hovered, setHovered] = useState(false)

  const light = isLightBg(bgColor)
  const tagBg      = light ? 'rgba(255,255,255,0.75)' : 'rgba(20,20,20,0.65)'
  const tagColor   = light ? 'rgba(0,0,0,0.75)'       : 'rgba(255,255,255,0.92)'
  const tagBorder  = light ? 'rgba(0,0,0,0.15)'        : 'rgba(255,255,255,0.25)'
  const captionClr = light ? 'rgba(0,0,0,0.75)'        : 'rgba(255,255,255,0.88)'
  const dateClr    = light ? 'rgba(0,0,0,0.45)'        : 'rgba(255,255,255,0.5)'
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  const texture = useTexture(node.content)
  const aspect = texture.image ? texture.image.width / texture.image.height : 1
  const w = 3 * aspect
  const h = 3

  const targetOpacity = isDimmed ? 0.32 : 1
  const mobileOrbitScale = typeof window !== 'undefined' && window.innerWidth < 600 ? 0.55 : 0.82
  const targetScale = isSelected ? 1.12 : isOrbit ? (hovered ? mobileOrbitScale + 0.08 : mobileOrbitScale) : hovered ? 1.04 : 1

  const springs = useSpring({
    position: targetPosition,
    scale: targetScale,
    opacity: targetOpacity,
    config: { mass: 1.2, tension: 140, friction: 26 },
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
      scale={springs.scale.to((s) => [s * w, s * h, 1] as [number,number,number])}
      onClick={handleClick}
      onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[1, 1]} />
      <animated.meshBasicMaterial
        map={texture}
        transparent
        opacity={springs.opacity}
        side={THREE.DoubleSide}
        toneMapped={false}
      />

      {/* Tags — left-aligned, just above the top edge, growing rightward */}
      {isSelected && node.tags.length > 0 && (
        <Html
          distanceFactor={10}
          position={[-0.5, 0.62, 0.01]}
          zIndexRange={[30, 20]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'nowrap', justifyContent: 'flex-start', paddingBottom: '4px' }}>
            {node.tags.map((tag) => (
              <span key={tag} style={{
                background: tagBg,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${tagBorder}`,
                color: tagColor,
                fontSize: '11px',
                padding: '4px 11px',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
              }}>#{tag}</span>
            ))}
          </div>
        </Html>
      )}

      {/* Caption — below image, floating, full image width, left edge anchor */}
      {(node.caption || node.date) && (
        <Html
          distanceFactor={10}
          position={[-0.5, -0.515, 0.01]}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '1px',
            width: `${Math.round(w * 120)}px`,
            opacity: isDimmed ? 0.1 : 1, transition: 'opacity 0.4s',
            paddingTop: '4px',
          }}>
            {node.caption && (
              <span style={{
                color: captionClr,
                fontSize: '12px',
                lineHeight: 1.4,
                fontStyle: 'italic',
                textShadow: light ? 'none' : '0 1px 4px rgba(0,0,0,0.5)',
              }}>
                {node.caption}
              </span>
            )}
            {node.date && (
              <span style={{
                color: dateClr,
                fontSize: '10px',
                fontStyle: 'italic',
                letterSpacing: '0.03em',
                textShadow: light ? 'none' : '0 1px 3px rgba(0,0,0,0.5)',
              }}>
                {formatDate(node.date)}
              </span>
            )}
          </div>
        </Html>
      )}

      {/* Delete button */}
      {editMode && (
        <Html
          position={[0.5, 0.5, 0.01]}
          zIndexRange={[50, 0]}
          style={{ pointerEvents: 'all', transform: 'translate(-100%, -100%)' }}
        >
          <DeleteButton onDelete={() => removeNode(node.id)} />
        </Html>
      )}
    </animated.mesh>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onDelete() }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: hover ? 'rgba(220,50,50,0.95)' : 'rgba(20,20,20,0.82)',
        border: '1.5px solid rgba(255,255,255,0.25)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
