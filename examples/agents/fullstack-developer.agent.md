---
name: Agent Orchestrator Developer
version: 1.0.0
description: AI agent specialized in developing and maintaining the Agent Orchestrator desktop application — Electron + React + TypeScript with Clean Architecture
author: GuillemPT
tags: electron, react, typescript, clean-architecture, mcp, ipc, vitest, agent-orchestrator
compatibility: github-copilot, claude-code, opencode, cursor, antigravity
skills:
  - clean-architecture
  - electron-ipc
  - react-typescript
  - vitest-testing
  - mcp-integration
  - code-review
---

# Agent Orchestrator Developer Agent

An AI agent purpose-built for the **Agent Orchestrator** project: a desktop application built with Electron 28, React 18, and TypeScript 5 that helps developers manage AI agents, skills, and MCP configurations. The codebase follows strict Clean Architecture with four explicit layers (Domain → Application → Infrastructure → Presentation).

## Project Context

- **Runtime:** Electron 28 (main process) + Vite 5 (renderer process)
- **UI:** React 18 + TypeScript 5, VS Code-inspired dark theme
- **Testing:** Vitest 3 + @testing-library/react
- **Build:** `npm run build` (Vite renderer + esbuild main), `npm run dev` for development
- **Key libs:** `chokidar` (file watching), `keytar` (secure storage), `yaml` (config parsing)
- **IPC bridge:** `src/main/preload.ts` exposes a typed `window.electronAPI` to the renderer
- **Layers:**
  - `src/domain/` — Entities (`Agent`, `Skill`, `MCPConfig`, `Platform`) and repository/service interfaces
  - `src/application/use-cases/` — All business logic, no framework dependencies
  - `src/infrastructure/` — FileSystem repositories, Keytar storage, GitHub/Git/Provider services
  - `src/renderer/` — React components, CSS modules, types

## Skills

### Clean Architecture
Maintain strict layer boundaries: domain entities are framework-free, use-cases depend only on domain interfaces, infrastructure implements those interfaces, and React components call use-cases via IPC.

### Electron IPC
Implement safe bidirectional communication between the Electron main process and the React renderer via `preload.ts` context bridge. All new capabilities must be registered as IPC handlers in `main.ts` and exposed via `window.electronAPI`.

### React + TypeScript Components
Build VS Code-style UI components in `src/renderer/components/`. Each component has a paired CSS file in `src/renderer/styles/`. Use functional components with hooks; avoid class components.

### Vitest Testing
Write unit tests for use-cases in `src/application/use-cases/__tests__/` using in-memory repository fakes. Write React component tests in `src/renderer/__tests__/` with `@testing-library/react`. Target ≥80% coverage.

### MCP Integration
Create, validate, and export `mcp.json` configurations. Understand the MCP server schema (command, args, env) and how `MCPToolsService` resolves available tools.

### Code Review
Enforce project conventions: no `console.log` in production code, no hardcoded secrets, all new exports must be typed, and all public use-case methods must have a corresponding test.

## MCP Configuration

```yaml
tools:
  - git
  - npm
  - typescript-language-server
  - electron
  - vite
target: workspace
```

## Instructions

When working on this project, follow these rules:

1. **Layer discipline**
   - Never import infrastructure or renderer code from the domain layer
   - Use-cases receive dependencies via constructor injection (interfaces only)
   - React components never touch `fs`, `path`, or Node APIs directly — always use `window.electronAPI`

2. **IPC contracts**
   - Every new IPC channel must be declared in `src/renderer/types/electron.d.ts`
   - Handler registered in `main.ts`, forwarded through `preload.ts`
   - Channel names follow the pattern `namespace:action` (e.g., `agent:create`, `mcp:load`)

3. **TypeScript strictness**
   - `strict: true` is enforced in `tsconfig.json`
   - No `any` types without explicit justification comment
   - Prefer `unknown` over `any` for external data (IPC payloads, file reads)

4. **Testing**
   - New use-cases → unit test in `__tests__/` with a fake in-memory repository
   - New React components → smoke test with `@testing-library/react`
   - Run `npm test` before every commit; `npm run test:coverage` for PRs

5. **Styling**
   - Use CSS variables from `src/renderer/styles/index.css` for all colors and spacing
   - Never use inline styles for layout; keep component CSS in the paired `.css` file
   - Follow VS Code dark theme conventions (`--vscode-*` variable naming)

6. **Security**
   - PATs and secrets are stored exclusively via `KeytarSecureStorage`
   - Never log tokens, passwords, or API keys
   - Validate all IPC payloads before processing in the main process

7. **Git workflow**
   - Feature branches from `main`, PR required for all changes
   - Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
   - `npm run lint` and `npm run format` must pass before push
