'use client'

import { create } from 'zustand'

/**
 * Which half of the sign-in card is showing.
 *
 * It lives outside the card because two other things choose it: the URL, when a
 * visitor arrives on a link that used to point at /register, and the "empieza"
 * card out on the canvas, whose button has to open the sign-up form and fly the
 * camera back to the middle at the same time.
 */
interface AuthModeStore {
  mode: 'signin' | 'signup'
  setMode: (mode: 'signin' | 'signup') => void
}

export const useAuthMode = create<AuthModeStore>((set) => ({
  mode: 'signin',
  setMode: (mode) => set({ mode }),
}))
