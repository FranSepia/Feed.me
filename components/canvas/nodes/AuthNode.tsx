'use client'

import { useRef, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { NodeData, useCanvasStore } from '@/lib/store'
import { NODE_SPRING, HTML_DEPTH_SELECTED } from '@/lib/nodeMotion'
import { isLightBg } from '@/lib/colors'
import { useAuth } from '@/lib/auth-context'
import { CARD_DISTANCE_FACTOR, MAX_CARD_WIDTH } from '@/components/landing/landingScale'
import { landingPalette } from '@/components/landing/landingTheme'
import { useAuthMode } from '@/components/landing/authMode'

/**
 * The way into Feed.Me, as a card on the canvas rather than a page in front of it.
 *
 * It is a node like every other node: it sits at a position, it can be selected,
 * and when something else is selected it shrinks into the ring with everything
 * else. The one thing it never does is disappear — when it is out in the orbit
 * it collapses to a pill instead of a form, so the way in is always one tap away
 * however far the visitor has wandered.
 */

interface Props {
  node: NodeData
  isSelected: boolean
  isDimmed: boolean
  isOrbit: boolean
  targetPosition: [number, number, number]
}

export function AuthNode({ node, isSelected, isOrbit, targetPosition }: Props) {
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const bgColor = useCanvasStore((s) => s.bgColor)
  const light = isLightBg(bgColor)
  const p = landingPalette(light)

  // Read here and handed down as props, not read inside the card.
  //
  // react-three-fiber bridges React context into the canvas, but drei's <Html>
  // renders its children into a ReactDOM root of its own — context stops dead at
  // that boundary. useRouter() threw outright there; useAuth() would have been
  // worse, quietly handing back the default context whose signIn does nothing.
  // Everything the form needs is therefore resolved on this side of it.
  const { signIn, signUp } = useAuth()
  const router = useRouter()

  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()

  // Deliberately ignores isDimmed. Selecting a photo dims everything that shares
  // none of its tags, which is right for the canvas and wrong for this card: the
  // sign-in form is never the less relevant thing on screen.
  const springs = useSpring({
    from: { position: [targetPosition[0], targetPosition[1] - 4, targetPosition[2] - 16] as [number, number, number] },
    position: targetPosition,
    config: NODE_SPRING,
  })

  useFrame(() => {
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion)
  })

  return (
    <animated.mesh
      ref={meshRef}
      position={springs.position as unknown as [number, number, number]}
      // A token hit area only. A full-size one would be a dozen world units of
      // invisible plane swallowing clicks meant for the photos behind it, and
      // the card itself is real DOM that takes its own clicks.
      scale={[1.2, 1.2, 1]}
      onClick={(e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        setSelectedNode(node.id)
      }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0} />

      <Html
        center
        distanceFactor={CARD_DISTANCE_FACTOR}
        zIndexRange={HTML_DEPTH_SELECTED}
        style={{ pointerEvents: 'auto' }}
      >
        {isOrbit && !isSelected ? (
          <AuthPill palette={p} onOpen={() => setSelectedNode(node.id)} />
        ) : (
          <AuthCard
            palette={p}
            light={light}
            signIn={signIn}
            signUp={signUp}
            onSignedIn={() => router.push('/editor')}
          />
        )}
      </Html>
    </animated.mesh>
  )
}

// ─── Collapsed form, for when the visitor is looking at something else ──────

function AuthPill({ palette: p, onOpen }: { palette: ReturnType<typeof landingPalette>; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '11px 20px', borderRadius: '50px', cursor: 'pointer',
        background: p.cardBg,
        borderTop: p.borderTop, borderLeft: p.borderTop,
        borderBottom: p.borderBottom, borderRight: p.borderBottom,
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        boxShadow: p.shadow,
        transform: hover ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.16s',
        whiteSpace: 'nowrap',
      }}
    >
      <Wordmark ink={p.ink} faint={p.inkFaint} size={16} />
      <span style={{ color: p.inkSoft, fontSize: '13px', fontWeight: 500 }}>Sign in</span>
    </button>
  )
}

// ─── The form ──────────────────────────────────────────────────────────────

interface AuthCardProps {
  palette: ReturnType<typeof landingPalette>
  light: boolean
  signIn: ReturnType<typeof useAuth>['signIn']
  signUp: ReturnType<typeof useAuth>['signUp']
  onSignedIn: () => void
}

function AuthCard({ palette: p, light, signIn, signUp, onSignedIn }: AuthCardProps) {
  const mode = useAuthMode((s) => s.mode)
  const setMode = useAuthMode((s) => s.setMode)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [appeared, setAppeared] = useState(false)

  // A visitor who followed an old /register link lands here instead
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('signup') === '1') setMode('signup')
  }, [setMode])

  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), 60)
    return () => clearTimeout(t)
  }, [])

  const switchTo = (next: 'signin' | 'signup') => {
    setMode(next)
    setError('')
    setSent(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    if (mode === 'signin') {
      const result = await signIn(email, password)
      if (result.error) {
        setError(result.error)
        setBusy(false)
      } else {
        onSignedIn()
      }
    } else {
      const result = await signUp(email, password, username)
      setBusy(false)
      if (result.error) setError(result.error)
      else setSent(true)
    }
  }

  const field: React.CSSProperties = {
    background: p.fieldBg,
    border: p.fieldBorder,
    borderRadius: '11px',
    padding: '12px 14px',
    color: p.ink,
    fontSize: '14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    userSelect: 'text',
  }

  return (
    <div
      style={{
        width: `${MAX_CARD_WIDTH}px`,
        background: p.cardBg,
        borderTop: p.borderTop, borderLeft: p.borderTop,
        borderBottom: p.borderBottom, borderRight: p.borderBottom,
        borderRadius: '26px',
        padding: '26px 24px 22px',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        boxShadow: p.shadow,
        display: 'flex', flexDirection: 'column', gap: '14px',
        // The card is draggable canvas everywhere except its fields, so a drag
        // across it must not smear a text selection over the copy
        userSelect: 'none',
        opacity: appeared ? 1 : 0,
        transform: appeared ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,0.61,0.36,1)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
        <Wordmark ink={p.ink} faint={p.inkFaint} size={30} />
        <div style={{ color: p.inkFaint, fontSize: '12.5px', textAlign: 'center' }}>
          No likes, no followers. Just You Being You.
        </div>
      </div>

      {sent ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '8px 0 4px' }}>
          <div style={{ fontSize: '32px' }}>✉️</div>
          <div style={{ color: p.ink, fontSize: '16px', fontWeight: 600 }}>Check your email</div>
          <div style={{ color: p.inkSoft, fontSize: '13px', textAlign: 'center', lineHeight: 1.5 }}>
            We sent a confirmation link to <strong style={{ color: p.ink }}>{email}</strong>. Open it and your
            canvas is ready.
          </div>
          <button onClick={() => switchTo('signin')} style={{
            marginTop: '2px', padding: '10px 20px', borderRadius: '11px', cursor: 'pointer',
            background: p.quietBg, border: 'none', color: p.ink, fontSize: '13px', fontWeight: 500,
          }}>
            I confirmed it — sign in
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{
            display: 'flex', gap: '4px', padding: '4px',
            background: p.quietBg, borderRadius: '13px',
          }}>
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchTo(m)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '13.5px', fontWeight: 600,
                  background: mode === m
                    ? (light ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.16)')
                    : 'transparent',
                  color: mode === m ? p.ink : p.inkFaint,
                  boxShadow: mode === m && light ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  transition: 'background 0.16s, color 0.16s',
                }}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {error && (
              <div style={{
                background: 'rgba(206,60,60,0.14)',
                border: '1px solid rgba(206,60,60,0.28)',
                borderRadius: '10px', padding: '9px 12px',
                color: light ? 'rgba(150,32,32,0.95)' : 'rgba(255,150,150,0.92)',
                fontSize: '12.5px', lineHeight: 1.4,
              }}>
                {error}
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: p.inkFaint, fontSize: '14px', pointerEvents: 'none',
                  }}>@</span>
                  <input
                    type="text"
                    placeholder="yourname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    required minLength={3} maxLength={30}
                    style={{ ...field, paddingLeft: '30px' }}
                  />
                </div>
                <div style={{ color: p.inkFaint, fontSize: '11px', marginTop: '5px', paddingLeft: '4px' }}>
                  feedme.com/{username || '…'}
                </div>
              </div>
            )}

            <input
              type="email" placeholder="Email" value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)} required style={field}
            />
            <input
              type="password"
              placeholder={mode === 'signup' ? 'Password (6+ characters)' : 'Password'}
              value={password}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              onChange={(e) => setPassword(e.target.value)} required minLength={6} style={field}
            />

            <button
              type="submit" disabled={busy}
              style={{
                marginTop: '2px', padding: '14px', borderRadius: '13px', border: 'none',
                background: busy ? p.quietBg : p.buttonBg,
                color: busy ? p.inkFaint : p.buttonInk,
                fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em',
                cursor: busy ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.16s',
              }}
            >
              {busy
                ? (mode === 'signin' ? 'Signing in…' : 'Creating…')
                : (mode === 'signin' ? 'Sign in' : 'Create my canvas')}
            </button>
          </form>

          <div style={{ color: p.inkFaint, fontSize: '11.5px', textAlign: 'center', lineHeight: 1.45 }}>
            {mode === 'signin'
              ? 'Everything out there is a real canvas. Drag it.'
              : 'Free. Your canvas, your order, your link.'}
          </div>
        </>
      )}
    </div>
  )
}

function Wordmark({ ink, faint, size }: { ink: string; faint: string; size: number }) {
  return (
    <span style={{ fontSize: `${size}px`, fontWeight: 700, color: ink, letterSpacing: '-0.03em', lineHeight: 1 }}>
      Feed<span style={{ color: faint }}>.</span>Me
    </span>
  )
}
