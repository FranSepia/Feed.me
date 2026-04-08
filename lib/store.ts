import { create } from 'zustand'
import { supabase } from './supabase'
import { getSessionId } from './sessionId'

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
  nodes: NodeData[]
  selectedNode: string | null
  bgColor: string
  showProfilePanel: boolean
  editMode: boolean
  socials: Record<string, string>
  nodesLoaded: boolean
  setSelectedNode: (id: string | null) => void
  setBgColor: (color: string) => void
  setShowProfilePanel: (show: boolean) => void
  setEditMode: (v: boolean) => void
  setSocial: (platform: string, url: string) => void
  addNode: (node: Omit<NodeData, 'id' | 'position'>) => Promise<void>
  removeNode: (id: string) => Promise<void>
  loadFromSupabase: () => Promise<void>
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: DEMO_NODES,
  selectedNode: null,
  bgColor: '#ede8de',
  showProfilePanel: false,
  editMode: false,
  socials: {},
  nodesLoaded: false,

  setSelectedNode: (id) => set({ selectedNode: id }),
  setBgColor: (color) => set({ bgColor: color }),
  setShowProfilePanel: (show) => set({ showProfilePanel: show }),
  setEditMode: (v) => set({ editMode: v }),

  // Load user's saved nodes from Supabase.
  // If they have saved nodes → replace demo nodes.
  // If new user → keep demo nodes so canvas isn't empty.
  loadFromSupabase: async () => {
    if (get().nodesLoaded) return
    const db = supabase
    if (!db) { set({ nodesLoaded: true }); return }
    try {
      const sessionId = getSessionId()
      const { data, error } = await db
        .from('canvas_nodes')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) { console.error('Supabase load error:', error); return }

      if (data && data.length > 0) {
        const loaded: NodeData[] = data
          .filter((row) => row.id && row.type && row.content) // skip corrupted rows
          .map((row) => {
            // Validate position — bad position data crashes Three.js
            const rawPos = row.position
            const pos: [number, number, number] =
              Array.isArray(rawPos) && rawPos.length >= 3 &&
              rawPos.every((v: unknown) => typeof v === 'number' && isFinite(v))
                ? [rawPos[0], rawPos[1], rawPos[2]]
                : [0, 0, 0]
            return {
              id: row.id,
              type: row.type,
              content: row.content,
              title: row.title ?? undefined,
              caption: row.caption ?? undefined,
              tags: Array.isArray(row.tags) ? row.tags : [],
              position: pos,
              seed: typeof row.seed === 'number' ? row.seed : 0,
            }
          })
        set({ nodes: loaded.length > 0 ? loaded : get().nodes, nodesLoaded: true })
      } else {
        // New user — keep demo nodes, mark as loaded
        set({ nodesLoaded: true })
      }
    } catch (e) {
      console.error('Failed to load from Supabase:', e)
    }
  },

  addNode: async (node) => {
    const id = `node-${Date.now()}`
    const pos = generatePositions(1)[0]
    const newNode: NodeData = { ...node, id, position: pos }

    // Optimistic update — show immediately
    set((state) => ({ nodes: [...state.nodes, newNode] }))

    // Persist to Supabase
    const db = supabase
    if (db) {
      try {
        const { error } = await db.from('canvas_nodes').insert({
          id,
          session_id: getSessionId(),
          type: node.type,
          content: node.content,
          title: node.title ?? null,
          caption: node.caption ?? null,
          tags: node.tags,
          position: pos,
          seed: node.seed,
        })
        if (error) console.error('Supabase insert error:', error)
      } catch (e) {
        console.error('Failed to save node:', e)
      }
    }
  },

  removeNode: async (id) => {
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
      try {
        const { error } = await db?.from('canvas_nodes').delete().eq('id', id)
        if (error) console.error('Supabase delete error:', error)
      } catch (e) {
        console.error('Failed to delete node:', e)
      }
    }
  },

  setSocial: (platform, url) =>
    set((state) => {
      const nodes = state.nodes.filter(
        (n) => !(n.type === 'social' && n.title === platform)
      )
      const newSocials = { ...state.socials }
      if (url.trim()) {
        newSocials[platform] = url
        const idx = SOCIAL_PLATFORMS.findIndex((p) => p.key === platform)
        const golden = Math.PI * (3 - Math.sqrt(5))
        const angle  = idx * golden * 2.5
        const radius = 14 + idx * 1.2
        const pos: [number, number, number] = [
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.38,
          Math.sin(angle * 0.6) * 5,
        ]
        nodes.push({
          id: `social-${platform}`,
          type: 'social',
          content: url,
          title: platform,
          tags: ['social', platform],
          position: pos,
          seed: idx,
        })
      } else {
        delete newSocials[platform]
      }
      return { socials: newSocials, nodes }
    }),
}))
