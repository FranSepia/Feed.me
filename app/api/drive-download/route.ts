import { NextRequest, NextResponse } from 'next/server'

// Extracts a Google Drive file ID from any Drive share URL
function extractDriveId(url: string): string | null {
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url') ?? ''

  // Accept either a full Drive URL or a bare file ID
  const fileId = extractDriveId(rawUrl) || rawUrl.trim()
  if (!fileId) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Primary download endpoint (works for most publicly shared files)
  const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`

  try {
    const res = await fetch(downloadUrl, {
      headers: {
        // Mimic a browser to avoid bot detection
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Drive responded with ${res.status}` },
        { status: 502 }
      )
    }

    const contentType = res.headers.get('content-type') ?? 'application/octet-stream'

    // Google sometimes returns an HTML "virus scan warning" page for large files.
    // Detect it and follow the confirm link.
    if (contentType.includes('text/html')) {
      const html = await res.text()
      const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/)
      if (confirmMatch) {
        const confirmUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmMatch[1]}`
        const confirmed = await fetch(confirmUrl, { redirect: 'follow' })
        if (!confirmed.ok) {
          return NextResponse.json({ error: 'Could not bypass virus-scan confirmation' }, { status: 502 })
        }
        const confirmedType = confirmed.headers.get('content-type') ?? 'application/octet-stream'
        const buffer = await confirmed.arrayBuffer()
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': confirmedType,
            'Cache-Control': 'no-store',
          },
        })
      }
      // File is not publicly accessible or requires sign-in
      return NextResponse.json(
        { error: 'File is not publicly accessible. Make sure sharing is set to "Anyone with the link".' },
        { status: 403 }
      )
    }

    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[drive-download]', err)
    return NextResponse.json({ error: 'Failed to fetch from Google Drive' }, { status: 500 })
  }
}
