'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { generatePositions, useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'

interface SkeletonItemProps {
  position: [number, number, number]
  index: number
  aspect: number
  light: boolean
  /** Once the real images are ready, fade out instead of popping */
  fading: boolean
}

function SkeletonItem({ position, index, aspect, light, fading }: SkeletonItemProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  // Attached to the border's <lineBasicMaterial>, not a mesh material
  const glowRef = useRef<THREE.LineBasicMaterial>(null)

  const w = 3 * aspect
  const h = 3

  // Two colours to oscillate between — dark theme: near-black ↔ bright white
  // Light theme: off-white ↔ charcoal
  const colorA = useMemo(() =>
    new THREE.Color(light ? '#888888' : '#2a2a2a'), [light])
  const colorB = useMemo(() =>
    new THREE.Color(light ? '#1a1a1a' : '#e0e0e0'), [light])
  const tempColor = useMemo(() => new THREE.Color(), [])

  // 1 while loading, eased toward 0 once the images are on their way in
  const fadeRef = useRef(1)

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()

    if (!meshRef.current || !matRef.current) return

    const target = fading ? 0 : 1
    fadeRef.current += (target - fadeRef.current) * Math.min(1, delta * 3.5)
    const fade = fadeRef.current

    // Billboard: always face the camera
    meshRef.current.quaternion.copy(state.camera.quaternion)

    // Strong shimmer wave: each card offset by 0.4 s so the light sweeps L→R
    // sin goes -1..1 → remap to 0..1
    const wave = (Math.sin(t * 5.0 - index * 0.4) + 1) / 2

    // Interpolate color A→B dramatically
    tempColor.copy(colorA).lerp(colorB, wave)
    matRef.current.color.copy(tempColor)

    // Also pulse opacity strongly  0.18 ↔ 0.72
    matRef.current.opacity = (0.18 + wave * 0.54) * fade

    // Glow outline pulses in opposite phase so it flashes when fill is dim
    if (glowRef.current) {
      const inv = 1 - wave
      glowRef.current.opacity = (0.15 + inv * 0.65) * fade
    }

    // Gentle float
    meshRef.current.position.set(
      position[0] + Math.cos(t * 1.2 + index * 0.7) * 0.3,
      position[1] + Math.sin(t * 1.8 + index * 0.5) * 0.35,
      position[2] + Math.sin(t * 1.0 + index * 0.9) * 0.2,
    )
  })

  // Border lines (8 verts, 4 line pairs)
  const borderGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const v = new Float32Array([
      -0.5,  0.5, 0,   0.5,  0.5, 0,
       0.5,  0.5, 0,   0.5, -0.5, 0,
       0.5, -0.5, 0,  -0.5, -0.5, 0,
      -0.5, -0.5, 0,  -0.5,  0.5, 0,
    ])
    g.setAttribute('position', new THREE.BufferAttribute(v, 3))
    return g
  }, [])

  return (
    <mesh ref={meshRef} position={position} scale={[w, h, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color={light ? '#888888' : '#2a2a2a'}
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
      <lineSegments geometry={borderGeo}>
        <lineBasicMaterial
          ref={glowRef}
          color={light ? '#333333' : '#ffffff'}
          transparent
          opacity={0.5}
        />
      </lineSegments>
    </mesh>
  )
}

const SKELETON_COUNT = 10

export function SkeletonNodes({ fading = false }: { fading?: boolean }) {
  const bgColor = useCanvasStore((s) => s.bgColor)
  const light = isLightBg(bgColor)

  const positions = useMemo(() => generatePositions(SKELETON_COUNT), [])

  const aspects = [1.33, 1.0, 1.4, 0.85, 1.25, 1.5, 0.9, 1.2, 1.33, 1.1]

  return (
    <group>
      {positions.map((pos, i) => (
        <SkeletonItem
          key={`skeleton-${i}`}
          position={pos}
          index={i}
          aspect={aspects[i % aspects.length]}
          light={light}
          fading={fading}
        />
      ))}
    </group>
  )
}
