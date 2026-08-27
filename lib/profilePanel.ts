import { useCanvasStore } from './store'
import { useResponsive } from './useResponsive'

/**
 * How wide the profile panel is on a screen with room to spare beside it.
 * ProfilePanel lays itself out with this; the canvas controls read it to get
 * out of its way.
 */
export const PROFILE_PANEL_WIDTH = 320

/**
 * What the open profile panel means for everything else floating over the
 * canvas.
 *
 * The panel is anchored to the right edge, and the controls that share that
 * edge — share, the Venn toggle — sit at a higher layer, so without this they
 * stay put and land on top of the panel's own tabs. On a wide screen the panel
 * only claims a strip, so those controls step `shift` px inward and keep
 * working; on a phone it claims the whole screen, so `coversScreen` tells them
 * to leave altogether. The one exception is the profile button itself, which
 * turns into the panel's ✕ and is meant to stay on top.
 */
export function useProfilePanel() {
  const showProfilePanel = useCanvasStore((s) => s.showProfilePanel)
  const readOnly = useCanvasStore((s) => s.readOnly)
  const { isMobile } = useResponsive()

  // A shared canvas has no panel to open, whatever the flag happens to say
  const open = showProfilePanel && !readOnly

  return {
    open,
    coversScreen: open && isMobile,
    shift: open && !isMobile ? PROFILE_PANEL_WIDTH : 0,
  }
}
