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

// Browsers that refuse muted autoplay outright (a Safari power-saving setting,
// or a phone in low-power mode) only relent after the page has been touched. The
// first gesture anywhere therefore starts everything that is still waiting, so
// nobody has to tap each card individually.
const pending = new Set<() => void>()
let gestureBound = false

function bindGesture(): void {
  if (gestureBound || typeof window === 'undefined') return
  gestureBound = true
  const start = () => pending.forEach((play) => play())
  const opts = { passive: true } as const
  window.addEventListener('pointerdown', start, opts)
  window.addEventListener('touchstart', start, opts)
  window.addEventListener('keydown', start, opts)
}

function registerPending(play: () => void): void {
  bindGesture()
  pending.add(play)
}

function unregisterPending(play: () => void): void {
  pending.delete(play)
}

interface VideoTextureState {
  texture: THREE.VideoTexture | null
  /** Real aspect ratio once the metadata is in, null until then */
  aspect: number | null
  /** False until there is a frame to paint, so the card can show a badge meanwhile */
  ready: boolean
  /** The source could not be played at all — bad codec, dead link, missing CORS */
  failed: boolean
}

/**
 * @param active whether this card holds one of the live decoder slots
 * @param withSound only the selected card gets audio; everything else loops muted
 */
export function useVideoTexture(url: string, active: boolean, withSound: boolean): VideoTextureState {
  const [state, setState] = useState<VideoTextureState>({ texture: null, aspect: null, ready: false, failed: false })
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!active || !url) return

    const video = document.createElement('video')
    // Needed for the texture upload to be allowed on a cross-origin file
    video.crossOrigin = 'anonymous'
    video.loop = true
    // Muted is what makes autoplay legal at all; sound is granted separately, and
    // both the property and the attribute have to be set before the source loads
    // or Safari decides this is a video with audio and refuses to start it
    video.muted = true
    video.defaultMuted = true
    video.setAttribute('muted', '')
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.autoplay = true
    video.setAttribute('autoplay', '')
    video.preload = 'auto'

    // A detached element is enough for Chrome, but WebKit will not decode frames
    // for a video that is not in the document — the difference between a card
    // that plays by itself and one that waits to be tapped. It goes in as a
    // single transparent pixel: still inside the viewport, because browsers stop
    // producing frames for a video they consider hidden or scrolled away, and
    // display:none would do exactly that.
    video.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.01;pointer-events:none'
    document.body.appendChild(video)

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
    const onData = () => setState((s) => ({ ...s, ready: true, failed: false }))
    const onError = () => setState((s) => ({ ...s, ready: false, failed: true }))

    // Calling play() straight after assigning src is too early: there is nothing
    // to play yet, the promise rejects, and nothing ever asks again — which is why
    // the cards used to sit still until they were clicked. Every event that means
    // "there is more of this video now" asks again instead.
    const tryPlay = () => { if (video.paused) void video.play().catch(() => {}) }

    video.addEventListener('loadedmetadata', onMetadata)
    video.addEventListener('loadeddata', onData)
    video.addEventListener('error', onError)
    video.addEventListener('loadeddata', tryPlay)
    video.addEventListener('canplay', tryPlay)
    video.addEventListener('canplaythrough', tryPlay)
    // Backgrounding a tab pauses these; coming back should not need a click
    video.addEventListener('pause', tryPlay)
    document.addEventListener('visibilitychange', tryPlay)

    // Last resort for a browser that refuses muted autoplay outright: the first
    // touch anywhere on the page starts everything that is still waiting
    registerPending(tryPlay)

    videoRef.current = video
    setState({ texture, aspect: null, ready: false, failed: false })
    tryPlay()

    return () => {
      unregisterPending(tryPlay)
      document.removeEventListener('visibilitychange', tryPlay)
      video.removeEventListener('loadedmetadata', onMetadata)
      video.removeEventListener('loadeddata', onData)
      video.removeEventListener('error', onError)
      video.removeEventListener('loadeddata', tryPlay)
      video.removeEventListener('canplay', tryPlay)
      video.removeEventListener('canplaythrough', tryPlay)
      video.removeEventListener('pause', tryPlay)
      video.pause()
      video.removeAttribute('src')
      // Hands the decoder back now instead of whenever the element is collected
      video.load()
      video.remove()
      texture.dispose()
      videoRef.current = null
      setState({ texture: null, aspect: null, ready: false, failed: false })
    }
  }, [url, active])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !withSound
    // Unmuting is only permitted off the back of a gesture; selecting the card is
    // one, and a browser that disagrees must still be left with a looping video
    // rather than a stopped one
    void video.play().catch(() => {
      video.muted = true
      void video.play().catch(() => {})
    })
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
