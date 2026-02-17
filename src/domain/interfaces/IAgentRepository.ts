import { Agent } from '../entities/Agent';

export interface IAgentRepository {
  findAll(): Promise<Agent[]>;
  findById(id: string): Promise<Agent | null>;
  save(agent: Agent): Promise<void>;
  delete(id: string): Promise<void>;
  exportToAgentMd(agent: Agent): Promise<string>;
}
