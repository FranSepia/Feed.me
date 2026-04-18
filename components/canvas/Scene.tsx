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

// Orbit layout when a node is selected — random every click, even distribution.
// Uses a jittered grid: divides the visible ellipse into cells so every region
// gets covered, then shuffles so assignment is random. z-range gives real depth.
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

  const N = others.length
  if (N === 0) return result

  const aspect    = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
  const zoomD     = isMobile ? 16 : 14
  const fovV      = isMobile ? 65 : 60
  const halfH     = zoomD * Math.tan((fovV / 2) * Math.PI / 180) * 0.82
  const halfW     = halfH * aspect
  const selExclude = isMobile ? 3.8 : 4.2   // clear zone around selected node
  const zRange     = isMobile ? 2.5 : 4.5   // ±depth spread in world units

  // --- Jittered-grid candidate generation ---
  // Divide the visible ellipse into a fine grid; one random candidate per cell.
  // Cells that fall inside the exclusion zone or outside the ellipse are skipped.
  // This guarantees uniform spatial coverage; shuffle makes assignment random.
  const gridCols = Math.ceil(Math.sqrt(N * aspect) * 2.4)
  const gridRows = Math.ceil(Math.sqrt(N / aspect) * 2.4)
  const cellW    = (halfW * 2) / gridCols
  const cellH    = (halfH * 2) / gridRows

  const candidates: [number, number][] = []
  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const cx = -halfW + (col + Math.random()) * cellW
      const cy = -halfH + (row + Math.random()) * cellH
      if ((cx / halfW) ** 2 + (cy / halfH) ** 2 > 1) continue   // outside ellipse
      if (Math.sqrt(cx ** 2 + cy ** 2) < selExclude) continue    // too close to selected
      candidates.push([cx, cy])
    }
  }

  // Fisher-Yates shuffle — every node gets a uniformly random cell
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  others.forEach((node, idx) => {
    let bx: number, by: number
    if (idx < candidates.length) {
      ;[bx, by] = candidates[idx]
    } else {
      // Fallback for overflow: random point inside ellipse, outside exclusion
      let fx = 0, fy = 0
      for (let a = 0; a < 80; a++) {
        fx = (Math.random() * 2 - 1) * halfW
        fy = (Math.random() * 2 - 1) * halfH
        if ((fx / halfW) ** 2 + (fy / halfH) ** 2 <= 1 && Math.sqrt(fx ** 2 + fy ** 2) >= selExclude) break
      }
      bx = fx; by = fy
    }

    result[node.id] = [
      sel.position[0] + bx,
      sel.position[1] + by,
      // Spread across ±zRange — nodes closer/further create real sense of depth
      sel.position[2] + (Math.random() * 2 - 1) * zRange,
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
