'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { signUp, user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) router.replace('/editor')
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signUp(email, password, username)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (authLoading) return null

  return (
    <div style={{
      width: '100%',
      maxWidth: '400px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '36px', fontWeight: 700, color: '#ede8de',
          letterSpacing: '-0.03em', marginBottom: '8px',
        }}>
          Feed<span style={{ color: 'rgba(237,232,222,0.3)' }}>.</span>Me
        </div>
        <div style={{ color: 'rgba(237,232,222,0.45)', fontSize: '14px' }}>
          Crea tu canvas. Compártelo con el mundo.
        </div>
      </div>

      {/* Card */}
      <form onSubmit={handleSubmit} style={{
        background: 'rgba(237,232,222,0.06)',
        border: '1px solid rgba(237,232,222,0.1)',
        borderRadius: '24px',
        padding: '32px',
        backdropFilter: 'blur(24px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {success ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '16px', padding: '20px 0',
          }}>
            <div style={{ fontSize: '40px' }}>✉️</div>
            <div style={{ color: '#ede8de', fontSize: '18px', fontWeight: 600, textAlign: 'center' }}>
              ¡Revisa tu correo!
            </div>
            <div style={{ color: 'rgba(237,232,222,0.5)', fontSize: '14px', textAlign: 'center', lineHeight: 1.5 }}>
              Te enviamos un link de confirmación a <strong style={{ color: '#ede8de' }}>{email}</strong>.
              Haz click en él para activar tu cuenta.
            </div>
            <Link href="/login" style={{
              marginTop: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'rgba(237,232,222,0.1)',
              border: '1px solid rgba(237,232,222,0.15)',
              color: '#ede8de',
              fontSize: '14px',
              textDecoration: 'none',
              fontWeight: 500,
            }}>
              Ir al Login
            </Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#ede8de', marginBottom: '4px' }}>
              Crear cuenta
            </div>

            {error && (
              <div style={{
                background: 'rgba(220,50,50,0.15)',
                border: '1px solid rgba(220,50,50,0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'rgba(255,150,150,0.9)',
                fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <div>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  color: 'rgba(237,232,222,0.3)', fontSize: '14px', pointerEvents: 'none',
                }}>@</span>
                <input
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                  required
                  minLength={3}
                  maxLength={30}
                  style={{ ...inputStyle, paddingLeft: '30px' }}
                />
              </div>
              <div style={{ color: 'rgba(237,232,222,0.3)', fontSize: '11px', marginTop: '4px', paddingLeft: '4px' }}>
                feedme.com/{username || '...'}
              </div>
            </div>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Contraseña (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={inputStyle}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: loading
                  ? 'rgba(237,232,222,0.1)'
                  : 'linear-gradient(135deg, #ede8de 0%, #d9d3c7 100%)',
                color: '#1a1a1a',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.18s',
                letterSpacing: '-0.01em',
              }}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>

            <div style={{
              textAlign: 'center',
              color: 'rgba(237,232,222,0.4)',
              fontSize: '13px',
              marginTop: '4px',
            }}>
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" style={{ color: '#ede8de', textDecoration: 'underline' }}>
                Inicia sesión
              </Link>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(237,232,222,0.07)',
  border: '1px solid rgba(237,232,222,0.12)',
  borderRadius: '10px',
  padding: '12px 14px',
  color: '#ede8de',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s',
}
