import { create } from 'zustand'
import { supabase } from './supabase'

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

  // Multi-user fields
  userId: string | null       // whose canvas is currently loaded
  readOnly: boolean           // true = public view, false = editor

  // Actions
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

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: DEMO_NODES,
  selectedNode: null,
  playingVideoUrl: null,
  bgColor: '#ede8de',
  showProfilePanel: false,
  editMode: false,
  socials: {},
  nodesLoaded: false,
  filterTags: [],
  userId: null,
  readOnly: false,

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
    // Persist to profile if this is the owner's canvas
    const { userId, readOnly } = get()
    if (!readOnly && userId && supabase) {
      supabase.from('profiles').update({ bg_color: color }).eq('id', userId).then()
    }
  },

  resetCanvas: () => {
    const freshPositions = generatePositions(DEMO_NODES.length)
    const freshDemo = DEMO_NODES.map((n, i) => ({ ...n, position: freshPositions[i] }))
    set({
      nodes: freshDemo,
      selectedNode: null,
      playingVideoUrl: null,
      nodesLoaded: false,
      socials: {},
      filterTags: [],
      userId: null,
      readOnly: false,
      editMode: false,
    })
  },

  // Load nodes for a given user
  loadFromSupabase: async (userId: string) => {
    const db = supabase
    if (!db) { set({ nodesLoaded: true }); return }
    try {
      const { data, error } = await db
        .from('canvas_nodes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) { console.error('Supabase load error:', error); set({ nodesLoaded: true }); return }

      const allRows = data ?? []

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
          .filter(row => row.id && row.type && row.content)
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

        set({ nodes: [...loaded, ...socialNodes], socials, nodesLoaded: true })
      } else {
        const { readOnly } = get()
        if (readOnly) {
          set({ nodes: socialNodes, socials, nodesLoaded: true })
        } else {
          const positions = layoutPositions(DEMO_NODES.length)
          const demo = DEMO_NODES.map((n, i) => ({ ...n, position: positions[i] }))
          set({ nodes: demo, socials, nodesLoaded: true })
        }
      }
    } catch (e) {
      console.error('Failed to load from Supabase:', e)
      set({ nodesLoaded: true })
    }
  },

  addNode: async (node) => {
    const { readOnly, userId } = get()
    if (readOnly || !userId) return

    const id = `node-${Date.now()}`
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

    // Persist
    const db = supabase
    if (db) {
      try {
        const payload = {
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
        }
        const { error } = await db.from('canvas_nodes').insert(payload)
        if (error) {
          console.error('[Feed.Me] INSERT error:', error.message, error.details, error.hint)
        }
      } catch (e) {
        console.error('[Feed.Me] Failed to save node:', e)
      }
    }
  },

  updateNode: async (id, updates) => {
    const { readOnly, userId } = get()
    if (readOnly || !userId) return

    // Optimistic update
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    }))

    // Persist
    const db = supabase
    if (db) {
      try {
        const payload: Record<string, any> = {}
        if (updates.title !== undefined) payload.title = updates.title
        if (updates.caption !== undefined) payload.caption = updates.caption
        if (updates.tags !== undefined) payload.tags = updates.tags

        if (Object.keys(payload).length > 0) {
          const { error } = await db.from('canvas_nodes').update(payload).eq('id', id)
          if (error) console.error('[Feed.Me] UPDATE error:', error.message)
        }
      } catch (e) {
        console.error('[Feed.Me] Failed to update node:', e)
      }
    }
  },

  removeNode: async (id) => {
    const { readOnly } = get()
    if (readOnly) return

    const node = get().nodes.find((n) => n.id === id)
    const newSocials = { ...get().socials }
    if (node?.type === 'social' && node.title) delete newSocials[node.title]

    // Optimistic update
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      selectedNode: state.selectedNode === id ? null : state.selectedNode,
      socials: newSocials,
    }))

    // Delete from Supabase (demo nodes have "demo-" prefix, skip them)
    if (!id.startsWith('demo-')) {
      const db = supabase
      if (db) {
        try {
          const { error } = await db.from('canvas_nodes').delete().eq('id', id)
          if (error) console.error('Supabase delete error:', error)
        } catch (e) {
          console.error('Failed to delete node:', e)
        }
      }
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

    // Persist via upsert — atomic single operation, errors propagate correctly.
    // The previous raw-fetch DELETE+INSERT with `Prefer: return=minimal` had a silent
    // failure mode: Supabase returns 204 even when RLS blocks the insert, so the UI
    // showed "Guardado" while nothing was actually written.
    const fixedId = `${userId}-socials-config`
    const { error } = await supabase
      .from('canvas_nodes')
      .upsert(
        {
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
        },
        { onConflict: 'id' }
      )

    if (error) throw new Error(error.message)
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
