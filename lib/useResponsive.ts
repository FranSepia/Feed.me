import { useState, useEffect } from 'react'

export function useResponsive() {
  // Start with 1200 (desktop) as SSR-safe default, correct immediately on mount
  const [w, setW] = useState(1200)

  useEffect(() => {
    // Set real width on mount — this is the critical fix for real mobile devices
    setW(window.innerWidth)
    const handler = () => setW(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return {
    isMobile: w < 600,
    isTablet: w >= 600 && w < 1024,
    isDesktop: w >= 1024,
    width: w,
  }
}
