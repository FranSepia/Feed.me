import { NextRequest, NextResponse } from 'next/server'

// ── URL helpers ───────────────────────────────────────────────────────────────

function isGooglePhotosUrl(url: string) {
  return url.includes('photos.google.com') || url.includes('photos.app.goo.gl')
}

function isDriveUrl(url: string) {
  return url.includes('drive.google.com')
}

function extractDriveId(url: string): string | null {
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// ── Google Photos handler ─────────────────────────────────────────────────────
// Strategy:
//  1. Fetch the share page HTML server-side (no CORS issue)
//  2. Look for a direct lh3.googleusercontent.com media URL
//  3. For images: use =d suffix to get original quality download
//  4. For videos: look for the video URL embedded in the page JSON

async function handleGooglePhotos(rawUrl: string): Promise<NextResponse> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,*/*',
  }

  // Follow redirects (handles photos.app.goo.gl short links)
  const pageRes = await fetch(rawUrl, { headers, redirect: 'follow' })
  if (!pageRes.ok) {
    return NextResponse.json(
      { error: `Google Photos responded with ${pageRes.status}` },
      { status: 502 }
    )
  }

  const html = await pageRes.text()

  // ── 1. Try video URL first ──────────────────────────────────────────────────
  // Google Photos embeds video download URLs inside the page JSON
  const videoPatterns = [
    /https:\/\/lh3\.googleusercontent\.com\/[^"'\s]+\.mp4[^"'\s]*/g,
    /https:\/\/lh3\.googleusercontent\.com\/[^"'\s]+=m37[^"'\s]*/g, // video format flag
  ]
  for (const pattern of videoPatterns) {
    const match = html.match(pattern)
    if (match) {
      const videoUrl = match[0].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&')
      try {
        const res = await fetch(videoUrl, { headers, redirect: 'follow' })
        if (res.ok) {
          const ct = res.headers.get('content-type') || 'video/mp4'
          if (!ct.includes('text/html')) {
            const buf = await res.arrayBuffer()
            return new NextResponse(buf, {
              headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' },
            })
          }
        }
      } catch { /* fall through */ }
    }
  }

  // ── 2. Extract image URL from og:image ───────────────────────────────────
  const ogMatch =
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) ||
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)

  if (ogMatch) {
    // og:image is a thumbnail like =w1200-h630-no; replace with =d for original
    let imgUrl = ogMatch[1]
    imgUrl = imgUrl
      .replace(/=w\d+[-a-z0-9]*/i, '=d')
      .replace(/=s\d+[-a-z0-9]*/i, '=d')

    try {
      const res = await fetch(imgUrl, { headers, redirect: 'follow' })
      if (res.ok) {
        const ct = res.headers.get('content-type') || 'image/jpeg'
        if (!ct.includes('text/html')) {
          const buf = await res.arrayBuffer()
          return new NextResponse(buf, {
            headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' },
          })
        }
      }
    } catch { /* fall through */ }
  }

  // ── 3. Look for any lh3.googleusercontent.com image URL in the page ──────
  const lh3Match = html.match(
    /https:\/\/lh3\.googleusercontent\.com\/[^"'\s\\]+/
  )
  if (lh3Match) {
    let imgUrl = lh3Match[0].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&')
    // Ensure full quality
    if (!imgUrl.includes('=d')) {
      imgUrl = imgUrl.replace(/=[^=\s"']+$/, '') + '=d'
    }
    try {
      const res = await fetch(imgUrl, { headers, redirect: 'follow' })
      if (res.ok) {
        const ct = res.headers.get('content-type') || 'image/jpeg'
        if (!ct.includes('text/html')) {
          const buf = await res.arrayBuffer()
          return new NextResponse(buf, {
            headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' },
          })
        }
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json(
    {
      error:
        'No se pudo extraer el archivo. Asegúrate de que el álbum o foto sea público (compartido con "Cualquier persona con el enlace").',
    },
    { status: 422 }
  )
}

// ── Google Drive handler ──────────────────────────────────────────────────────
async function handleDrive(rawUrl: string): Promise<NextResponse> {
  const fileId = extractDriveId(rawUrl) || rawUrl.trim()
  if (!fileId) {
    return NextResponse.json({ error: 'Missing file ID' }, { status: 400 })
  }

  const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  }

  const res = await fetch(downloadUrl, { headers, redirect: 'follow' })
  if (!res.ok) {
    return NextResponse.json(
      { error: `Drive responded with ${res.status}` },
      { status: 502 }
    )
  }

  const ct = res.headers.get('content-type') || 'application/octet-stream'

  // Virus-scan confirmation page for large files
  if (ct.includes('text/html')) {
    const html = await res.text()
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/)
    if (confirmMatch) {
      const confirmUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmMatch[1]}`
      const confirmed = await fetch(confirmUrl, { headers, redirect: 'follow' })
      if (!confirmed.ok) {
        return NextResponse.json(
          { error: 'Could not bypass virus-scan confirmation' },
          { status: 502 }
        )
      }
      const buf = await confirmed.arrayBuffer()
      const confirmedCt =
        confirmed.headers.get('content-type') || 'application/octet-stream'
      return new NextResponse(buf, {
        headers: { 'Content-Type': confirmedCt, 'Cache-Control': 'no-store' },
      })
    }
    return NextResponse.json(
      { error: 'File is not publicly accessible.' },
      { status: 403 }
    )
  }

  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' },
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url') ?? ''
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    if (isGooglePhotosUrl(rawUrl)) return await handleGooglePhotos(rawUrl)
    if (isDriveUrl(rawUrl)) return await handleDrive(rawUrl)
    return NextResponse.json(
      { error: 'URL must be from Google Photos or Google Drive' },
      { status: 400 }
    )
  } catch (err) {
    console.error('[media-proxy]', err)
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}
