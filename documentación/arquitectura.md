# Arquitectura de Feed.Me

Diagrama generado a partir del código real del repo (Next.js 14 App Router + React Three Fiber + Supabase). Ábrelo en VSCode con una extensión de preview Markdown+Mermaid, o en GitHub (renderiza Mermaid nativamente).

```mermaid
flowchart TB
    subgraph Browser["Navegador"]
        User(("Usuario"))
    end

    subgraph Routes["app/ (Next.js App Router)"]
        RootLayout["layout.tsx<br/>AuthProvider + TouchBlocker"]
        RootPage["page.tsx<br/>redirige según sesión"]

        subgraph AuthGroup["(auth)"]
            Login["login/page.tsx"]
            Register["register/page.tsx"]
        end

        subgraph EditorGroup["(editor) — protegido"]
            EditorLayout["layout.tsx<br/>guard: redirige a /login"]
            EditorPage["editor/page.tsx<br/>carga nodos del usuario"]
        end

        PublicProfile["[username]/page.tsx<br/>SSR, fetch directo a REST<br/>(SEO / OG tags)"]
        DriveApi["api/drive-download/route.ts<br/>proxy de medios Google Photos/Drive"]
    end

    subgraph CanvasLayer["components/canvas (React Three Fiber)"]
        Canvas3D["Canvas3D.tsx"]
        Scene["Scene.tsx<br/>layout: spiral/oval/orbit/perimeter"]
        CameraControls["CameraControls.tsx<br/>pan/zoom manual"]
        Skeleton["SkeletonNodes.tsx"]
        subgraph NodeTypes["canvas/nodes"]
            ImageNode
            VideoNode
            TextNode
            SpotifyNode
            SocialNode
        end
    end

    subgraph UILayer["components/ui (chrome 2D)"]
        BottomBar["BottomBar.tsx<br/>subir/importar contenido"]
        NodeEditor["NodeEditor.tsx"]
        ProfilePanel["ProfilePanel.tsx"]
        ProfileButton
        EditModeButton
        FilterButton
        ShareButton
        PublicBanner
    end

    ProfileClient["components/profile/PublicProfileClient.tsx<br/>modo read-only"]

    subgraph LibLayer["lib/ (estado y servicios)"]
        Store["store.ts<br/>Zustand: nodes, editMode, bgColor, socials<br/>CRUD vía fetch crudo a PostgREST"]
        AuthCtx["auth-context.tsx<br/>useAuth(): user, profile, signIn/signUp/signOut"]
        SupabaseClient["supabase.ts<br/>cliente Supabase (Auth + Storage)"]
        Colors["colors.ts"]
        SessionId["sessionId.ts"]
        Responsive["useResponsive.ts"]
    end

    subgraph Supabase["Supabase (backend)"]
        SBAuth["Auth<br/>email/password"]
        SBDb[("Postgres<br/>tablas: profiles, canvas_nodes")]
        SBStorage["Storage<br/>avatares / medios"]
    end

    GoogleExt["Google Photos / Drive<br/>(externo)"]

    User --> RootPage
    RootPage --> Login
    RootPage --> EditorPage
    RootLayout --> AuthCtx
    Login --> AuthCtx
    Register --> AuthCtx
    EditorLayout --> AuthCtx
    EditorLayout --> EditorPage

    EditorPage --> Canvas3D
    EditorPage --> BottomBar
    EditorPage --> NodeEditor
    EditorPage --> ProfilePanel
    EditorPage --> ProfileButton
    EditorPage --> EditModeButton
    EditorPage --> FilterButton
    EditorPage --> ShareButton

    PublicProfile --> ProfileClient
    ProfileClient --> Canvas3D
    ProfileClient --> FilterButton
    ProfileClient --> PublicBanner

    Canvas3D --> Scene
    Scene --> CameraControls
    Scene --> Skeleton
    Scene --> NodeTypes

    Scene -. lee .-> Store
    BottomBar -. escribe .-> Store
    NodeEditor -. escribe .-> Store
    ProfilePanel -. escribe .-> Store
    FilterButton -. lee .-> Store
    ProfileClient -. set read-only .-> Store

    BottomBar --> DriveApi
    DriveApi --> GoogleExt

    AuthCtx --> SupabaseClient
    Store -. fetch REST directo .-> SBDb
    PublicProfile -. fetch REST directo .-> SBDb
    SupabaseClient --> SBAuth
    SupabaseClient --> SBStorage
    BottomBar -. upload .-> SBStorage
    ProfilePanel -. upload avatar .-> SBStorage
```

## Notas clave

- **Todo el CRUD de datos** (`canvas_nodes`, `profiles`) pasa por `fetch` crudo a la API REST de Supabase (PostgREST) en `lib/store.ts`, **no** por el cliente JS `@supabase/supabase-js` — según comentarios en el código, ese cliente "se cuelga" en escrituras. El cliente JS (`lib/supabase.ts`) se usa solo para Auth y Storage.
- **Único endpoint API propio**: `app/api/drive-download/route.ts`, que actúa de proxy para importar imágenes/videos desde links de Google Photos/Drive.
- **Sin carpeta `supabase/`**: el esquema de la base de datos no está versionado en el repo, solo se infiere del código (tablas `profiles` y `canvas_nodes`).
- **Capa 3D**: React Three Fiber + drei + react-spring/three, con cámara y controles de pan/zoom implementados a mano (sin `OrbitControls` de drei).
- **Vista pública** (`/[username]`) es server component con fetch directo (para SEO/OG tags) que delega el canvas 3D a un client component (`PublicProfileClient`) en modo solo-lectura.
