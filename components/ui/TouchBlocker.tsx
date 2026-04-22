'use client'

import { useEffect } from 'react'

export function TouchBlocker() {
  useEffect(() => {
    // Prevent iOS Safari from interpreting two-finger pinches as a native zoom gesture
    const handleGestureStart = (e: Event) => {
      e.preventDefault()
    }
    
    // Fallback: prevent native scaling when two fingers are touching the screen and moving
    const handleTouchMove = (e: TouchEvent) => {
      // If we are pinching (2 or more fingers) and the target isn't an explicit scrollable container
      if (e.scale !== undefined && e.scale !== 1) {
        e.preventDefault();
      }
    }

    document.addEventListener('gesturestart', handleGestureStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove as any, { passive: false })

    return () => {
      document.removeEventListener('gesturestart', handleGestureStart)
      document.removeEventListener('touchmove', handleTouchMove as any)
    }
  }, [])

  return null
}
