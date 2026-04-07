import { useState, useEffect } from 'react'

export function useResponsive() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
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
