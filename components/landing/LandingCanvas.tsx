'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { NodeData, useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'
import { landingPalette, Z_CHROME } from './landingTheme'
import { cardWorldSize, MAX_CARD_WIDTH } from './landingScale'
import { landingPositions, estimateCardHeight, type LandingItem } from './landingLayout'
import { AUTH_NODE_ID, LANDING_CARDS, LANDING_PHOTOS } from './landingContent'

const Canvas3D = dynamic(
  () => import('@/components/canvas/Canvas3D').then((m) => m.Canvas3D),
  { ssr: false }
)

/**
 * The front door.
 *
 * It is not a page that describes Feed.Me — it is a Feed.Me canvas that happens
 * to be about Feed.Me, with the sign-in form as one of its cards. The visitor
 * learns what the product is by using it: the copy is on cards they can pull
 * closer, the photos are real nodes, and dragging the background does what
 * dragging the background does everywhere else in the app.
 */

/** Tall enough for the sign-up form, which is the taller of the two states. */
const AUTH_CARD_HEIGHT = 440

/**
 * Half-extents of a photo node at scale 1: ImageNode draws them 3 world units
 * tall and as wide as the picture's aspect ratio makes them, which for a typical
 * landscape frame is about 4.4.
 */
const PHOTO_HALF_W = 2.2
const PHOTO_HALF_H = 1.5

const BG = '#ede8de'

function buildLandingNodes(): NodeData[] {
  const items: LandingItem[] = [
    {
      id: AUTH_NODE_ID,
      kind: 'auth',
      halfW: cardWorldSize(MAX_CARD_WIDTH) / 2,
      halfH: cardWorldSize(AUTH_CARD_HEIGHT) / 2,
      ring: 1,
    },
    ...LANDING_CARDS.map((card): LandingItem => {
      const width = Math.min(card.width, MAX_CARD_WIDTH)
      return {
        id: card.id,
        kind: 'card',
        halfW: cardWorldSize(width) / 2,
        halfH: cardWorldSize(estimateCardHeight(card, width)) / 2,
        ring: card.ring,
      }
    }),
    ...LANDING_PHOTOS.map((photo, i): LandingItem => ({
      id: `landing-photo-${i}`,
      kind: 'photo',
      halfW: PHOTO_HALF_W * photo.scale,
      halfH: PHOTO_HALF_H * photo.scale,
      ring: photo.ring,
    })),
  ]

  const at = landingPositions(items)

  return [
    { id: AUTH_NODE_ID, type: 'auth', content: '', tags: [], position: at[AUTH_NODE_ID], seed: 0 },
    ...LANDING_CARDS.map((card, i): NodeData => ({
      id: card.id,
      type: 'headline',
      content: card.body ?? card.title,
      title: card.eyebrow,
      tags: card.tags,
      position: at[card.id],
      seed: i + 1,
    })),
    ...LANDING_PHOTOS.map((photo, i): NodeData => ({
      id: `landing-photo-${i}`,
      type: 'image',
      content: photo.url,
      caption: photo.title,
      tags: photo.tags,
      position: at[`landing-photo-${i}`],
      scale: photo.scale,
      seed: 100 + i,
    })),
  ]
}

export function LandingCanvas() {
  const setStaticNodes = useCanvasStore((s) => s.setStaticNodes)
  const setBgColor = useCanvasStore((s) => s.setBgColor)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)

  // Built once, on the client: the arrangement is measured against the viewport,
  // and there is no viewport on the server.
  const nodes = useMemo(buildLandingNodes, [])

  useEffect(() => {
    // Order matters. setBgColor writes the colour back to the profile of whoever
    // the store still thinks is signed in, and arriving here straight after
    // signing out leaves that id behind — setStaticNodes clears it first, so the
    // landing's background can never be saved onto someone's canvas.
    setStaticNodes(nodes)
    setBgColor(BG)
  }, [nodes, setBgColor, setStaticNodes])

  return (
    <main className="w-full h-screen relative" style={{ background: BG }}>
      <Canvas3D />
      <HomeChip onClick={() => setSelectedNode(AUTH_NODE_ID)} />
      <MissingUserNotice />
      <NavigationHint />
    </main>
  )
}

// ─── Chrome ────────────────────────────────────────────────────────────────

function chip(light: boolean): React.CSSProperties {
  const p = landingPalette(light)
  return {
    position: 'fixed',
    zIndex: Z_CHROME,
    background: p.cardBg,
    borderTop: p.borderTop,
    borderLeft: p.borderTop,
    borderBottom: p.borderBottom,
    borderRight: p.borderBottom,
    borderRadius: '50px',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    boxShadow: p.shadow,
  }
}

/** Always-there way back to the middle, however far the canvas has been dragged. */
function HomeChip({ onClick }: { onClick: () => void }) {
  const light = isLightBg(useCanvasStore((s) => s.bgColor))
  const p = landingPalette(light)
  const [hover, setHover] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...chip(light),
        top: '20px',
        left: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        padding: '9px 17px',
        cursor: 'pointer',
        transform: hover ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.16s',
      }}
    >
      <span style={{ fontSize: '16px', fontWeight: 700, color: p.ink, letterSpacing: '-0.03em' }}>
        Feed<span style={{ color: p.inkFaint }}>.</span>Me
      </span>
      <span style={{ fontSize: '12px', color: p.inkFaint, whiteSpace: 'nowrap' }}>Recenter</span>
    </button>
  )
}

/**
 * Someone who followed a link to a profile that is not there. They are told what
 * happened here rather than on a dead end of their own, because this screen is
 * the one place that can do something about it.
 */
function MissingUserNotice() {
  const light = isLightBg(useCanvasStore((s) => s.bgColor))
  const p = landingPalette(light)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get('missing')
    if (name) setUsername(name.slice(0, 40))
  }, [])

  if (!username) return null

  return (
    <div style={{
      ...chip(light),
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 18px',
      maxWidth: 'calc(100vw - 40px)',
      color: p.inkSoft,
      fontSize: '13px',
      textAlign: 'center',
    }}>
      <strong style={{ color: p.ink, fontWeight: 600 }}>@{username}</strong> doesn’t have a canvas yet. The name
      is free.
    </div>
  )
}

/** Says the canvas is draggable, then gets out of the way. */
function NavigationHint() {
  const light = isLightBg(useCanvasStore((s) => s.bgColor))
  const p = landingPalette(light)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 1400)
    const hide = setTimeout(() => setVisible(false), 11000)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [])

  return (
    <div style={{
      ...chip(light),
      bottom: '22px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 20px',
      color: p.inkSoft,
      fontSize: '12.5px',
      whiteSpace: 'nowrap',
      maxWidth: 'calc(100vw - 32px)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.7s ease',
      pointerEvents: 'none',
    }}>
      Drag to move around · tap anything to see it close
    </div>
  )
}
