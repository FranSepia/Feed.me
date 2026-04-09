'use client'

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCanvasStore } from '@/lib/store'

const ZOOM_DIST_DESKTOP: Record<string, number> = {
  image: 7.5,
  video: 7.5,
  text: 5.5,
  spotify: 5.5,
  social: 5.5,
}

const ZOOM_DIST_MOBILE: Record<string, number> = {
  image: 13,
  video: 13,
  text: 10,
  spotify: 10,
  social: 10,
}

export function CameraControls() {
  const { camera, gl } = useThree()
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const lastPinchDist = useRef<number | null>(null)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600
  const initZ = isMobile ? 34 : 20
  const ZOOM_DIST = isMobile ? ZOOM_DIST_MOBILE : ZOOM_DIST_DESKTOP

  const freeTarget = useRef(new THREE.Vector3(0, 0, initZ))
  const targetPosition = useRef(new THREE.Vector3(0, 0, initZ))
  const currentPosition = useRef(new THREE.Vector3(0, 0, initZ))
  const wasZoomed = useRef(false)

  const selectedNodeId = useCanvasStore((s) => s.selectedNode)
  const nodes = useCanvasStore((s) => s.nodes)

  useEffect(() => {
    if (selectedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId)
      if (node) {
        if (!wasZoomed.current) {
          freeTarget.current.copy(targetPosition.current)
          wasZoomed.current = true
        }
        let d = ZOOM_DIST[node.type] ?? (isMobile ? 13 : 7.5)

        // Zoom out enough to keep all scattered orbit nodes on screen.
        // Nodes are placed in a random circle of radius MAX_R (same value as Scene.tsx).
        const hasRelated = nodes.some(
          (n) => n.id !== selectedNodeId && n.tags.some((t) => node.tags.includes(t))
        )
        if (hasRelated) {
          const MAX_R = isMobile ? 9.0 : 13.0
          const fovV = isMobile ? 65 : 60
          const tanHalfFovV = Math.tan((fovV / 2) * Math.PI / 180)
          const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
          const tanHalfFovH = aspect * tanHalfFovV
          const nodeSize = 2.0
          // Orbit nodes sit ~5 units behind selected (z-5), so effective depth = d + 5
          const dVert  = (MAX_R + nodeSize) / tanHalfFovV - 5
          const dHoriz = (MAX_R + nodeSize) / tanHalfFovH - 5
          d = Math.max(d, dVert, dHoriz) * 1.15
        }

        targetPosition.current.set(
          node.position[0],
          node.position[1],
          node.position[2] + d
        )
      }
    } else {
      if (wasZoomed.current) {
        targetPosition.current.copy(freeTarget.current)
        wasZoomed.current = false
      }
    }
  }, [selectedNodeId, nodes])

  useEffect(() => {
    const canvas = gl.domElement
    const maxZ = isMobile ? 60 : 50

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY * 0.05
      targetPosition.current.z = THREE.MathUtils.clamp(targetPosition.current.z + delta, -10, maxZ)
      freeTarget.current.z = targetPosition.current.z
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging.current = true
        lastMouse.current = { x: e.clientX, y: e.clientY }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = (e.clientX - lastMouse.current.x) * 0.02
      const dy = (e.clientY - lastMouse.current.y) * 0.02
      targetPosition.current.x -= dx
      targetPosition.current.y += dy
      // Keep freeTarget in sync so deselecting leaves camera at current position
      freeTarget.current.x = targetPosition.current.x
      freeTarget.current.y = targetPosition.current.y
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseUp = () => {
      isDragging.current = false
      lastPinchDist.current = null
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        isDragging.current = false
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist.current = Math.sqrt(dx * dx + dy * dy)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch to zoom — allowed even when a node is selected
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (lastPinchDist.current !== null) {
          const delta = (lastPinchDist.current - dist) * 0.05
          freeTarget.current.z = THREE.MathUtils.clamp(freeTarget.current.z + delta, -10, maxZ)
          targetPosition.current.z = freeTarget.current.z
        }
        lastPinchDist.current = dist
        return
      }

      if (!isDragging.current || e.touches.length !== 1) return
      const dx = (e.touches[0].clientX - lastMouse.current.x) * 0.02
      const dy = (e.touches[0].clientY - lastMouse.current.y) * 0.02
      targetPosition.current.x -= dx
      targetPosition.current.y += dy
      freeTarget.current.x = targetPosition.current.x
      freeTarget.current.y = targetPosition.current.y
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onMouseUp)

    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onMouseUp)
    }
  }, [gl])

  useFrame(() => {
    currentPosition.current.lerp(targetPosition.current, 0.07)
    camera.position.copy(currentPosition.current)
  })

  return null
}
