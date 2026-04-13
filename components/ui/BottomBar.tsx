'use client'

import { useState, useRef, useCallback } from 'react'
import { useCanvasStore } from '@/lib/store'
import { useResponsive } from '@/lib/useResponsive'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

type UploadType = 'image' | 'video' | 'text' | 'spotify' | null

// ── Google Photos / Drive helpers ────────────────────────────────────────────
function isGoogleMediaUrl(url: string): boolean {
  return (
    url.includes('photos.google.com') ||
    url.includes('photos.app.goo.gl') ||
    url.includes('drive.google.com')
  )
}

// Download a Google Photos or Drive file via our API proxy and return a File object
async function fetchGoogleFile(url: string): Promise<File> {
  const encoded = encodeURIComponent(url)
  const res = await fetch(`/api/drive-download?url=${encoded}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const contentType = blob.type || 'application/octet-stream'
  const ext = contentType.split('/')[1]?.split(';')[0] ?? 'bin'
  return new File([blob], `google-media.${ext}`, { type: contentType })
}

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
  const [videoCaption, setVideoCaption] = useState('')
  const [videoDate, setVideoDate] = useState('')
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
  const [imageName, setImageName] = useState('')
  const [imageCaption, setImageCaption] = useState('')
  const [imageDate, setImageDate] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState('')
  // previews[i] is an object-URL for imageFilesState[i]
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFilesState, setImageFilesState] = useState<File[]>([])
  const [videoFilesState, setVideoFilesState] = useState<File[]>([])
  const addNode = useCanvasStore((s) => s.addNode)
  const nodes = useCanvasStore((s) => s.nodes)
  const readOnly = useCanvasStore((s) => s.readOnly)
  const editMode = useCanvasStore((s) => s.editMode)
  const selectedNode = useCanvasStore((s) => s.selectedNode)
  const { isMobile } = useResponsive()
  const { user } = useAuth()

  // All unique tags already in the canvas
  const existingTags = Array.from(new Set(nodes.flatMap((n) => n.tags))).sort()

  // Compress images > 2 MB before upload (critical for mobile camera photos)
  const compressImage = (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.size < 2 * 1024 * 1024) {
      return Promise.resolve(file)
    }
    return new Promise((resolve) => {
      const img = new Image()
      const objUrl = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(objUrl)
        const MAX_W = 1920
        let { width, height } = img
        if (width > MAX_W) { height = Math.round(height * MAX_W / width); width = MAX_W }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(file); return }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return }
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          },
          'image/jpeg', 0.85
        )
      }
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file) }
      img.src = objUrl
    })
  }

  // Upload a file to Supabase Storage and return its public URL
  // Includes a 30-second timeout so mobile uploads never freeze forever
  const uploadMedia = async (file: File): Promise<string> => {
    const db = supabase
    if (!db) throw new Error('Supabase not configured')
    if (!user) throw new Error('Not authenticated')

    const compressed = await compressImage(file)
    const ext = compressed.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    let timer: ReturnType<typeof setTimeout>
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Upload timed out — check your connection and try again.')), 30000)
    })

    try {
      const result = await Promise.race([
        db.storage.from('media').upload(path, compressed, { cacheControl: '31536000', upsert: false }),
        timeoutPromise,
      ])
      if (result.error) throw result.error
      const { data } = db.storage.from('media').getPublicUrl(path)
      return data.publicUrl
    } finally {
      clearTimeout(timer!)
    }
  }

  const addImageFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    const newPreviews = imageFiles.map(f => URL.createObjectURL(f))
    setImageFilesState(prev => [...prev, ...imageFiles])
    setImagePreviews(prev => [...prev, ...newPreviews])
    setImageUrl('')
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) addImageFiles(files)
    // Reset so the same files can be re-selected
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) addImageFiles(files)
  }

  const removeImageFile = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index])
    setImageFilesState(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleImageUrlChange = async (value: string) => {
    setDriveError('')
    if (isGoogleMediaUrl(value)) {
      setDriveLoading(true)
      try {
        const file = await fetchGoogleFile(value)
        addImageFiles([file])
      } catch (err: any) {
        setDriveError(err.message ?? 'Error al descargar de Google Photos')
      } finally {
        setDriveLoading(false)
      }
    } else {
      setImageUrl(value)
    }
  }

  const handleVideoUrlChange = async (value: string) => {
    setDriveError('')
    if (isGoogleMediaUrl(value)) {
      setDriveLoading(true)
      try {
        const file = await fetchGoogleFile(value)
        setVideoFilesState(prev => [...prev, file])
        setVideoFile(URL.createObjectURL(file))
        setVideoFileName(file.name)
      } catch (err: any) {
        setDriveError(err.message ?? 'Error al descargar de Google Photos')
      } finally {
        setDriveLoading(false)
      }
    } else {
      setVideoUrl(value)
      setVideoFile(null)
      setVideoFilesState([])
    }
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

      } else if (activeType === 'image' && (imageUrl || imageFilesState.length > 0)) {
        if (imageFilesState.length > 0) {
          for (const file of imageFilesState) {
            let finalUrl = ''
            try { finalUrl = await uploadMedia(file) } catch (err) { finalUrl = URL.createObjectURL(file) }
            await addNode({ type: 'image', content: finalUrl, title: file.name, caption: imageCaption || undefined, date: imageDate || undefined, tags: tagList, seed: Math.random() })
          }
        } else if (imageUrl) {
          await addNode({ type: 'image', content: imageUrl, title: imageName || 'Image', caption: imageCaption || undefined, date: imageDate || undefined, tags: tagList, seed: Math.random() })
        }
        setImagePreviews([]); setImageName(''); setImageUrl(''); setImageCaption(''); setImageDate(''); setImageFilesState([])

      } else if (activeType === 'spotify' && spotifyTrackId) {
        await addNode({ type: 'spotify', content: spotifyTrackId, title: spotifyTitle || 'Track', tags: tagList, seed: Math.random() })
        setSpotifyUrl(''); setSpotifyTrackId(''); setSpotifyTitle('')

      } else if (activeType === 'video' && (videoUrl || videoFilesState.length > 0)) {
        if (videoFilesState.length > 0) {
          for (const file of videoFilesState) {
            let finalUrl = ''
            try { finalUrl = await uploadMedia(file) } catch (err) { finalUrl = URL.createObjectURL(file) }
            await addNode({ type: 'video', content: finalUrl, title: file.name, caption: videoCaption || undefined, date: videoDate || undefined, tags: tagList, seed: Math.random() })
          }
        } else if (videoUrl) {
          await addNode({ type: 'video', content: videoUrl, title: videoTitle || 'Video', caption: videoCaption || undefined, date: videoDate || undefined, tags: tagList, seed: Math.random() })
        }
        setVideoUrl(''); setVideoTitle(''); setVideoCaption(''); setVideoDate(''); setVideoFile(null); setVideoFileName(''); setVideoFilesState([])
      }
    } catch (err) {
      console.error('File upload failed:', err)
      alert('Error uploading file. Check your connection and try again.')
    } finally {
      setUploading(false)
    }

    setTags('')
    setActiveType(null)
  }

  // Hide in read-only mode (public view) or if editing a node
  if (readOnly || (editMode && selectedNode)) return null

  return (
    <>
    {/* Backdrop — click outside the panel to close it */}
    {activeType && (
      <div
        onClick={() => setActiveType(null)}
        style={{ position: 'fixed', inset: 0, zIndex: 499 }}
      />
    )}
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? '16px' : '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 500,
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
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />

              {/* Multi-file thumbnail grid */}
              {imagePreviews.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                }}>
                  {imagePreviews.map((src, i) => (
                    <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1' }}>
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <button
                        onClick={() => removeImageFile(i)}
                        style={{
                          position: 'absolute', top: '4px', right: '4px',
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: 'rgba(0,0,0,0.6)', border: 'none',
                          color: 'white', fontSize: '11px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                        }}
                      >✕</button>
                    </div>
                  ))}
                  {/* Add more button */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      borderRadius: '8px', aspectRatio: '1',
                      border: '2px dashed rgba(0,0,0,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'rgba(0,0,0,0.3)', fontSize: '22px',
                    }}
                  >+</div>
                </div>
              )}

              {/* Drop zone — shown when no files yet */}
              {imagePreviews.length === 0 && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${isDragOver ? 'rgba(74,158,255,0.7)' : 'rgba(0,0,0,0.15)'}`,
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
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: '13px', fontWeight: 500 }}>
                    Click to upload or drag & drop
                  </span>
                  <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: '11px' }}>
                    PNG, JPG, GIF, WEBP · multiple selection supported
                  </span>
                </div>
              )}

              {/* URL / Google Photos input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
                <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px' }}>or paste URL / Google Photos link</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  placeholder="https://... or Google Photos link"
                  value={imageUrl}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  style={inputStyle}
                />
                {driveLoading && activeType === 'image' && (
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                    <Spinner />
                  </div>
                )}
              </div>
              {driveError && activeType === 'image' && (
                <span style={{ color: 'rgba(220,60,60,0.85)', fontSize: '12px', paddingLeft: '4px' }}>{driveError}</span>
              )}

              {/* Caption */}
              <input
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                placeholder="Photo caption (optional)..."
                style={{ ...inputStyle, width: '100%', marginBottom: '12px' }}
              />

              {/* Date */}
              <input
                type="date"
                value={imageDate}
                onChange={(e) => setImageDate(e.target.value)}
                style={{ ...inputStyle, width: '100%', colorScheme: 'light' }}
              />
            </>
          )}
          {activeType === 'spotify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                placeholder="Paste Spotify link..."
                value={spotifyUrl}
                onChange={(e) => handleSpotifyUrlChange(e.target.value)}
                style={inputStyle}
              />
              {/* Preview */}
              {spotifyLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(29,185,84,0.08)', borderRadius: '10px', border: '1px solid rgba(29,185,84,0.2)' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(29,185,84,0.4)', borderTopColor: '#1DB954', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Searching track...</span>
                </div>
              )}
              {!spotifyLoading && spotifyTitle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(29,185,84,0.1)', borderRadius: '10px', border: '1px solid rgba(29,185,84,0.3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontWeight: 500 }}>{spotifyTitle}</span>
                </div>
              )}
              {!spotifyLoading && spotifyUrl && !spotifyTrackId && (
                <span style={{ color: 'rgba(255,100,100,0.7)', fontSize: '12px', paddingLeft: '4px' }}>Invalid link. Use a Spotify track link.</span>
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
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  if (files.length === 0) return
                  setVideoFilesState(prev => [...prev, ...files])
                  setVideoFile(URL.createObjectURL(files[0]))
                  setVideoFileName(files.length > 1 ? `${files.length} videos selected` : files[0].name)
                }}
              />
              {videoFilesState.length > 0 || videoFile ? (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                  <video src={videoFile || ''} style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} muted />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)', display: 'flex', alignItems: 'flex-end', padding: '10px 12px', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>{videoFileName}</span>
                    <button onClick={() => { setVideoFile(null); setVideoFileName(''); setVideoFilesState([]) }} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px', color: 'white', fontSize: '11px', padding: '3px 10px', cursor: 'pointer' }}>Change</button>
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
                <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: '11px' }}>or YouTube / Google Photos link</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.08)' }} />
              </div>
              <div style={{ position: 'relative' }}>
                <input placeholder="https://youtube.com/watch?v=... or Google Photos link" value={videoFile ? '' : videoUrl} onChange={(e) => handleVideoUrlChange(e.target.value)} style={inputStyle} />
                {driveLoading && activeType === 'video' && (
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                    <Spinner />
                  </div>
                )}
              </div>
              {driveError && activeType === 'video' && (
                <span style={{ color: 'rgba(220,60,60,0.85)', fontSize: '12px', paddingLeft: '4px' }}>{driveError}</span>
              )}
              <input placeholder="Title (optional)" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} style={inputStyle} />
              <input placeholder="Description (optional)" value={videoCaption} onChange={(e) => setVideoCaption(e.target.value)} style={inputStyle} />
              <input type="date" value={videoDate} onChange={(e) => setVideoDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'light' }} />
            </div>
          )}
          {/* Tags input + existing tag suggestions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              placeholder="Tags (comma separated)"
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
            <AquaButton icon={uploading ? <Spinner /> : null} label={uploading ? 'Uploading...' : 'Add to canvas'} active themeKey={activeType ?? 'default'} onClick={uploading ? () => {} : handleAdd} />
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
    </>
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
