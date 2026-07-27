'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'

// First-frame thumbnails for video cards that have no live <video> element.
//
// Mobile can only afford a handful of mounted <video> elements at once, and the
// cards without one were plain grey rectangles. Capturing the first frame gives
// them a real preview at the cost of a JPEG.
//
// The capture itself needs a decoder, which is the very thing being rationed —
// so captures run strictly one at a time, on a detached element that is torn
// down immediately afterwards. One transient decoder is nothing like the dozens
// of persistent ones that crashed the page.

const POSTER_WIDTH = 320
const CAPTURE_TIMEOUT_MS = 8000

// value === null means "tried and failed"; missing key means "not tried yet"
const cache = new Map<string, string | null>()
const queued = new Set<string>()
const queue: string[] = []
let running = false

const listeners = new Set<() => void>()
let version = 0

function notify(): void {
  version++
  listeners.forEach((cb) => cb())
}

function capture(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    // Required to read pixels back out of the canvas; without it the canvas is
    // tainted and toDataURL throws
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    let settled = false

    const teardown = () => {
      video.onloadedmetadata = null
      video.onseeked = null
      video.onerror = null
      video.removeAttribute('src')
      // Releases the decoder straight away rather than at the next GC
      video.load()
    }

    const finish = (poster: string | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      teardown()
      resolve(poster)
    }

    const timer = setTimeout(() => finish(null), CAPTURE_TIMEOUT_MS)

    video.onloadedmetadata = () => {
      // Seeking slightly past zero forces a real frame to be fetched; browsers
      // serve this as a range request, so the whole file is never downloaded
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) * 0.1)
      } catch {
        finish(null)
      }
    }

    video.onseeked = () => {
      if (settled) return
      const w = video.videoWidth
      const h = video.videoHeight
      if (!w || !h) { finish(null); return }
      try {
        const scale = Math.min(1, POSTER_WIDTH / w)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(w * scale))
        canvas.height = Math.max(1, Math.round(h * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) { finish(null); return }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        // Tainted canvas (missing CORS headers) or a codec the browser won't paint
        finish(null)
      }
    }

    video.onerror = () => finish(null)
    video.src = url
  })
}

async function pump(): Promise<void> {
  if (running) return
  running = true
  try {
    while (queue.length > 0) {
      const url = queue.shift()!
      queued.delete(url)
      if (cache.has(url)) continue
      cache.set(url, await capture(url))
      notify()
    }
  } finally {
    running = false
  }
}

function requestPoster(url: string): void {
  if (cache.has(url) || queued.has(url)) return
  queued.add(url)
  queue.push(url)
  void pump()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function getVersion(): number {
  return version
}

/**
 * Returns a data-URL thumbnail of the video's first frame, or null while it is
 * still being captured or if capture failed. Pass enabled=false for cards that
 * already show a live <video>.
 */
export function useVideoPoster(url: string, enabled: boolean): string | null {
  const v = useSyncExternalStore(subscribe, getVersion, () => 0)

  useEffect(() => {
    if (enabled && url) requestPoster(url)
  }, [url, enabled])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => cache.get(url) ?? null, [url, v])
}
