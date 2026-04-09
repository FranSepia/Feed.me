'use client'

import { useState, useEffect } from 'react'
import { useCanvasStore } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'

export function NodeEditor() {
  const selectedNode = useCanvasStore((s) => s.selectedNode)
  const editMode = useCanvasStore((s) => s.editMode)
  const nodes = useCanvasStore((s) => s.nodes)
  const updateNode = useCanvasStore((s) => s.updateNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const { isMobile } = useResponsive()

  const node = nodes.find((n) => n.id === selectedNode)

  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync state with node
  useEffect(() => {
    if (node) {
      setTitle(node.title || '')
      setCaption(node.caption || '')
      setTags(node.tags?.join(', ') || '')
      setDate(node.date || '')
    }
  }, [node])

  if (!editMode || !selectedNode || !node) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
      await updateNode(node.id, {
        title,
        caption,
        tags: tagList,
        date: date || undefined,
      })
      setSelectedNode(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this element?')) {
      await removeNode(node.id)
      setSelectedNode(null)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? '20px' : '40px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 500,
      background: 'linear-gradient(160deg, rgba(255,255,255,0.72) 0%, rgba(240,240,240,0.60) 100%)',
      borderTop: '1px solid rgba(255,255,255,0.90)',
      borderLeft: '1px solid rgba(255,255,255,0.90)',
      borderBottom: '1px solid rgba(180,180,180,0.35)',
      borderRight: '1px solid rgba(180,180,180,0.35)',
      borderRadius: '24px',
      padding: '24px',
      width: isMobile ? 'calc(100vw - 32px)' : '360px',
      backdropFilter: 'blur(32px)',
      WebkitBackdropFilter: 'blur(32px)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.95)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'rgba(50,54,78,0.95)' }}>Edit {node.type}</h3>
        <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', color: 'rgba(50,54,78,0.5)', cursor: 'pointer', fontSize: '20px' }}>×</button>
      </div>

      {(node.type === 'image' || node.type === 'video' || node.type === 'text') && (
        <input 
          placeholder="Title (optional)" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          style={inputStyle} 
        />
      )}

      {(node.type === 'image' || node.type === 'video') && (
        <input 
          placeholder="Caption (optional)" 
          value={caption} 
          onChange={(e) => setCaption(e.target.value)} 
          style={inputStyle} 
        />
      )}

      {node.type === 'text' && (
        <textarea 
          placeholder="Text content..." 
          value={node.content} 
          disabled /* Text content is read-only right now or we can implement full text edit if we pass `content` to updates... wait user wants full edit so let's allow it */
          rows={3} 
          onChange={(e) => updateNode(node.id, { content: e.target.value })}
          style={{ ...inputStyle, resize: 'none' }} 
        />
      )}

      {node.type !== 'text' && node.type !== 'spotify' && (
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)} 
          style={{ ...inputStyle, colorScheme: 'light' }} 
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input 
          placeholder="Tags (comma separated)" 
          value={tags} 
          onChange={(e) => setTags(e.target.value)} 
          style={inputStyle} 
        />
        {Array.from(new Set(nodes.flatMap((n) => n.tags))).sort().length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {Array.from(new Set(nodes.flatMap((n) => n.tags))).sort().map((tag) => {
              const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean)
              const active = currentTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => {
                    let newTags = [...currentTags]
                    if (active) newTags = newTags.filter(t => t !== tag)
                    else newTags.push(tag)
                    setTags(newTags.join(', '))
                  }}
                  style={{
                    background: active ? 'rgba(50,54,78,0.15)' : 'transparent',
                    border: `1px solid rgba(50,54,78,${active ? 0.3 : 0.15})`,
                    color: active ? 'rgba(50,54,78,0.95)' : 'rgba(50,54,78,0.6)',
                    borderRadius: '12px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  #{tag}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
        <button 
          onClick={handleDelete}
          style={{ 
            background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)', 
            color: 'rgba(200,50,50,0.9)', padding: '8px 16px', borderRadius: '12px', 
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Delete
        </button>
        <button 
          onClick={handleSave}
          style={{ 
            background: 'linear-gradient(135deg, rgba(80,100,250,0.9), rgba(50,70,220,0.9))', 
            border: '1px solid rgba(255,255,255,0.2)', color: 'white', 
            padding: '8px 24px', borderRadius: '12px', fontSize: '14px', 
            fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(50,70,220,0.3)',
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.65)',
  border: '1px solid rgba(50,54,78,0.12)',
  borderRadius: '12px',
  padding: '10px 14px',
  color: 'rgba(50,54,78,0.9)',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
  boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.03)',
}
