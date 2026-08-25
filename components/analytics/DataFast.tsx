// ─────────────────────────────────────────────────────────────────────────────
//  DataFast — analítica de tráfico de feed-me.space
//
//  PARA QUITARLO, dos pasos y ya:
//    1. borra la línea  <DataFast />  en app/layout.tsx (está marcada con un
//       comentario igual a este)
//    2. borra este archivo
//
//  No hay nada más que limpiar: ningún otro archivo lo importa, no guarda
//  estado, no usa variables de entorno y no toca el resto de la app. Se carga
//  en el <head> del layout raíz, así que cubre todas las páginas.
// ─────────────────────────────────────────────────────────────────────────────

export function DataFast() {
  return (
    <script
      defer
      data-website-id="dfid_qm56efcjShaVSQ3g1GTSZ"
      data-domain="feed-me.space"
      src="https://datafa.st/js/script.js"
    />
  )
}
