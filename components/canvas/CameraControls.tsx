'use client'

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCanvasStore } from '@/lib/store'
import { NODE_SPRING } from '@/lib/nodeMotion'

const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 600

const ZOOM_DIST_DESKTOP: Record<string, number> = {
  image: 14,
  video: 14,
  text: 5.5,
  spotify: 5.5,
  social: 5.5,
  // The landing's cards are drawn 1:1 with their CSS size at the distance the
  // camera rests at, so selecting one has to *move* to enlarge it. 'auth' parks
  // exactly where the camera started: choosing the sign-in card recentres it
  // without resizing a form the visitor may already be typing into.
  auth: 20,
  headline: 12,
}

const ZOOM_DIST_MOBILE: Record<string, number> = {
  image: 16,
  video: 16,
  text: 10,
  spotify: 10,
  social: 10,
  auth: 34,
  headline: 26,
}

/**
 * How far the camera parks from a card of this type when it is selected.
 *
 * The orbit layout needs the same number: it lays the other cards out on the
 * plane the selected one sits on, and that plane's on-screen size is entirely a
 * function of this distance. When the two disagreed, the ring was computed for a
 * camera that was somewhere else.
 */
export function zoomDistance(type: string): number {
  const table = isMobileDevice ? ZOOM_DIST_MOBILE : ZOOM_DIST_DESKTOP
  return table[type] ?? (isMobileDevice ? 13 : 7.5)
}

// Zoom is multiplicative, not additive: each gesture scales the remaining distance
// to this floor rather than adding a fixed number of world units. Far away the
// same finger travel covers a lot of ground, and the closer you get the finer it
// becomes — so you can no longer shoot straight past an image while pinching.
const ZOOM_FLOOR = -12

// How hard a pinch bites. Zoom is multiplicative, so the distance to the floor
// moves by (finger spread ratio) ^ PINCH_EXPONENT — halving the exponent halves
// the zoom a given pinch produces, exactly.
const PINCH_EXPONENT = 0.425

/** Screen pixels of travel past which a press counts as a drag, not a tap. */
const DRAG_SLOP = 5

function applyZoom(z: number, factor: number, min: number, max: number): number {
  const scaled = ZOOM_FLOOR + (z - ZOOM_FLOOR) * factor
  return THREE.MathUtils.clamp(scaled, min, max)
}

/**
 * True for something the visitor is trying to operate rather than drag past.
 *
 * A drag that starts on a text field is that field's — selecting an email
 * address must not send the canvas flying. Everything else on a card, including
 * its background and its prose, is canvas as far as panning is concerned.
 */
function isControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('input, textarea, select, button, a, label, [contenteditable="true"]') !== null
  )
}

export function CameraControls() {
  const { camera, gl, events } = useThree()
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const lastPinchDist = useRef<number | null>(null)

  const isMobile = isMobileDevice
  const initZ = isMobile ? 34 : 20

  // How far the pointer has travelled during the current press, in screen pixels,
  // and whether the click it is about to produce should be thrown away.
  const dragDistance = useRef(0)
  const swallowClick = useRef(false)

  const freeTarget = useRef(new THREE.Vector3(0, 0, initZ))
  const targetPosition = useRef(new THREE.Vector3(0, 0, initZ))
  const currentPosition = useRef(new THREE.Vector3(0, 0, initZ))
  const velocity = useRef(new THREE.Vector3())
  const acceleration = useRef(new THREE.Vector3())
  const wasZoomed = useRef(false)
  // Where the camera was before the Venn view took over the framing
  const preVenn = useRef<THREE.Vector3 | null>(null)
  // Raised while a diagram larger than the usual limit is on screen, so the first
  // scroll after it is framed does not yank the camera back in
  const baseMaxZ = isMobileDevice ? 60 : 50
  const maxZoomOut = useRef(baseMaxZ)

  const selectedNodeId = useCanvasStore((s) => s.selectedNode)
  const nodes = useCanvasStore((s) => s.nodes)
  const vennActive = useCanvasStore((s) => s.vennActive)
  const vennFrame = useCanvasStore((s) => s.vennFrame)

  useEffect(() => {
    if (selectedNodeId) {
      const node = nodes.find((n) => n.id === selectedNodeId)
      if (node) {
        if (!wasZoomed.current) {
          freeTarget.current.copy(targetPosition.current)
          wasZoomed.current = true
        }
        const d = zoomDistance(node.type)

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

  // Frame the diagram when the Venn view opens, and put the camera back where it
  // was when it closes. The frame arrives a render after the toggle, so this runs
  // twice — the first pass only records where we came from.
  useEffect(() => {
    if (vennActive) {
      if (!preVenn.current) preVenn.current = targetPosition.current.clone()
      if (!vennFrame) return

      const [minX, minY, maxX, maxY] = vennFrame
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const halfW = Math.max((maxX - minX) / 2, 0.01)
      const halfH = Math.max((maxY - minY) / 2, 0.01)

      const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 60
      const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
      const half = Math.tan((fov / 2) * Math.PI / 180)

      // Whichever side runs out first decides, and barely — the point is to back
      // off exactly far enough to hold the circles, because every unit further
      // costs the photos, and they are what the diagram is made of. Centred on the
      // diagram rather than the origin, so nothing is wasted framing empty canvas.
      const dist = Math.max(halfH / half, halfW / (half * aspect)) * 1.05

      targetPosition.current.set(cx, cy, THREE.MathUtils.clamp(dist, 10, 300))
      freeTarget.current.copy(targetPosition.current)
      maxZoomOut.current = Math.max(baseMaxZ, targetPosition.current.z * 1.25)
      wasZoomed.current = false
    } else if (preVenn.current) {
      // Read rather than subscribe: this effect must not re-run on a selection,
      // or every click inside the diagram would re-frame it and fight the zoom
      const selected = useCanvasStore.getState().selectedNode
      if (selected) {
        // A card is being examined — leave the camera on it, and let deselecting
        // land back where the canvas was before the diagram opened
        freeTarget.current.copy(preVenn.current)
      } else {
        targetPosition.current.copy(preVenn.current)
        freeTarget.current.copy(preVenn.current)
        wasZoomed.current = false
      }
      preVenn.current = null
      maxZoomOut.current = baseMaxZ
    }
  }, [vennActive, vennFrame, camera, baseMaxZ])

  useEffect(() => {
    const canvas = gl.domElement
    // Pan and zoom listen on the event source, not on the canvas.
    //
    // drei portals every <Html> card into exactly this element, so the cards are
    // not inside the canvas — they are laid over it, two levels up the tree. An
    // event over one of them never reached a listener bound to the canvas, so
    // anywhere a card sat the canvas stopped moving, and the sign-in card is half
    // the screen. Binding to the element the cards actually live in puts the whole
    // surface back under one pan and zoom; isControl is what still lets a form be
    // a form. Read from react-three-fiber rather than counted in parentElements,
    // because it is the same value drei reads when it decides where to portal.
    const surface: HTMLElement =
      events.connected instanceof HTMLElement ? events.connected : canvas.parentElement ?? canvas

    // How much world space a screen pixel covers depends on how far back the
    // camera sits, so panning has to scale with it too — otherwise a drag that
    // feels right zoomed out sends the canvas flying when you are up close.
    const panSpan = initZ - ZOOM_FLOOR
    const panFactor = () =>
      Math.max(0.3, (currentPosition.current.z - ZOOM_FLOOR) / panSpan)

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = Math.exp(e.deltaY * 0.0016)
      targetPosition.current.z = applyZoom(targetPosition.current.z, factor, -10, maxZoomOut.current)
      freeTarget.current.z = targetPosition.current.z
    }

    const onMouseDown = (e: MouseEvent) => {
      swallowClick.current = false
      if (e.button === 0 && !isControl(e.target)) {
        isDragging.current = true
        dragDistance.current = 0
        lastMouse.current = { x: e.clientX, y: e.clientY }
        // Stops the browser turning the drag into a text selection across
        // whatever card the pointer happens to be over
        e.preventDefault()
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      dragDistance.current += Math.abs(e.clientX - lastMouse.current.x) + Math.abs(e.clientY - lastMouse.current.y)
      const p = panFactor()
      const dx = (e.clientX - lastMouse.current.x) * 0.02 * p
      const dy = (e.clientY - lastMouse.current.y) * 0.02 * p
      targetPosition.current.x -= dx
      targetPosition.current.y += dy
      // Keep freeTarget in sync so deselecting leaves camera at current position
      freeTarget.current.x = targetPosition.current.x
      freeTarget.current.y = targetPosition.current.y
      lastMouse.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseUp = () => {
      swallowClick.current = dragDistance.current > DRAG_SLOP
      isDragging.current = false
      dragDistance.current = 0
      lastPinchDist.current = null
    }

    /**
     * A drag is not a click.
     *
     * The browser fires `click` on release however far the pointer has travelled,
     * and react-three-fiber turns that into a selection on whichever card happens
     * to be under the release point — so panning across the canvas kept opening
     * things that were never aimed at. Once a press has travelled past a few
     * pixels, the click it produces is caught here on the way down, before it can
     * reach the canvas react-three-fiber is listening on.
     */
    const onClickCapture = (e: MouseEvent) => {
      if (!swallowClick.current) return
      swallowClick.current = false
      e.stopPropagation()
      e.preventDefault()
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // Two fingers are always a pinch, wherever they land — only a one-finger
        // drag has to yield to a control underneath it
        if (isControl(e.target)) return
        isDragging.current = true
        dragDistance.current = 0
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
        if (lastPinchDist.current !== null && dist > 0 && lastPinchDist.current > 0) {
          // The ratio between finger spreads is already scale-relative, which is
          // what makes this ease off as you approach. The exponent just softens
          // how hard a given pinch bites.
          const ratio = Math.pow(lastPinchDist.current / dist, PINCH_EXPONENT)
          freeTarget.current.z = applyZoom(freeTarget.current.z, ratio, -10, maxZoomOut.current)
          targetPosition.current.z = freeTarget.current.z
        }
        lastPinchDist.current = dist
        return
      }

      if (!isDragging.current || e.touches.length !== 1) return
      dragDistance.current +=
        Math.abs(e.touches[0].clientX - lastMouse.current.x) + Math.abs(e.touches[0].clientY - lastMouse.current.y)
      const p = panFactor()
      const dx = (e.touches[0].clientX - lastMouse.current.x) * 0.06 * p
      const dy = (e.touches[0].clientY - lastMouse.current.y) * 0.06 * p
      targetPosition.current.x -= dx
      targetPosition.current.y += dy
      freeTarget.current.x = targetPosition.current.x
      freeTarget.current.y = targetPosition.current.y
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    surface.addEventListener('wheel', onWheel, { passive: false })
    surface.addEventListener('mousedown', onMouseDown)
    surface.addEventListener('click', onClickCapture, true)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    surface.addEventListener('touchstart', onTouchStart, { passive: true })
    surface.addEventListener('touchmove', onTouchMove, { passive: true })
    surface.addEventListener('touchend', onMouseUp)

    return () => {
      surface.removeEventListener('wheel', onWheel)
      surface.removeEventListener('mousedown', onMouseDown)
      surface.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      surface.removeEventListener('touchstart', onTouchStart)
      surface.removeEventListener('touchmove', onTouchMove)
      surface.removeEventListener('touchend', onMouseUp)
    }
  }, [gl, events])

  // The camera is driven by the same spring the cards use, rather than a lerp.
  //
  // Selecting a different card moves the whole orbit *and* the camera by the same
  // vector, so if both follow the same curve that shared travel cancels on screen
  // and you only see the re-layout. A lerp does not: it leaves at full speed while
  // the cards are still accelerating out of rest, so for the first frames after a
  // tap every card slid backwards across the screen before catching up — the whip.
  useFrame((_, delta) => {
    // A dropped frame must not blow the integrator up, and small fixed substeps
    // keep the response identical regardless of refresh rate
    const dt = Math.min(delta, 1 / 20)
    const steps = Math.min(6, Math.max(1, Math.ceil(dt * 120)))
    const h = dt / steps
    const { mass, tension, friction } = NODE_SPRING

    for (let i = 0; i < steps; i++) {
      acceleration.current
        .copy(targetPosition.current)
        .sub(currentPosition.current)
        .multiplyScalar(tension)
        .addScaledVector(velocity.current, -friction)
        .divideScalar(mass)
      velocity.current.addScaledVector(acceleration.current, h)
      currentPosition.current.addScaledVector(velocity.current, h)
    }

    camera.position.copy(currentPosition.current)
  })

  return null
}
