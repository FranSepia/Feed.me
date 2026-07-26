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

const MAX_TEXTURE_SIZE = typeof window !== 'undefined' && window.innerWidth < 600 ? 768 : 1280

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

function loadDownscaled(url: string): Promise<THREE.Texture> {
  return new Promise((resolve) => {
    const img = new Image()
    // Matches THREE.TextureLoader's default; required to draw into a canvas untainted
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      const scale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(w, h))

      // Already small enough — use it directly, no redraw
      if (scale >= 1) {
        const texture = new THREE.Texture(img)
        texture.needsUpdate = true
        resolve(texture)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        const texture = new THREE.Texture(img)
        texture.needsUpdate = true
        resolve(texture)
        return
      }
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      resolve(texture)
    }

    img.onerror = () => resolve(makePlaceholder())
    img.src = url
  })
}

// Textures stay cached for the life of the page. They are small enough after
// downscaling that this is cheaper than reloading on every re-layout, and node
// URLs are stable.
export function useNodeTexture(url: string): THREE.Texture {
  const entry = cache.get(url)
  if (entry?.status === 'done') return entry.texture
  if (entry?.status === 'pending') throw entry.promise

  const promise = loadDownscaled(url).then((texture) => {
    cache.set(url, { status: 'done', texture })
    version++
    listeners.forEach((cb) => cb())
  })
  cache.set(url, { status: 'pending', promise })
  throw promise
}
