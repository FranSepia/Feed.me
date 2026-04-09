import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Single browser client — handles auth session in localStorage automatically
export const supabase = (url && key) ? createClient(url, key) : null
