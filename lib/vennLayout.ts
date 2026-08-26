import { NodeData } from '@/lib/store'

// Venn view: one island per tag, and a card that carries two tags sits in the
// lens where those two islands overlap.
//
// The diagram is built the way an Euler diagram is: circles first, cards after.
//
//   1. A circle's area comes from how many cards carry its tag, so a circle is
//      never bigger than what it holds.
//   2. The distance between two circles is solved so the lens they make is the
//      area the cards carrying both tags need. Two tags with nothing in common
//      end up apart; a tag whose cards all carry another ends up nested in it.
//   3. Only then are the cards scattered — each across the whole of the area
//      matching its exact combination of tags, and nowhere else.
//
// It used to work the other way round: cards were clustered first and a circle
// drawn around the clusters. That left every card of a tag huddled in one part
// of its circle with the rest empty, and made the circles far larger than their
// contents, which pushed the camera back until the photos were specks.

// Beyond this many circles a Venn diagram stops being readable. Tags past the cap
// are left out by frequency — filter to the tags you want if you need exact ones.
export const MAX_ISLANDS_DESKTOP = 8
export const MAX_ISLANDS_MOBILE = 6

export interface VennIsland {
  tag: string
  center: [number, number]
  radius: number
  /** Where on its own circle the label hangs, in radians — see labelAngle() */
  labelAngle: number
  count: number
}

export interface VennLayout {
  positions: Record<string, [number, number, number]>
  islands: VennIsland[]
  /** Cards carrying none of the island tags — parked outside the diagram */
  outsiders: Set<string>
  /**
   * What the camera has to cover: [minX, minY, maxX, maxY].
   *
   * A box rather than a radius, because the diagram is rarely round — two islands
   * side by side are wide and short, and framing that as if it were a disc pushed
   * the camera back until the photos were specks.
   */
  bounds: [number, number, number, number]
}

export const EMPTY_VENN: VennLayout = {
  positions: {},
  islands: [],
  outsiders: new Set(),
  bounds: [0, 0, 0, 0],
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/**
 * Which tags get an island. A filter, if one is on, decides; otherwise the most
 * used tags win, and either way the count is capped — the cards belonging to the
 * tags that miss the cut are still placed, just outside the diagram.
 */
export function pickVennTags(nodes: NodeData[], filterTags: string[], max: number): string[] {
  const counts = new Map<string, number>()
  for (const n of nodes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1)

  const pool = filterTags.length > 0
    ? filterTags.filter((t) => counts.has(t))
    : Array.from(counts.keys())

  return pool
    .sort((a, b) => (counts.get(b)! - counts.get(a)!) || a.localeCompare(b))
    .slice(0, max)
}

// ── Circle geometry ─────────────────────────────────────────────────────────

/** Area shared by two circles */
function lensArea(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2
  const a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1))
  const b = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2))
  const c = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2))
  return a + b - c
}

/**
 * How far apart two circles have to be for their lens to hold `target` of area.
 *
 * The lens shrinks as they separate, so a bisection finds the distance. This is
 * what makes the picture mean something: the overlap you see is the number of
 * cards that really do carry both tags, rather than a fixed amount of overlap
 * that merely looks Venn-ish.
 */
function solveDistance(r1: number, r2: number, target: number): number {
  const full = Math.PI * Math.min(r1, r2) ** 2
  if (target >= full) return Math.abs(r1 - r2)      // nested: one tag lives inside the other
  if (target <= 0) return r1 + r2

  let lo = Math.abs(r1 - r2)
  let hi = r1 + r2
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (lensArea(r1, r2, mid) > target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Small deterministic PRNG, so a canvas lays out the same way every time */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

interface Circle { x: number; y: number; r: number }

// ── The layout ──────────────────────────────────────────────────────────────

export function computeVennLayout(
  nodes: NodeData[],
  islandTags: string[],
  isMobile: boolean,
  /** Viewport width / height — the diagram is laid out to match the screen shape */
  aspect = 1.6
): VennLayout {
  if (islandTags.length === 0 || nodes.length === 0) return EMPTY_VENN

  // Roughly the room one card takes at the size they are drawn in this view…
  const spacing = isMobile ? 2.0 : 2.9
  // …and the area each is given inside a circle. Above the card's own footprint,
  // so they read as scattered rather than tiled, but not so far above that the
  // circle grows into empty space. Measured: below this the cards start landing
  // on each other, above it they only get smaller.
  const cell = spacing * spacing * 2.0
  // A card is a billboard, wider than it is tall, and one whose centre sits just
  // inside the rim hangs half out of the circle. Every point offered to a card is
  // kept this far clear of the boundary, and no fallback is allowed to give that
  // up — a photo outside the circle of its own tag is the one thing this view
  // cannot do.
  const cardHalf = isMobile ? 1.2 : 1.7

  const k = islandTags.length
  const tagIndex = new Map(islandTags.map((t, i) => [t, i]))

  // ── Sort the cards by exactly which of these tags they carry ──────────────
  const regions = new Map<number, NodeData[]>()
  const outsiders: NodeData[] = []
  const tagCount: number[] = new Array(k).fill(0)
  const shared: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))

  for (const node of nodes) {
    const own = node.tags
      .filter((t) => tagIndex.has(t))
      .map((t) => tagIndex.get(t)!)
      .sort((a, b) => a - b)
    if (own.length === 0) { outsiders.push(node); continue }

    for (const i of own) tagCount[i]++
    for (let a = 0; a < own.length; a++) {
      for (let b = a + 1; b < own.length; b++) {
        shared[own[a]][own[b]]++
        shared[own[b]][own[a]]++
      }
    }

    let mask = 0
    for (const i of own) mask |= 1 << i
    const bucket = regions.get(mask)
    if (bucket) bucket.push(node)
    else regions.set(mask, [node])
  }

  // ── 1. A circle is as big as what it holds ────────────────────────────────
  //
  // The area is what the cards need, and the rim is added on top: card centres
  // can only use the disc inside the margin, so sizing the whole circle to the
  // cards' area quietly halved the room they actually had and put them back on
  // top of each other.
  const circles: Circle[] = tagCount.map((count) => ({
    x: 0,
    y: 0,
    r: cardHalf + Math.max(spacing * 0.5, Math.sqrt((Math.max(count, 1) * cell) / Math.PI)),
  }))

  // ── 2. Set them apart so each overlap is the size of what it shares ───────
  if (k > 1) {
    const meanR = circles.reduce((s, c) => s + c.r, 0) / k
    const ring = k === 2 ? meanR : (meanR * 1.7) / (2 * Math.sin(Math.PI / k))
    // Two circles read along whichever axis the screen is longer in
    const phase = k === 2 ? (aspect >= 1 ? 0 : Math.PI / 2) : Math.PI / 2
    circles.forEach((c, i) => {
      const a = phase + (i * 2 * Math.PI) / k
      c.x = Math.cos(a) * ring
      c.y = Math.sin(a) * ring
    })

    const want: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        want[i][j] = want[j][i] = shared[i][j] > 0
          ? solveDistance(circles[i].r, circles[j].r, shared[i][j] * cell)
          : circles[i].r + circles[j].r + spacing * 0.4   // nothing in common: keep apart
      }
    }

    // Past three circles no arrangement satisfies every pair at once, so this
    // settles on the best compromise rather than solving it outright
    for (let iter = 0; iter < 400; iter++) {
      const rate = 0.5 * (1 - iter / 400) + 0.06
      for (let i = 0; i < k; i++) {
        for (let j = i + 1; j < k; j++) {
          let dx = circles[j].x - circles[i].x
          let dy = circles[j].y - circles[i].y
          let d = Math.hypot(dx, dy)
          if (d < 1e-6) { dx = Math.cos(i * GOLDEN); dy = Math.sin(i * GOLDEN); d = 1e-6 }
          const move = ((d - want[i][j]) / d) * rate * 0.5
          circles[i].x += dx * move; circles[i].y += dy * move
          circles[j].x -= dx * move; circles[j].y -= dy * move
        }
      }
    }
  }

  // Two tags carried by exactly the same cards want the same circle in the same
  // place, and one ring drawn on top of another looks like a tag that does not
  // exist. Widening one keeps both visible and still holds every card in both.
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < i; j++) {
      const sep = Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y)
        + Math.abs(circles[i].r - circles[j].r)
      if (sep < spacing * 0.5) circles[i].r += spacing * 0.5
    }
  }

  // ── 2b. Every combination needs somewhere legal to sit ───────────────────
  //
  // The distances above are a compromise once there are four or more circles, and
  // a pair that shares cards can end up too far apart for their lens to hold one.
  // The cards that could not be placed inside every circle they belong to were
  // then dropped at the average of those circles' centres — which is how photos
  // ended up outside the very circle they were tagged with, and why the tag that
  // shares with everything was the worst affected.
  //
  // So circles that share cards are pulled together until each combination has
  // room for a whole card. They share cards; more overlap is the honest picture.
  const combos: number[][] = []
  regions.forEach((_members, mask) => {
    const inside: number[] = []
    for (let i = 0; i < k; i++) if ((mask >> i) & 1) inside.push(i)
    if (inside.length > 1) combos.push(inside)
  })

  // Aim for a sliver more than a card needs. Settling for exactly a card's worth
  // leaves the anchor sitting on the limit, and a card placed there grazes the rim.
  const roomNeeded = cardHalf + 0.15

  for (let round = 0; round < 80; round++) {
    let worst = 0
    for (const inside of combos) {
      const p = feasiblePoint(circles, inside, roomNeeded)
      let deficit = 0
      for (const i of inside) {
        deficit = Math.max(deficit,
          Math.hypot(p[0] - circles[i].x, p[1] - circles[i].y) + roomNeeded - circles[i].r)
      }
      if (deficit <= 0.01) continue
      worst = Math.max(worst, deficit)

      let cx = 0, cy = 0
      for (const i of inside) { cx += circles[i].x; cy += circles[i].y }
      cx /= inside.length; cy /= inside.length
      for (const i of inside) {
        const dx = cx - circles[i].x, dy = cy - circles[i].y
        const len = Math.hypot(dx, dy)
        if (len < 1e-6) continue
        const step = Math.min(deficit * 0.5, len)
        circles[i].x += (dx / len) * step
        circles[i].y += (dy / len) * step
      }
    }
    if (worst <= 0.01) break
  }

  // Three circles cannot always be arranged so that all three share an area, so
  // whatever pulling could not solve is solved by growing the circles involved.
  // Growing never pushes out a card that is already inside.
  for (let round = 0; round < 16; round++) {
    let grew = false
    for (const inside of combos) {
      const p = feasiblePoint(circles, inside, roomNeeded)
      for (const i of inside) {
        const need = Math.hypot(p[0] - circles[i].x, p[1] - circles[i].y) + roomNeeded - circles[i].r
        // A shade more than strictly needed, so the anchor is never left sitting
        // exactly on the limit — a card placed there grazes the rim
        if (need > 0.01) { circles[i].r += need + 0.12; grew = true }
      }
    }
    if (!grew) break
  }

  // Recentre, so the camera frames the diagram and not the empty space beside it
  {
    const cx = (Math.min(...circles.map((c) => c.x - c.r)) + Math.max(...circles.map((c) => c.x + c.r))) / 2
    const cy = (Math.min(...circles.map((c) => c.y - c.r)) + Math.max(...circles.map((c) => c.y + c.r))) / 2
    for (const c of circles) { c.x -= cx; c.y -= cy }
  }

  // ── 3. Scatter the cards across the whole of the area they belong to ──────
  const positions: Record<string, [number, number, number]> = {}

  regions.forEach((members, mask) => {
    const inside: number[] = []
    const outside: number[] = []
    for (let i = 0; i < k; i++) ((mask >> i) & 1 ? inside : outside).push(i)

    const anchor = feasiblePoint(circles, inside, cardHalf)
    const points = sampleRegion(
      circles, inside, outside, members.length, spacing, cardHalf, anchor, hash(String(mask))
    )
    members.forEach((node: NodeData, i: number) => {
      const p = points[i] ?? points[points.length - 1] ?? [circles[inside[0]].x, circles[inside[0]].y]
      // A hair of stagger so cards that do overlap always overlap the same way
      positions[node.id] = [p[0], p[1], i * 0.03]
    })
  })

  const angles = labelAngles(circles, spacing)
  const islands: VennIsland[] = islandTags.map((tag, i) => ({
    tag,
    center: [circles[i].x, circles[i].y],
    radius: circles[i].r,
    labelAngle: angles[i],
    count: tagCount[i],
  }))

  const bounds: [number, number, number, number] = [
    Math.min(...circles.map((c) => c.x - c.r)),
    Math.min(...circles.map((c) => c.y - c.r)),
    Math.max(...circles.map((c) => c.x + c.r)),
    Math.max(...circles.map((c) => c.y + c.r)),
  ]

  // ── Everything that carries none of these tags waits outside ──────────────
  //
  // Hugging the rim, and inside what the camera frames: parked further out they
  // dropped off the edge of the screen the moment the diagram opened.
  if (outsiders.length > 0) {
    const cx = (bounds[0] + bounds[2]) / 2
    const cy = (bounds[1] + bounds[3]) / 2
    const haloX = (bounds[2] - bounds[0]) / 2 + spacing * 1.2
    const haloY = (bounds[3] - bounds[1]) / 2 + spacing * 1.2
    outsiders.forEach((node, i) => {
      const angle = i * GOLDEN
      positions[node.id] = [cx + Math.cos(angle) * haloX, cy + Math.sin(angle) * haloY, -2]
    })
    const reach = spacing * 0.9
    bounds[0] = Math.min(bounds[0], cx - haloX - reach)
    bounds[1] = Math.min(bounds[1], cy - haloY - reach)
    bounds[2] = Math.max(bounds[2], cx + haloX + reach)
    bounds[3] = Math.max(bounds[3], cy + haloY + reach)
  }

  return { positions, islands, outsiders: new Set(outsiders.map((n) => n.id)), bounds }
}

/**
 * A point that sits inside every circle in `inside` with `margin` to spare.
 *
 * Projecting onto one disc after another converges on a point they all share —
 * discs are convex, so this cannot get stuck. When they share nothing the result
 * is the closest thing to it, which is what the passes above measure to decide
 * how far the circles still have to move.
 */
function feasiblePoint(circles: Circle[], inside: number[], margin: number): [number, number] {
  let x = 0, y = 0
  for (const i of inside) { x += circles[i].x; y += circles[i].y }
  x /= inside.length; y /= inside.length

  for (let iter = 0; iter < 150; iter++) {
    let moved = false
    for (const i of inside) {
      const c = circles[i]
      const limit = Math.max(c.r - margin, 0.001)
      const dx = x - c.x, dy = y - c.y
      const d = Math.hypot(dx, dy)
      if (d > limit) {
        const scale = limit / (d || 1)
        x = c.x + dx * scale
        y = c.y + dy * scale
        moved = true
      }
    }
    if (!moved) break
  }
  return [x, y]
}

/**
 * Points spread over one exact region: far enough inside every circle in
 * `inside` that a whole card fits, and clear of every circle in `outside`.
 *
 * Candidates are drawn on a jittered grid and then thinned by repeatedly taking
 * whichever is furthest from everything chosen so far. That spreads the cards
 * evenly over the whole shape however odd the shape is — a crescent, a lens, a
 * sliver. Placing them by formula instead only ever fills a disc, which is what
 * left a tag's photos huddled in one part of its circle.
 *
 * Staying clear of the circles it does not belong to is a preference and is given
 * up when the shape is too tight for it; staying inside the ones it does belong
 * to never is.
 */
function sampleRegion(
  circles: Circle[],
  inside: number[],
  outside: number[],
  count: number,
  spacing: number,
  cardHalf: number,
  anchor: [number, number],
  seed: number
): [number, number][] {
  if (count === 0 || inside.length === 0) return []

  // A hair beyond the card's own half-width, so a point that lands exactly on the
  // limit still reads as inside rather than as a card grazing the rim
  const keepIn = cardHalf + 0.05

  // How much room there is around the anchor while still holding a whole card
  let inscribed = Infinity
  for (const i of inside) {
    inscribed = Math.min(
      inscribed,
      circles[i].r - keepIn - Math.hypot(anchor[0] - circles[i].x, anchor[1] - circles[i].y)
    )
  }
  inscribed = Math.max(inscribed, 0)

  // Last resort, and still legal: fan the cards out around the anchor, inside the
  // room that is known to be there
  const aroundAnchor = (): [number, number][] =>
    Array.from({ length: count }, (_, i) => {
      const r = count === 1 ? 0 : inscribed * Math.sqrt((i + 0.5) / count)
      const a = i * GOLDEN
      return [anchor[0] + Math.cos(a) * r, anchor[1] + Math.sin(a) * r] as [number, number]
    })

  // The region cannot reach outside the smallest circle containing it
  let minX = -Infinity, maxX = Infinity, minY = -Infinity, maxY = Infinity
  for (const i of inside) {
    minX = Math.max(minX, circles[i].x - circles[i].r)
    maxX = Math.min(maxX, circles[i].x + circles[i].r)
    minY = Math.max(minY, circles[i].y - circles[i].r)
    maxY = Math.min(maxY, circles[i].y + circles[i].r)
  }
  if (!(maxX > minX && maxY > minY)) return aroundAnchor()

  const inRegion = (x: number, y: number, clearance: number): boolean => {
    for (const i of inside) {
      // Never negotiable
      if (Math.hypot(x - circles[i].x, y - circles[i].y) > circles[i].r - keepIn) return false
    }
    for (const i of outside) {
      if (Math.hypot(x - circles[i].x, y - circles[i].y) < circles[i].r + clearance) return false
    }
    return true
  }

  let candidates: [number, number][] = []
  for (const clearance of [cardHalf, cardHalf * 0.4, 0]) {
    for (const divisor of [0.55, 0.32, 0.18]) {
      const step = spacing * divisor
      const rand = mulberry32(seed + Math.round(step * 1000))
      const found: [number, number][] = []
      for (let y = minY; y <= maxY; y += step) {
        for (let x = minX; x <= maxX; x += step) {
          const jx = x + (rand() - 0.5) * step * 0.7
          const jy = y + (rand() - 0.5) * step * 0.7
          if (inRegion(jx, jy, clearance)) found.push([jx, jy])
        }
      }
      if (found.length > candidates.length) candidates = found
      if (candidates.length >= count * 2) break
    }
    if (candidates.length >= count * 2) break
  }

  if (candidates.length === 0) return aroundAnchor()
  if (candidates.length <= count) {
    // Everything that was found is used, and the rest fan out around the anchor
    const extra = aroundAnchor()
    return Array.from({ length: count }, (_, i) =>
      i < candidates.length ? candidates[i] : extra[i])
  }

  // Farthest-point thinning: start nearest the region's middle, then always take
  // whichever candidate is furthest from everything picked so far
  let first = 0
  let best = Infinity
  candidates.forEach(([x, y], i) => {
    const d = Math.hypot(x - anchor[0], y - anchor[1])
    if (d < best) { best = d; first = i }
  })

  const chosen: [number, number][] = [candidates[first]]
  const nearest = candidates.map(([x, y]) =>
    Math.hypot(x - candidates[first][0], y - candidates[first][1]))
  nearest[first] = -1

  while (chosen.length < count) {
    let pick = -1
    let far = -1
    for (let i = 0; i < candidates.length; i++) {
      if (nearest[i] > far) { far = nearest[i]; pick = i }
    }
    if (pick < 0) break
    chosen.push(candidates[pick])
    const [px, py] = candidates[pick]
    for (let i = 0; i < candidates.length; i++) {
      const d = Math.hypot(candidates[i][0] - px, candidates[i][1] - py)
      if (d < nearest[i]) nearest[i] = d
    }
    nearest[pick] = -1
  }

  return chosen
}

/**
 * Hangs each label on the side of its circle that no other circle covers, so it
 * lands in open space rather than inside a lens.
 *
 * Leaning away from the others is not enough on its own: two circles sitting in
 * the same place lean the same way, and their labels come out on top of each
 * other — which is how a tag ends up looking like it does not exist. So whatever
 * still collides is walked around its own circle until it is clear.
 */
function labelAngles(circles: Circle[], spacing: number): number[] {
  const k = circles.length
  const angles = circles.map((me, index) => {
    let x = 0, y = 0
    for (let i = 0; i < k; i++) {
      if (i === index) continue
      x += me.x - circles[i].x
      y += me.y - circles[i].y
    }
    if (Math.hypot(x, y) < 1e-6) {
      return k === 1 ? Math.PI / 2 : Math.PI / 2 + (index * 2 * Math.PI) / k
    }
    return Math.atan2(y, x)
  })

  const at = (i: number): [number, number] => [
    circles[i].x + Math.cos(angles[i]) * circles[i].r,
    circles[i].y + Math.sin(angles[i]) * circles[i].r,
  ]

  const minGap = spacing * 1.3
  for (let pass = 0; pass < 40; pass++) {
    let clear = true
    for (let i = 0; i < k && clear; i++) {
      for (let j = 0; j < i; j++) {
        const [ax, ay] = at(i)
        const [bx, by] = at(j)
        if (Math.hypot(ax - bx, ay - by) < minGap) {
          // Always the same way round. Nudging back and forth would only return
          // the label to where it started on the following pass.
          angles[i] += 0.42
          clear = false
          break
        }
      }
    }
    if (clear) break
  }

  return angles
}
