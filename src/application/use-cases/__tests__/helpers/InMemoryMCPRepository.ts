import { MCPGlobalConfig, MCPProjectConfig } from '../../../../domain/entities/MCPConfig';
import { IMCPRepository } from '../../../../domain/interfaces/IMCPRepository';

export class InMemoryMCPRepository implements IMCPRepository {
  private config: MCPGlobalConfig = { mcpServers: {}, tools: [] };
  private projects: Map<string, MCPProjectConfig> = new Map();

  async load(): Promise<MCPGlobalConfig> {
    return structuredClone(this.config);
  }

  async save(config: MCPGlobalConfig): Promise<void> {
    this.config = structuredClone(config);
  }

  async exportToJson(): Promise<string> {
    return JSON.stringify(this.config, null, 2);
  }

  async listProjectConfigs(): Promise<MCPProjectConfig[]> {
    return Array.from(this.projects.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  async saveProjectConfig(config: MCPProjectConfig): Promise<void> {
    this.projects.set(config.id, structuredClone(config));
  }

  async deleteProjectConfig(id: string): Promise<void> {
    this.projects.delete(id);
  }

  async deployProjectConfig(_config: MCPProjectConfig): Promise<void> {
    // no-op in tests — real deploy writes to filesystem
  }
}
