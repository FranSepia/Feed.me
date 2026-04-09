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

// Reserved usernames that cannot be used
const RESERVED = new Set(['login', 'register', 'editor', 'admin', 'api', 'settings', 'profile', 'explore'])

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) {
      setProfile({
        id: data.id,
        username: data.username,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        bio: data.bio,
        bg_color: data.bg_color ?? '#ede8de',
      })
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          await loadProfile(u.id)
        } else {
          setProfile(null)
        }
        // After the first event (INITIAL_SESSION), mark loading done
        if (event === 'INITIAL_SESSION') {
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
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
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}
