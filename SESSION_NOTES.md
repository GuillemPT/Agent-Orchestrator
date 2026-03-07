# Agent Orchestrator — Session Notes

> Last updated: 2026-02-20  
> Stack: Electron 28 · React 18 · TypeScript 5.3 · Vite 5 · esbuild · Vitest  
> Tests: **86 passing** · Builds: **main ✅ · renderer ✅**

---

## What exists right now

### Views / panels (active in Sidebar)
| View key | Component | Description |
|---|---|---|
| `agents` | `AgentEditor.tsx` | Create/edit/export agents · Monaco editor · move/copy between projects · PR modal |
| `skills` | `SkillWizard.tsx` | Skill builder wizard · Monaco editor · move/copy between projects · PR modal |
| `mcp` | `MCPConfig.tsx` | MCP server configuration |
| `settings` | `Settings.tsx` | Multi-provider OAuth settings |

> `SyncPanel`, `WorkspaceSetup`, `Discover`, `GitPanel` — components preserved but **removed from Sidebar menu** until core is stable.

### Domain / infrastructure added this session
```
src/domain/interfaces/
  IGitProvider.ts          ← Core interface all providers implement

src/infrastructure/services/providers/
  GitHubProvider.ts        ← OAuth Device Flow + full API
  GitLabProvider.ts        ← OAuth Device Flow + self-hosted support
  BitbucketProvider.ts     ← App Passwords (Basic auth)

src/infrastructure/services/
  GitProviderService.ts    ← Orchestrator; persists clientIds in {dataDir}/git-providers.json

src/application/use-cases/
  GitProviderUseCases.ts   ← 13 use cases (connect, disconnect, repos, pushFiles, createPR, snippets…)
```

### IPC surface added (main ↔ renderer)
All under `gitProvider:*` namespace — **additive**, old `github:*` handlers unchanged.

| IPC channel | Use case |
|---|---|
| `gitProvider:getConnectedAccounts` | Returns `{ type, user }[]` for all authenticated providers |
| `gitProvider:getSettings` | Returns per-provider `{ clientId, baseUrl? }` |
| `gitProvider:setClientId` | Saves OAuth client ID for a provider |
| `gitProvider:startDeviceFlow` | Initiates RFC 8628 Device Flow; returns `{ device_code, user_code, verification_url, interval }` |
| `gitProvider:completeDeviceFlow` | Polls token endpoint; returns `GitUser` on success |
| `gitProvider:connectAppPassword` | Bitbucket: validates & stores username + app password |
| `gitProvider:disconnect` | Clears stored token/credentials for a provider |
| `gitProvider:listRepos` | Lists repos for authenticated user |
| `gitProvider:pushFiles` | Pushes files to a branch via Git Trees / Commits API |
| `gitProvider:createPR` | Creates PR/MR on GitHub, GitLab or Bitbucket |
| `gitProvider:listMarketplaceSnippets` | Lists public Gists/Snippets |
| `gitProvider:getSnippet` | Fetches a single snippet |
| `gitProvider:publishSnippet` | Publishes agent/skill as a snippet |

The `window.api.gitProvider.*` client-side API is fully typed in `src/renderer/types/electron.d.ts`.

---

## Bugs fixed this session

### Layout bug (panels floating / detached from header)
**Root cause:** All panels had `height: 100%` or `height: 100vh` but were children of a flex container — `height: 100%` doesn't fill the **main axis** of a flex column reliably in Electron/Chromium.

**Final fix applied:**
- `index.css` → `html, body, #root { height: 100%; overflow: hidden; }` — anchors the height chain
- `App.css` → `.app` uses **CSS Grid** (`grid-template-columns: 250px 1fr`) instead of flexbox
- `App.css` → `.main-content { position: relative }` + `.main-content > * { position: absolute; inset: 0 }` — **every panel is pinned to all 4 edges**, bypassing any flex/height chain fragility
- All panel roots (`AgentEditor`, `SkillWizard`, `MCPConfig`, `SyncPanel`, `GitPanel`, `WorkspaceSetup`, `Discover`, `Settings`) updated to `flex: 1; min-height: 0` (was `height: 100%` or `height: 100vh`)

### `dev:main` script
Added `NODE_ENV=development` so Electron correctly connects to the Vite dev server (port 3000) and opens DevTools automatically:
```json
"dev:main": "NODE_ENV=development node scripts/build-main.mjs && NODE_ENV=development electron ."
```

---

## Architecture decisions made

| Decision | Choice | Reason |
|---|---|---|
| Multi-provider strategy | `IGitProvider` interface + 3 concrete implementations | Clean extensibility; can add Azure DevOps, Gitea, etc. later |
| Auth — GitHub / GitLab | OAuth Device Flow (RFC 8628) | No redirect URI needed; works in Electron without a server |
| Auth — Bitbucket | App Passwords (Basic auth) | Bitbucket doesn't support Device Flow |
| OAuth app ownership | Each user registers their own OAuth app | No server-side secret storage; app works for everyone out of the box |
| Backward compat | Old `GitHubService` + `github:*` IPC kept intact | `AgentEditor` + `SkillWizard` PR modals and `Discover` still use old path |
| API abstraction | `src/renderer/api/index.ts` selects `window.api.*` vs `fetch('/api/*')` via `VITE_MODE` | Single import; zero diff between Electron and web component code |
| Mode flag | `VITE_MODE=web` env var (Vite build-time) | Avoids runtime `navigator.userAgent` hacks; tree-shaken in production |
| Project-less agents | `projectId: null` → "Sin proyecto" bucket | Allows creating without an active project; surfaced in selector as virtual group |
| Sidebar scope | Remove discover/sync/workspace/git from menuItems; keep components | Fast cleanup without deleting work; easy to re-enable later |
| Monaco in renderer | `@monaco-editor/react` lazy-loaded | VS Code engine, markdown/YAML highlighting, `vs-dark` matches app theme |
| Auto-save (web only) | 1 s `setTimeout` debounce, `PUT /api/agents/:id` | Notion-like UX; Electron side skips (file-system save is immediate) |
| Web auth | Better Auth (Hono plugin) — GitHub + Google OAuth | Official SDK for Hono; supports multiple providers with minimal config |

---

## Pending / next steps

### � Phase 13 — Version history (optional)
Add `AgentVersion` table (already in `schema.prisma`) to keep full edit history per agent/skill. Expose a "History" sidebar in `AgentEditor` / `SkillWizard` where the user can browse and restore previous versions.
### 🟡 Future idea — Copy/paste agents & skills
Allow copying an agent or skill to the clipboard (serialised JSON/YAML) and pasting it as a new item — useful for templating and quick duplication across projects without using the ⋮ context menu.

### 🟡 Future idea — Multi-tenant Kubernetes + local AI (Ollama)
When the web version is hosted, each tenant (user/org) could have its own isolated pod in a Kubernetes cluster. One of the pods could run an Ollama instance so that agents/skills are generated and validated locally (no cloud LLM calls needed). The Hono server would act as an API gateway routing requests to the correct pod. Auto-scaling via HPA based on active sessions.
Architecture sketch:
```
Ingress
  └─ Hono API gateway (1 replica, scales horizontally)
       ├─ User pod A  → Ollama sidecar, SQLite volume
       ├─ User pod B  → Ollama sidecar, SQLite volume
       └─ …
```
### 🟡 Phase 12 — Deploy
Scaffold and web migration complete; still pending:
- `npx prisma migrate dev --name init` first run
- Deploy Hono server to Railway / Render
- Deploy React SPA to Vercel / Cloudflare Pages
- Switch SQLite datasource to PostgreSQL for production

---

### ✅ COMPLETADOS (sesión 2026-02-20)

- **ProjectSelector modal** → import extraído del dropdown a un overlay modal independiente con paginación real (10 repos/página, prev/next, búsqueda)
- **Eliminar creación manual de proyectos** → `showCreate`, `handleCreateProject` y botón "New Project" eliminados de `ProjectSelector.tsx`
- **Flujo de proyecto end-to-end** → `AgentEditor` y `SkillWizard` filtran por `projectId`; crear un agente/skill lo asocia al proyecto activo; `projectId: null` → bucket "Sin proyecto"
- **Mover/Copiar entre proyectos** → botón `⋮` en cada item de `AgentEditor` y `SkillWizard` abre menú contextual con "Move to project" / "Copy to project" sobre todos los proyectos disponibles
- **Sidebar cleanup** → `discover`, `sync`, `workspace`, `git` eliminados de `menuItems`; `ViewType` actualizado; componentes preservados
- **Phase 8 — migración a gitProvider.\*** → `AgentEditor` y `SkillWizard` usan `window.api.gitProvider.pushFiles` / `createPR` (confirmado)
- **Phase 12 — scaffold servidor** → `src/server/` completo: Hono + Better Auth + Prisma (SQLite) + 5 rutas CRUD
- **API abstraction layer** → `src/renderer/api/index.ts` exporta `api` que delega a `window.api.*` (Electron) o `fetch('/api/...')` (web, `VITE_MODE=web`); todos los componentes activos migrados
- **Login page** → `Login.tsx` + `Login.css`: botones GitHub y Google OAuth
- **Session-aware routing** → `App.tsx` llama `GET /api/me` en modo web; 401 → `<Login>`, 200 → app completa
- **Monaco Editor** → `@monaco-editor/react` instalado; campo Instructions en `AgentEditor` y campo Markdown en `SkillWizard` usan Monaco (`vs-dark`, `wordWrap: on`); auto-save debounced 1 s con indicador "Saving… / Saved ✓" en modo web
- **Scripts dev:server / dev:web** → `npm run dev:server` (Hono :3001 vía tsx), `npm run dev:web` (Vite :3000 + Hono concurrentes), proxy `/api → :3001` en Vite
- **tsconfig `vite/client`** → resuelve `import.meta.env` sin errores de tipo
- **Fix GitPanel `isCommitting`** → bug de scope pre-existente corregido

---

### ✅ COMPLETADOS (sesión anterior)

Convert Agent Orchestrator into a full web application where each user manages their own agents, skills and MCPs across all their projects, authenticated via GitHub or Google OAuth.

### Stack
| Layer | Technology | Notes |
|---|---|---|
| **Auth** | [Better Auth](https://www.better-auth.com/) | TypeScript-native; GitHub + Google OAuth out of the box; handles sessions |
| **Backend** | [Hono](https://hono.dev/) | TypeScript, ultralight, same API as Express; runs on Node / Cloudflare Workers |
| **ORM** | [Prisma](https://www.prisma.io/) | Type-safe, auto-migrations |
| **DB** | SQLite (dev) → PostgreSQL (prod) | Start with no infrastructure; migrate when deploying |
| **Frontend** | Existing React (`src/renderer/`) | Only change: `window.api.X()` → `fetch('/api/X')` |

### Database schema (summary)
```
User          — id, email, name, avatar
Account       — OAuth provider linkage (github / google)
Project       — belongs to User; name, repoUrl
Agent         — belongs to Project; name, version, content (JSON)
Skill         — belongs to Project; name, content (JSON)
MCP           — belongs to Project; config (JSON)
GitToken      — belongs to User; provider + AES-256 encrypted token
```

### Backend structure (`src/server/` — ✅ created and active on port 3001)
```
src/server/
  index.ts              ← Hono app entry point
  auth.ts               ← Better Auth config (GitHub + Google providers)
  db.ts                 ← Prisma client singleton
  prisma/
    schema.prisma
    migrations/
  routes/
    projects.ts         ← CRUD /api/projects
    agents.ts           ← CRUD /api/agents
    skills.ts           ← CRUD /api/skills
    mcps.ts             ← CRUD /api/mcps
    git.ts              ← /api/git/* (reuses Phase 8 GitProviderService)
```

### What gets reused without changes
- `src/domain/` — entities and interfaces, 100% portable
- `src/application/use-cases/` — all use cases; only instantiation changes
- `src/infrastructure/services/providers/` — all 3 git providers; called from server instead of Electron main
- `src/renderer/` — mechanical change: `window.api.*` → `fetch('/api/*')`

### Frontend additions
- Login page (GitHub / Google buttons)
- Project selector in Sidebar (dropdown or new `projects` view)
- Session-aware routing (redirect to login if unauthenticated)

### Deployment targets
```
Railway / Render / Fly.io  →  Hono server + PostgreSQL
Vercel / Cloudflare Pages  →  React SPA (static)
```
Or everything on a single server.

### Implementation order
1. `src/server/` scaffold — Hono + Better Auth + Prisma schema + SQLite
2. Auth routes — GitHub OAuth + Google OAuth login/callback
3. CRUD endpoints — projects, agents, skills, mcps (with user scoping via session)
4. Git endpoints — thin wrappers around existing `GitProviderService`
5. Frontend migration — replace `window.api.*` with `fetch` calls
6. Project selector — new `projects` view / Sidebar dropdown
7. Rich text editor for agents/skills (see below)
8. Deploy to Railway (server) + Vercel (SPA)

### Manual editing of agents and skills

Agents and skills are stored as plain text / YAML in the `content` column. The editing experience in the web version:

**Recommended editor: Monaco Editor** (same engine as VS Code)
- Supports YAML + Markdown syntax highlighting out of the box
- Dark theme (`vs-dark`) matches the existing app style
- Lazy-loaded (~2 MB), no impact on initial load
- Drop-in replacement for the existing `<textarea>`:

```tsx
// Before
<textarea value={content} onChange={e => setContent(e.target.value)} />

// After
import Editor from '@monaco-editor/react'
<Editor language="markdown" value={content} theme="vs-dark"
        onChange={value => setContent(value ?? '')} />
```

**Auto-save with debounce** (1 second after last keystroke, like Notion):
```ts
useEffect(() => {
  const timer = setTimeout(() => {
    fetch(`/api/agents/${id}`, { method: 'PUT', body: JSON.stringify({ content }) })
  }, 1000)
  return () => clearTimeout(timer)
}, [content])
```
Show a "Saving…" / "Saved ✓" indicator in the panel header.

**Editor options by audience:**

| Option | Library | When |
|---|---|---|
| Simple `<textarea>` | — | Already works, zero friction |
| Syntax highlighting | Monaco Editor | Devs editing YAML/Markdown |
| WYSIWYG Markdown | [TipTap](https://tiptap.dev/) | Non-technical users |
| Split view (edit + preview) | Monaco + `react-markdown` | Best of both worlds |

### Version history (Phase 13, optional)

Add a `AgentVersion` table to keep a full edit history per agent/skill:

```prisma
model AgentVersion {
  id        String   @id @default(cuid())
  agentId   String
  content   Json
  createdAt DateTime @default(now())
  agent     Agent    @relation(fields: [agentId], references: [id])
}
```

Every save appends a version row. The UI exposes a "History" sidebar where the user can browse and restore any previous version.

---

## How to run

```bash
# Development — Electron (default)
npm run dev

# Development — web mode (Hono :3001 + Vite :3000)
npm run dev:web

# Development — server only
npm run dev:server

# First-time DB setup (web mode)
npx prisma migrate dev --name init

# Production build
npm run build        # builds renderer (dist/renderer/) + main (dist/main/)
npm start            # runs from dist/

# Tests
npm test             # 86 tests, ~1.5 s
```

---

## File map (new/changed files only)

```
src/
  domain/interfaces/
    IGitProvider.ts                       NEW
  infrastructure/services/
    GitProviderService.ts                 NEW
    providers/
      GitHubProvider.ts                   NEW
      GitLabProvider.ts                   NEW
      BitbucketProvider.ts                NEW
  application/use-cases/
    GitProviderUseCases.ts                NEW
  main/
    main.ts                               MODIFIED (13 new IPC handlers)
    preload.ts                            MODIFIED (gitProvider namespace)
  renderer/
    App.tsx                               MODIFIED (Settings import + ViewType + render)
    types/electron.d.ts                   MODIFIED (provider types + gitProvider API)
    components/
      Settings.tsx                        NEW
      Sidebar.tsx                         MODIFIED (multi-provider footer, Settings btn)
    styles/
      App.css                             MODIFIED (CSS Grid layout + absolute panels)
      Settings.css                        NEW
      Sidebar.css                         MODIFIED (provider strip styles)
      index.css                           MODIFIED (html/body/#root height anchoring)
      AgentEditor.css                     MODIFIED (height fix)
      SkillWizard.css                     MODIFIED (height fix)
      SyncPanel.css                       MODIFIED (height fix)
      GitPanel.css                        MODIFIED (height fix)
      MCPConfig.css                       MODIFIED (height fix)
      WorkspaceSetup.css                  MODIFIED (height fix)
      Discover.css                        MODIFIED (height fix)
package.json                              MODIFIED (NODE_ENV in dev:main)

# Session 2026-02-20
src/renderer/
  api/
    index.ts                              NEW  (abstraction: Electron ↔ web fetch)
  components/
    Login.tsx                             NEW  (GitHub + Google OAuth buttons)
    AgentEditor.tsx                       MODIFIED (monaco, move/copy menu, api.*)
    SkillWizard.tsx                       MODIFIED (monaco, move/copy menu, api.*)
    ProjectSelector.tsx                   MODIFIED (overlay modal, pagination, api.*)
    Sidebar.tsx                           MODIFIED (only agents/skills/mcp in menu, api.*)
    App.tsx                               MODIFIED (ViewType, session routing, Login)
    MCPConfig.tsx                         MODIFIED (api.*)
    ToolSelector.tsx                      MODIFIED (api.*)
    GitPanel.tsx                          FIXED  (isCommitting scope bug)
  styles/
    Login.css                             NEW
    AgentEditor.css                       MODIFIED (context menu, monaco-field, save-status)
    SkillWizard.css                       MODIFIED (context menu, monaco-field, save-status)
    ProjectSelector.css                   MODIFIED (import-modal overlay)
src/server/
  index.ts                               MODIFIED (serve() uncommented, active :3001)
vite.config.ts                           MODIFIED (proxy /api → :3001 when VITE_MODE=web)
tsconfig.json                            MODIFIED (types: ["vite/client"])
package.json                             MODIFIED (dev:server, dev:web, prisma:*, tsx dep)
```

---

## AI Generation — Architecture & Enterprise Deployment

### Current Implementation (Groq free tier)

The AI generation feature uses **Groq** as the primary provider, serving `llama-3.3-70b-versatile` via their OpenAI-compatible API. The `openai` SDK acts as a universal client — a single `AIService.ts` handles Groq, OpenAI, and Ollama by swapping `baseURL`.

**Why Groq over self-hosted Ollama:** At ~1000 req/day with ~800 output tokens, auto-hosting Ollama on a VPS without GPU ($20/mo) delivers the same cost with ~100× worse latency (~2–4 min/req on CPU). Groq provides `llama-3.3-70B` free up to 14,400 req/day with <2s latency.

Env vars: `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (see `.env.example`).

### Enterprise Kubernetes + Ollama Architecture

For on-premise deployments where data cannot leave the network:

```
┌─────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                     │
│                                                          │
│  ┌──────────┐     ┌──────────────────────────────────┐  │
│  │  Ingress  │────▷│  Hono API Gateway (N replicas)   │  │
│  │  (nginx)  │     │  HPA: scale by CPU               │  │
│  └──────────┘     └──────────┬───────────────────────┘  │
│                               │                          │
│       ┌───────────────────────┼───────────────────┐      │
│       ▼                       ▼                   ▼      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│  │ Namespace A  │   │ Namespace B │   │ Namespace C │   │
│  │ (tenant)     │   │ (tenant)    │   │ (tenant)    │   │
│  │             │   │             │   │             │   │
│  │ ┌─────────┐ │   │ ┌─────────┐ │   │ ┌─────────┐ │   │
│  │ │ App Pod │ │   │ │ App Pod │ │   │ │ App Pod │ │   │
│  │ │+Ollama  │ │   │ │+Ollama  │ │   │ │+Ollama  │ │   │
│  │ │ sidecar │ │   │ │ sidecar │ │   │ │ sidecar │ │   │
│  │ └─────────┘ │   │ └─────────┘ │   │ └─────────┘ │   │
│  └─────────────┘   └─────────────┘   └─────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Configuration tiers:**

| Tier | Model | Hardware | Latency | Use case |
|------|-------|----------|---------|----------|
| CPU sidecar | `qwen2.5:7b` | Node ≥8 GB RAM, no GPU | ~30–60s | Background generation, cost-sensitive |
| GPU node pool | `llama3.1:8b` | A10G (24 GB VRAM) | ~80 tok/s (<2s) | Synchronous UX, premium tier |

**GPU node pool setup:** Separate node pool with taints (`nvidia.com/gpu=true:NoSchedule`) + tolerations on Ollama pods. Only provisioned when `ollama.gpuNodePool` is enabled in Helm values.

**Helm chart values (sketch):**
```yaml
ollama:
  enabled: false
  model: qwen2.5:7b
  gpuNodePool:
    enabled: false
    taint: nvidia.com/gpu
    instanceType: g5.xlarge  # A10G
  resources:
    cpu:
      requests: "2"
      limits: "4"
      memory: "8Gi"
    gpu:
      requests: "1"
      limits: "1"
      memory: "24Gi"
```

**Migration path:** Set `AI_PROVIDER=ollama` + `AI_BASE_URL=http://localhost:11434/v1` — no code changes needed. The `AIService.ts` already supports it.
