'use client'

import { useState, useRef, useCallback } from 'react'
import { useCanvasStore } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'
import { supabase } from '@/lib/supabase'
import { getSessionId } from '@/lib/sessionId'

type UploadType = 'image' | 'video' | 'text' | 'spotify' | null

// ── SVG outline icons (pure white stroke, no fill) ──────────────────────────
function IconPhoto() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17.5" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconText() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M12 7v10M8 17h8" />
    </svg>
  )
}

function IconVideo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3V10z" />
    </svg>
  )
}

function IconMusic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="18" r="2.5" />
      <circle cx="18" cy="16" r="2.5" />
      <path d="M10.5 18V7l10-2v9" />
    </svg>
  )
}

// ── Neumorphic bar base color ─────────────────────────────────────────────────
// All shadows are calculated relative to this base
const BAR_BG = 'rgba(200,205,218,0.72)'

interface AquaButtonProps {
  icon: React.ReactNode
  label: string
  active: boolean
  themeKey: string
  onClick: () => void
  compact?: boolean
}

function AquaButton({ icon, label, active, themeKey, onClick, compact }: AquaButtonProps) {
  const [hovered, setHovered] = useState(false)

  // Inactive = sunken (inset shadow)
  // Active   = raised/elevated (outset shadow + bright pill)
  const shadowSunken =
    'inset 1px 1px 4px rgba(140,145,160,0.35), inset -1px -1px 4px rgba(255,255,255,0.55)'
  const shadowRaised =
    '3px 3px 8px rgba(120,125,140,0.30), -2px -2px 6px rgba(255,255,255,0.70)'
  const shadowHover =
    'inset 1px 1px 2px rgba(140,145,160,0.25), inset -1px -1px 2px rgba(255,255,255,0.45)'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '0' : '7px',
        padding: compact ? '9px' : '9px 18px',
        borderRadius: '50px',
        // Bevel: light top-left / dark bottom-right
        border: active
          ? '1px solid rgba(255,255,255,0.82)'
          : '1px solid rgba(255,255,255,0.55)',
        borderTop: active ? '1px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.7)',
        borderLeft: active ? '1px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.7)',
        borderBottom: active ? '1px solid rgba(180,185,205,0.5)' : '1px solid rgba(180,185,205,0.4)',
        borderRight: active ? '1px solid rgba(180,185,205,0.5)' : '1px solid rgba(180,185,205,0.4)',
        cursor: 'pointer',
        transition: 'all 0.16s ease',
        // Active raised = moves up slightly; inactive sunken = no transform
        transform: active ? 'translateY(-1px)' : 'translateY(0)',
        background: active
          ? 'linear-gradient(145deg, rgba(255,255,255,0.72) 0%, rgba(230,232,238,0.55) 100%)'
          : 'transparent',
        boxShadow: active ? shadowRaised : hovered ? shadowHover : shadowSunken,
        // Ash/gray tones — low contrast as in reference
        color: active ? 'rgba(50,54,78,0.95)' : 'rgba(68,72,96,0.80)',
        fontSize: '13px',
        fontWeight: 600,
        letterSpacing: '0.01em',
        outline: 'none',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        minWidth: compact ? '40px' : undefined,
        minHeight: compact ? '40px' : undefined,
      }}
    >
      {icon}
      {!compact && <span>{label}</span>}
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function BottomBar() {
  const [activeType, setActiveType] = useState<UploadType>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [videoFile, setVideoFile] = useState<string | null>(null)
  const [videoFileName, setVideoFileName] = useState('')
  const videoFileInputRef = useRef<HTMLInputElement>(null)
  const [textContent, setTextContent] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [spotifyTrackId, setSpotifyTrackId] = useState('')
  const [spotifyTitle, setSpotifyTitle] = useState('')
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [tags, setTags] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [imageCaption, setImageCaption] = useState('')
  const [imageDate, setImageDate] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageFileRef = useRef<File | null>(null)
  const videoRawFileRef = useRef<File | null>(null)
  const addNode = useCanvasStore((s) => s.addNode)
  const nodes = useCanvasStore((s) => s.nodes)
  const { isMobile } = useResponsive()

  // All unique tags already in the canvas
  const existingTags = Array.from(new Set(nodes.flatMap((n) => n.tags))).sort()

  // Upload a file to Supabase Storage and return its public URL
  const uploadMedia = async (file: File): Promise<string> => {
    const db = supabase
    if (!db) throw new Error('Supabase not configured')
    const sessionId = getSessionId()
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await db.storage.from('media').upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw error
    const { data } = db.storage.from('media').getPublicUrl(path)
    return data.publicUrl
  }

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    imageFileRef.current = file
    const objectUrl = URL.createObjectURL(file)
    setImagePreview(objectUrl)
    setImageUrl(objectUrl)
    setImageName(file.name)
  }, [])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    setImageUrl('')
    setImageName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSpotifyUrlChange = async (value: string) => {
    setSpotifyUrl(value)
    setSpotifyTitle('')
    setSpotifyTrackId('')
    const match = value.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/)
    if (!match) return
    const id = match[1]
    setSpotifyTrackId(id)
    setSpotifyLoading(true)
    try {
      const res = await fetch(
        `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${id}`
      )
      if (res.ok) {
        const data = await res.json()
        setSpotifyTitle(data.title ?? 'Track')
      }
    } catch {
      setSpotifyTitle('Track')
    } finally {
      setSpotifyLoading(false)
    }
  }

  const handleAdd = async () => {
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    setUploading(true)

    try {
      if (activeType === 'text' && textContent) {
        await addNode({ type: 'text', content: textContent, title: textTitle, tags: tagList, seed: Math.random() })
        setTextContent(''); setTextTitle('')

      } else if (activeType === 'image' && imageUrl) {
        let finalUrl = imageUrl
        // If user selected a local file, try uploading to Supabase Storage
        if (imageFileRef.current) {
          try {
            finalUrl = await uploadMedia(imageFileRef.current)
          } catch (uploadErr) {
            console.warn('Storage upload failed, using local URL for this session:', uploadErr)
            // Keep the local blob URL — node will show in this session but won't persist across devices
          }
          imageFileRef.current = null
        }
        await addNode({ type: 'image', content: finalUrl, title: imageName || 'Image', caption: imageCaption || undefined, date: imageDate || undefined, tags: tagList, seed: Math.random() })
        if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
        setImagePreview(null); setImageName(''); setImageUrl(''); setImageCaption(''); setImageDate('')

      } else if (activeType === 'spotify' && spotifyTrackId) {
        await addNode({ type: 'spotify', content: spotifyTrackId, title: spotifyTitle || 'Track', tags: tagList, seed: Math.random() })
        setSpotifyUrl(''); setSpotifyTrackId(''); setSpotifyTitle('')

      } else if (activeType === 'video' && (videoUrl || videoFile || videoRawFileRef.current)) {
        let finalUrl = videoUrl || videoFile || ''
        // If user selected a local video file, upload it to Supabase Storage
        if (videoRawFileRef.current) {
          finalUrl = await uploadMedia(videoRawFileRef.current)
          videoRawFileRef.current = null
        }
        await addNode({ type: 'video', content: finalUrl, title: videoTitle || videoFileName || 'Video', tags: tagList, seed: Math.random() })
        setVideoUrl(''); setVideoTitle(''); setVideoFile(null); setVideoFileName('')
      }
    } catch (err) {
      console.error('Error adding node:', err)
      alert('Error al subir el archivo. Verifica tu conexión e inténtalo de nuevo.')
    } finally {
      setUploading(false)
    }

    setTags('')
    setActiveType(null)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? '16px' : '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        width: isMobile ? 'calc(100vw - 24px)' : 'auto',
        maxWidth: isMobile ? '420px' : 'none',
      }}
    >
      {/* Input panel */}
      {activeType && (
        <div
          style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.48) 100%)',
            border: '1px solid rgba(255,255,255,0.8)',
            borderRadius: '24px',
            padding: isMobile ? '14px' : '18px',
            width: isMobile ? '100%' : '360px',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: isMobile ? '60vh' : 'none',
            overflowY: isMobile ? 'auto' : 'visible',
          }}
        >
          {activeType === 'text' && (
            <>
              <input placeholder="Title (optional)" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} style={inputStyle} />
              <textarea placeholder="Your text..." value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
            </>
          )}
          {activeType === 'image' && (
            <>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />

              {imagePreview ? (
                /* Preview */
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                  <img
                    src={imagePreview}
                    alt="preview"
                    style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)',
                    display: 'flex', alignItems: 'flex-end', padding: '10px 12px',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {imageName}
                    </span>
                    <button onClick={clearImage} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', color: 'white', fontSize: '11px', padding: '3px 10px', cursor: 'pointer' }}>
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                /* Drop zone */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${isDragOver ? 'rgba(74,158,255,0.7)' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: '12px',
                    padding: '28px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    background: isDragOver ? 'rgba(74,158,255,0.06)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.18s',
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: '13px', fontWeight: 500 }}>
                    Click to upload or drag & drop
                  </span>
                  <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: '11px' }}>
                    PNG, JPG, GIF, WEBP
                  </span>
                </div>
              )}

              {/* URL fallback */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
                <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px' }}>or paste URL</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
              </div>
              <input
                placeholder="https://..."
                value={imagePreview ? '' : imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImagePreview(null); setImageName('') }}
                style={inputStyle}
              />

              {/* Caption */}
              <input
                placeholder="Texto de la foto (opcional)..."
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                style={inputStyle}
              />

              {/* Date */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  value={imageDate}
                  onChange={(e) => setImageDate(e.target.value)}
                  style={{ ...inputStyle, flex: 1, colorScheme: 'dark' }}
                />
                <button
                  onClick={() => setImageDate(new Date().toISOString().split('T')[0])}
                  style={{
                    background: 'rgba(0,0,0,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    padding: '0 14px',
                    height: '38px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Hoy
                </button>
              </div>
            </>
          )}
          {activeType === 'spotify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                placeholder="Pega el link de Spotify..."
                value={spotifyUrl}
                onChange={(e) => handleSpotifyUrlChange(e.target.value)}
                style={inputStyle}
              />
              {/* Preview */}
              {spotifyLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(29,185,84,0.08)', borderRadius: '10px', border: '1px solid rgba(29,185,84,0.2)' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(29,185,84,0.4)', borderTopColor: '#1DB954', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Buscando canción...</span>
                </div>
              )}
              {!spotifyLoading && spotifyTitle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(29,185,84,0.1)', borderRadius: '10px', border: '1px solid rgba(29,185,84,0.3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 500 }}>{spotifyTitle}</span>
                </div>
              )}
              {!spotifyLoading && spotifyUrl && !spotifyTrackId && (
                <span style={{ color: 'rgba(255,100,100,0.7)', fontSize: '12px', paddingLeft: '4px' }}>Link no válido. Usa un link de canción de Spotify.</span>
              )}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {activeType === 'video' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  videoRawFileRef.current = f
                  setVideoFile(URL.createObjectURL(f))
                  setVideoFileName(f.name)
                }}
              />
              {videoFile ? (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                  <video src={videoFile} style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} muted />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)', display: 'flex', alignItems: 'flex-end', padding: '10px 12px', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{videoFileName}</span>
                    <button onClick={() => { setVideoFile(null); setVideoFileName('') }} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', color: 'white', fontSize: '11px', padding: '3px 10px', cursor: 'pointer' }}>Change</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => videoFileInputRef.current?.click()}
                  style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '12px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                >
                  <IconVideo />
                  <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: '13px' }}>Click to upload video</span>
                  <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: '11px' }}>MP4, MOV, WEBM</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
                <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px' }}>or YouTube URL</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
              </div>
              <input placeholder="https://youtube.com/watch?v=..." value={videoFile ? '' : videoUrl} onChange={(e) => { setVideoUrl(e.target.value); setVideoFile(null) }} style={inputStyle} />
              <input placeholder="Title (optional)" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} style={inputStyle} />
            </div>
          )}
          {/* Tags input + existing tag suggestions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              placeholder="Tags (separados por coma)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={inputStyle}
            />
            {existingTags.length > 0 && (
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {existingTags.map((tag) => {
                  const active = tags.split(',').map(t => t.trim()).includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        const current = tags.split(',').map(t => t.trim()).filter(Boolean)
                        if (active) {
                          setTags(current.filter(t => t !== tag).join(', '))
                        } else {
                          setTags([...current, tag].join(', '))
                        }
                      }}
                      style={{
                        background: active ? 'rgba(20,20,20,0.75)' : 'rgba(255,255,255,0.55)',
                        border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.12)',
                        color: active ? 'rgba(255,255,255,0.92)' : 'rgba(50,54,78,0.75)',
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        backdropFilter: 'blur(8px)',
                        transition: 'all 0.15s',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      #{tag}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <AquaButton icon={uploading ? <Spinner /> : null} label={uploading ? 'Subiendo...' : 'Add to canvas'} active themeKey={activeType ?? 'default'} onClick={uploading ? () => {} : handleAdd} />
            <AquaButton icon={null} label="Cancel" active={false} themeKey="default" onClick={() => setActiveType(null)} />
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      <div
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.90)',
          borderLeft: '1px solid rgba(255,255,255,0.90)',
          borderBottom: '1px solid rgba(180,180,180,0.35)',
          borderRight: '1px solid rgba(180,180,180,0.35)',
          borderRadius: '60px',
          padding: isMobile ? '6px 8px' : '7px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '2px' : '3px',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: '0 6px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.85)',
        }}
      >
        <AquaButton
          icon={<IconPhoto />}
          label="Photo"
          active={activeType === 'image'}
          themeKey="image"
          compact={isMobile}
          onClick={() => setActiveType(activeType === 'image' ? null : 'image')}
        />
        <AquaButton
          icon={<IconText />}
          label="Text"
          active={activeType === 'text'}
          themeKey="text"
          compact={isMobile}
          onClick={() => setActiveType(activeType === 'text' ? null : 'text')}
        />
        <AquaButton
          icon={<IconMusic />}
          label="Spotify"
          active={activeType === 'spotify'}
          themeKey="spotify"
          compact={isMobile}
          onClick={() => setActiveType(activeType === 'spotify' ? null : 'spotify')}
        />
        <AquaButton
          icon={<IconVideo />}
          label="Video"
          active={activeType === 'video'}
          themeKey="video"
          compact={isMobile}
          onClick={() => setActiveType(activeType === 'video' ? null : 'video')}
        />
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: '14px', height: '14px', border: '2px solid rgba(50,54,78,0.25)',
      borderTopColor: 'rgba(50,54,78,0.8)', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: '#222',
  fontSize: '14px',
  outline: 'none',
  width: '100%',
}
