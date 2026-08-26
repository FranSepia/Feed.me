'use client'

/**
 * How a DOM card on the landing canvas is sized, and how big it is in world units.
 *
 * drei scales an `<Html distanceFactor={f}>` by `f / (2·tan(fov/2)·distance)`.
 * Every other card on a Feed.Me canvas takes that at face value, which is why a
 * text card is illegible until you click it — at the distance the camera rests
 * at, its 200 px of type is drawn at 87.
 *
 * The landing cannot afford that: its copy is the first thing a visitor reads.
 * So the factor is *derived* from the distance the camera rests at, which makes
 * the scale exactly 1 — every card is drawn at the CSS size it was designed at,
 * on any screen. Zooming into one is then a real zoom rather than a rescue.
 */

const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

/** Mirrors the camera Canvas3D starts with. */
export const REST_DISTANCE = isMobile ? 34 : 20
const REST_FOV = isMobile ? 65 : 60

/** `distanceFactor` that renders a card 1:1 with its CSS size at REST_DISTANCE. */
export const CARD_DISTANCE_FACTOR =
  2 * Math.tan((REST_FOV / 2) * (Math.PI / 180)) * REST_DISTANCE

/** Widest a landing card may be, so it still fits a narrow phone. */
export const MAX_CARD_WIDTH =
  typeof window !== 'undefined' ? Math.min(340, window.innerWidth - 40) : 340

/**
 * World size of a DOM card `cssPx` across.
 *
 * The two conversions — CSS px → screen px, screen px → world units — cancel the
 * camera distance out entirely, leaving only the viewport's *height*: the
 * vertical field of view is what maps world units onto pixels, in both axes.
 */
export function cardWorldSize(cssPx: number): number {
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 900
  return (cssPx * CARD_DISTANCE_FACTOR) / viewportH
}

/** Half-extents of the area the camera can see at rest, in world units. */
export function restViewport(): { halfW: number; halfH: number } {
  const aspect =
    typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
  const halfH = REST_DISTANCE * Math.tan((REST_FOV / 2) * (Math.PI / 180))
  return { halfW: halfH * aspect, halfH }
}
