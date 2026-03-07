import { Agent } from '../entities/Agent';
import { Platform } from '../entities/Platform';

export interface IAgentRepository {
  findAll(): Promise<Agent[]>;
  findByProjectId(projectId: string | null): Promise<Agent[]>;  // null = global agents
  findById(id: string): Promise<Agent | null>;
  save(agent: Agent): Promise<void>;
  delete(id: string): Promise<void>;
  exportToAgentMd(agent: Agent, platform?: Platform): Promise<string>;
}
