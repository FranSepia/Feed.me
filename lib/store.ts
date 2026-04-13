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
  { key: 'instagram',  label: 'Instagram',  color: '#E1306C', icon: 'IG' },
  { key: 'twitter',    label: 'X / Twitter', color: '#000000', icon: 'X'  },
  { key: 'tiktok',     label: 'TikTok',      color: '#010101', icon: 'TK' },
  { key: 'snapchat',   label: 'Snapchat',    color: '#FFFC00', icon: 'SC' },
  { key: 'onlyfans',   label: 'OnlyFans',    color: '#00AFF0', icon: 'OF' },
  { key: 'whatsapp',   label: 'WhatsApp',    color: '#25D366', icon: 'WA' },
  { key: 'youtube',    label: 'YouTube',     color: '#FF0000', icon: 'YT' },
  { key: 'twitch',     label: 'Twitch',      color: '#9146FF', icon: 'TW' },
  { key: 'linkedin',   label: 'LinkedIn',    color: '#0077B5', icon: 'LI' },
  { key: 'spotify',    label: 'Spotify',     color: '#1DB954', icon: 'SP' },
]

// Golden-angle spiral layout
export function generatePositions(count: number): [number, number, number][] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const offset = Math.random() * Math.PI * 2
  return Array.from({ length: count }, (_, i) => {
    const angle  = i * golden + offset
    const radius = Math.sqrt(i + 1) * 4.8
    return [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.75,
      Math.sin(i * 0.9 + offset) * 7,
    ] as [number, number, number]
  })
}

// Screen-aware oval layout
function layoutPositions(count: number): [number, number, number][] {
  const aspect = typeof window !== 'undefined'
    ? window.innerWidth / window.innerHeight
    : 1.6
  const base   = Math.sqrt(count) * 3.2 + 6
  const Rx     = aspect >= 1 ? base * Math.min(aspect, 2.2) * 0.68 : base * 0.68
  const Ry     = aspect >= 1 ? base * 0.44                          : base * Math.min(1 / aspect, 2.2) * 0.55
  const golden = Math.PI * (3 - Math.sqrt(5))
  const rot    = Math.random() * Math.PI * 2
  return Array.from({ length: count }, (_, i) => {
    const angle = i * golden + rot
    const r     = Math.sqrt((i + 0.5) / Math.max(count, 1))
    return [
      Math.cos(angle) * Rx * r + (Math.random() - 0.5) * Rx * 0.30,
      Math.sin(angle) * Ry * r + (Math.random() - 0.5) * Ry * 0.30,
      (Math.random() - 0.5) * 8,
    ] as [number, number, number]
  })
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

  resetCanvas: () => set({
    nodes: DEMO_NODES,
    selectedNode: null,
    playingVideoUrl: null,
    nodesLoaded: false,
    socials: {},
    filterTags: [],
    userId: null,
    readOnly: false,
    editMode: false,
  }),

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
        const positions = layoutPositions(loaded.length)
        const withPos = loaded.map((n, i) => ({ ...n, position: positions[i] }))
        set({ nodes: [...withPos, ...socialNodes], socials, nodesLoaded: true })
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
    const count = get().nodes.length
    const golden = Math.PI * (3 - Math.sqrt(5))
    const angle = count * golden + Math.random() * 0.8
    const radius = Math.sqrt(count + 2) * 5 + Math.random() * 4
    const pos: [number, number, number] = [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.75,
      (Math.random() - 0.5) * 12,
    ]
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

  // Save ALL socials at once — raw fetch to bypass any Supabase JS client lock issues
  setSocials: async (allSocials: Record<string, string>) => {
    const { readOnly, userId } = get()
    if (readOnly || !userId) return

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

    // Persist via raw fetch — avoids any internal Supabase JS client lock/hang
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) throw new Error('Supabase env vars not set')

    // Get auth token (fall back to anon key if no session)
    let token = anonKey
    try {
      const { data } = await supabase!.auth.getSession()
      if (data.session?.access_token) token = data.session.access_token
    } catch { /* use anon key */ }

    const payload = {
      id: `${userId}-socials-${Date.now()}`,
      user_id: userId,
      type: 'socials_config',
      content: JSON.stringify(clean),
      title: 'socials',
      caption: null,
      date: null,
      tags: [] as string[],
      position: [0, 0, 0] as number[],
      seed: 0,
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/canvas_nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Save failed: ${res.status} ${text}`)
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
