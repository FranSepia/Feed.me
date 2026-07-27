'use client'

import { useEffect, useState } from 'react'
import * as THREE from 'three'

// Suspense-backed texture loader that downscales before handing the image to the GPU.
//
// WHY this exists instead of drei's useTexture:
//   useTexture uploads the image at its full decoded resolution. A canvas node is
//   drawn about 300–400 px wide on screen, but the stored file is 1600 px or more,
//   so each texture cost ~15 MB of VRAM (plus mipmaps) for detail nobody can see.
//   Twenty images was enough to exhaust a phone GPU's budget, lose the WebGL
//   context and take the whole canvas down with it.
//
//   Capping the longest edge fixes it for images that are *already uploaded*,
//   which the upload-side compression cannot do.

const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

// Adaptive budget for the wide view. Still scales with how busy the canvas is,
// but the floor is far higher than it was — the earlier 384 px cap kept memory
// safe at a visible cost in sharpness, and quality is the priority.
//
// Whatever this leaves on the table is recovered by HIGH_RES_SIZE below: the
// image you actually look at closely is reloaded at full detail.
let maxTextureSize = isMobile ? 1024 : 1600

export function configureTextureBudget(imageCount: number): void {
  maxTextureSize = isMobile
    ? imageCount > 50 ? 640 : imageCount > 25 ? 800 : 1024
    : imageCount > 60 ? 1200 : 1600
}

// Resolution for the selected node. Only a couple of these exist at any moment,
// so they can be generous without threatening the memory ceiling.
const HIGH_RES_SIZE = isMobile ? 1600 : 2400
const HIGH_RES_CACHE_LIMIT = 3

// Decoding a full canvas of images at once produces a memory spike large enough
// to lose the WebGL context on mobile, even though each finished texture is small.
// Loads are therefore funnelled through a small queue.
const MAX_CONCURRENT_LOADS = isMobile ? 3 : 6
let activeLoads = 0
const waiting: (() => void)[] = []

function acquireSlot(): Promise<void> {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads++
    return Promise.resolve()
  }
  return new Promise((resolve) => waiting.push(() => { activeLoads++; resolve() }))
}

function releaseSlot(): void {
  activeLoads--
  waiting.shift()?.()
}

type Entry =
  | { status: 'pending'; promise: Promise<void> }
  | { status: 'done'; texture: THREE.Texture }

const cache = new Map<string, Entry>()

// Lets the scene keep its skeleton up until the images are actually on screen,
// rather than until the database rows arrive.
const listeners = new Set<() => void>()
let version = 0

export function subscribeTextures(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function getTextureVersion(): number {
  return version
}

export function isTextureReady(url: string): boolean {
  return cache.get(url)?.status === 'done'
}

// A broken URL resolves to this instead of rejecting, so one dead image can't
// throw during render and blank the entire scene.
function makePlaceholder(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = 'rgba(150,150,150,0.30)'
    ctx.fillRect(0, 0, 1, 1)
  }
  return new THREE.CanvasTexture(canvas)
}

// Sharpens the minified case, which is most of the canvas most of the time.
// three clamps this to whatever the GPU actually supports when it uploads.
function tune(texture: THREE.Texture): THREE.Texture {
  texture.anisotropy = 4
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function decode(url: string, size: number): Promise<THREE.Texture> {
  return new Promise((resolve) => {
    const img = new Image()
    // Matches THREE.TextureLoader's default; required to draw into a canvas untainted
    img.crossOrigin = 'anonymous'

    const finish = (texture: THREE.Texture) => {
      // Drop the decoded source so the browser can reclaim it instead of holding
      // the full-size bitmap alongside the downscaled copy we actually use
      img.onload = null
      img.onerror = null
      img.src = ''
      resolve(texture)
    }

    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const scale = Math.min(1, size / Math.max(w, h))

      // Already small enough — use it directly, no redraw
      if (scale >= 1) {
        resolve(tune(new THREE.Texture(img)))   // keeps `img` alive, which this texture points at
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(tune(new THREE.Texture(img)))
        return
      }
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      finish(tune(new THREE.CanvasTexture(canvas)))
    }

    img.onerror = () => finish(makePlaceholder())
    img.src = url
  })
}

async function loadAtSize(url: string, size: number): Promise<THREE.Texture> {
  await acquireSlot()
  try {
    return await decode(url, size)
  } finally {
    releaseSlot()
  }
}

// High-resolution copies, kept on a short LRU. Only the selected node asks for
// one, so the cap is about surviving rapid selection changes, not volume.
const highResCache = new Map<string, THREE.Texture>()
const highResOrder: string[] = []
const highResPending = new Map<string, Promise<THREE.Texture>>()

function touchHighRes(url: string): void {
  const i = highResOrder.indexOf(url)
  if (i >= 0) highResOrder.splice(i, 1)
  highResOrder.push(url)
}

async function loadHighRes(url: string): Promise<THREE.Texture> {
  const cached = highResCache.get(url)
  if (cached) { touchHighRes(url); return cached }

  const inflight = highResPending.get(url)
  if (inflight) return inflight

  const promise = loadAtSize(url, HIGH_RES_SIZE)
  highResPending.set(url, promise)

  const texture = await promise
  highResPending.delete(url)
  highResCache.set(url, texture)
  touchHighRes(url)

  // Evict oldest first, so what just got selected is never the thing freed
  while (highResOrder.length > HIGH_RES_CACHE_LIMIT) {
    const oldest = highResOrder.shift()!
    highResCache.get(oldest)?.dispose()
    highResCache.delete(oldest)
  }

  return texture
}

/**
 * Base textures stay cached for the life of the page; node URLs are stable and
 * reloading on every re-layout would cost more than keeping them.
 *
 * Pass highRes for the node the user is actually looking at. It renders at the
 * shared resolution first and swaps in the detailed copy when that arrives, so
 * selecting never blanks the card.
 */
export function useNodeTexture(url: string, highRes = false): THREE.Texture {
  const [detailed, setDetailed] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!highRes) { setDetailed(null); return }
    let cancelled = false
    loadHighRes(url).then((texture) => { if (!cancelled) setDetailed(texture) })
    return () => { cancelled = true }
  }, [url, highRes])

  const entry = cache.get(url)
  if (entry?.status === 'done') return detailed ?? entry.texture
  if (entry?.status === 'pending') throw entry.promise

  const promise = loadAtSize(url, maxTextureSize).then((texture) => {
    cache.set(url, { status: 'done', texture })
    version++
    listeners.forEach((cb) => cb())
  })
  cache.set(url, { status: 'pending', promise })
  throw promise
}
