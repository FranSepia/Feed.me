'use client'

import { restViewport } from './landingScale'
import type { LandingCard, Ring } from './landingContent'

/**
 * Where everything sits on the landing canvas.
 *
 * The sign-in card is pinned at the origin, because that is where the camera
 * starts and the whole point of this screen is that the way in is the first
 * thing you see. Everything else is arranged around it in three bands: the first
 * inside the opening frame, the other two past its edges, so panning is
 * rewarded rather than empty.
 *
 * The sign-in card is what makes the first band awkward: it is half the height
 * of the viewport and, on a phone, nearly all of its width. So that band is
 * arranged around whatever room is actually left — two lobes to the left and
 * right on a laptop, a single stacked column above and below on a phone.
 */

export interface LandingItem {
  id: string
  kind: 'auth' | 'card' | 'photo'
  halfW: number
  halfH: number
  ring: Ring
}

export type Positions = Record<string, [number, number, number]>

/** Stable pseudo-random in 0–1, same shape as the one Scene uses. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Fraction of the opening frame each band sits at, before it is pushed clear. */
const RING_RADIUS: Record<Ring, number> = { 1: 0.74, 2: 1.12, 3: 1.85 }

/** Breathing room between the sign-in card and the first band. */
const KEEP_OUT_PAD = 1.3

/**
 * How much of the circle each first-band lobe covers.
 *
 * Kept narrow — a wide lobe reaches the corners, and a corner is where the
 * viewport runs out in both directions at once. The first band has to be whole
 * on arrival, so it hugs the axis the screen is long in.
 */
const LOBE_SPREAD = 1.45

/** Vertical breathing room between stacked cards in the phone column. */
const COLUMN_GAP = 1.5

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/**
 * A card's height in CSS pixels, near enough to keep it from landing on top of
 * its neighbours. Deliberately an estimate: measuring would mean rendering
 * first, and every card here is short prose whose wrapping is predictable.
 */
export function estimateCardHeight(card: LandingCard, width = card.width): number {
  const inner = width - 40 // padding
  const lines = (text: string, charWidth: number) =>
    Math.max(1, Math.ceil(text.length / Math.max(8, inner / charWidth)))

  let h = 38 // padding top + bottom
  h += 20 // eyebrow
  h += lines(card.title, 9.6) * 24
  if (card.body) h += 10 + lines(card.body, 6.5) * 20
  if (card.bullets) h += 10 + card.bullets.reduce((sum, b) => sum + lines(b, 6.3) * 19 + 7, 0)
  if (card.art === 'venn') h += 12 + 104
  if (card.art === 'kinds') h += 12 + 70
  if (card.cta) h += 12 + 42
  h += 12 + 22 // tags
  return h
}

export function landingPositions(items: LandingItem[]): Positions {
  const { halfW, halfH } = restViewport()
  const portrait = halfH > halfW

  const auth = items.find((i) => i.kind === 'auth')
  const out: Positions = {}
  const movable = items.filter((i) => i.kind !== 'auth')

  // Keep-out ellipse around the sign-in card. Items are separated from it by
  // their own half-size on top of this, so the padding is about the gap between
  // two edges rather than between two centres.
  const keepX = (auth?.halfW ?? 0) + KEEP_OUT_PAD
  const keepY = (auth?.halfH ?? 0) + KEEP_OUT_PAD
  if (auth) out[auth.id] = [0, 0, 0]

  // ─── Initial angles ──────────────────────────────────────────────────────
  type Placed = { item: LandingItem; x: number; y: number; pinned: boolean }
  const pts: Placed[] = []

  for (const ring of [1, 2, 3] as Ring[]) {
    const band = movable.filter((i) => i.ring === ring)
    const f = RING_RADIUS[ring]

    // Band one on a phone is a column, not a ring.
    //
    // The sign-in card is half the height of a phone screen and nearly all of
    // its width, so there is no "beside" left over — two cards at one radius
    // land on top of each other, and pushing them apart pushes them both off
    // the sides. Stacking them above and below is the only arrangement a
    // portrait screen actually has room for, and it is the one a phone reads
    // best anyway.
    if (ring === 1 && portrait) {
      let up = keepY
      let down = -keepY
      band.forEach((item, i) => {
        const drift = (rand(item.id.length * 5 + i) - 0.5) * 1.4
        // Downwards first, so the card nearest the fold is the one whose
        // eyebrow and headline come into view — a card peeking from above shows
        // only its tags, which says nothing about what it is.
        if (i % 2 === 0) {
          const y = down - item.halfH - COLUMN_GAP
          down = y - item.halfH
          pts.push({ item, x: drift, y, pinned: true })
        } else {
          const y = up + item.halfH + COLUMN_GAP
          up = y + item.halfH
          pts.push({ item, x: drift, y, pinned: true })
        }
      })
      continue
    }

    band.forEach((item, i) => {
      let angle: number
      if (ring === 1) {
        // Two lobes, left and right of the sign-in card
        const lobe = i % 2
        const perLobe = Math.ceil(band.length / 2)
        const j = Math.floor(i / 2)
        const t = perLobe === 1 ? 0.5 : j / (perLobe - 1)
        angle = (lobe === 0 ? 0 : Math.PI) + (t - 0.5) * LOBE_SPREAD
      } else {
        angle = i * GOLDEN + ring * 1.7
      }
      angle += (rand(item.id.length * 7 + i * 31 + ring) - 0.5) * 0.22

      const jitter = 1 + (rand(i * 13 + ring * 101) - 0.5) * 0.24
      pts.push({
        item,
        x: Math.cos(angle) * halfW * f * jitter,
        y: Math.sin(angle) * halfH * f * jitter,
        pinned: false,
      })
    })
  }

  // ─── Push clear of the sign-in card ──────────────────────────────────────
  const clearCentre = (p: Placed) => {
    if (p.pinned) return
    const a = keepX + p.item.halfW
    const b = keepY + p.item.halfH
    const d = Math.hypot(p.x / a, p.y / b)
    if (d >= 1 || d === 0) return
    const s = 1 / d
    p.x *= s
    p.y *= s
  }
  // Nothing in the first band may be cut off on arrival: it is the band the
  // opening frame holds, and a half-visible card reads as a rendering fault
  // rather than as an invitation to pan. Bands 2 and 3 are meant to run off the
  // edges — that is what makes the canvas feel bigger than the window.
  const keepOnScreen = (p: Placed) => {
    if (p.item.ring !== 1 || portrait) return
    const maxX = halfW - p.item.halfW - 0.3
    const maxY = halfH - p.item.halfH - 0.3
    if (maxX > 0) p.x = Math.max(-maxX, Math.min(maxX, p.x))
    if (maxY > 0) p.y = Math.max(-maxY, Math.min(maxY, p.y))
  }

  /**
   * A card is whole inside the frame or whole outside it, never straddling.
   *
   * A photograph running off the edge reads as a wall that carries on, which is
   * exactly the invitation this page wants to extend. A paragraph cut in half by
   * the edge of the window reads as something that failed to render. So the
   * later bands' cards are nudged the short way out of the frame's boundary —
   * you find them by dragging, and when you do they are complete.
   */
  const clearFrameEdge = (p: Placed) => {
    if (p.item.kind !== 'card' || p.item.ring === 1 || portrait) return
    const { halfW: hw, halfH: hh } = p.item
    const ax = Math.abs(p.x)
    const ay = Math.abs(p.y)
    if (ax + hw <= halfW && ay + hh <= halfH) return   // wholly in frame
    if (ax - hw >= halfW || ay - hh >= halfH) return   // wholly out of frame

    const needX = halfW + hw - ax
    const needY = halfH + hh - ay
    if (needX <= needY) p.x += (p.x >= 0 ? 1 : -1) * needX
    else p.y += (p.y >= 0 ? 1 : -1) * needY
  }

  const settle = () => pts.forEach((p) => { keepOnScreen(p); clearFrameEdge(p); clearCentre(p) })
  settle()

  // ─── Separate items from each other ──────────────────────────────────────
  //
  // Axis-aligned rather than radial: these are rectangles of very different
  // shapes — a nine-line list next to a photo — and pushing them apart along the
  // axis they overlap least in moves each one the shortest distance that
  // actually resolves it.
  const GAP = 0.9
  for (let pass = 0; pass < 90; pass++) {
    let moved = false
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]
        const b = pts[j]
        const minX = a.item.halfW + b.item.halfW + GAP
        const minY = a.item.halfH + b.item.halfH + GAP
        const dx = b.x - a.x
        const dy = b.y - a.y
        const overX = minX - Math.abs(dx)
        const overY = minY - Math.abs(dy)
        if (overX <= 0 || overY <= 0) continue

        // A pinned item does not budge, so the whole correction is spent on
        // the other one. That is what keeps the phone column where it was put
        // instead of being shouldered off screen by the photographs.
        if (a.pinned && b.pinned) continue
        const aShare = a.pinned ? 0 : b.pinned ? 1 : 0.5
        const bShare = 1 - aShare

        if (overX / minX < overY / minY) {
          const push = overX * (dx >= 0 ? 1 : -1)
          a.x -= push * aShare
          b.x += push * bShare
        } else {
          const push = overY * (dy >= 0 ? 1 : -1)
          a.y -= push * aShare
          b.y += push * bShare
        }
        moved = true
      }
    }
    settle()
    if (!moved) break
  }

  // ─── Depth ───────────────────────────────────────────────────────────────
  //
  // Photos get real depth: they are planes in the scene, and the parallax as you
  // pan is most of what makes the canvas feel like a space. Cards get almost
  // none — they are DOM overlays whose size comes from their distance to the
  // camera, so a card set far back would render its copy smaller, which is the
  // one thing this page cannot afford.
  for (const p of pts) {
    // Kept modest. Depth changes a plane's size on screen as well as its
    // parallax, and these photographs are laid out at their nominal size — let
    // one drift far forward and it grows past the gap reserved for it.
    const spread = p.item.kind === 'photo' ? 7 : 2.2
    out[p.item.id] = [p.x, p.y, (rand(p.item.id.length * 3 + p.x) - 0.5) * spread]
  }

  return out
}
