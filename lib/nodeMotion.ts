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
