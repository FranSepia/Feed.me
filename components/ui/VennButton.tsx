'use client'

import { useCanvasStore } from '@/lib/store'

/**
 * Latching toggle for the Venn view. It sits inside FilterButton's cluster, so
 * it lands next to the funnel on both screens the canvas appears on — the editor
 * and a shared profile — and follows the same row-on-mobile, column-on-desktop
 * arrangement as everything else up there.
 *
 * Pressed is a real state, not a flash: while the diagram is open the button
 * stays sunken and a shade darker, and clicking it again lets it back up.
 */
export function VennButton() {
  const vennActive = useCanvasStore((s) => s.vennActive)
  const setVennActive = useCanvasStore((s) => s.setVennActive)
  const nodes = useCanvasStore((s) => s.nodes)

  // Nothing to draw a diagram from
  if (!nodes.some((n) => n.tags.length > 0)) return null

  return (
    <button
      onClick={() => setVennActive(!vennActive)}
      title={vennActive ? 'Close the tag diagram' : 'Show tags as a Venn diagram'}
      aria-pressed={vennActive}
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        flexShrink: 0,
        // Pressed inverts the light: the highlight moves to the bottom-right and
        // the face darkens, which is what makes it read as held down rather than
        // merely selected
        borderTop: `1px solid ${vennActive ? 'rgba(150,150,160,0.55)' : 'rgba(255,255,255,0.90)'}`,
        borderLeft: `1px solid ${vennActive ? 'rgba(150,150,160,0.55)' : 'rgba(255,255,255,0.90)'}`,
        borderBottom: `1px solid ${vennActive ? 'rgba(255,255,255,0.70)' : 'rgba(180,180,180,0.35)'}`,
        borderRight: `1px solid ${vennActive ? 'rgba(255,255,255,0.70)' : 'rgba(180,180,180,0.35)'}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition: 'all 0.18s',
        transform: vennActive ? 'translateY(1px) scale(0.97)' : 'scale(1)',
        background: vennActive
          ? 'linear-gradient(160deg, rgba(196,198,210,0.72) 0%, rgba(168,171,186,0.62) 100%)'
          : 'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(240,240,240,0.52) 100%)',
        boxShadow: vennActive
          ? 'inset 3px 3px 8px rgba(90,94,115,0.45), inset -2px -2px 6px rgba(255,255,255,0.45)'
          : 'inset 2px 2px 6px rgba(160,160,160,0.35), inset -2px -2px 6px rgba(255,255,255,0.75)',
        color: vennActive ? 'rgba(38,42,66,0.95)' : 'rgba(68,72,96,0.80)',
        outline: 'none',
      }}
    >
      <VennIcon filled={vennActive} />
    </button>
  )
}

function VennIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* The lens is painted first so the two outlines stay crisp on top of it */}
      <path
        d="M12 7.2a5.4 5.4 0 0 0 0 9.6 5.4 5.4 0 0 0 0-9.6z"
        fill="currentColor"
        opacity={filled ? 0.55 : 0.28}
        stroke="none"
      />
      <circle cx="9.2" cy="12" r="5.4" />
      <circle cx="14.8" cy="12" r="5.4" />
    </svg>
  )
}
