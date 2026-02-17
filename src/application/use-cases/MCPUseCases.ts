import { MCPGlobalConfig } from '@domain/entities/MCPConfig';
import { IMCPRepository } from '@domain/interfaces/IMCPRepository';
import { MCPToolsService, MCPTool } from '@infrastructure/services/MCPToolsService';

export class LoadMCPConfigUseCase {
  constructor(private mcpRepository: IMCPRepository) {}

  async execute(): Promise<MCPGlobalConfig> {
    return await this.mcpRepository.load();
  }
}

export class SaveMCPConfigUseCase {
  constructor(private mcpRepository: IMCPRepository) {}

  async execute(config: MCPGlobalConfig): Promise<void> {
    await this.mcpRepository.save(config);
  }
}

export class ExportMCPConfigUseCase {
  constructor(private mcpRepository: IMCPRepository) {}

  async execute(): Promise<string> {
    return await this.mcpRepository.exportToJson();
  }
}

export class GetAvailableMCPToolsUseCase {
  constructor(private mcpToolsService: MCPToolsService) {}

  async execute(): Promise<MCPTool[]> {
    return await this.mcpToolsService.fetchAvailableTools();
  }
}

export class SearchMCPToolsUseCase {
  constructor(private mcpToolsService: MCPToolsService) {}

  async execute(query: string): Promise<MCPTool[]> {
    return await this.mcpToolsService.searchTools(query);
  }
}
