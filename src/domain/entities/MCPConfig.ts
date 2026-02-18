import type { Platform } from './Platform';

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPToolConfig {
  name: string;
  enabled: boolean;
  servers?: string[];
}

/**
 * Per-project, per-platform MCP configuration.
 * No credentials are stored here — use KeytarSecureStorage instead.
 */
export interface MCPProjectConfig {
  /** Unique ID for this config entry (auto-generated) */
  id: string;
  /** Human-readable label, e.g. "My Fullstack Project" */
  label: string;
  /** Filesystem path to the project root */
  projectPath: string;
  /** Target AI platform */
  platform: Platform;
  /** MCP servers registered for this project+platform combo */
  mcpServers: Record<string, MCPServerConfig>;
  tools?: MCPToolConfig[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Legacy global config — kept for backward compatibility with mcp.json loading.
 * New code should use MCPProjectConfig.
 */
export interface MCPGlobalConfig {
  mcpServers: Record<string, MCPServerConfig>;
  tools?: MCPToolConfig[];
}

export class MCPConfigEntity implements MCPGlobalConfig {
  constructor(
    public mcpServers: Record<string, MCPServerConfig>,
    public tools?: MCPToolConfig[],
  ) {}

  static create(data?: Partial<MCPGlobalConfig>): MCPConfigEntity {
    return new MCPConfigEntity(
      data?.mcpServers || {},
      data?.tools || [],
    );
  }

  addServer(name: string, config: MCPServerConfig): void {
    this.mcpServers[name] = config;
  }

  removeServer(name: string): void {
    delete this.mcpServers[name];
  }

  updateServer(name: string, config: Partial<MCPServerConfig>): void {
    if (this.mcpServers[name]) {
      this.mcpServers[name] = { ...this.mcpServers[name], ...config };
    }
  }
}

export class MCPProjectConfigEntity implements MCPProjectConfig {
  constructor(
    public id: string,
    public label: string,
    public projectPath: string,
    public platform: Platform,
    public mcpServers: Record<string, MCPServerConfig>,
    public tools: MCPToolConfig[] = [],
    public createdAt: string = new Date().toISOString(),
    public updatedAt: string = new Date().toISOString(),
  ) {}

  static create(data: Partial<MCPProjectConfig>): MCPProjectConfigEntity {
    const now = new Date().toISOString();
    return new MCPProjectConfigEntity(
      data.id || crypto.randomUUID(),
      data.label || 'New Project',
      data.projectPath || '',
      data.platform || 'github-copilot',
      data.mcpServers || {},
      data.tools || [],
      data.createdAt || now,
      data.updatedAt || now,
    );
  }

  /** Returns the path where the config file should be written for the chosen platform. */
  getConfigFilePath(): string {
    switch (this.platform) {
      case 'claude':
        return `${this.projectPath}/.claude/settings.json`;
      case 'cursor':
        return `${this.projectPath}/.cursor/mcp.json`;
      case 'antigravity':
        return `${this.projectPath}/antigravity.config.json`;
      case 'opencode':
        return `${this.projectPath}/.opencode/mcp.json`;
      case 'github-copilot':
      default:
        return `${this.projectPath}/.vscode/mcp.json`;
    }
  }

  /** Serialises this config in the format expected by the target platform. */
  toExportJson(): string {
    const servers: Record<string, MCPServerConfig> = {};
    for (const [name, cfg] of Object.entries(this.mcpServers)) {
      // Strip undefined values
      servers[name] = Object.fromEntries(
        Object.entries(cfg).filter(([, v]) => v !== undefined)
      ) as MCPServerConfig;
    }

    switch (this.platform) {
      case 'claude':
        return JSON.stringify({ mcpServers: servers }, null, 2);
      case 'cursor':
        return JSON.stringify({ mcpServers: servers }, null, 2);
      case 'github-copilot':
      default:
        return JSON.stringify({ servers }, null, 2);
    }
  }
}

