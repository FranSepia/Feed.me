'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// A looping video painted onto the same kind of plane a photo uses.
//
// Video cards used to be DOM overlays (drei's <Html>), and a DOM overlay is not
// part of the scene: it sits on top of the WebGL canvas, so it covered every
// photo it crossed no matter which of the two was actually nearer the camera.
// As a texture the card is an ordinary object again — it shrinks with the orbit,
// sorts by depth, and passes behind the photos in front of it.
//
// YouTube nodes still have to be an iframe; nothing else can play them.

/**
 * Live elements are rationed. Each one holds a hardware decoder, and iOS gives a
 * page only a handful before it starts refusing — or dropping the WebGL context
 * and taking the canvas with it. Cards without a slot show their captured first
 * frame instead.
 */
export const MAX_LIVE_VIDEOS = typeof window !== 'undefined' && window.innerWidth < 600 ? 4 : 12

interface VideoTextureState {
  texture: THREE.VideoTexture | null
  /** Real aspect ratio once the metadata is in, null until then */
  aspect: number | null
  /** False until there is a frame to paint, so the card can show a badge meanwhile */
  ready: boolean
}

/**
 * @param active whether this card holds one of the live decoder slots
 * @param withSound only the selected card gets audio; everything else loops muted
 */
export function useVideoTexture(url: string, active: boolean, withSound: boolean): VideoTextureState {
  const [state, setState] = useState<VideoTextureState>({ texture: null, aspect: null, ready: false })
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!active || !url) return

    const video = document.createElement('video')
    // Needed for the texture upload to be allowed on a cross-origin file
    video.crossOrigin = 'anonymous'
    video.loop = true
    // Muted is what makes autoplay legal everywhere; sound is granted separately
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.preload = 'auto'
    video.src = url

    const texture = new THREE.VideoTexture(video)
    // A video frame is re-uploaded every frame, so mipmaps would be rebuilt every
    // frame too — far more expensive than the sharpness is worth
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false

    const onMetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        setState((s) => ({ ...s, aspect: video.videoWidth / video.videoHeight }))
      }
    }
    const onData = () => setState((s) => ({ ...s, ready: true }))
    video.addEventListener('loadedmetadata', onMetadata)
    video.addEventListener('loadeddata', onData)

    videoRef.current = video
    setState({ texture, aspect: null, ready: false })
    void video.play().catch(() => {})

    return () => {
      video.removeEventListener('loadedmetadata', onMetadata)
      video.removeEventListener('loadeddata', onData)
      video.pause()
      video.removeAttribute('src')
      // Hands the decoder back now instead of whenever the element is collected
      video.load()
      texture.dispose()
      videoRef.current = null
      setState({ texture: null, aspect: null, ready: false })
    }
  }, [url, active])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !withSound
    // Unmuting is only permitted off the back of a gesture; selecting the card is
    // one, and if the browser disagrees the card simply keeps playing silently
    if (withSound) void video.play().catch(() => { video.muted = true })
  }, [withSound, state.texture])

  return state
}

/** Loads a captured poster frame as a texture for cards with no live slot */
export function usePosterTexture(dataUrl: string | null): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!dataUrl) { setTexture(null); return }
    let cancelled = false
    let created: THREE.Texture | null = null
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      created = new THREE.Texture(image)
      created.minFilter = THREE.LinearFilter
      created.magFilter = THREE.LinearFilter
      created.generateMipmaps = false
      created.needsUpdate = true
      setTexture(created)
    }
    image.src = dataUrl
    return () => {
      cancelled = true
      created?.dispose()
      setTexture(null)
    }
  }, [dataUrl])

  return texture
}
