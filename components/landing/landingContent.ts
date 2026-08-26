/**
 * Everything the landing canvas is made of.
 *
 * It is a Feed.Me canvas like any other — the same cards, the same photos, the
 * same navigation — except that its contents live here instead of in Supabase.
 * Editing the copy or swapping a photo is a change to this file and nothing else.
 */

/** Which band of the canvas an item is laid out in. 1 is nearest the centre. */
export type Ring = 1 | 2 | 3

export interface LandingCard {
  id: string
  /** Small uppercase line above the title, the way TextNode labels a card. */
  eyebrow: string
  title: string
  body?: string
  bullets?: string[]
  /** Inline illustration drawn by HeadlineNode. */
  art?: 'venn' | 'kinds'
  /** Sends the visitor to the sign-up form on the card in the middle. */
  cta?: boolean
  /** CSS width the card is designed at — see landingScale for why that is literal. */
  width: number
  tags: string[]
  ring: Ring
}

export interface LandingPhoto {
  url: string
  title: string
  tags: string[]
  ring: Ring
  /** Multiple of the standard card size. Varied on purpose — a collage of one
   *  size reads as a contact sheet, and this is meant to read as a wall. */
  scale: number
}

export const AUTH_NODE_ID = 'landing-auth'

const W = 264      // ordinary card
const W_WIDE = 306 // the two that carry a list or an illustration

export const LANDING_CARDS: LandingCard[] = [
  {
    id: 'what-it-is',
    eyebrow: 'What this is',
    title: 'Your world, on a 3D canvas',
    body:
      'Feed.Me is an open space where you keep the things that matter to you: photos, videos, songs, notes, ' +
      'links. No feed, no algorithm, no order somebody else decided. You arrange it, it looks like you, and ' +
      'it lives at one link: feedme.com/yourname.',
    width: W_WIDE,
    tags: ['feed.me'],
    ring: 1,
  },
  {
    id: 'what-you-add',
    eyebrow: 'What you can put on it',
    title: 'Just about anything',
    bullets: [
      'Photos and videos straight from your phone',
      'Whole albums out of Google Photos or Drive',
      'Spotify songs, playing right there',
      'Notes, writing, stray lines',
      'Your socials: Instagram, TikTok, X, YouTube, Twitch…',
    ],
    art: 'kinds',
    width: W_WIDE,
    tags: ['uploads'],
    ring: 1,
  },
  {
    id: 'how-it-works',
    eyebrow: 'How it works',
    title: 'Three steps',
    bullets: [
      'Make an account — under a minute.',
      'Put your things on it and tag them.',
      'Share your link. People walk through it instead of scrolling it.',
    ],
    width: W,
    tags: ['start'],
    ring: 1,
  },
  {
    id: 'islands',
    eyebrow: 'The islands',
    title: 'Your tags turn into places',
    body:
      'Every tag opens an island on the canvas. Anything carrying two tags floats exactly where the two ' +
      'overlap — so at a glance you can see how your things connect. A trip that was also a concert lives ' +
      'between both islands, instead of being filed under one and lost to the other.',
    art: 'venn',
    width: W_WIDE,
    tags: ['islands', 'tags'],
    ring: 1,
  },
  {
    id: 'getting-around',
    eyebrow: 'Getting around',
    title: 'Drag, zoom, tap',
    bullets: [
      'Drag to move around the canvas.',
      'Scroll or pinch to get closer.',
      'Tap something to see it big — whatever shares its tags gathers around it.',
    ],
    body: 'Try it right here. What you are looking at is already a Feed.Me canvas.',
    width: W,
    tags: ['getting-around'],
    ring: 2,
  },
  {
    id: 'travel',
    eyebrow: 'What it is for',
    title: "The trip that won't fit in a camera roll",
    body:
      'The photos, the video of the plane leaving, the song you had on the whole way, and the note you wrote ' +
      'that night. All of it in one place. Tag by city and every city becomes an island of its own.',
    width: W,
    tags: ['travel', 'memories'],
    ring: 2,
  },
  {
    id: 'photographer',
    eyebrow: 'What it is for',
    title: "A portfolio that isn't a grid",
    body:
      'If you shoot, there is no algorithm to beat here and nothing gets cropped to a square. Series, ' +
      'commissions, tests, outtakes: tag each body of work and send one link to whoever is hiring you.',
    width: W,
    tags: ['portfolio', 'photography'],
    ring: 2,
  },
  {
    id: 'one-link',
    eyebrow: 'What it is for',
    title: 'Everything of yours at one link',
    body:
      'Your socials, your music, your work and your face — for the bio, the email, the business card. ' +
      'A link that actually looks like you, instead of a stack of grey buttons.',
    width: W,
    tags: ['links', 'socials'],
    ring: 2,
  },
  {
    id: 'start-here',
    eyebrow: 'Start',
    title: "It's free and it's yours",
    body:
      'Make your account on the card in the middle. A minute from now you have your canvas, your background ' +
      'color, and your link to send.',
    cta: true,
    width: W,
    tags: ['start'],
    ring: 2,
  },
  {
    id: 'moodboard',
    eyebrow: 'What it is for',
    title: 'The moodboard for the project',
    body:
      'References, palettes, type, loose screenshots, and the video that explains the tone. Instead of a ' +
      'folder the client never opens, a space they can walk through.',
    width: W,
    tags: ['design', 'moodboard'],
    ring: 3,
  },
  {
    id: 'more-ideas',
    eyebrow: 'And also',
    title: 'Other ways people use it',
    bullets: [
      "Grandma's recipe book, a photo per dish",
      'A visual diary of the year, one node a week',
      "A band's memory: shows, flyers, songs",
      'A wedding album everyone can add to',
      "A restaurant's menu, a photo of every plate",
      "A small label's catalog",
      'Moving house: everything you want for the new place',
      "The anniversary present that doesn't get printed",
    ],
    width: W_WIDE,
    tags: ['ideas'],
    ring: 3,
  },
  {
    id: 'no-likes',
    eyebrow: 'Why',
    title: 'No likes, no followers',
    body:
      'No counter, no streak, nobody to beat. Nothing decides what gets seen first except you. ' +
      'No likes, no followers. Just You Being You.',
    width: W,
    tags: ['feed.me'],
    ring: 3,
  },
]

/**
 * Free-to-use photographs from Unsplash, sized down at the CDN so a landing that
 * shows eighteen of them at once does not cost a phone its WebGL context.
 * Every id here was checked to resolve before it was committed.
 */
const photo = (id: string) => `https://images.unsplash.com/${id}?w=1200&q=75`

export const LANDING_PHOTOS: LandingPhoto[] = [
  { url: photo('photo-1506905925346-21bda4d32df4'), title: 'Still lake',        tags: ['travel', 'nature'],        ring: 2, scale: 2.9 },
  { url: photo('photo-1469854523086-cc02fe5d8800'), title: 'Long road',         tags: ['travel'],                  ring: 2, scale: 2.4 },
  { url: photo('photo-1517841905240-472988babdf9'), title: 'Portrait',          tags: ['portrait', 'photography'], ring: 2, scale: 2.2 },
  { url: photo('photo-1504674900247-0877df9cc836'), title: 'The table set',     tags: ['recipes'],                 ring: 2, scale: 2.6 },
  { url: photo('photo-1469474968028-56623f02e42e'), title: 'Sunrise up there',  tags: ['travel', 'nature'],        ring: 2, scale: 2.7 },
  { url: photo('photo-1459749411175-04bf5292ceea'), title: "Last night's show", tags: ['music'],                   ring: 2, scale: 2.3 },
  { url: photo('photo-1487958449943-2429e8be8625'), title: 'Lines',             tags: ['design'],                  ring: 3, scale: 2.0 },
  { url: photo('photo-1500375592092-40eb2168fd21'), title: 'Open sea',          tags: ['travel'],                  ring: 2, scale: 2.6 },
  { url: photo('photo-1492684223066-81342ee5ff30'), title: 'Confetti',          tags: ['party', 'memories'],       ring: 3, scale: 2.1 },
  { url: photo('photo-1447752875215-b2761acb3c5d'), title: 'Woods',             tags: ['nature'],                  ring: 3, scale: 2.4 },
  { url: photo('photo-1414235077428-338989a2e8c0'), title: 'Open kitchen',      tags: ['recipes'],                 ring: 3, scale: 1.9 },
  { url: photo('photo-1419242902214-272b3f66ee7a'), title: 'Aurora',            tags: ['travel', 'nature'],        ring: 3, scale: 2.8 },
  { url: photo('photo-1449824913935-59a10b8d2000'), title: 'The city',          tags: ['city'],                    ring: 3, scale: 2.2 },
  { url: photo('photo-1502920917128-1aa500764cbd'), title: 'Before the wave',   tags: ['sport'],                   ring: 3, scale: 2.5 },
  { url: photo('photo-1505144808419-1957a94ca61e'), title: 'Night sky',         tags: ['nature'],                  ring: 3, scale: 2.3 },
  { url: photo('photo-1488646953014-85cb44e25828'), title: 'Planning the trip', tags: ['travel'],                  ring: 3, scale: 2.0 },
  { url: photo('photo-1470071459604-3b5ec3a7fe05'), title: 'Fog',               tags: ['nature'],                  ring: 3, scale: 2.6 },
  { url: photo('photo-1501854140801-50d01698950b'), title: 'Green',             tags: ['nature'],                  ring: 3, scale: 2.1 },
]
