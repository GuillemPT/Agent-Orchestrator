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

export interface MCPGlobalConfig {
  mcpServers: Record<string, MCPServerConfig>;
  tools?: MCPToolConfig[];
  credentials?: Record<string, string>;
}

export class MCPConfigEntity implements MCPGlobalConfig {
  constructor(
    public mcpServers: Record<string, MCPServerConfig>,
    public tools?: MCPToolConfig[],
    public credentials?: Record<string, string>
  ) {}

  static create(data?: Partial<MCPGlobalConfig>): MCPConfigEntity {
    return new MCPConfigEntity(
      data?.mcpServers || {},
      data?.tools || [],
      data?.credentials || {}
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

  addCredential(key: string, value: string): void {
    if (!this.credentials) {
      this.credentials = {};
    }
    this.credentials[key] = value;
  }

  removeCredential(key: string): void {
    if (this.credentials) {
      delete this.credentials[key];
    }
  }
}
