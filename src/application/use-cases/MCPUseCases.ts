import { MCPGlobalConfig, MCPProjectConfig, MCPProjectConfigEntity } from '../../domain/entities/MCPConfig';
import { IMCPRepository } from '../../domain/interfaces/IMCPRepository';
import { MCPToolsService, MCPTool } from '../../infrastructure/services/MCPToolsService';

// ── Legacy global config use cases ───────────────────────────────────────────

export class LoadMCPConfigUseCase {
  constructor(private mcpRepository: IMCPRepository) {}
  async execute(): Promise<MCPGlobalConfig> {
    return this.mcpRepository.load();
  }
}

export class SaveMCPConfigUseCase {
  constructor(private mcpRepository: IMCPRepository) {}
  async execute(config: MCPGlobalConfig): Promise<void> {
    return this.mcpRepository.save(config);
  }
}

export class ExportMCPConfigUseCase {
  constructor(private mcpRepository: IMCPRepository) {}
  async execute(): Promise<string> {
    return this.mcpRepository.exportToJson();
  }
}

// ── Tool discovery use cases ──────────────────────────────────────────────────

export class GetAvailableMCPToolsUseCase {
  constructor(private mcpToolsService: MCPToolsService) {}
  async execute(): Promise<MCPTool[]> {
    return this.mcpToolsService.fetchAvailableTools();
  }
}

export class SearchMCPToolsUseCase {
  constructor(private mcpToolsService: MCPToolsService) {}
  async execute(query: string): Promise<MCPTool[]> {
    return this.mcpToolsService.searchTools(query);
  }
}

// ── Per-project config use cases ──────────────────────────────────────────────

export class GetAllMCPProjectsUseCase {
  constructor(private mcpRepository: IMCPRepository) {}
  async execute(): Promise<MCPProjectConfig[]> {
    return this.mcpRepository.listProjectConfigs();
  }
}

export class CreateMCPProjectUseCase {
  constructor(private mcpRepository: IMCPRepository) {}
  async execute(data: Partial<MCPProjectConfig>): Promise<MCPProjectConfig> {
    const entity = MCPProjectConfigEntity.create(data);
    await this.mcpRepository.saveProjectConfig(entity);
    return entity;
  }
}

export class UpdateMCPProjectUseCase {
  constructor(private mcpRepository: IMCPRepository) {}
  async execute(id: string, updates: Partial<MCPProjectConfig>): Promise<MCPProjectConfig> {
    const all = await this.mcpRepository.listProjectConfigs();
    const existing = all.find(p => p.id === id);
    if (!existing) throw new Error(`MCP project not found: ${id}`);
    const updated = MCPProjectConfigEntity.create({ ...existing, ...updates, id, updatedAt: new Date().toISOString() });
    await this.mcpRepository.saveProjectConfig(updated);
    return updated;
  }
}

export class DeleteMCPProjectUseCase {
  constructor(private mcpRepository: IMCPRepository) {}
  async execute(id: string): Promise<void> {
    return this.mcpRepository.deleteProjectConfig(id);
  }
}

export class DeployMCPProjectUseCase {
  constructor(private mcpRepository: IMCPRepository) {}
  async execute(config: MCPProjectConfig): Promise<string> {
    await this.mcpRepository.deployProjectConfig(config);
    const entity = MCPProjectConfigEntity.create(config);
    return entity.getConfigFilePath();
  }
}
