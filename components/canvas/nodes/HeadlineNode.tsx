'use client'

import { useRef, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { NodeData, useCanvasStore } from '@/lib/store'
import { NODE_SPRING, useEntranceDelay, htmlDepth, htmlCardScale } from '@/lib/nodeMotion'
import { isLightBg } from '@/lib/colors'
import { CARD_DISTANCE_FACTOR, MAX_CARD_WIDTH, cardWorldSize } from '@/components/landing/landingScale'
import { landingPalette } from '@/components/landing/landingTheme'
import { estimateCardHeight } from '@/components/landing/landingLayout'
import { LANDING_CARDS, AUTH_NODE_ID, type LandingCard } from '@/components/landing/landingContent'
import { useAuthMode } from '@/components/landing/authMode'

/**
 * A card of copy on the landing canvas.
 *
 * TextNode would have been the obvious thing to reuse, but it is built for a
 * canvas where text is a keepsake you click to read — at rest its 200 px card is
 * drawn at 87, which is fine for a note to yourself and useless for the sentence
 * that explains what this product is. This one is drawn at the size it was
 * written for (see landingScale) and otherwise wears exactly the same glass.
 *
 * The card takes no pointer events. Dragging the background is how you get
 * around here, and a dozen cards that swallow the drag would leave most of the
 * screen dead — so clicks come off a mesh cut to the card's own size instead,
 * and only the one button that has to be a button opts back in.
 */

interface Props {
  node: NodeData
  isSelected: boolean
  isDimmed: boolean
  isOrbit: boolean
  targetPosition: [number, number, number]
}

const byId = new Map<string, LandingCard>(LANDING_CARDS.map((c) => [c.id, c]))

export function HeadlineNode({ node, isSelected, isDimmed, isOrbit, targetPosition }: Props) {
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const setMode = useAuthMode((s) => s.setMode)
  const bgColor = useCanvasStore((s) => s.bgColor)
  const light = isLightBg(bgColor)
  const p = landingPalette(light)

  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  const card = byId.get(node.id)

  const { width, worldW, worldH } = useMemo(() => {
    const w = Math.min(card?.width ?? 264, MAX_CARD_WIDTH)
    return {
      width: w,
      worldW: cardWorldSize(w),
      worldH: cardWorldSize(card ? estimateCardHeight(card, w) : 200),
    }
  }, [card])

  const orbitScale = 0.52 * (0.85 + Math.abs(Math.sin(node.seed * 127.1 + 311.7)) * 0.3)
  const targetScale = isSelected ? 1 : isOrbit ? orbitScale : hovered ? 1.03 : 1

  const entranceFrom = useRef<[number, number, number]>([
    targetPosition[0] + (Math.random() - 0.5) * 40,
    targetPosition[1] + (Math.random() - 0.5) * 26,
    targetPosition[2] - 12 - Math.random() * 14,
  ])
  const entranceDelay = useEntranceDelay()

  const springs = useSpring({
    from: { position: entranceFrom.current, scale: 0.9 },
    position: targetPosition,
    scale: targetScale,
    config: NODE_SPRING,
    delay: entranceDelay,
  })

  useFrame(() => {
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion)
  })

  if (!card) return null

  const goSignUp = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMode('signup')
    setSelectedNode(AUTH_NODE_ID)
  }

  return (
    <animated.mesh
      ref={meshRef}
      position={springs.position as unknown as [number, number, number]}
      scale={springs.scale.to((s) => [worldW * s, worldH * s, 1] as [number, number, number])}
      onClick={(e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        setSelectedNode(isSelected ? null : node.id)
      }}
      onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0} />

      <Html
        center
        distanceFactor={CARD_DISTANCE_FACTOR}
        zIndexRange={htmlDepth(isSelected)}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{ position: 'relative', ...htmlCardScale(targetScale) }}>
          {isSelected && card.tags.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0,
              display: 'flex', gap: '5px', paddingBottom: '6px', whiteSpace: 'nowrap',
            }}>
              {card.tags.map((tag) => (
                <span key={tag} style={{
                  background: light ? 'rgba(255,255,255,0.75)' : 'rgba(20,20,20,0.65)',
                  border: `1px solid ${light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)'}`,
                  color: light ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(10px)',
                  fontSize: '11px', padding: '4px 11px', borderRadius: '20px',
                }}>#{tag}</span>
              ))}
            </div>
          )}

          <div style={{
            width: `${width}px`,
            background: p.cardBg,
            borderTop: p.borderTop, borderLeft: p.borderTop,
            borderBottom: p.borderBottom, borderRight: p.borderBottom,
            borderRadius: '20px',
            padding: '19px 20px 17px',
            backdropFilter: 'blur(26px)', WebkitBackdropFilter: 'blur(26px)',
            boxShadow: p.shadow,
            display: 'flex', flexDirection: 'column', gap: '9px',
            opacity: isDimmed ? 0.42 : 1,
            transition: 'opacity 0.4s ease',
            boxSizing: 'border-box',
          }}>
            <div style={{
              color: p.inkFaint, fontSize: '10px', letterSpacing: '0.09em',
              textTransform: 'uppercase', fontWeight: 600,
            }}>
              {card.eyebrow}
            </div>

            <div style={{
              color: p.ink, fontSize: '17.5px', fontWeight: 650,
              lineHeight: 1.25, letterSpacing: '-0.015em',
            }}>
              {card.title}
            </div>

            {card.art === 'venn' && <VennArt ink={p.ink} faint={p.inkFaint} />}
            {card.art === 'kinds' && <KindsArt palette={p} />}

            {card.body && (
              <div style={{ color: p.inkSoft, fontSize: '13px', lineHeight: 1.55 }}>
                {card.body}
              </div>
            )}

            {card.bullets && (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {card.bullets.map((b) => (
                  <li key={b} style={{
                    color: p.inkSoft, fontSize: '12.5px', lineHeight: 1.45,
                    display: 'flex', gap: '8px',
                  }}>
                    <span style={{ color: p.inkFaint, flexShrink: 0 }}>—</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {card.cta && (
              <button
                onClick={goSignUp}
                style={{
                  marginTop: '3px', padding: '11px', borderRadius: '12px', border: 'none',
                  background: p.buttonBg, color: p.buttonInk,
                  fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', width: '100%',
                  // The one thing on this card that has to take a real click
                  pointerEvents: 'auto',
                }}
              >
                Create my account
              </button>
            )}

            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
              {card.tags.map((tag) => (
                <span key={tag} style={{
                  background: p.tagBg, color: p.tagInk,
                  fontSize: '10px', padding: '3px 8px', borderRadius: '20px',
                }}>#{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </Html>
    </animated.mesh>
  )
}

/**
 * Three tags, three circles, and the things that carry two of them sitting in
 * the lens between — the same neutral ink VennIslands draws the real diagram in.
 */
function VennArt({ ink, faint }: { ink: string; faint: string }) {
  const r = 30
  const circles: [number, number][] = [[96, 40], [144, 40], [120, 74]]
  const cards: [number, number, boolean][] = [
    [78, 30, false], [162, 30, false], [120, 88, false],   // one tag only
    [120, 38, true], [104, 62, true], [136, 62, true],     // two tags — in a lens
  ]
  return (
    <svg viewBox="0 0 240 104" style={{ width: '100%', height: 'auto', display: 'block', color: ink }}>
      {circles.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="currentColor" fillOpacity={0.06}
          stroke="currentColor" strokeOpacity={0.34} strokeWidth={1} />
      ))}
      {cards.map(([x, y, shared], i) => (
        <rect key={i} x={x - 6} y={y - 4.5} width={12} height={9} rx={2}
          fill="currentColor" fillOpacity={shared ? 0.55 : 0.28} />
      ))}
      <text x="44" y="16" fontSize="8.5" fill={faint}>#travel</text>
      <text x="172" y="16" fontSize="8.5" fill={faint}>#music</text>
      <text x="103" y="102" fontSize="8.5" fill={faint}>#2019</text>
    </svg>
  )
}

/** The kinds of thing a node can be, as the chips they read like on the canvas. */
function KindsArt({ palette: p }: { palette: ReturnType<typeof landingPalette> }) {
  const kinds = ['Photo', 'Video', 'Song', 'Note', 'Link']
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
      {kinds.map((k) => (
        <span key={k} style={{
          background: p.quietBg, color: p.inkSoft,
          border: `1px solid ${p.rule}`,
          fontSize: '11px', padding: '5px 10px', borderRadius: '8px', fontWeight: 500,
        }}>{k}</span>
      ))}
    </div>
  )
}
