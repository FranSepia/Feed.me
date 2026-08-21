'use client'

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { NodeData, useCanvasStore } from '@/lib/store'
import { NODE_SPRING, useEntranceDelay, htmlDepth, htmlCardScale } from '@/lib/nodeMotion'
import { isLightBg } from '@/lib/colors'
import { useVideoPoster } from '@/lib/useVideoPoster'
import { useVideoTexture, usePosterTexture } from '@/lib/useVideoTexture'

function getYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
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
  /** Scene rations the live decoders; a card without one shows its poster frame */
  canPlay?: boolean
}

export function VideoNode({ node, isSelected, isDimmed, isOrbit, targetPosition, canPlay = true }: Props) {
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const setPlayingVideoUrl = useCanvasStore((s) => s.setPlayingVideoUrl)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const editMode = useCanvasStore((s) => s.editMode)
  const bgColor = useCanvasStore((s) => s.bgColor)
  const light = isLightBg(bgColor)
  const [hovered, setHovered] = useState(false)

  const ytId = getYouTubeId(node.content)
  const isYT = !!ytId

  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  // Every video plays, looped and silent, from the moment it can. The selected
  // card is the only one that gets sound.
  const live = canPlay || isSelected

  const { texture: videoTexture, aspect: liveAspect, ready: videoReady, failed } =
    useVideoTexture(isYT ? '' : node.content, !isYT && live, isSelected)

  // A card with no decoder slot — or one whose source will not play — falls back
  // to a captured first frame rather than a grey rectangle
  const wantsPoster = !isYT && (!live || failed)
  const posterUrl = useVideoPoster(node.content, wantsPoster)
  const posterTexture = usePosterTexture(wantsPoster ? posterUrl : null)

  // Never bind a video texture that has no frame in it yet — three uploads it as
  // an empty texture, which is why a loading card looked like a transparent hole
  // rather than a card that had not started yet
  const map = videoReady ? videoTexture : posterTexture
  const posterAspect = posterTexture?.image
    ? posterTexture.image.width / posterTexture.image.height
    : null
  const aspect = liveAspect ?? posterAspect ?? 16 / 9

  const captionClr = light ? 'rgba(0,0,0,0.75)'  : 'rgba(255,255,255,0.88)'
  const dateClr    = light ? 'rgba(0,0,0,0.45)'  : 'rgba(255,255,255,0.5)'
  const tagBg      = light ? 'rgba(255,255,255,0.75)' : 'rgba(20,20,20,0.65)'
  const tagColor   = light ? 'rgba(0,0,0,0.75)'       : 'rgba(255,255,255,0.92)'
  const tagBorder  = light ? 'rgba(0,0,0,0.15)'        : 'rgba(255,255,255,0.25)'

  // Random entrance — computed once on mount
  const entranceFrom = useRef({
    position: [
      targetPosition[0] + (Math.random() - 0.5) * 60,
      targetPosition[1] + (Math.random() - 0.5) * 40,
      targetPosition[2] - 10 - Math.random() * 20,
    ] as [number, number, number],
  })
  const entranceDelay = useEntranceDelay()

  const orbitScale = 0.66 * (0.80 + Math.abs(Math.sin(node.seed * 127.1 + 311.7)) * 0.40)
  // A selected local video is now the same kind of object as a selected photo,
  // at the same camera distance, so it takes the same size. The YouTube card is
  // still DOM and would only rasterise blurry if it were blown up that far.
  const selectedScale = isYT ? 1.08 : 1.75
  const targetScale = isSelected ? selectedScale : isOrbit ? (hovered ? orbitScale + 0.07 : orbitScale) : hovered ? 1.03 : 1

  const springs = useSpring({
    from: { position: entranceFrom.current.position, scale: 0, opacity: 0 },
    position: targetPosition,
    scale: targetScale,
    opacity: isDimmed ? 0.4 : 1,
    config: NODE_SPRING,
    delay: entranceDelay,
  })

  useFrame(() => {
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion)
  })

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    // A local video that is already selected expands into the full player
    if (!isYT && isSelected) {
      setPlayingVideoUrl(node.content)
    } else {
      setSelectedNode(isSelected ? null : node.id)
    }
  }

  const pointerProps = {
    onClick: handleClick,
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); setHovered(true) },
    onPointerOut: () => setHovered(false),
  }

  // ── YouTube: only an iframe can play it, so it stays a DOM card ──
  if (isYT) {
    const H = 180
    const W = 320
    // Looping needs the playlist parameter — a bare loop=1 is ignored on a single video
    const common = `rel=0&modestbranding=1&playsinline=1&loop=1&playlist=${ytId}`
    const src = isSelected
      ? `https://www.youtube.com/embed/${ytId}?autoplay=1&${common}`
      : `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&${common}`

    return (
      <animated.mesh
        ref={meshRef}
        position={springs.position as unknown as [number, number, number]}
        scale={springs.scale.to((s) => [s * 3 * (16 / 9), s * 3, 1] as [number, number, number])}
        {...pointerProps}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial transparent opacity={0} />

        <Html
          center
          distanceFactor={10}
          zIndexRange={htmlDepth(isSelected)}
          style={{ pointerEvents: isSelected ? 'all' : 'none' }}
        >
          <div style={{
            position: 'relative',
            opacity: isDimmed ? 0.4 : 1,
            ...htmlCardScale(targetScale),
          }}>
            {isSelected && node.tags.length > 0 && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0,
                display: 'flex', gap: '5px', flexWrap: 'nowrap', paddingBottom: '6px',
                pointerEvents: 'none',
              }}>
                {node.tags.map((tag) => (
                  <span key={tag} style={{
                    background: tagBg, backdropFilter: 'blur(10px)',
                    border: `1px solid ${tagBorder}`, color: tagColor,
                    fontSize: '11px', padding: '4px 11px', borderRadius: '20px', whiteSpace: 'nowrap',
                  }}>#{tag}</span>
                ))}
              </div>
            )}

            <div style={{
              width: `${W}px`, height: `${H}px`,
              borderRadius: '12px', overflow: 'hidden',
              position: 'relative', cursor: 'pointer', background: '#000',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              {/* Thumbnail underneath, so there is never a black hole while the player boots */}
              <img
                src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />

              {live && (
                <iframe
                  key={isSelected ? 'selected' : 'muted'}
                  src={src}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    border: 'none', display: 'block',
                    // A card is selected by clicking it; letting the embed swallow that
                    // click meant the first tap only ever reached YouTube's own UI
                    pointerEvents: isSelected ? 'all' : 'none',
                  }}
                />
              )}

              {(!live || failed) && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.18)',
                }}>
                  <PlayBadge />
                </div>
              )}

              {node.title && !isSelected && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                  padding: '24px 12px 10px', color: 'white',
                  fontSize: '12px', fontWeight: 500, pointerEvents: 'none',
                }}>{node.title}</div>
              )}
            </div>

            {(node.caption || node.date) && (
              <div style={{
                paddingTop: '4px', width: `${W}px`,
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
    )
  }

  // ── Local video: a textured plane, exactly like a photo ──
  return (
    <animated.mesh
      ref={meshRef}
      position={springs.position as unknown as [number, number, number]}
      scale={springs.scale.to((s) => [s * 3 * aspect, s * 3, 1] as [number, number, number])}
      {...pointerProps}
    >
      <planeGeometry args={[1, 1]} />
      <animated.meshBasicMaterial
        map={map}
        color={map ? '#ffffff' : '#111111'}
        transparent
        opacity={springs.opacity}
        side={THREE.DoubleSide}
        toneMapped={false}
      />

      {/* Only for a card the decoder budget could not cover. A video that is simply
          still loading gets no badge: it is about to start on its own, and offering
          a play button for it is what made the whole canvas look click-to-start. */}
      {(!live || failed) && (
        <Html center distanceFactor={10} zIndexRange={htmlDepth(isSelected)} style={{ pointerEvents: 'none' }}>
          <div style={{ opacity: isDimmed ? 0.4 : 1, ...htmlCardScale(targetScale) }}>
            <PlayBadge />
          </div>
        </Html>
      )}

      {isSelected && node.tags.length > 0 && (
        <Html
          distanceFactor={10}
          position={[-0.5, 0.62, 0.01]}
          zIndexRange={htmlDepth(isSelected)}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'nowrap', paddingBottom: '4px' }}>
            {node.tags.map((tag) => (
              <span key={tag} style={{
                background: tagBg, backdropFilter: 'blur(10px)',
                border: `1px solid ${tagBorder}`, color: tagColor,
                fontSize: '11px', padding: '4px 11px', borderRadius: '20px', whiteSpace: 'nowrap',
              }}>#{tag}</span>
            ))}
          </div>
        </Html>
      )}

      {(node.caption || node.date) && (
        <Html
          distanceFactor={10}
          position={[-0.5, -0.515, 0.01]}
          zIndexRange={htmlDepth(isSelected)}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '1px',
            width: `${Math.round(3 * aspect * 120)}px`,
            opacity: isDimmed ? 0.1 : 1, transition: 'opacity 0.4s',
            paddingTop: '4px',
          }}>
            {node.caption && (
              <span style={{
                color: captionClr, fontSize: '12px', lineHeight: 1.4, fontStyle: 'italic',
                textShadow: light ? 'none' : '0 1px 4px rgba(0,0,0,0.5)',
              }}>{node.caption}</span>
            )}
            {node.date && (
              <span style={{
                color: dateClr, fontSize: '10px', fontStyle: 'italic', letterSpacing: '0.03em',
                textShadow: light ? 'none' : '0 1px 3px rgba(0,0,0,0.5)',
              }}>{formatDate(node.date)}</span>
            )}
          </div>
        </Html>
      )}

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

function PlayBadge() {
  return (
    <div style={{
      width: '52px', height: '52px', borderRadius: '50%',
      background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1.5px solid rgba(255,255,255,0.4)',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <polygon points="5,3 19,12 5,21" />
      </svg>
    </div>
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
