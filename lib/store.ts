import { create } from 'zustand'

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

interface CanvasStore {
  nodes: NodeData[]
  selectedNode: string | null
  bgColor: string
  showProfilePanel: boolean
  editMode: boolean
  socials: Record<string, string>
  setSelectedNode: (id: string | null) => void
  setBgColor: (color: string) => void
  setShowProfilePanel: (show: boolean) => void
  setEditMode: (v: boolean) => void
  setSocial: (platform: string, url: string) => void
  addNode: (node: Omit<NodeData, 'id' | 'position'>) => void
  removeNode: (id: string) => void
}

const DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
  'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800',
  'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=800',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800',
  'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800',
  'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=800',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800',
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800',
]

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Golden-angle spiral → always circular, never random clumping
export function generatePositions(count: number): [number, number, number][] {
  const golden = Math.PI * (3 - Math.sqrt(5)) // ~137.5°
  const offset = Math.random() * Math.PI * 2   // random starting angle per session
  return Array.from({ length: count }, (_, i) => {
    const angle  = i * golden + offset
    const radius = Math.sqrt(i + 1) * 4.8
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius * 0.45
    const z = Math.sin(i * 0.9 + offset) * 7
    return [x, y, z] as [number, number, number]
  })
}

const positions = generatePositions(DEMO_IMAGES.length + 3)

const DEMO_NODES: NodeData[] = [
  ...DEMO_IMAGES.map((url, i) => ({
    id: `img-${i}`,
    type: 'image' as const,
    content: url,
    title: `Photo ${i + 1}`,
    tags: ['nature', 'landscape', i % 2 === 0 ? 'forest' : 'mountain'].slice(0, i % 3 + 1),
    position: positions[i],
    seed: i,
  })),
  {
    id: 'text-1',
    type: 'text' as const,
    content: 'Welcome to Feed.Me — your personal 3D canvas.',
    title: 'Welcome',
    tags: ['intro', 'feed.me'],
    position: positions[12],
    seed: 12,
  },
  {
    id: 'text-2',
    type: 'text' as const,
    content: 'Scroll to zoom in, drag to pan around.',
    title: 'Navigation tip',
    tags: ['help', 'intro'],
    position: positions[13],
    seed: 13,
  },
  {
    id: 'spotify-1',
    type: 'spotify' as const,
    content: '4uLU6hMCjMI75M1A2tKUQC',
    title: 'Never Gonna Give You Up',
    tags: ['music', 'classic'],
    position: positions[14],
    seed: 14,
  },
]

let nodeIdCounter = DEMO_NODES.length

export const useCanvasStore = create<CanvasStore>((set) => ({
  nodes: DEMO_NODES,
  selectedNode: null,
  bgColor: '#ede8de',
  showProfilePanel: false,
  editMode: false,
  socials: {},
  setSelectedNode: (id) => set({ selectedNode: id }),
  setBgColor: (color) => set({ bgColor: color }),
  setShowProfilePanel: (show) => set({ showProfilePanel: show }),
  setEditMode: (v) => set({ editMode: v }),
  setSocial: (platform, url) =>
    set((state) => {
      // Remove existing social node for this platform
      const nodes = state.nodes.filter(
        (n) => !(n.type === 'social' && n.title === platform)
      )
      const newSocials = { ...state.socials }

      if (url.trim()) {
        newSocials[platform] = url
        // Deterministic position based on platform index
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
  addNode: (node) => {
    const id = `node-${++nodeIdCounter}`
    const pos = generatePositions(1)[0]
    set((state) => ({
      nodes: [...state.nodes, { ...node, id, position: pos }],
    }))
  },
  removeNode: (id) =>
    set((state) => {
      const node = state.nodes.find((n) => n.id === id)
      const newSocials = { ...state.socials }
      if (node?.type === 'social' && node.title) delete newSocials[node.title]
      return {
        nodes: state.nodes.filter((n) => n.id !== id),
        selectedNode: state.selectedNode === id ? null : state.selectedNode,
        socials: newSocials,
      }
    }),
}))
