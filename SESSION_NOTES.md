# Agent Orchestrator — Session Notes

> Last updated: 2026-02-18  
> Stack: Electron 28 · React 18 · TypeScript 5.3 · Vite 5 · esbuild · Vitest  
> Tests: **66 passing** · Builds: **main ✅ · renderer ✅**

---

## What exists right now

### Views / panels
| View key | Component | Description |
|---|---|---|
| `agents` | `AgentEditor.tsx` | Create/edit/export agents to 5 platforms + PR modal |
| `skills` | `SkillWizard.tsx` | Skill builder wizard + PR modal |
| `mcp` | `MCPConfig.tsx` | MCP server configuration |
| `sync` | `SyncPanel.tsx` | Directory → workspace sync |
| `workspace` | `WorkspaceSetup.tsx` | Pattern analysis & workspace scaffolding |
| `discover` | `Discover.tsx` | GitHub Gist marketplace for agents/skills |
| `git` | `GitPanel.tsx` | Git operations panel |
| `settings` | `Settings.tsx` | **NEW** Multi-provider OAuth settings |

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

---

## Pending / next steps

### 🔴 Known broken — Create / Save buttons (agents, skills, MCPs, sync)

All "New Agent", "Save", "Create Skill", etc. buttons call `window.api.*` IPC handlers that write to the **local filesystem** (`FileSystemAgentRepository`, `FileSystemSkillRepository`, etc.). They are broken or unreliable in the current build — likely due to the path resolution changing between dev and built mode, or IPC not being wired after the Phase 8 refactor of `main.ts`.

**How to debug:**
- Run `npm run dev` (opens DevTools automatically now)
- Click "New Agent" and check the Console for IPC errors
- Check the Network/IPC tab or add `console.log` to the `agents:create` handler in `main.ts`

**Fix in Electron (short term):** Audit the `agents:*`, `skills:*`, `mcp:*` IPC handlers in `main.ts` and confirm `dataDir` resolves correctly and the repository instances are passed properly.

**Fix in the web version (Phase 12, long term):** These buttons will call `fetch('/api/agents')`, `fetch('/api/skills')`, etc. instead of `window.api.*`. The underlying logic (use cases + domain entities) stays exactly the same — only the transport changes. No file system access needed: data goes to the database (Prisma → PostgreSQL/SQLite). Concretely:

| Current (Electron IPC) | Web version (HTTP) |
|---|---|
| `window.api.agents.create(data)` | `POST /api/agents` with JSON body |
| `window.api.agents.list()` | `GET /api/agents?projectId=xxx` |
| `window.api.agents.update(id, data)` | `PUT /api/agents/:id` |
| `window.api.agents.delete(id)` | `DELETE /api/agents/:id` |
| Same pattern for skills, mcps, sync | Same pattern |

The React components themselves barely change — just swap the call site. All state management, form logic and UI stays the same.

### 🟡 Phase 8 — wiring Settings UI properly
`Settings.tsx` is rendered but the Device Flow UX needs real-world testing:
1. Register a GitHub OAuth app (Settings → Developer settings → OAuth Apps)
   - Homepage URL: `http://localhost`
   - Callback URL: `http://localhost` (Device Flow doesn't use it)
   - Note the **Client ID** (secret is NOT needed for Device Flow)
2. Open Settings in the app, enter the Client ID, click Connect
3. Follow the verification URL + code shown in the UI
4. Confirm avatar appears in the Sidebar footer

Same flow for GitLab. For Bitbucket, use username + App Password (Settings → Personal settings → App passwords, grant Read repositories scope).

### 🟡 Phase 8 — integrate new providers into existing flows
Currently `AgentEditor` and `SkillWizard` PR modals call `window.api.github.*` (old path, PAT-based). Once the new providers are confirmed working, migrate them to:
```ts
window.api.gitProvider.createPR({ provider: 'github', ... })
window.api.gitProvider.pushFiles({ provider: 'github', ... })
```
And show a provider selector in the PR modal (GitHub / GitLab / Bitbucket dropdown).

### 🟡 Phase 8 — migrate Discover
`Discover.tsx` uses `window.api.github.listGists` / `getGist` / `publishGist` (old PAT path). Migrate to `window.api.gitProvider.listMarketplaceSnippets` etc., with a provider filter so GitLab/Bitbucket snippet markets also appear.

### 🟢 Phase 9 — tests for new use cases
`GitProviderUseCases.ts` has no tests yet. Add `src/application/use-cases/__tests__/GitProviderUseCases.test.ts` following the same pattern as `GitHubUseCases.test.ts`.

### 🟢 Phase 10 — packaging / distribution
- `electron-builder` config not yet created → add `build` section to `package.json`
- Per-platform targets: `.AppImage` (Linux), `.dmg` (macOS), `.exe` NSIS installer (Windows)
- Code-signing config (macOS notarisation, Windows Authenticode)
- Auto-updater via `electron-updater`

### 🟢 Phase 11 — UI polish
- The Sidebar provider strip (`providers-strip`) shows avatar + login for connected accounts. Add a tooltip with provider name on hover.
- Settings page: add a "Test connection" button that calls `getConnectedAccounts` and shows a success badge.
- Dark/light theme toggle (CSS variables are already set up for it).

---

## Phase 12 — Web app + multi-user SaaS

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

### Backend structure (`src/server/` — to be created)
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
# Development (Vite dev server + Electron with DevTools)
npm run dev

# Production build
npm run build        # builds renderer (dist/renderer/) + main (dist/main/)
npm start            # runs from dist/

# Tests
npm test             # 66 tests, ~1.5 s
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
```
