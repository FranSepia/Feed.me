'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) router.replace('/editor')
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn(email, password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/editor')
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
          Your personal creative canvas
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
        <div style={{ fontSize: '20px', fontWeight: 600, color: '#ede8de', marginBottom: '4px' }}>
          Sign In
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
          placeholder="Password"
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
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={{
          textAlign: 'center',
          color: 'rgba(237,232,222,0.4)',
          fontSize: '13px',
          marginTop: '4px',
        }}>
          Don't have an account?{' '}
          <Link href="/register" style={{ color: '#ede8de', textDecoration: 'underline' }}>
            Sign Up
          </Link>
        </div>
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
