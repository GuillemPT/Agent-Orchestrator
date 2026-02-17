import { MCPGlobalConfig } from '../entities/MCPConfig';

export interface IMCPRepository {
  load(): Promise<MCPGlobalConfig>;
  save(config: MCPGlobalConfig): Promise<void>;
  exportToJson(): Promise<string>;
}
