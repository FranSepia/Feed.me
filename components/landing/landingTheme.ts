'use client'

/**
 * The glass the landing cards are cut from.
 *
 * Same neumorphic recipe as BottomBar and PublicBanner — a light gradient with a
 * bright top-left edge and a grey bottom-right one — pulled out here because the
 * sign-in card and the copy cards have to be visibly the same material, and they
 * live in different files.
 */
export interface LandingPalette {
  cardBg: string
  borderTop: string
  borderBottom: string
  shadow: string
  ink: string
  inkSoft: string
  inkFaint: string
  fieldBg: string
  fieldBorder: string
  buttonBg: string
  buttonInk: string
  quietBg: string
  tagBg: string
  tagInk: string
  rule: string
}

export function landingPalette(light: boolean): LandingPalette {
  return light
    ? {
        cardBg: 'linear-gradient(160deg, rgba(255,255,255,0.74) 0%, rgba(240,240,240,0.56) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.92)',
        borderBottom: '1px solid rgba(180,180,180,0.35)',
        shadow:
          '0 10px 34px rgba(0,0,0,0.11), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.85)',
        ink: 'rgba(43,46,60,0.93)',
        inkSoft: 'rgba(50,54,78,0.68)',
        inkFaint: 'rgba(50,54,78,0.42)',
        fieldBg: 'rgba(255,255,255,0.62)',
        fieldBorder: '1px solid rgba(120,125,145,0.22)',
        buttonBg: 'linear-gradient(135deg, #2f3342 0%, #1e212c 100%)',
        buttonInk: '#f2efe7',
        quietBg: 'rgba(43,46,60,0.06)',
        tagBg: 'rgba(43,46,60,0.07)',
        tagInk: 'rgba(50,54,78,0.60)',
        rule: 'rgba(50,54,78,0.12)',
      }
    : {
        cardBg: 'linear-gradient(160deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.05) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.16)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        shadow: '0 10px 34px rgba(0,0,0,0.36)',
        ink: 'rgba(237,232,222,0.94)',
        inkSoft: 'rgba(237,232,222,0.62)',
        inkFaint: 'rgba(237,232,222,0.38)',
        fieldBg: 'rgba(255,255,255,0.07)',
        fieldBorder: '1px solid rgba(255,255,255,0.14)',
        buttonBg: 'linear-gradient(135deg, #ede8de 0%, #d9d3c7 100%)',
        buttonInk: '#1a1a1a',
        quietBg: 'rgba(255,255,255,0.07)',
        tagBg: 'rgba(255,255,255,0.10)',
        tagInk: 'rgba(255,255,255,0.60)',
        rule: 'rgba(255,255,255,0.12)',
      }
}

/**
 * The landing's own chrome, in the same band as the rest of the interface —
 * above the canvas, below the error toast.
 */
export const Z_CHROME = 600
