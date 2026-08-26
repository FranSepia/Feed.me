import { Metadata, ResolvingMetadata } from 'next'
import { redirect } from 'next/navigation'
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

  // A profile that isn't there used to be its own dead end. The home canvas can
  // do more with the visitor than an apology can — it says the name is free and
  // has the sign-up form right there — so that is where they go.
  if (!profile) redirect(`/?missing=${encodeURIComponent(params.username)}`)

  return <PublicProfileClient profile={profile} />
}
