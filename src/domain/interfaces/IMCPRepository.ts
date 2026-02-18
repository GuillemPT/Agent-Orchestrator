import { MCPGlobalConfig, MCPProjectConfig } from '../entities/MCPConfig';

export interface IMCPRepository {
  /** Load legacy global config (backward compat) */
  load(): Promise<MCPGlobalConfig>;
  /** Save legacy global config (backward compat) */
  save(config: MCPGlobalConfig): Promise<void>;
  exportToJson(): Promise<string>;

  /** Per-project config management */
  listProjectConfigs(): Promise<MCPProjectConfig[]>;
  saveProjectConfig(config: MCPProjectConfig): Promise<void>;
  deleteProjectConfig(id: string): Promise<void>;
  /** Write the config to the project directory in platform format */
  deployProjectConfig(config: MCPProjectConfig): Promise<void>;
}
