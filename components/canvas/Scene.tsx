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

// Orbit layout when a node is selected — all nodes scatter at the same Z,
// randomly placed across the visible area, with minimum-distance enforcement
// to prevent overlapping.
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
  // Compute half-extents of the visible area at the selected node's depth
  const depth  = zoomD + 2
  const fovV   = isMobile ? 65 : 60
  const halfH  = depth * Math.tan((fovV / 2) * Math.PI / 180) * 0.82
  const halfW  = halfH * aspect
  // Minimum separation between node centres (scaled-down orbit size ≈ 3 units)
  const minDist = isMobile ? 4.2 : 5.0

  // Start with selected node occupying the centre
  const placed: [number, number][] = [[0, 0]]

  others.forEach((node) => {
    let bx = 0, by = 0
    let found = false

    // Try up to 40 seeded positions; pick the first that doesn't overlap
    for (let attempt = 0; attempt < 40 && !found; attempt++) {
      const cx = (seededRandom(node.seed * 7 + attempt * 17 + 1) * 2 - 1) * halfW
      const cy = (seededRandom(node.seed * 5 + attempt * 13 + 3) * 2 - 1) * halfH
      const tooClose = placed.some(([px, py]) =>
        Math.sqrt((cx - px) ** 2 + (cy - py) ** 2) < minDist
      )
      if (!tooClose) { bx = cx; by = cy; found = true }
    }
    if (!found) {
      // Fallback: use raw seeded position (no overlap guarantee but no hang)
      bx = (seededRandom(node.seed * 7 + 1) * 2 - 1) * halfW
      by = (seededRandom(node.seed * 5 + 3) * 2 - 1) * halfH
    }
    placed.push([bx, by])

    // Tiny Z jitter (±0.8) — visually natural, never "in front of" or "behind"
    const zJitter = (seededRandom(node.seed * 3 + 9) - 0.5) * 1.6
    result[node.id] = [
      sel.position[0] + bx,
      sel.position[1] + by,
      sel.position[2] + zJitter,
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

  const count  = matching.length
  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
  const base   = Math.sqrt(count) * 3.2 + 6
  const Rx     = aspect >= 1 ? base * Math.min(aspect, 2.2) * 0.68 : base * 0.68
  const Ry     = aspect >= 1 ? base * 0.44 : base * Math.min(1 / aspect, 2.2) * 0.55
  const golden = Math.PI * (3 - Math.sqrt(5))

  matching.forEach((node, i) => {
    const angle = i * golden
    const r     = Math.sqrt((i + 0.5) / count)
    const jx    = (seededRandom(node.seed * 3 + 7) - 0.5) * Rx * 0.30
    const jy    = (seededRandom(node.seed * 5 + 2) - 0.5) * Ry * 0.30
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

  return (
    <>
      <CameraControls />
      {sorted.map((node) => {
        const isSelected = selectedNode === node.id

        // Orbit/dim logic (when something is selected)
        const isRelated = selectedNode
          ? nodes.find((n) => n.id === selectedNode)?.tags.some((t) => node.tags.includes(t)) ?? false
          : true
        const orbitDimmed = selectedNode !== null && !isSelected && !isRelated

        // Filter logic (when filter is active and nothing is selected)
        const matchesFilter = filterActive
          ? node.tags.some((t) => filterTags.includes(t))
          : true
        const filterDimmed = filterActive && !selectedNode && !matchesFilter

        const isDimmed = orbitDimmed || filterDimmed
        const isOrbit = !isSelected && selectedNode !== null

        // Priority: orbit positions > perimeter positions > default position
        const targetPosition =
          orbitPositions[node.id] ??
          perimeterPositions[node.id] ??
          node.position

        const props = { key: node.id, node, isSelected, isDimmed, isOrbit, targetPosition }

        if (node.type === 'image')   return <ImageNode   {...props} />
        if (node.type === 'text')    return <TextNode    {...props} />
        if (node.type === 'spotify') return <SpotifyNode {...props} />
        if (node.type === 'video')   return <VideoNode   {...props} />
        if (node.type === 'social')  return <SocialNode  {...props} />
        return null
      })}
    </>
  )
}
