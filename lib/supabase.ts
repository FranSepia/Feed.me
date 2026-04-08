import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Lazy singleton — avoids crash during SSR prerender if env vars are missing
let _client: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!url || !key) return null
  if (!_client) _client = createClient(url, key)
  return _client
}

// Convenience export — safe to use anywhere (returns null if not configured)
export const supabase = (url && key) ? createClient(url, key) : null
