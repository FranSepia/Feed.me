import { Metadata, ResolvingMetadata } from 'next'
import { PublicProfileClient } from '@/components/profile/PublicProfileClient'
import type { Profile } from '@/lib/auth-context'

interface Props {
  params: { username: string }
}

// Ensure dynamic rendering because we rely on fetch with no cache or params reading
export const dynamic = 'force-dynamic'

async function getProfile(username: string): Promise<Profile | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null

  // Fetch from the Supabase REST API directly to avoid any client complexities
  try {
    const res = await fetch(
      `${url}/rest/v1/profiles?username=eq.${encodeURIComponent(username.toLowerCase())}&select=*`,
      {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        },
        cache: 'no-store'
      }
    )

    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.length === 0) return null

    const p = data[0]
    return {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      bio: p.bio,
      bg_color: p.bg_color ?? '#ede8de',
    }
  } catch (e) {
    console.error('Server fetch error:', e)
    return null
  }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const profile = await getProfile(params.username)

  if (!profile) {
    return {
      title: 'User Not Found | Feed.Me',
    }
  }

  const title = `${profile.display_name || profile.username} | Feed.Me`
  const description = profile.bio || `Check out ${profile.username}'s 3D canvas on Feed.Me`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.avatar_url ? [profile.avatar_url] : [],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: profile.avatar_url ? [profile.avatar_url] : [],
    }
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const profile = await getProfile(params.username)

  if (!profile) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a',
        flexDirection: 'column', gap: '20px',
      }}>
        <div style={{
          fontSize: '28px', fontWeight: 700, color: 'white',
          letterSpacing: '-0.02em',
        }}>
          Feed<span style={{ color: 'rgba(255,255,255,0.4)' }}>.</span>Me
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>
          @{params.username} does not exist
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <a href="/login" style={{
            padding: '12px 28px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
            textDecoration: 'none',
            fontWeight: 500,
          }}>
            Sign In
          </a>
          <a href="/register" style={{
            padding: '12px 28px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'white',
            fontSize: '14px',
            textDecoration: 'none',
            fontWeight: 500,
          }}>
            Create your Feed.Me
          </a>
        </div>
      </div>
    )
  }

  return <PublicProfileClient profile={profile} />
}
