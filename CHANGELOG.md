# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-17

### Added

#### GitHub Integration (Phase 5)
- **GitHub Authentication** — PAT-based login stored securely in system keyring via Keytar; connected user shown in Sidebar footer with avatar + disconnect button
- **Pull Request Creation** — "Create PR" button in Agent Editor and Skill Wizard; exports the config to a new branch via GitHub Git Trees API and opens a PR — no local git checkout required
- **GitHub Git Trees API support** — `pushFilesToBranch` pushes files directly to any branch with automatic blob/tree/commit creation
- **`GitHubService`** — new infrastructure service wrapping GitHub REST API (user, repos, PRs, Gists, Git Trees)
- **`GitHubUseCases`** — eight use cases: SaveToken, GetUser, ClearToken, ListRepos, CreatePR, GetMarketplaceGists, GetGist, PublishGist
- **IPC handlers & typed API** — `window.api.github.*` and `window.api.workspace.*` namespaces fully typed in `electron.d.ts`

#### Discover / Gist Marketplace (Phase 6)
- **Browse Marketplace tab** — lists public GitHub Gists tagged `[agent-orchestrator]`, with per-gist preview modal and one-click "Import as Agent"
- **Publish tab** — export any agent or skill as a public Gist direct from the UI
- **`Discover` component** — new view accessible from the Sidebar; shows warning banner when GitHub is not connected

#### Workspace Setup (Phase 7 — replaces Pattern Analysis)
- **Analyze tab** — repository language/framework/pattern detection and Copilot instruction generation
- **Generate All Platforms tab** — select an agent + target project path, choose platforms (GitHub Copilot, Claude, Cursor, Antigravity, OpenCode), generate and deploy all configs in one click via `workspace:deployAgent` IPC
- `workspace:deploySkill` IPC handler for deploying skill configs to platform-specific paths

#### Testing
- **`GitHubUseCases.test.ts`** — 16 new unit tests covering all eight GitHub use cases with mock service (happy path + failure scenarios)
- Test suite now at **66 tests** across 5 test files

### Changed
- **Sidebar** navigation updated: *Pattern Analysis* replaced by *Workspace Setup* (🗂️) and *Discover* (🛒)
- **AgentEditor** action toolbar expanded with *Create PR* (dark GitHub button)
- **SkillWizard** action toolbar expanded with *Create PR* (same modal pattern as AgentEditor)
- `PatternAnalysis.tsx` and `PatternAnalysis.css` removed

---

## [1.0.0] - 2024-02-17

### Added

#### Core Features
- **Agent Management System**
  - Create, edit, and delete agents
  - Visual agent editor with metadata configuration
  - Export agents as `.agent.md` files
  - Support for multiple AI platforms (GitHub Copilot, Claude-Code, OpenCode, Cursor, Antigravity)

- **Skill Wizard**
  - Multi-step wizard for creating skills
  - Support for Markdown documentation
  - YAML configuration
  - Script management (Bash, Python, JavaScript, TypeScript, PowerShell)
  - Export as `.skill.md` or `.yaml`

- **MCP Configuration**
  - Visual editor for Model Context Protocol configuration
  - Server management (command, args, env variables)
  - Tool configuration
  - Secure credential storage via system keyring
  - Export as `mcp.json`

- **Directory Sync**
  - Bidirectional sync between `~/.copilot` and `.github`
  - Multiple sync directions (Home → GitHub, GitHub → Home, Bidirectional)
  - Conflict resolution strategies (Newer, Prefer GitHub, Prefer Home)
  - Real-time change detection

- **Pattern Analysis**
  - Analyze agent configurations and codebase patterns
  - Generate optimized `copilot-instructions.md`
  - AI compatibility layer for multiple platforms
  - Custom pattern input support

#### Architecture
- **Clean Architecture Implementation**
  - Domain layer with entities and interfaces
  - Application layer with use cases
  - Infrastructure layer with repositories and services
  - Presentation layer with React components

- **Technology Stack**
  - Electron 28 for desktop application
  - React 18 with TypeScript
  - Vite 5 for fast builds
  - Clean separation of concerns

#### UI/UX
- **VS Code-Inspired Theme**
  - Professional dark theme
  - Consistent color scheme
  - Familiar interface for developers

- **Responsive Design**
  - Sidebar navigation
  - Split-pane layouts
  - Scrollable content areas

#### Developer Experience
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Comprehensive documentation

### Documentation
- README.md with installation and usage instructions
- ARCHITECTURE.md with system design documentation
- CONTRIBUTING.md with contribution guidelines
- QUICKSTART.md for quick onboarding
- LICENSE (MIT)
- Example agents and skills

### Security
- Secure credential storage using system keyring
- Context isolation in Electron
- Controlled IPC communication

### Files Generated
- `.agent.md` - Agent configuration files
- `.skill.md` - Skill documentation files
- `.yaml` - YAML skill configurations
- `mcp.json` - MCP server configuration
- `copilot-instructions.md` - Generated AI instructions

## [Unreleased]

### Planned Features
- Plugin system for extensions
- Cloud sync for backup
- Collaboration features
- Template library
- Advanced search and filtering
- Version control for agents
- Bulk import/export
- Analytics and insights
- Keyboard shortcuts
- Auto-updater

### Known Issues
- Keyring may not work on all systems (falls back to in-memory storage)
- No automated tests yet (manual testing only)
- Large file lists may need virtual scrolling for performance

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
