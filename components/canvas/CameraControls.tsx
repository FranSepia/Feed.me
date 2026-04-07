'use client'

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCanvasStore } from '@/lib/store'

// Zoom distance so the node fills ~35% of screen height (FOV 60°)
// nodeH / (2 * tan(30°) * d) = 0.35  →  d = nodeH / 0.404
const ZOOM_DIST: Record<string, number> = {
  image: 7.5,
  video: 7.5,
  text: 5.5,
  spotify: 5.5,
  social: 5.5,
}

export function CameraControls() {
  const { camera, gl } = useThree()
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  // User-controlled "free" target
  const freeTarget = useRef(new THREE.Vector3(0, 0, 20))
  // Actual interpolation target (may be overridden by selection)
  const targetPosition = useRef(new THREE.Vector3(0, 0, 20))
  const currentPosition = useRef(new THREE.Vector3(0, 0, 20))
  const wasZoomed = useRef(false)

  const selectedNodeId = useCanvasStore((s) => s.selectedNode)
  const nodes = useCanvasStore((s) => s.nodes)

  // When selection changes → move camera
  useEffect(() => {
    if (selectedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId)
      if (node) {
        if (!wasZoomed.current) {
          freeTarget.current.copy(targetPosition.current)
          wasZoomed.current = true
        }
        const d = ZOOM_DIST[node.type] ?? 7.5
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

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (wasZoomed.current) return
      const delta = e.deltaY * 0.05
      freeTarget.current.z = THREE.MathUtils.clamp(freeTarget.current.z + delta, -10, 50)
      targetPosition.current.z = freeTarget.current.z
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging.current = true
        lastMouse.current = { x: e.clientX, y: e.clientY }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || wasZoomed.current) return
      const dx = (e.clientX - lastMouse.current.x) * 0.02
      const dy = (e.clientY - lastMouse.current.y) * 0.02
      freeTarget.current.x -= dx
      freeTarget.current.y += dy
      targetPosition.current.x = freeTarget.current.x
      targetPosition.current.y = freeTarget.current.y
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseUp = () => { isDragging.current = false }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1 || wasZoomed.current) return
      const dx = (e.touches[0].clientX - lastMouse.current.x) * 0.02
      const dy = (e.touches[0].clientY - lastMouse.current.y) * 0.02
      freeTarget.current.x -= dx
      freeTarget.current.y += dy
      targetPosition.current.x = freeTarget.current.x
      targetPosition.current.y = freeTarget.current.y
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
