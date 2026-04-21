'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  bg_color: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, username: string, displayName?: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  refreshProfile: async () => {},
})

export const useAuth = () => useContext(AuthContext)

// Remove all Supabase auth tokens from localStorage (handles ghost sessions)
function clearSupabaseStorage() {
  if (typeof window === 'undefined') return
  Object.keys(localStorage)
    .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    .forEach((k) => localStorage.removeItem(k))
}

// Reserved usernames that cannot be used
const RESERVED = new Set(['login', 'register', 'editor', 'admin', 'api', 'settings', 'profile', 'explore'])

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return

    let token = key
    try {
      const ref = new URL(url).hostname.split('.')[0]
      const raw = localStorage.getItem(`sb-${ref}-auth-token`)
      if (raw) {
        const parsed = JSON.parse(raw)
        const at = parsed?.access_token ?? parsed?.currentSession?.access_token
        if (at) token = at
      }
    } catch { /* fall back */ }

    try {
      const res = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}&select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('fetch error')
      const rows = await res.json()
      if (Array.isArray(rows) && rows.length > 0) {
        const data = rows[0]
        setProfile({
          id: data.id,
          username: data.username,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          bio: data.bio,
          bg_color: data.bg_color ?? '#ede8de',
        })
      }
    } catch (e) {
      console.error('loadProfile error', e)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id)
  }, [user, loadProfile])

  // Listen for auth state changes
  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Use onAuthStateChange for INITIAL_SESSION — more reliable than getSession()
    // because getSession() can hang indefinitely if token refresh fails.
    // INITIAL_SESSION always fires (even when there is no session), so
    // setLoading(false) is guaranteed to be called.
    // Safety net: if INITIAL_SESSION never fires at all (extremely rare),
    // unblock the UI after 12 seconds. No signOut — we don't want to kick
    // out users whose token refresh is just slow (can take 4-8s on mobile).
    const fallbackTimer = setTimeout(() => {
      setLoading(false)
    }, 12000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null

        if (event === 'INITIAL_SESSION') {
          clearTimeout(fallbackTimer)
          if (u) {
            // Validate the session server-side to catch ghost sessions.
            // getUser() makes a real API call — if the token is expired/revoked
            // it returns an error even though localStorage looks fine.
            const { error: userError } = await supabase!.auth.getUser()
            if (userError) {
              // Ghost session — wipe it and send to login
              clearSupabaseStorage()
              await supabase!.auth.signOut({ scope: 'local' })
              setUser(null)
              setProfile(null)
              setLoading(false)
              if (typeof window !== 'undefined') window.location.replace('/login')
              return
            }
            setUser(u)
            loadProfile(u.id) // fire-and-forget
          } else {
            setUser(null)
            setProfile(null)
          }
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          // Only clean up React state — don't touch localStorage or redirect here.
          // Supabase already cleared the tokens. The page that called signOut()
          // is responsible for navigation (ProfilePanel already does router.push).
          setUser(null)
          setProfile(null)
        } else {
          // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, etc.
          setUser(u)
          if (u) {
            await loadProfile(u.id)
          } else {
            setProfile(null)
          }
        }
      }
    )

    return () => {
      clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase not configured' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  const signUp = async (email: string, password: string, username: string, displayName?: string) => {
    if (!supabase) return { error: 'Supabase not configured' }

    // Validate username
    const clean = username.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
    if (clean.length < 3) return { error: 'Username must be at least 3 characters long' }
    if (clean.length > 30) return { error: 'Username is too long (max 30)' }
    if (RESERVED.has(clean)) return { error: 'That username is reserved' }

    // Check uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', clean)
      .maybeSingle()
    if (existing) return { error: 'Username already in use' }

    // Register
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: clean, display_name: displayName || clean },
      },
    })
    if (error) return { error: error.message }
    return {}
  }

  const signOut = async () => {
    if (!supabase) return
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      await Promise.race([supabase.auth.signOut(), timeout])
    } catch {
      // Token already invalid or hanging — clean up manually so the ghost session is destroyed
      clearSupabaseStorage()
    }
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
