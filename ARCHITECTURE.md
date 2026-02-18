# Agent Orchestrator - Architecture Documentation

## System Overview

Agent Orchestrator is a desktop application built with Electron and React that helps developers manage AI agents, skills, and development configurations. It follows Clean Architecture principles for maintainability and scalability.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              React Components (UI)                   │   │
│  │  - AgentEditor    - SkillWizard                     │   │
│  │  - MCPConfig      - SyncPanel                       │   │
│  │  - WorkspaceSetup - Discover                        │   │
│  │  - GitPanel                                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Use Cases                          │   │
│  │  - CreateAgent    - ExportAgent                     │   │
│  │  - CreateSkill    - ExportSkill                     │   │
│  │  - LoadMCPConfig  - SyncDirectories                 │   │
│  │  - GenerateInstructions                             │   │
│  │  - SaveGitHubToken - CreatePullRequest              │   │
│  │  - GetMarketplaceGists - PublishGist                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Entities & Interfaces                   │   │
│  │  Entities:                 Interfaces:              │   │
│  │  - Agent                   - IAgentRepository       │   │
│  │  - Skill                   - ISkillRepository       │   │
│  │  - MCPConfig               - IMCPRepository         │   │
│  │                            - ISecureStorage         │   │
│  │                            - ISyncService           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     Repositories              Services              │   │
│  │  - FileSystemAgent      - KeytarSecureStorage      │   │
│  │  - FileSystemSkill      - CopilotSyncService       │   │
│  │  - FileSystemMCP        - GitHubService            │   │
│  │                         - GitService               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                    External Systems                          │
│  - File System    - Keyring    - Chokidar (File Watcher)   │
└─────────────────────────────────────────────────────────────┘
```

## Electron Process Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Main Process                           │
│  ┌────────────────────────────────────────────────┐     │
│  │  main.ts - Application Entry Point             │     │
│  │  - Initialize repositories & services          │     │
│  │  - Register IPC handlers                       │     │
│  │  - Manage application lifecycle                │     │
│  └────────────────────────────────────────────────┘     │
│                         ↓ ↑                              │
│  ┌────────────────────────────────────────────────┐     │
│  │  preload.ts - Bridge Layer                     │     │
│  │  - Expose safe API to renderer                 │     │
│  │  - Context isolation boundary                  │     │
│  └────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
                         ↓ ↑ IPC
┌──────────────────────────────────────────────────────────┐
│                  Renderer Process                         │
│  ┌────────────────────────────────────────────────┐     │
│  │  React Application                             │     │
│  │  - Component tree                              │     │
│  │  - State management                            │     │
│  │  - UI rendering                                │     │
│  └────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

### Example: Creating a New Agent

```
User Action (UI)
       ↓
React Component (AgentEditor)
       ↓
window.api.agent.create(data)
       ↓
IPC Channel (preload.ts)
       ↓
Main Process Handler (main.ts)
       ↓
Use Case (CreateAgentUseCase)
       ↓
Entity (AgentEntity.create)
       ↓
Repository (FileSystemAgentRepository.save)
       ↓
File System (agents/[id].json)
```

### Example: Syncing Directories

```
User Action (UI)
       ↓
React Component (SyncPanel)
       ↓
window.api.sync.syncDirectories(options)
       ↓
IPC Channel (preload.ts)
       ↓
Main Process Handler (main.ts)
       ↓
Use Case (SyncCopilotDirectoriesUseCase)
       ↓
Service (CopilotSyncService)
       ↓
File System (~/.copilot ↔ .github)
```

## Key Components

### Domain Layer

**Entities**:
- `Agent`: Core agent configuration with metadata, skills, and MCP config
- `Skill`: Reusable skill with documentation, YAML, and scripts
- `MCPConfig`: Model Context Protocol server configuration

**Interfaces**:
- Define contracts for repositories and services
- Enable dependency inversion
- Facilitate testing and mocking

### Application Layer

**Use Cases**:
- Single-purpose business operations
- Orchestrate domain entities and repositories
- Implement business rules and validation

### Infrastructure Layer

**Repositories**:
- Implement domain interfaces
- Handle data persistence (filesystem)
- Abstract storage mechanisms

**Services**:
- External integrations (keyring, file sync)
- Platform-specific implementations
- Cross-cutting concerns

### Presentation Layer

**Components**:
- React functional components
- State management with hooks
- VS Code-inspired theming
- Responsive layouts

## File Storage

```
User Data Directory/
├── data/
│   ├── agents/
│   │   ├── [agent-id-1].json
│   │   ├── [agent-id-2].json
│   │   └── ...
│   ├── skills/
│   │   ├── [skill-id-1].json
│   │   ├── [skill-id-2].json
│   │   └── ...
│   └── mcp.json
└── logs/
    └── ...
```

## Security Considerations

1. **Credential Storage**: Uses system keyring via Keytar
2. **Context Isolation**: Enabled in Electron for security
3. **IPC Communication**: Controlled through preload script
4. **File Access**: Limited to designated directories

## Extension Points

### Adding New Entity Types

1. Create entity in `src/domain/entities/`
2. Define interface in `src/domain/interfaces/`
3. Implement repository in `src/infrastructure/repositories/`
4. Create use cases in `src/application/use-cases/`
5. Add IPC handlers in `src/main/main.ts`
6. Expose in `src/main/preload.ts`
7. Create UI component in `src/renderer/components/`

### Adding New Export Formats

1. Add export method to entity
2. Implement in repository
3. Create use case
4. Add IPC handler
5. Update UI to trigger export

### Adding New Sync Strategies

1. Extend `ISyncService` interface
2. Implement new strategy in `CopilotSyncService`
3. Add to sync options
4. Update UI with new option

## Performance Considerations

- **File Operations**: Async/await for non-blocking I/O
- **Large Lists**: Virtual scrolling for agent/skill lists (future)
- **Builds**: Vite for fast development builds
- **Updates**: Electron auto-updater (future implementation)

## Testing Strategy

### Unit Tests
- Domain entities
- Use cases
- Repository implementations

### Integration Tests
- IPC communication
- File operations
- Service integrations

### E2E Tests
- Complete user workflows
- UI interactions
- Data persistence

## Future Enhancements

1. **Plugin System**: Allow third-party extensions
2. **Template Library**: Pre-built agent templates
3. **Cloud Sync**: Optional cloud backup
4. **Collaboration**: Share agents with team
5. **Analytics**: Usage patterns and insights
6. **Version Control**: Agent versioning and history
7. **Import/Export**: Bulk operations
8. **Search**: Advanced search and filtering
