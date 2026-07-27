import { create } from 'zustand'
import { supabase } from './supabase'
import { configureTextureBudget } from './useNodeTexture'

export interface NodeData {
  id: string
  type: 'image' | 'video' | 'text' | 'spotify' | 'social'
  content: string
  title?: string
  caption?: string
  date?: string
  tags: string[]
  position: [number, number, number]
  seed: number
}

export const SOCIAL_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', color: '#E1306C', icon: 'IG' },
  { key: 'twitter', label: 'X / Twitter', color: '#000000', icon: 'X' },
  { key: 'tiktok', label: 'TikTok', color: '#010101', icon: 'TK' },
  { key: 'snapchat', label: 'Snapchat', color: '#FFFC00', icon: 'SC' },
  { key: 'onlyfans', label: 'OnlyFans', color: '#00AFF0', icon: 'OF' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', icon: 'WA' },
  { key: 'youtube', label: 'YouTube', color: '#FF0000', icon: 'YT' },
  { key: 'twitch', label: 'Twitch', color: '#9146FF', icon: 'TW' },
  { key: 'linkedin', label: 'LinkedIn', color: '#0077B5', icon: 'LI' },
  { key: 'spotify', label: 'Spotify', color: '#1DB954', icon: 'SP' },
]

// Golden-angle spiral layout
export function generatePositions(count: number): [number, number, number][] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const offset = Math.random() * Math.PI * 2
  return Array.from({ length: count }, (_, i) => {
    const angle = i * golden + offset
    const radius = Math.sqrt(i + 1) * 4.8
    return [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.75,
      Math.sin(i * 0.9 + offset) * 7,
    ] as [number, number, number]
  })
}

// Oval layout within visible screen bounds.
// Landscape screen → wide horizontal oval. Portrait → tall vertical oval.
// Scales the oval up proportionally when there are many nodes.
function layoutPositions(count: number): [number, number, number][] {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600
  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
  // Base visible area at camera z=20 fov=60 (desktop) / z=34 fov=65 (mobile)
  const baseH = isMobile ? 19 : 11
  const baseW = baseH * aspect
  // Scale oval up for many nodes so they all have room
  const scaleF = Math.max(1, Math.sqrt(count / 30))
  const Rx = baseW * scaleF * 0.70
  const Ry = baseH * scaleF * 0.70
  // MIN_DIST ≈ max image size at scale 1 to prevent visual overlap
  const MIN_DIST = isMobile ? 3.8 : 4.2

  const placed: [number, number][] = []
  const result: [number, number, number][] = []

  for (let i = 0; i < count; i++) {
    let bx = 0, by = 0, bestDist = -1

    for (let a = 0; a < 120; a++) {
      // Uniform random point inside the oval via rejection from bounding rectangle
      const cx = (Math.random() * 2 - 1) * Rx
      const cy = (Math.random() * 2 - 1) * Ry
      if ((cx / Rx) ** 2 + (cy / Ry) ** 2 > 1) continue  // outside oval — skip
      const minD = placed.length === 0
        ? Infinity
        : placed.reduce((m, [px, py]) => Math.min(m, Math.sqrt((cx - px) ** 2 + (cy - py) ** 2)), Infinity)
      if (minD >= MIN_DIST) { bx = cx; by = cy; bestDist = Infinity; break }
      if (minD > bestDist) { bestDist = minD; bx = cx; by = cy }
    }

    placed.push([bx, by])
    result.push([bx, by, (Math.random() - 0.5) * 10])
  }

  return result
}

// Returns true if a stored DB position is usable (non-zero, within oval bounds).
function isValidStoredPosition(pos: unknown): pos is [number, number, number] {
  if (!Array.isArray(pos) || pos.length !== 3) return false
  if (!pos.every((v) => typeof v === 'number' && isFinite(v))) return false
  const [x, y] = pos as number[]
  if (x === 0 && y === 0) return false  // never stored / default
  return Math.abs(x) < 50 && Math.abs(y) < 40  // within reasonable world bounds
}

// Demo nodes shown to first-time visitors (never saved to Supabase)
const DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
  'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800',
  'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800',
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800',
]

const demoPositions = generatePositions(DEMO_IMAGES.length + 2)

const DEMO_NODES: NodeData[] = [
  ...DEMO_IMAGES.map((url, i) => ({
    id: `demo-img-${i}`,
    type: 'image' as const,
    content: url,
    title: `Photo ${i + 1}`,
    tags: ['nature', 'landscape', i % 2 === 0 ? 'forest' : 'mountain'].slice(0, i % 3 + 1),
    position: demoPositions[i],
    seed: i,
  })),
  {
    id: 'demo-text-1',
    type: 'text' as const,
    content: 'Welcome to Feed.Me — your personal 3D canvas.',
    title: 'Welcome',
    tags: ['intro', 'feed.me'],
    position: demoPositions[DEMO_IMAGES.length],
    seed: DEMO_IMAGES.length,
  },
  {
    id: 'demo-spotify-1',
    type: 'spotify' as const,
    content: '4uLU6hMCjMI75M1A2tKUQC',
    title: 'Never Gonna Give You Up',
    tags: ['music', 'classic'],
    position: demoPositions[DEMO_IMAGES.length + 1],
    seed: DEMO_IMAGES.length + 1,
  },
]

interface CanvasStore {
  // Canvas data
  nodes: NodeData[]
  selectedNode: string | null
  playingVideoUrl: string | null
  bgColor: string
  showProfilePanel: boolean
  editMode: boolean
  socials: Record<string, string>
  nodesLoaded: boolean
  filterTags: string[]
  lastError: string | null    // surfaced to the user when a write is rolled back

  // Multi-user fields
  userId: string | null       // whose canvas is currently loaded
  readOnly: boolean           // true = public view, false = editor

  // Actions
  setLastError: (msg: string | null) => void
  setUserId: (id: string | null) => void
  setReadOnly: (v: boolean) => void
  setSelectedNode: (id: string | null) => void
  setPlayingVideoUrl: (url: string | null) => void
  setFilterTags: (tags: string[]) => void
  setBgColor: (color: string) => void
  setShowProfilePanel: (show: boolean) => void
  setEditMode: (v: boolean) => void
  setSocial: (platform: string, url: string) => Promise<void>
  setSocials: (allSocials: Record<string, string>) => Promise<void>
  addNode: (node: Omit<NodeData, 'id' | 'position'>) => Promise<void>
  removeNode: (id: string) => Promise<void>
  updateNode: (id: string, updates: Partial<NodeData>) => Promise<void>
  loadFromSupabase: (userId: string) => Promise<void>
  resetCanvas: () => void
}

// ─── Auth token ──────────────────────────────────────────────────────────
//
// Tokens are read straight from localStorage (synchronous, never blocks) and
// refreshed through the auth REST endpoint with raw fetch. We deliberately do
// not use supabase.auth.getSession()/refreshSession(): the JS client hangs on
// this project's writes, and getSession() can trigger that same stalled refresh
// internally.

function authStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
}

function readStoredSession(supabaseUrl: string): { access_token?: string; refresh_token?: string } | null {
  try {
    const raw = localStorage.getItem(authStorageKey(supabaseUrl))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const session = parsed?.currentSession ?? parsed
    return session?.access_token ? session : null
  } catch { return null }
}

// Seconds left on a JWT's `exp` claim. Returns 0 when unreadable, so an
// undecodable token is treated as expired rather than silently used.
function secondsUntilExpiry(jwt: string): number {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload?.exp === 'number' ? payload.exp - Math.floor(Date.now() / 1000) : 0
  } catch { return 0 }
}

let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(supabaseUrl: string, anonKey: string, refreshToken: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.access_token) return null

    // Write the new session back so the JS client (Auth/Storage) picks it up too
    try {
      const raw = localStorage.getItem(authStorageKey(supabaseUrl))
      const parsed = raw ? JSON.parse(raw) : {}
      localStorage.setItem(
        authStorageKey(supabaseUrl),
        JSON.stringify(
          parsed?.currentSession
            ? { ...parsed, currentSession: { ...parsed.currentSession, ...data } }
            : { ...parsed, ...data }
        )
      )
    } catch { /* token is still usable for this request */ }

    return data.access_token as string
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Returns a valid access token, refreshing it first when it has expired.
// This matters most on mobile: a backgrounded tab has its timers frozen, so the
// JS client's auto-refresh never fires and the stored token goes stale — every
// write then came back 401 and was discarded without a trace.
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return null

  const session = readStoredSession(supabaseUrl)
  if (!session?.access_token) return null
  if (secondsUntilExpiry(session.access_token) > 60) return session.access_token
  if (!session.refresh_token) return null

  // Share a single refresh between concurrent writes
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken(supabaseUrl, anonKey, session.refresh_token)
      .finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

// ─── DB writes ───────────────────────────────────────────────────────────

type WriteResult = { ok: true } | { ok: false; error: string }

// Performs a write and confirms it actually changed something.
//
// WHY Prefer: return=representation (not return=minimal):
//   PostgREST answers 204 to a PATCH/DELETE that matched zero rows — which is
//   exactly what happens when RLS filters the row out. That is indistinguishable
//   from success, so writes looked fine and then vanished on reload. Asking for
//   the affected rows back lets us tell the two apart.
async function rawDbWrite(
  method: 'POST' | 'PATCH' | 'DELETE',
  queryParams: string,
  body: Record<string, unknown> | null,
  endpoint: string = '/rest/v1/canvas_nodes'
): Promise<WriteResult> {
  if (typeof window === 'undefined') return { ok: false, error: 'No disponible en el servidor' }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return { ok: false, error: 'Supabase no está configurado' }

  const token = await getAuthToken()
  if (!token) return { ok: false, error: 'Tu sesión expiró — volvé a iniciar sesión' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${supabaseUrl}${endpoint}${queryParams}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`[Feed.Me] DB ${method} ${res.status}:`, detail)
      if (res.status === 401 || res.status === 403) return { ok: false, error: 'Tu sesión expiró — volvé a iniciar sesión' }
      if (res.status === 409) return { ok: false, error: 'Ese elemento ya existe' }
      return { ok: false, error: `Error del servidor (${res.status})` }
    }

    const rows = await res.json().catch(() => null)
    if (!Array.isArray(rows) || rows.length === 0) {
      console.error(`[Feed.Me] DB ${method} affected 0 rows (RLS or unknown id):`, queryParams)
      return { ok: false, error: 'No se guardó — revisá tus permisos' }
    }
    return { ok: true }
  } catch (err) {
    console.error(`[Feed.Me] DB ${method} failed:`, err)
    return {
      ok: false,
      error: (err as Error).name === 'AbortError'
        ? 'Tiempo de espera agotado — revisá tu conexión'
        : 'No se pudo conectar',
    }
  } finally {
    clearTimeout(timer)
  }
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  selectedNode: null,
  playingVideoUrl: null,
  bgColor: '#ede8de',
  showProfilePanel: false,
  editMode: false,
  socials: {},
  nodesLoaded: false,
  filterTags: [],
  lastError: null,
  userId: null,
  readOnly: false,

  setLastError: (msg) => set({ lastError: msg }),
  setUserId: (id) => set({ userId: id }),
  setReadOnly: (v) => set({ readOnly: v, editMode: false }),
  setSelectedNode: (id) => set({ selectedNode: id }),
  setPlayingVideoUrl: (url) => set({ playingVideoUrl: url }),
  setFilterTags: (tags) => set({ filterTags: tags }),
  setShowProfilePanel: (show) => set({ showProfilePanel: show }),
  setEditMode: (v) => {
    if (get().readOnly) return  // no edit mode in public view
    set({ editMode: v })
  },

  setBgColor: (color) => {
    set({ bgColor: color })
    // Persist to profile if this is the owner's canvas.
    // Not rolled back on failure: the picker fires rapidly while dragging and
    // reverting mid-drag would fight the user. We just report it.
    const { readOnly, userId } = get()
    if (!readOnly && userId) {
      rawDbWrite('PATCH', `?id=eq.${encodeURIComponent(userId)}`, { bg_color: color }, '/rest/v1/profiles')
        .then((r) => { if (!r.ok) set({ lastError: `No se guardó el color: ${r.error}` }) })
    }
  },

  resetCanvas: () => {
    set({
      nodes: [],
      selectedNode: null,
      playingVideoUrl: null,
      nodesLoaded: false,
      socials: {},
      filterTags: [],
      lastError: null,
      userId: null,
      readOnly: false,
      editMode: false,
    })
  },

  // Load nodes for a given user
  loadFromSupabase: async (userId: string) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) { set({ nodesLoaded: true }); return }

    // Refresh an expired token first. Loading with a stale one returned 401 and
    // rendered an empty canvas, which looks exactly like "everything got deleted".
    const token = (await getAuthToken()) ?? anonKey

    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/canvas_nodes?user_id=eq.${userId}&order=created_at.asc`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        console.error('Supabase load error:', await res.text())
        set({
          nodesLoaded: true,
          lastError: res.status === 401 || res.status === 403
            ? 'No se pudo cargar tu canvas — volvé a iniciar sesión'
            : 'No se pudo cargar tu canvas — revisá tu conexión',
        })
        return
      }

      const data = await res.json()
      const allRows = Array.isArray(data) ? data : []

      // Socials are saved as a special 'socials_config' row — take the most recent one
      const socialsRow = [...allRows].reverse().find(r => r.type === 'socials_config')
      let socials: Record<string, string> = {}
      if (socialsRow?.content) {
        try { socials = JSON.parse(socialsRow.content) } catch { /* ignore */ }
      } else {
        // Legacy: socials were individual 'social' type nodes
        allRows.filter(r => r.type === 'social' && r.title && r.content)
          .forEach(r => { socials[r.title] = r.content })
      }

      // Build social canvas nodes for display (fixed positions, not included in layout)
      const socialNodes: NodeData[] = Object.entries(socials)
        .filter(([, url]) => url.trim())
        .map(([platform, url]) => {
          const idx = SOCIAL_PLATFORMS.findIndex(p => p.key === platform)
          const i = idx >= 0 ? idx : 0
          const golden = Math.PI * (3 - Math.sqrt(5))
          const angle = i * golden * 2.5
          const radius = 14 + i * 1.2
          return {
            id: `${userId}-social-${platform}`,
            type: 'social' as const,
            content: url,
            title: platform,
            tags: ['social', platform],
            position: [
              Math.cos(angle) * radius,
              Math.sin(angle) * radius * 0.38,
              Math.sin(angle * 0.6) * 5,
            ] as [number, number, number],
            seed: i,
          }
        })

      // Regular nodes: skip socials_config rows and legacy social rows (handled above)
      const regularRows = allRows.filter(r => r.type !== 'socials_config' && r.type !== 'social')

      if (regularRows.length > 0 || socialNodes.length > 0) {
        const loaded: NodeData[] = regularRows
          .filter(row => row.id && row.type && row.content && !String(row.content).startsWith('blob:'))
          .map(row => ({
            id: row.id,
            type: row.type,
            content: row.content,
            title: row.title ?? undefined,
            caption: row.caption ?? undefined,
            date: row.date ?? undefined,
            tags: Array.isArray(row.tags) ? row.tags : [],
            position: [0, 0, 0] as [number, number, number],
            seed: typeof row.seed === 'number' ? row.seed : 0,
          }))

        // Always generate fresh random positions so every session looks different
        if (loaded.length > 0) {
          const newPositions = layoutPositions(loaded.length)
          loaded.forEach((n, i) => { n.position = newPositions[i] })
        }

        // Size the GPU texture cap to the canvas before any node renders
        configureTextureBudget(loaded.filter((n) => n.type === 'image').length)

        set({ nodes: [...loaded, ...socialNodes], socials, nodesLoaded: true })
      } else {
        set({ nodes: socialNodes, socials, nodesLoaded: true })
      }
    } catch (e) {
      console.error('Failed to load from Supabase:', e)
      set({ nodesLoaded: true, lastError: 'No se pudo cargar tu canvas — revisá tu conexión' })
    }
  },

  addNode: async (node) => {
    const { readOnly, userId } = get()
    if (readOnly || !userId) return

    // Random suffix: `node-${Date.now()}` alone collided when several images
    // were added in the same millisecond, and the duplicate primary key made the
    // second insert fail.
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const isMob = typeof window !== 'undefined' && window.innerWidth < 600
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
    const baseH = isMob ? 19 : 11
    const baseW = baseH * aspect
    const count = get().nodes.length
    const scaleF = Math.max(1, Math.sqrt((count + 1) / 30))
    const Rx = baseW * scaleF * 0.72
    const Ry = baseH * scaleF * 0.72
    // Pick a random position inside the oval, avoiding existing nodes
    const existing = get().nodes.map(n => n.position)
    let px = 0, py = 0, bestD = -1
    for (let a = 0; a < 120; a++) {
      const cx = (Math.random() * 2 - 1) * Rx
      const cy = (Math.random() * 2 - 1) * Ry
      if ((cx / Rx) ** 2 + (cy / Ry) ** 2 > 1) continue
      const minD = existing.length === 0 ? Infinity
        : existing.reduce((m, [ex, ey]) => Math.min(m, Math.sqrt((cx - ex) ** 2 + (cy - ey) ** 2)), Infinity)
      if (minD >= 6) { px = cx; py = cy; break }
      if (minD > bestD) { bestD = minD; px = cx; py = cy }
    }
    const pos: [number, number, number] = [px, py, (Math.random() - 0.5) * 8]
    const newNode: NodeData = { ...node, id, position: pos }

    // Optimistic update
    set((state) => ({ nodes: [...state.nodes, newNode] }))

    const result = await rawDbWrite('POST', '', {
      id,
      user_id: userId,
      type: node.type,
      content: node.content,
      title: node.title ?? null,
      caption: node.caption ?? null,
      date: node.date ?? null,
      tags: node.tags,
      position: pos,
      seed: node.seed,
    })

    // Roll back so the canvas never shows something the database doesn't have
    if (!result.ok) {
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        selectedNode: state.selectedNode === id ? null : state.selectedNode,
        lastError: result.error,
      }))
    }
  },

  updateNode: async (id, updates) => {
    const { readOnly, userId } = get()
    if (readOnly || !userId) return

    const before = get().nodes.find((n) => n.id === id)
    if (!before) return

    // Optimistic update
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }))

    const patch: Record<string, unknown> = {}
    if (updates.title !== undefined) patch.title = updates.title
    if (updates.caption !== undefined) patch.caption = updates.caption
    if (updates.tags !== undefined) patch.tags = updates.tags
    // `date` and `content` used to be missing here, so changing a date or the
    // body of a text node updated the canvas but was never written to the DB.
    if (updates.date !== undefined) patch.date = updates.date ?? null
    if (updates.content !== undefined) patch.content = updates.content
    if (Object.keys(patch).length === 0) return

    const result = await rawDbWrite('PATCH', `?id=eq.${encodeURIComponent(id)}`, patch)

    if (!result.ok) {
      // Restore only the fields this call touched, so a concurrent edit to a
      // different field isn't clobbered by the rollback.
      const revert: Record<string, unknown> = {}
      for (const key of Object.keys(updates)) revert[key] = before[key as keyof NodeData]
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...revert } : n)),
        lastError: result.error,
      }))
    }
  },

  removeNode: async (id) => {
    const { readOnly, userId } = get()
    if (readOnly || !userId) return

    const index = get().nodes.findIndex((n) => n.id === id)
    if (index === -1) return
    const node = get().nodes[index]

    // Socials have no row of their own — they live inside the single
    // 'socials_config' row. The old code fired a DELETE at the synthetic id
    // `<userId>-social-<platform>`, which matched nothing, so removed socials
    // came back on the next load. Route them through setSocials instead.
    if (node.type === 'social') {
      const next = { ...get().socials }
      if (node.title) delete next[node.title]
      try {
        await get().setSocials(next)
      } catch (err) {
        set({ lastError: (err as Error).message })
      }
      return
    }

    // Optimistic update
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      selectedNode: state.selectedNode === id ? null : state.selectedNode,
    }))

    // Demo nodes only ever exist client-side
    if (id.startsWith('demo-')) return

    const result = await rawDbWrite('DELETE', `?id=eq.${encodeURIComponent(id)}`, null)

    // Put it back where it was — the database still has it
    if (!result.ok) {
      set((state) => {
        const nodes = [...state.nodes]
        nodes.splice(Math.min(index, nodes.length), 0, node)
        return { nodes, lastError: result.error }
      })
    }
  },

  // Save ALL socials at once — upsert to a fixed row ID so there's only ever one row
  setSocials: async (allSocials: Record<string, string>) => {
    const { readOnly, userId } = get()
    if (readOnly || !userId) throw new Error('Not authenticated')
    if (!supabase) throw new Error('Supabase not configured')

    // Keep only non-empty values
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(allSocials)) {
      if (v.trim()) clean[k] = v.trim()
    }

    // Build social canvas nodes for display
    const socialNodes: NodeData[] = Object.entries(clean).map(([platform, url]) => {
      const idx = SOCIAL_PLATFORMS.findIndex(p => p.key === platform)
      const i = idx >= 0 ? idx : 0
      const golden = Math.PI * (3 - Math.sqrt(5))
      const angle = i * golden * 2.5
      const radius = 14 + i * 1.2
      return {
        id: `${userId}-social-${platform}`,
        type: 'social' as const,
        content: url,
        title: platform,
        tags: ['social', platform],
        position: [
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.38,
          Math.sin(angle * 0.6) * 5,
        ] as [number, number, number],
        seed: i,
      }
    })

    // Optimistic update
    set(state => ({
      nodes: [...state.nodes.filter(n => n.type !== 'social'), ...socialNodes],
      socials: clean,
    }))

    // Persist via raw fetch with AbortController timeout.
    //
    // WHY raw fetch instead of supabase.from().upsert():
    //   The Supabase JS client hangs indefinitely on all write operations in this
    //   project (likely an issue with its internal fetch middleware / auth refresh).
    //   Raw fetch bypasses that layer entirely and always resolves or aborts.
    //
    // WHY getAuthToken() instead of supabase.auth.getSession():
    //   getSession() can trigger a network token-refresh which also hangs.
    //   getAuthToken() reads localStorage synchronously and only goes to the
    //   network (with a timeout) when the token has actually expired.
    //
    // WHY Prefer: return=representation:
    //   With return=minimal the server returns 204 even when RLS silently drops
    //   the insert (no rows affected). return=representation gives us the inserted
    //   row back, so we can confirm the save actually happened.

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) throw new Error('Supabase env vars not set')

    const token = await getAuthToken()
    if (!token) throw new Error('Tu sesión expiró — volvé a iniciar sesión')

    const fixedId = `${userId}-socials-config`
    const base    = `${supabaseUrl}/rest/v1/canvas_nodes`
    const headers = {
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'Authorization': `Bearer ${token}`,
      // return=representation sends the inserted row back so we can confirm it exists
      'Prefer': 'return=representation',
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    try {
      // Delete existing row first (fire-and-forget — no row = 204, that's fine)
      await fetch(
        `${base}?id=eq.${encodeURIComponent(fixedId)}`,
        { method: 'DELETE', headers, signal: controller.signal }
      )

      // Insert fresh row
      const res = await fetch(base, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          id: fixedId,
          user_id: userId,
          type: 'socials_config',
          content: JSON.stringify(clean),
          title: 'socials',
          caption: null,
          date: null,
          tags: [],
          position: [0, 0, 0],
          seed: 0,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => res.status.toString())
        throw new Error(`Error del servidor (${res.status}): ${text}`)
      }

      // Verify the row was actually written (with return=representation we get the row back)
      const rows: unknown[] = await res.json().catch(() => [])
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('El servidor no confirmó el guardado — revisa tus permisos')
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('Tiempo de espera agotado — verifica tu conexión')
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  },

  // Keep setSocial for individual changes (delegates to setSocials internally)
  setSocial: async (platform, url) => {
    const { readOnly, userId } = get()
    if (readOnly || !userId) return
    const current = { ...get().socials }
    if (url.trim()) {
      current[platform] = url.trim()
    } else {
      delete current[platform]
    }
    await get().setSocials(current)
  },
}))
