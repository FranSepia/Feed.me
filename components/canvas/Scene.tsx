'use client'

import { useMemo, useState, useEffect, useSyncExternalStore, Suspense, Component, ReactNode } from 'react'
import { NodeData, useCanvasStore } from '@/lib/store'
import { subscribeTextures, getTextureVersion, isTextureReady } from '@/lib/useNodeTexture'
import { MAX_LIVE_VIDEOS } from '@/lib/useVideoTexture'
import {
  computeVennLayout, pickVennTags, EMPTY_VENN,
  MAX_ISLANDS_DESKTOP, MAX_ISLANDS_MOBILE,
} from '@/lib/vennLayout'
import { ImageNode } from './nodes/ImageNode'
import { TextNode } from './nodes/TextNode'
import { SpotifyNode } from './nodes/SpotifyNode'
import { VideoNode } from './nodes/VideoNode'
import { SocialNode } from './nodes/SocialNode'
import { AuthNode } from './nodes/AuthNode'
import { HeadlineNode } from './nodes/HeadlineNode'
import { CameraControls, zoomDistance } from './CameraControls'
import { SkeletonNodes } from './SkeletonNodes'
import { VennIslands } from './VennIslands'

const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

// How long the skeleton keeps rendering after it starts fading out. Must stay >=
// the ease in SkeletonItem, so it is already invisible when it unmounts.
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

// Stable 0–1 for a (card, selection) pair. Seeds are small integers, so the two
// are mixed with irrational-ish factors before hashing to keep neighbouring cards
// from landing on neighbouring values.
function pairSeed(nodeSeed: number, selSeed: number) {
  return seededRandom(nodeSeed * 12.9898 + selSeed * 78.233)
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
  // Taken from CameraControls rather than copied, so the ring is always laid out
  // for the distance the camera actually parks at — which is not the same for a
  // photo as for a text or link card
  const zoomD  = zoomDistance(sel.type)
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
  // Deal each group afresh for *this* selection.
  //
  // Slot order used to be the order of `nodes`, which barely changes when the
  // selection moves: the newly selected card leaves the list and the old one
  // rejoins it, so only the cards whose index sat between the two shifted along.
  // Because radius grows with index, that shifted range is a contiguous band —
  // one ring of cards visibly re-placed itself and everything inside and outside
  // it stayed put. Keying the order on the pair (card, selection) instead gives
  // every card a different slot for every selection, so the whole canvas settles
  // into a new arrangement rather than one annulus of it.
  const dealKey = new Map(others.map((n) => [n.id, pairSeed(n.seed, sel.seed)]))
  const deal = (group: NodeData[]) =>
    [...group].sort((a, b) => dealKey.get(a.id)! - dealKey.get(b.id)!)
  const ordered = [...deal(related), ...deal(unrelated)]

  const golden = Math.PI * (3 - Math.sqrt(5))
  const total  = ordered.length

  // Rotating the whole spiral per selection as well, so the slots themselves are
  // somewhere new — a card that happens to be dealt its old index still moves.
  const phase = seededRandom(sel.seed * 7 + 13) * Math.PI * 2

  ordered.forEach((node, i) => {
    const angle = phase + i * golden

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
      ? -10 - seededRandom(node.seed + 3) * 8
      : -1.5 - seededRandom(node.seed + 1) * 3

    // Everything above places the card on the plane the selected one sits on, but
    // the card is then pushed back out of that plane — and under perspective,
    // pushing something back drags it toward the middle of the screen. Unrelated
    // cards were sent 24–34 units back with no correction, so they arrived at
    // roughly a third of the radius they were given: right on top of the card
    // that had just been selected. Widening the offset by the same ratio the
    // extra distance shrinks it by leaves the card exactly where the ring put it.
    const depthFactor = (zoomD - zOffset) / zoomD

    result[node.id] = [
      sel.position[0] + (Math.cos(angle) * Rx * r + jx) * depthFactor,
      sel.position[1] + (Math.sin(angle) * Ry * r + jy) * depthFactor,
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
  const vennActive = useCanvasStore((s) => s.vennActive)
  const setVennFrame = useCanvasStore((s) => s.setVennFrame)

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

  // Venn view: one island per tag, cards that carry two tags in the lens between
  // them. A filter, when one is on, chooses which tags get an island — filter to
  // two tags and you get the classic two-circle diagram of exactly those.
  const venn = useMemo(() => {
    if (!vennActive) return EMPTY_VENN
    const max = isMobile ? MAX_ISLANDS_MOBILE : MAX_ISLANDS_DESKTOP
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
    return computeVennLayout(nodes, pickVennTags(nodes, filterTags, max), isMobile, aspect)
  }, [nodes, filterTags, vennActive])

  // The camera needs the size of the diagram to frame it, and only this component
  // has it
  useEffect(() => {
    setVennFrame(venn.islands.length > 0 ? venn.bounds : null)
  }, [venn, setVennFrame])

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
  // It then waited for *every* texture, which overcorrected: cards arrive one by
  // one, so the placeholders stayed up shimmering behind real photos. The
  // skeleton is a stand-in for an empty canvas, so it only has to last until the
  // canvas stops being empty — the first decoded image starts the fade, and the
  // rest of the cards fly in over a canvas that is already clear.
  const textureVersion = useSyncExternalStore(subscribeTextures, getTextureVersion, () => 0)
  const firstImageReady = useMemo(
    () => nodesLoaded && (
      // A canvas with no images at all has nothing left to wait for
      !nodes.some((n) => n.type === 'image') ||
      nodes.some((n) => n.type === 'image' && isTextureReady(n.content))
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, nodesLoaded, textureVersion]
  )

  const [skeletonMounted, setSkeletonMounted] = useState(true)
  useEffect(() => {
    if (!firstImageReady) { setSkeletonMounted(true); return }
    const timer = setTimeout(() => setSkeletonMounted(false), FADE_MS)
    return () => clearTimeout(timer)
  }, [firstImageReady])

  // Safety valve: an image that never fires load or error must not pin the
  // skeleton on screen forever.
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 20000)
    return () => clearTimeout(timer)
  }, [])

  const showSkeleton = skeletonMounted && !timedOut

  // Which video nodes get a live element. Every video loops silently from the
  // moment it loads, but each live one holds a hardware decoder and a phone only
  // has a few — past the cap, the rest show their captured first frame.
  //
  // Deliberately derived from canvas order rather than the selection, so choosing
  // a card does not tear down and restart every other video on the canvas.
  const liveVideoIds = useMemo(() => {
    const videos = nodes.filter((n) => n.type === 'video')
    if (videos.length <= MAX_LIVE_VIDEOS) return null   // null: no rationing needed
    return new Set(videos.slice(0, MAX_LIVE_VIDEOS).map((n) => n.id))
  }, [nodes])

  return (
    <>
      <CameraControls />
      {showSkeleton && <SkeletonNodes fading={firstImageReady} />}
      {vennActive && !selectedNode && <VennIslands islands={venn.islands} />}
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

        // In the Venn view the cards that belong to no island are the ones held back
        const isDimmed =
          (filterActive && !selectedNode && !matchesFilter) ||
          isUnrelated ||
          (vennActive && !selectedNode && venn.outsiders.has(node.id))

        // Cards take orbit size inside the diagram too — a wall of full-size cards
        // would bury the circles they are supposed to be sitting in
        const isOrbit = !isSelected && (selectedNode !== null || vennActive)

        // Priority: orbit > Venn > perimeter > wherever the card normally lives.
        // Orbit wins because selecting a card is a request to look at that card.
        const targetPosition =
          orbitPositions[node.id] ??
          venn.positions[node.id] ??
          perimeterPositions[node.id] ??
          node.position

        const props = { node, isSelected, isDimmed, isOrbit, targetPosition }

        let element: ReactNode = null
        if (node.type === 'image') element = <ImageNode   {...props} />
        else if (node.type === 'text') element = <TextNode    {...props} />
        else if (node.type === 'spotify') element = <SpotifyNode {...props} />
        else if (node.type === 'video') element = (
          <VideoNode {...props} canPlay={liveVideoIds ? liveVideoIds.has(node.id) : true} />
        )
        else if (node.type === 'social') element = <SocialNode  {...props} />
        // Landing-only cards — see components/landing
        else if (node.type === 'auth') element = <AuthNode     {...props} />
        else if (node.type === 'headline') element = <HeadlineNode {...props} />
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
