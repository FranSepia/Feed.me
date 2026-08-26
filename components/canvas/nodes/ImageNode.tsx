'use client'

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { NodeData, useCanvasStore } from '@/lib/store'
import { NODE_SPRING, useEntranceDelay, htmlDepth } from '@/lib/nodeMotion'
import { isLightBg } from '@/lib/colors'
import { useNodeTexture } from '@/lib/useNodeTexture'

const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

// Each <Html> overlay is a real DOM node whose transform drei recomputes every
// frame. A phone showing one caption per image on a busy canvas spends more time
// in layout than in rendering, so past this many nodes only the selected card
// keeps its caption.
const MOBILE_CAPTION_LIMIT = 20

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
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
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const [hovered, setHovered] = useState(false)

  const showCaption = isSelected || !isMobile || nodeCount <= MOBILE_CAPTION_LIMIT

  const light = isLightBg(bgColor)
  const tagBg      = light ? 'rgba(255,255,255,0.75)' : 'rgba(20,20,20,0.65)'
  const tagColor   = light ? 'rgba(0,0,0,0.75)'       : 'rgba(255,255,255,0.92)'
  const tagBorder  = light ? 'rgba(0,0,0,0.15)'        : 'rgba(255,255,255,0.25)'
  const captionClr = light ? 'rgba(0,0,0,0.75)'        : 'rgba(255,255,255,0.88)'
  const dateClr    = light ? 'rgba(0,0,0,0.45)'        : 'rgba(255,255,255,0.5)'
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  // The selected card is the one being examined closely, so it gets the detailed copy
  const texture = useNodeTexture(node.content, isSelected)
  const aspect = texture.image ? texture.image.width / texture.image.height : 1
  const w = 3 * aspect
  const h = 3

  const targetOpacity = isDimmed ? 0.4 : 1
  // Base orbit scale is 20% smaller than before; each node gets ±20% variation
  // from its seed so the cloud of thumbnails looks organic, not uniform.
  const orbitBase = typeof window !== 'undefined' && window.innerWidth < 600 ? 0.44 : 0.66
  const seedVar   = Math.abs(Math.sin(node.seed * 127.1 + 311.7))   // stable 0–1 per node
  const orbitScale = orbitBase * (0.80 + seedVar * 0.40)             // 80–120 % of base
  // Only the resting size is scaled. A selected card and an orbit ring are
  // uniform states — the point of them is that every card is the same size —
  // so a node that is drawn large on the open canvas still takes its turn at
  // the same size as the rest once you are looking at something.
  const restScale = node.scale ?? 1
  const targetScale = isSelected ? 1.75 : isOrbit ? (hovered ? orbitScale + 0.07 : orbitScale) : (hovered ? 1.04 : 1) * restScale

  // Caption and tags are DOM, so they do not grow with the mesh on their own.
  // Tying their distance factor to the same scale keeps a big photograph from
  // being labelled in type too small to read.
  const labelFactor = 10 * (isOrbit ? 1 : restScale)

  // Random entrance — computed once on mount, stable across re-renders
  const entranceFrom = useRef({
    position: [
      targetPosition[0] + (Math.random() - 0.5) * 60,
      targetPosition[1] + (Math.random() - 0.5) * 40,
      targetPosition[2] - 10 - Math.random() * 20,
    ] as [number, number, number],
  })
  const entranceDelay = useEntranceDelay()

  const springs = useSpring({
    from: { position: entranceFrom.current.position, scale: 0, opacity: 0 },
    position: targetPosition,
    scale: targetScale,
    opacity: targetOpacity,
    config: NODE_SPRING,
    delay: entranceDelay,
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
          distanceFactor={labelFactor}
          position={[-0.5, 0.62, 0.01]}
          zIndexRange={htmlDepth(isSelected)}
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
      {(node.caption || node.date) && showCaption && (
        <Html
          distanceFactor={labelFactor}
          position={[-0.5, -0.515, 0.01]}
          zIndexRange={htmlDepth(isSelected)}
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
          zIndexRange={htmlDepth(isSelected)}
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
