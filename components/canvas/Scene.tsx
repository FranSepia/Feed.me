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

function computeTargetPositions(
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

  const n = related.length
  const nodeWidth = isMobile ? 2.0 : 3.2
  const minR     = isMobile ? 7.0 : 9.0
  const circumR  = (n * nodeWidth * 1.5) / (2 * Math.PI)
  const R        = Math.max(minR, circumR)

  // Ellipse radii — on mobile: moderately narrower in X, taller in Y
  // Not too extreme so nodes still appear "around" not "above/below only"
  const Rx = isMobile ? R * 0.60 : R
  const Ry = isMobile ? R * 1.20 : R * 0.52

  // Jitter amount — adds organic randomness so nodes don't fall on a perfect ellipse line
  const jitterX = isMobile ? R * 0.28 : R * 0.18
  const jitterY = isMobile ? R * 0.22 : R * 0.14

  related.forEach((node, i) => {
    const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2

    // Seeded jitter so positions are deterministic but look random
    const jx = (seededRandom(node.seed * 5 + 1) - 0.5) * 2 * jitterX
    const jy = (seededRandom(node.seed * 7 + 3) - 0.5) * 2 * jitterY

    result[node.id] = [
      sel.position[0] + Math.cos(angle) * Rx + jx,
      sel.position[1] + Math.sin(angle) * Ry + jy,
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

export function Scene() {
  const nodes = useCanvasStore((s) => s.nodes)
  const selectedNode = useCanvasStore((s) => s.selectedNode)

  const targetPositions = useMemo(
    () => computeTargetPositions(nodes, selectedNode),
    [nodes, selectedNode]
  )

  const sorted = [...nodes].sort((a, b) =>
    a.id === selectedNode ? 1 : b.id === selectedNode ? -1 : 0
  )

  return (
    <>
      <CameraControls />
      {sorted.map((node) => {
        const isSelected = selectedNode === node.id
        const isRelated = selectedNode
          ? nodes.find((n) => n.id === selectedNode)?.tags.some((t) => node.tags.includes(t)) ?? false
          : true
        const isDimmed = selectedNode !== null && !isSelected && !isRelated
        const targetPosition = targetPositions[node.id] ?? node.position
        const isOrbit = !isSelected && selectedNode !== null && isRelated
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
