'use client'

import { useMemo } from 'react'
import { NodeData, useCanvasStore } from '@/lib/store'
import { ImageNode } from './nodes/ImageNode'
import { TextNode } from './nodes/TextNode'
import { SpotifyNode } from './nodes/SpotifyNode'
import { VideoNode } from './nodes/VideoNode'
import { SocialNode } from './nodes/SocialNode'
import { CameraControls } from './CameraControls'

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

  // Selected stays put
  result[selectedId] = sel.position

  // Related → orbit in a circle around selected
  const R = 7
  related.forEach((node, i) => {
    const angle = (i / Math.max(related.length, 1)) * Math.PI * 2
    result[node.id] = [
      sel.position[0] + Math.cos(angle) * R,
      sel.position[1] + Math.sin(angle) * R * 0.55,
      sel.position[2] + Math.sin(angle * 1.5) * 2,
    ]
  })

  // Unrelated → push far back in Z, slight spread in X/Y (visible but far)
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

  return (
    <>
      <CameraControls />
      {nodes.map((node) => {
        const isSelected = selectedNode === node.id
        const isRelated = selectedNode
          ? nodes.find((n) => n.id === selectedNode)?.tags.some((t) => node.tags.includes(t)) ?? false
          : true
        const isDimmed = selectedNode !== null && !isSelected && !isRelated
        const targetPosition = targetPositions[node.id] ?? node.position

        const props = { key: node.id, node, isSelected, isDimmed, targetPosition }

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
