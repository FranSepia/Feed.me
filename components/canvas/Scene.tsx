'use client'

import { useMemo, useState, useEffect, useSyncExternalStore, Suspense, Component, ReactNode } from 'react'
import { NodeData, useCanvasStore } from '@/lib/store'
import { subscribeTextures, getTextureVersion, isTextureReady } from '@/lib/useNodeTexture'
import { ImageNode } from './nodes/ImageNode'
import { TextNode } from './nodes/TextNode'
import { SpotifyNode } from './nodes/SpotifyNode'
import { VideoNode } from './nodes/VideoNode'
import { SocialNode } from './nodes/SocialNode'
import { CameraControls } from './CameraControls'
import { SkeletonNodes } from './SkeletonNodes'

const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

// iOS Safari caps how many media elements can play at once, and every autoplaying
// YouTube node mounts its own iframe. Letting the whole canvas play together was
// enough to lock up a phone, so only the nodes nearest the selection get a slot.
const MAX_AUTOPLAY_VIDEOS = isMobile ? 2 : 4

// How many idle <video> elements may exist on a phone purely to show their first
// frame. Comfortably under iOS's decoder ceiling, but enough that a canvas does
// not look like a wall of blank cards.
const MAX_MOBILE_VIDEO_PREVIEWS = 4

// Must stay >= the largest entrance delay the node components roll for themselves,
// plus enough of the spring to have visibly started
const ENTRANCE_MAX_MS = 500
const FADE_MS = 450

// Isolates a single node's failures. Previously one broken texture threw past the
// canvas-wide boundary in Canvas3D, which rendered null and blanked everything.
class NodeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error) { console.error('[Feed.Me] Node render error:', error) }
  render() { return this.state.hasError ? null : this.props.children }
}

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

// Orbit layout when a node is selected.
//
// This used to be rejection sampling: pick a random point, keep it if it clears
// every card already placed, otherwise keep the "least bad" one after 200 tries.
// That degrades badly as the ring fills — valid spots become rare, so most later
// cards land on the fallback, which is what produced the clumps and the empty
// patches. It also sampled a rectangle rather than the oval the loose layout uses.
//
// Phyllotaxis over an annulus places cards by equal area instead, so even spacing
// is a property of the formula rather than something we hope sampling finds.
function computeOrbitPositions(
  nodes: NodeData[],
  selectedId: string | null
): Record<string, [number, number, number]> {
  if (!selectedId) return {}
  const sel = nodes.find((n) => n.id === selectedId)
  if (!sel) return {}

  const others = nodes.filter((n) => n.id !== selectedId)
  const result: Record<string, [number, number, number]> = {}
  result[selectedId] = sel.position
  if (others.length === 0) return result

  const selTags = sel.tags || []

  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
  // Must match ZOOM_DIST in CameraControls so orbit positions land inside the actual viewport
  const zoomD  = isMobile ? 16 : 14
  const fovV   = isMobile ? 65 : 60
  // Visible half-extents at the selected node's depth (camera sits zoomD units away)
  const halfH  = zoomD * Math.tan((fovV / 2) * Math.PI / 180)
  const halfW  = halfH * aspect

  // Card half-sizes. The orbit scale here mirrors ImageNode's orbitBase, and the
  // width factors allow for the widest aspect ratios in a typical canvas.
  const orbitScale = isMobile ? 0.44 : 0.66
  const cardHalfH  = (3 * orbitScale) / 2
  const cardHalfW  = cardHalfH * 1.6
  const selHalfH   = (3 * 1.75) / 2
  const selHalfW   = selHalfH * 1.4

  // Inset by a card so nothing is half off the edge, then grow with the canvas so
  // density stays constant — the same reason the loose layout scales, which is why
  // that one reads as evenly spread.
  //
  // Phones get a gentler growth and a ceiling: on a narrow portrait screen the
  // desktop factor pushed most of the ring past the edges, leaving the view empty.
  const spread = isMobile
    ? Math.min(1.6, Math.max(1, Math.sqrt(others.length / 45)))
    : Math.max(1, Math.sqrt(others.length / 32))
  const Rx = Math.max(1, halfW - cardHalfW) * spread
  const Ry = Math.max(1, halfH - cardHalfH) * spread

  // Hole left for the selected card.
  //
  // A single normalised radius has to satisfy the tightest axis, and on a portrait
  // phone that is the width — the selected card is nearly as wide as the screen.
  // Applying that same fraction vertically, where Ry is more than twice Rx, carved
  // out a band of dead space above and below it. Desktop is close to square in this
  // respect, so its behaviour is deliberately left alone.
  const rInnerUniform = Math.min(0.62, Math.max(
    (selHalfW + cardHalfW) / Rx,
    (selHalfH + cardHalfH) / Ry,
    0.18
  ))

  // Mobile instead excludes an ellipse shaped like the selected card itself, so
  // each direction only reserves the room that direction actually needs.
  // Scaled slightly under 1 so a card may tuck a little way behind the centre
  // one — they all render behind it, so a partial overlap reads as depth.
  const TUCK = 0.86
  const innerW = (selHalfW + cardHalfW) * TUCK
  const innerH = (selHalfH + cardHalfH) * TUCK

  // Related tags take the inner rings, unrelated get pushed to the outside. The
  // old code multiplied unrelated positions by 2.2 after placement, which threw
  // away the spacing it had just computed — related cards bunched in the middle
  // while unrelated ones scattered and left gaps.
  const related: NodeData[] = []
  const unrelated: NodeData[] = []
  for (const n of others) {
    const isUn = selTags.length > 0 && !n.tags.some((t) => selTags.includes(t))
    ;(isUn ? unrelated : related).push(n)
  }
  const ordered = [...related, ...unrelated]

  const golden = Math.PI * (3 - Math.sqrt(5))
  const total  = ordered.length

  ordered.forEach((node, i) => {
    const angle = i * golden

    // Where the hole ends in this particular direction. Solving the inner ellipse
    // for the ray (Rx·cosθ, Ry·sinθ) gives the fraction of the way out at which a
    // card stops touching the selected one — small above and below, large to the
    // sides, instead of one compromise value everywhere.
    let inner = rInnerUniform
    if (isMobile) {
      const ex = (Math.cos(angle) * Rx) / innerW
      const ey = (Math.sin(angle) * Ry) / innerH
      inner = Math.min(0.92, Math.max(0.12, 1 / Math.sqrt(ex * ex + ey * ey)))
    }

    // sqrt spacing distributes by area, so rings do not crowd toward the centre
    const t = (i + 0.5) / total
    const inner2 = inner * inner
    const r = Math.sqrt(inner2 + t * (1 - inner2))

    // Seeded, so a re-render does not reshuffle the arrangement mid-animation
    const jx = (seededRandom(node.seed * 3 + 7) - 0.5) * Rx * 0.09
    const jy = (seededRandom(node.seed * 5 + 2) - 0.5) * Ry * 0.09

    // Every orbit card sits behind the selected one. They used to be offset by
    // ±4, so about half of them rendered in front and covered the card you had
    // just tapped.
    const isUn = i >= related.length
    const zOffset = isUn
      ? -24 - seededRandom(node.seed + 3) * 10
      : -1.5 - seededRandom(node.seed + 1) * 3

    result[node.id] = [
      sel.position[0] + Math.cos(angle) * Rx * r + jx,
      sel.position[1] + Math.sin(angle) * Ry * r + jy,
      sel.position[2] + zOffset,
    ]
  })

  return result
}

// Filter layout: same oval+golden-angle as normal load, centred at origin.
// Landscape screen → wider horizontal oval. Portrait → taller vertical oval.
// Uses seeded jitter so positions are stable across re-renders.
function computePerimeterPositions(
  nodes: NodeData[],
  filterTags: string[]
): Record<string, [number, number, number]> {
  const matching = nodes.filter((n) => n.tags.some((t) => filterTags.includes(t)))
  const result: Record<string, [number, number, number]> = {}
  if (matching.length === 0) return result

  const count = matching.length
  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
  const base = Math.sqrt(count) * 2.0 + 5
  const Rx = aspect >= 1 ? base * Math.min(aspect, 2.2) * 0.60 : base * 0.60
  const Ry = aspect >= 1 ? base * 0.38 : base * Math.min(1 / aspect, 2.2) * 0.48
  const golden = Math.PI * (3 - Math.sqrt(5))

  matching.forEach((node, i) => {
    const angle = i * golden
    const r = Math.sqrt((i + 0.5) / count)
    const jx = (seededRandom(node.seed * 3 + 7) - 0.5) * Rx * 0.30
    const jy = (seededRandom(node.seed * 5 + 2) - 0.5) * Ry * 0.30
    result[node.id] = [
      Math.cos(angle) * Rx * r + jx,
      Math.sin(angle) * Ry * r + jy,
      (seededRandom(node.seed + 1) - 0.5) * 8,
    ]
  })

  return result
}

export function Scene() {
  const nodes = useCanvasStore((s) => s.nodes)
  const nodesLoaded = useCanvasStore((s) => s.nodesLoaded)
  const selectedNode = useCanvasStore((s) => s.selectedNode)
  const filterTags = useCanvasStore((s) => s.filterTags)

  const filterActive = filterTags.length > 0

  // Now that the arrangement is seeded rather than random, `nodes` can be a real
  // dependency: recomputing gives the same result, so positions stay correct when
  // a node is added or removed while something is selected.
  const orbitPositions = useMemo(
    () => computeOrbitPositions(nodes, selectedNode),
    [nodes, selectedNode]
  )

  const perimeterPositions = useMemo(
    () => filterActive && !selectedNode ? computePerimeterPositions(nodes, filterTags) : {},
    [nodes, filterTags, filterActive, selectedNode]
  )

  const sorted = [...nodes].sort((a, b) =>
    a.id === selectedNode ? 1 : b.id === selectedNode ? -1 : 0
  )

  const selNodeMap = useMemo(() => nodes.find(n => n.id === selectedNode), [nodes, selectedNode])

  // Skeleton lifetime.
  //
  // It used to be tied to `nodesLoaded`, which flips as soon as the DB rows land
  // — a few milliseconds. The slow part is the images that load *after* that, so
  // the skeleton vanished right when the waiting actually started and the canvas
  // sat empty.
  //
  // A texture being decoded still isn't the same as an image being visible: each
  // node waits out a random entrance delay (up to ENTRANCE_MAX_MS) and then flies
  // in on a spring. So we hold the full skeleton until every image is decoded,
  // then keep it up through that entrance window while fading it out, and the
  // real images cross-fade in underneath.
  const textureVersion = useSyncExternalStore(subscribeTextures, getTextureVersion, () => 0)
  const imagesReady = useMemo(
    () => nodesLoaded && nodes.every((n) => n.type !== 'image' || isTextureReady(n.content)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, nodesLoaded, textureVersion]
  )

  const [skeletonMounted, setSkeletonMounted] = useState(true)
  useEffect(() => {
    if (!imagesReady) { setSkeletonMounted(true); return }
    const timer = setTimeout(() => setSkeletonMounted(false), ENTRANCE_MAX_MS + FADE_MS)
    return () => clearTimeout(timer)
  }, [imagesReady])

  // Safety valve: an image that never fires load or error must not pin the
  // skeleton on screen forever.
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 20000)
    return () => clearTimeout(timer)
  }, [])

  const showSkeleton = skeletonMounted && !timedOut

  // Which video nodes keep an idle element for their poster frame. Deliberately
  // derived from canvas order rather than the selection, so selecting a node does
  // not tear down and remount other cards' videos.
  const previewVideoIds = useMemo(() => {
    if (!isMobile) return null
    return new Set(
      nodes.filter((n) => n.type === 'video')
        .slice(0, MAX_MOBILE_VIDEO_PREVIEWS)
        .map((n) => n.id)
    )
  }, [nodes])

  // Which video nodes are allowed to autoplay — nearest to the selection wins
  const autoPlayIds = useMemo(() => {
    if (!selectedNode || !selNodeMap) return new Set<string>()
    const selTags = selNodeMap.tags ?? []
    const eligible = nodes.filter((n) => {
      if (n.type !== 'video' || n.id === selectedNode) return false
      // Dimmed (unrelated) nodes never autoplay, matching the per-node rule below
      return selTags.length === 0 || n.tags.some((t) => selTags.includes(t))
    })
    const selPos = selNodeMap.position
    const dist2 = (n: NodeData) => {
      const p = orbitPositions[n.id] ?? n.position
      return (p[0] - selPos[0]) ** 2 + (p[1] - selPos[1]) ** 2
    }
    return new Set(
      [...eligible].sort((a, b) => dist2(a) - dist2(b))
        .slice(0, MAX_AUTOPLAY_VIDEOS)
        .map((n) => n.id)
    )
  }, [nodes, selectedNode, selNodeMap, orbitPositions])

  return (
    <>
      <CameraControls />
      {showSkeleton && <SkeletonNodes fading={imagesReady} />}
      {sorted.map((node) => {
        const isSelected = selectedNode === node.id

        // Filter dimming only — nodes are always solid during orbit
        const matchesFilter = filterActive
          ? node.tags.some((t) => filterTags.includes(t))
          : true
          
        let isUnrelated = false
        if (selNodeMap && selNodeMap.tags.length > 0 && node.id !== selectedNode) {
          isUnrelated = !node.tags.some(t => selNodeMap.tags.includes(t))
        }

        const isDimmed = (filterActive && !selectedNode && !matchesFilter) || isUnrelated
        const isOrbit = !isSelected && selectedNode !== null

        // Priority: orbit positions > perimeter positions > default position
        const targetPosition =
          orbitPositions[node.id] ??
          perimeterPositions[node.id] ??
          node.position

        const props = { node, isSelected, isDimmed, isOrbit, targetPosition }

        let element: ReactNode = null
        if (node.type === 'image') element = <ImageNode   {...props} />
        else if (node.type === 'text') element = <TextNode    {...props} />
        else if (node.type === 'spotify') element = <SpotifyNode {...props} />
        else if (node.type === 'video') element = (
          <VideoNode
            {...props}
            canAutoPlay={autoPlayIds.has(node.id)}
            canPreview={previewVideoIds ? previewVideoIds.has(node.id) : true}
          />
        )
        else if (node.type === 'social') element = <SocialNode  {...props} />
        if (!element) return null

        // Per-node Suspense so a slow image shows the rest of the canvas instead
        // of holding every node back behind one shared boundary.
        return (
          <NodeErrorBoundary key={node.id}>
            <Suspense fallback={null}>{element}</Suspense>
          </NodeErrorBoundary>
        )
      })}
    </>
  )
}
