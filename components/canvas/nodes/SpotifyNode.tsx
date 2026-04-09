'use client'

import { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import * as THREE from 'three'
import { NodeData, useCanvasStore } from '@/lib/store'
import { isLightBg } from '@/lib/colors'

declare global {
  interface Window {
    onSpotifyIframeApiReady: (IFrameAPI: any) => void;
    SpotifyIFrameAPI?: any;
  }
}

let apiScriptInjected = false
const initSpotifyAPI = (callback: (api: any) => void) => {
  if (typeof window === 'undefined') return
  if (window.SpotifyIFrameAPI) {
    callback(window.SpotifyIFrameAPI)
    return
  }
  if (!apiScriptInjected) {
    apiScriptInjected = true
    const script = document.createElement('script')
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.async = true
    document.body.appendChild(script)
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      window.SpotifyIFrameAPI = IFrameAPI
      document.dispatchEvent(new CustomEvent('spotify-api-ready', { detail: IFrameAPI }))
    }
  }
  const listener = (e: any) => {
    document.removeEventListener('spotify-api-ready', listener)
    callback(e.detail)
  }
  document.addEventListener('spotify-api-ready', listener)
}

interface Props {
  node: NodeData
  isSelected: boolean
  isDimmed: boolean
  isOrbit: boolean
  targetPosition: [number, number, number]
}

export function SpotifyNode({ node, isSelected, isDimmed, isOrbit, targetPosition }: Props) {
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const editMode = useCanvasStore((s) => s.editMode)
  const selectedNodeId = useCanvasStore((s) => s.selectedNode)
  const bgColor = useCanvasStore((s) => s.bgColor)
  const light = isLightBg(bgColor)
  const meshRef = useRef<THREE.Mesh>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<any>(null)
  const { camera } = useThree()

  const autoPlay = !isSelected && !isDimmed && selectedNodeId !== null
  const shouldShow = isSelected || autoPlay

  // When shouldShow becomes true, initialize controller and play
  useEffect(() => {
    if (!shouldShow || controllerRef.current) return
    initSpotifyAPI((IFrameAPI) => {
      if (!wrapperRef.current || controllerRef.current) return
      
      const inner = document.createElement('div')
      wrapperRef.current.innerHTML = ''
      wrapperRef.current.appendChild(inner)

      const options = {
        uri: `spotify:track:${node.content}`,
        width: 300,
        height: 152,
        theme: 0,
      }
      const callback = (EmbedController: any) => {
        controllerRef.current = EmbedController
        EmbedController.addListener('ready', () => {
          // Play immediately when ready (browser allows it due to prior user click gesture)
          EmbedController.play()
        })
      }
      IFrameAPI.createController(inner, options, callback)
    })
  }, [shouldShow, node.content])

  // Stop/cleanup when no longer showing
  useEffect(() => {
    if (!shouldShow && controllerRef.current) {
      if (typeof controllerRef.current.destroy === 'function') {
        controllerRef.current.destroy()
      }
      controllerRef.current = null
      if (wrapperRef.current) wrapperRef.current.innerHTML = ''
    }
  }, [shouldShow])

  const springs = useSpring({
    position: targetPosition,
    scale: isSelected ? 1.1 : isOrbit ? 0.82 : autoPlay ? 1.06 : 1,
    config: { mass: 1.2, tension: 140, friction: 26 },
  })

  useFrame(() => {
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion)
  })

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNode(isSelected ? null : node.id)
  }

  return (
    <animated.mesh
      ref={meshRef}
      position={springs.position as unknown as [number, number, number]}
      scale={springs.scale.to((s) => [s * 3.2, s * 2, 1] as [number, number, number])}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0} />
      <Html center distanceFactor={10} zIndexRange={[50, 0]} style={{ pointerEvents: 'all' }}>
        {/* Outer div covers the full node area — every click is a DOM event (required for autoplay) */}
        <div
          onClick={handleNodeClick}
          style={{
            position: 'relative',
            opacity: isDimmed ? 0.32 : 1,
            transition: 'opacity 0.4s',
            userSelect: 'none',
            cursor: editMode ? 'default' : 'pointer',
            padding: '20px',
            margin: '-20px',
          }}
        >
          {/* Tags — CSS-positioned above the card, left-aligned */}
          {isSelected && node.tags.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: '20px',
              display: 'flex', gap: '5px', flexWrap: 'nowrap', paddingBottom: '6px',
            }}>
              {node.tags.map((tag) => (
                <span key={tag} style={{
                  background: light ? 'rgba(255,255,255,0.75)' : 'rgba(20,20,20,0.65)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)'}`,
                  color: light ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)',
                  fontSize: '11px', padding: '4px 11px', borderRadius: '20px', whiteSpace: 'nowrap',
                }}>#{tag}</span>
              ))}
            </div>
          )}

          {/* Iframe container — shown when shouldShow */}
          <div 
            ref={wrapperRef} 
            style={{ 
              display: shouldShow ? 'block' : 'none',
              borderRadius: '12px',
              overflow: 'hidden'
            }} 
          />

          {/* Green card — shown when not yet playing */}
          {!shouldShow && (
            <div style={{
              background: '#1DB954', borderRadius: '12px', padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: '12px',
              width: '220px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <div>
                <div style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>{node.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>▶ Reproducir</div>
              </div>
            </div>
          )}

          {editMode && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ position: 'absolute', top: '-8px', right: '-8px', pointerEvents: 'all' }}
            >
              <DeleteButton onDelete={() => removeNode(node.id)} />
            </div>
          )}
        </div>
      </Html>
    </animated.mesh>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onDelete() }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: hover ? 'rgba(220,50,50,0.95)' : 'rgba(20,20,20,0.82)',
        border: '1.5px solid rgba(255,255,255,0.25)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        transition: 'background 0.15s, transform 0.12s',
        transform: hover ? 'scale(1.15)' : 'scale(1)', padding: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
      </svg>
    </button>
  )
}
