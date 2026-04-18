'use client'

import { useMemo } from 'react'
import { NodeData, useCanvasStore } from '@/lib/store'
import { ImageNode } from './nodes/ImageNode'
import { TextNode } from './nodes/TextNode'
import { SpotifyNode } from './nodes/SpotifyNode'
import { VideoNode } from './nodes/VideoNode'
import { SocialNode } from './nodes/SocialNode'
import { CameraControls } from './CameraControls'

const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

// Orbit layout when a node is selected — random every click, no overlaps.
// Uses Math.random() so each tap/click gives a fresh arrangement.
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

  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
  const zoomD  = isMobile ? 13 : 7.5
  const fovV   = isMobile ? 65 : 60
  // Visible area at the zoom depth (camera will sit zoomD units in front of selected node)
  const halfH  = zoomD * Math.tan((fovV / 2) * Math.PI / 180) * 0.80
  const halfW  = halfH * aspect

  // selExclude must be small enough to fit inside the visible screen.
  // At desktop zoom: visible half-height ≈ 4.3 units — 9.0 was larger than the screen diagonal!
  // selExclude ≈ half the selected image height (1.75 × 3 = 5.25, half ≈ 2.6) + orbit image half-height
  const selExclude = isMobile ? 4.0 : 3.4
  const minDist    = isMobile ? 3.2 : 2.8

  // placed[0] = selected node at relative origin
  const placed: [number, number][] = [[0, 0]]

  others.forEach((node) => {
    let bx = 0, by = 0, bestDist = -1

    for (let a = 0; a < 160; a++) {
      const cx = (Math.random() * 2 - 1) * halfW
      const cy = (Math.random() * 2 - 1) * halfH

      // Check distance against each placed node with its own threshold
      let ok = true
      let worstGap = Infinity
      for (let pi = 0; pi < placed.length; pi++) {
        const [px, py] = placed[pi]
        const d = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2)
        const threshold = pi === 0 ? selExclude : minDist
        const gap = d - threshold
        if (gap < 0) { ok = false; worstGap = Math.min(worstGap, gap); break }
        worstGap = Math.min(worstGap, gap)
      }

      if (ok) { bx = cx; by = cy; break }
      if (worstGap > bestDist) { bestDist = worstGap; bx = cx; by = cy }
    }

    placed.push([bx, by])
    // Orbit nodes go behind the selected node so there is clear depth separation
    const zBehind = sel.position[2] - 1.5 - Math.random() * 2.5
    result[node.id] = [
      sel.position[0] + bx,
      sel.position[1] + by,
      zBehind,
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
  const selectedNode = useCanvasStore((s) => s.selectedNode)
  const filterTags = useCanvasStore((s) => s.filterTags)

  const filterActive = filterTags.length > 0

  // Re-randomize only when the selected node ID changes — not on every render.
  // This gives a fresh random scatter each time a node is tapped/clicked.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const orbitPositions = useMemo(
    () => computeOrbitPositions(nodes, selectedNode),
    [selectedNode]
  )

  const perimeterPositions = useMemo(
    () => filterActive && !selectedNode ? computePerimeterPositions(nodes, filterTags) : {},
    [nodes, filterTags, filterActive, selectedNode]
  )

  const sorted = [...nodes].sort((a, b) =>
    a.id === selectedNode ? 1 : b.id === selectedNode ? -1 : 0
  )

  return (
    <>
      <CameraControls />
      {sorted.map((node) => {
        const isSelected = selectedNode === node.id

        // Filter dimming only — nodes are always solid during orbit
        const matchesFilter = filterActive
          ? node.tags.some((t) => filterTags.includes(t))
          : true
        const isDimmed = filterActive && !selectedNode && !matchesFilter
        const isOrbit = !isSelected && selectedNode !== null

        // Priority: orbit positions > perimeter positions > default position
        const targetPosition =
          orbitPositions[node.id] ??
          perimeterPositions[node.id] ??
          node.position

        const props = { key: node.id, node, isSelected, isDimmed, isOrbit, targetPosition }

        if (node.type === 'image') return <ImageNode   {...props} />
        if (node.type === 'text') return <TextNode    {...props} />
        if (node.type === 'spotify') return <SpotifyNode {...props} />
        if (node.type === 'video') return <VideoNode   {...props} />
        if (node.type === 'social') return <SocialNode  {...props} />
        return null
      })}
    </>
  )
}
