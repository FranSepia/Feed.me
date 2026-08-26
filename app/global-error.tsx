'use client'

/**
 * Last resort: the root layout itself threw, so error.tsx never got to render
 * and React has nothing left mounted. This one has to supply its own document.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error('[Feed.Me] Fatal error:', error)

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div style={{
          width: '100vw', height: '100vh', background: '#ede8de',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '14px', padding: '24px', textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'rgba(43,46,60,0.93)', letterSpacing: '-0.03em' }}>
            Feed<span style={{ color: 'rgba(50,54,78,0.34)' }}>.</span>Me
          </div>
          <div style={{ color: 'rgba(50,54,78,0.72)', fontSize: '15px', maxWidth: '340px', lineHeight: 1.55 }}>
            Something broke completely. Reload and you should be able to get back in.
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              onClick={reset}
              style={{
                padding: '11px 22px', borderRadius: '12px', cursor: 'pointer',
                background: 'rgba(43,46,60,0.07)', border: '1px solid rgba(120,125,145,0.20)',
                color: 'rgba(43,46,60,0.9)', fontSize: '14px', fontWeight: 500,
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '11px 22px', borderRadius: '12px', textDecoration: 'none',
                background: 'linear-gradient(135deg, #2f3342 0%, #1e212c 100%)',
                color: '#f2efe7', fontSize: '14px', fontWeight: 600,
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
