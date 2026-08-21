'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Shared motion constants for every card on the canvas.
 *
 * The camera integrates this same spring (see CameraControls), which is the
 * point of exporting it: selecting a different card moves the whole ring and the
 * camera by the same vector, so as long as both follow the identical curve that
 * shared travel cancels out on screen and only the real re-layout is visible.
 * When the camera used a plain lerp instead, it left at full speed while the
 * cards were still accelerating, and every card appeared to lurch backwards
 * before catching up.
 */
export const NODE_SPRING = { mass: 1.4, tension: 120, friction: 28 }

/** Longest a card may wait before flying in on first load */
const ENTRANCE_MAX_MS = 500

/**
 * Staggers a card's arrival on first load, then stops.
 *
 * react-spring applies `delay` to *every* update, not just the first, so a fixed
 * per-card delay also held up the re-layout that follows a selection: the camera
 * started moving immediately while cards sat still for up to half a second, then
 * scrambled to catch up. That head start was the whip. The entrance stagger is
 * still worth having, so the delay simply retires once it has been spent.
 */
export function useEntranceDelay(): number {
  const delay = useRef(Math.floor(Math.random() * ENTRANCE_MAX_MS))
  const [spent, setSpent] = useState(false)

  useEffect(() => {
    // Small margin so the entrance has definitely started before the delay drops
    const timer = setTimeout(() => setSpent(true), delay.current + 80)
    return () => clearTimeout(timer)
  }, [])

  return spent ? 0 : delay.current
}

/**
 * One depth scale for every DOM overlay on the canvas.
 *
 * drei maps an <Html>'s distance from the camera onto the z-index range it is
 * given, so ranges only sort against each other if they are the same range. They
 * were not: video cards sat in [50, 0], social and text in [15, 5], an image's
 * caption in [10, 0]. A card's depth in the scene therefore had almost nothing to
 * do with what it covered — a video two rings out still painted over everything
 * in front of it, because 50 beats 15 wherever the two happen to be standing.
 *
 * The range is wide because the mapping is linear over the camera's whole
 * near–far span: a narrow one collapses the entire canvas onto a couple of
 * values, which is how cards that are metres apart ended up tied.
 */
export const HTML_DEPTH: [number, number] = [16_000_000, 100]

/** Reserved band above every other card, so nothing can cover the selection */
export const HTML_DEPTH_SELECTED: [number, number] = [16_777_271, 16_700_000]

export function htmlDepth(isSelected: boolean): [number, number] {
  return isSelected ? HTML_DEPTH_SELECTED : HTML_DEPTH
}

/**
 * Makes a DOM card shrink into the orbit the way a mesh card does.
 *
 * drei sizes an <Html> from its distance to the camera alone and ignores the
 * scale of the mesh it hangs off, so the spring that pulls every other card down
 * to orbit size never reached the DOM ones. They stayed full size while the
 * photos around them shrank, which is why videos and links looked like they were
 * looming over the canvas — and why they reached into the gap the layout had
 * reserved for the selected card. Re-applying the same scale in CSS puts them
 * back on the same footing.
 */
export function htmlCardScale(scale: number): { transform: string; transition: string } {
  return {
    transform: `scale(${scale})`,
    // Close to how long NODE_SPRING takes to settle, so a DOM card resizes
    // alongside the meshes rather than snapping to its new size. Opacity rides
    // along because a card that sets both would otherwise drop one of them.
    transition: 'transform 520ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.4s',
  }
}
