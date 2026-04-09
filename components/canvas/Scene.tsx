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

// Orbit layout when a node is selected
function computeOrbitPositions(
  nodes: NodeData[],
  selectedId: string | null
): Record<string, [number, number, number]> {
  if (!selectedId) return {}
  const sel = nodes.find((n) => n.id === selectedId)
  if (!sel) return {}

  const related = nodes.filter(
    (n) => n.id !== selectedId && n.tags.some((t) => sel.tags.includes(t))
  )
  const unrelated = nodes.filter(
    (n) => n.id !== selectedId && !n.tags.some((t) => sel.tags.includes(t))
  )

  const result: Record<string, [number, number, number]> = {}
  result[selectedId] = sel.position

  // Place related nodes randomly across the full visible screen area.
  // We compute the viewport bounds at orbit depth (sel.z - 5) using the
  // default camera zoom for an image node — so no zoom-out is needed.
  const aspect  = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
  const zoomD   = isMobile ? 13 : 7.5          // matches CameraControls ZOOM_DIST image
  const depth   = zoomD + 5                    // camera at sel.z+zoomD, orbit at sel.z-5
  const fovV    = isMobile ? 65 : 60
  const halfH   = depth * Math.tan((fovV / 2) * Math.PI / 180) * 0.80  // 80% inset
  const halfW   = halfH * aspect
  const minDist = isMobile ? 2.5 : 3.5         // exclusion zone around selected node

  related.forEach((node) => {
    // Independent seeded random for x and y — no circular pattern
    let x = (seededRandom(node.seed * 6 + 1) * 2 - 1) * halfW
    let y = (seededRandom(node.seed * 4 + 3) * 2 - 1) * halfH
    // Push away from center if too close to selected node
    const dist = Math.sqrt(x * x + y * y)
    if (dist < minDist) { x = x * minDist / dist; y = y * minDist / dist }
    result[node.id] = [
      sel.position[0] + x,
      sel.position[1] + y,
      sel.position[2] - 5,
    ]
  })

  unrelated.forEach((node) => {
    const dx = node.position[0] - sel.position[0] || 0.1
    const dy = node.position[1] - sel.position[1] || 0.1
    result[node.id] = [
      sel.position[0] + dx * 1.4,
      sel.position[1] + dy * 1.4,
      sel.position[2] - 30,
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
        const isOrbit = !isSelected && selectedNode !== null && isRelated

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
