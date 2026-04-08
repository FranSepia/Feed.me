'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { NodeData, useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

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

export function VideoNode({ node, isSelected, isDimmed, isOrbit, targetPosition }: Props) {
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const editMode = useCanvasStore((s) => s.editMode)
  const selectedNodeId = useCanvasStore((s) => s.selectedNode)
  const bgColor = useCanvasStore((s) => s.bgColor)
  const light = isLightBg(bgColor)
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  const ytId = getYouTubeId(node.content)
  const isYT = !!ytId

  const autoPlay = !isSelected && !isDimmed && selectedNodeId !== null

  const captionClr = light ? 'rgba(0,0,0,0.75)'  : 'rgba(255,255,255,0.88)'
  const dateClr    = light ? 'rgba(0,0,0,0.45)'  : 'rgba(255,255,255,0.5)'

  const springs = useSpring({
    position: targetPosition,
    scale: isSelected ? 1.08 : isOrbit ? (hovered ? 0.90 : 0.82) : autoPlay ? 1.04 : hovered ? 1.03 : 1,
    config: { mass: 1.2, tension: 140, friction: 26 },
  })

  useFrame(() => {
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion)
  })

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (editMode) return
    setSelectedNode(isSelected ? null : node.id)
  }

  return (
    <>
      <animated.mesh
        ref={meshRef}
        position={springs.position as unknown as [number,number,number]}
        scale={springs.scale.to((s) => [s * 5.3, s * 3, 1] as [number,number,number])}
        onClick={handleClick}
        onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} />

        <Html center distanceFactor={10} zIndexRange={[50, 0]} style={{ pointerEvents: (isYT && (isSelected || autoPlay)) ? 'all' : 'none' }}>
          <div style={{ position: 'relative', opacity: isDimmed ? 0.32 : 1, transition: 'opacity 0.4s' }}>

            {/* Tags above card when selected */}
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

            {/* YouTube embed when selected/autoplay */}
            {isYT && (isSelected || autoPlay) ? (
              <iframe
                width="480" height="270"
                src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                allow="autoplay; fullscreen"
                style={{ borderRadius: '12px', border: 'none', display: 'block' }}
              />
            ) : (
              /* Thumbnail card (always shown for local; shown when not playing for YT) */
              <div style={{
                width: '280px', borderRadius: '12px', overflow: 'hidden',
                background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', flexDirection: 'column', cursor: 'pointer',
              }}>
                <div style={{
                  height: '158px', position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isYT && (
                    <img
                      src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                      alt="thumbnail"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                  <div style={{
                    position: 'relative', zIndex: 1,
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  </div>
                  {node.title && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      padding: '20px 12px 10px', color: 'white', fontSize: '12px', fontWeight: 500,
                    }}>{node.title}</div>
                  )}
                </div>
              </div>
            )}

            {/* Caption + date below the card */}
            {(node.caption || node.date) && (
              <div style={{
                paddingTop: '4px', width: '280px',
                display: 'flex', flexDirection: 'column', gap: '1px',
                opacity: isDimmed ? 0.1 : 1, transition: 'opacity 0.4s',
                pointerEvents: 'none',
              }}>
                {node.caption && (
                  <span style={{ color: captionClr, fontSize: '12px', lineHeight: 1.4, fontStyle: 'italic' }}>
                    {node.caption}
                  </span>
                )}
                {node.date && (
                  <span style={{ color: dateClr, fontSize: '10px', fontStyle: 'italic', letterSpacing: '0.03em' }}>
                    {formatDate(node.date)}
                  </span>
                )}
              </div>
            )}

            {editMode && (
              <div style={{ position: 'absolute', top: '-8px', right: '-8px', pointerEvents: 'all' }}>
                <DeleteButton onDelete={() => removeNode(node.id)} />
              </div>
            )}
          </div>
        </Html>
      </animated.mesh>

      {/* Local video modal — rendered directly to body to avoid THREE.js canvas z-index issues */}
      {isSelected && !isYT && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setSelectedNode(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden' }}>
            <video
              src={node.content}
              controls
              autoPlay
              style={{ display: 'block', maxWidth: '90vw', maxHeight: '80vh', borderRadius: '16px' }}
            />
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                position: 'absolute', top: '10px', right: '10px',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)',
                color: 'white', fontSize: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
            >✕</button>
          </div>
        </div>,
        document.body
      )}
    </>
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
