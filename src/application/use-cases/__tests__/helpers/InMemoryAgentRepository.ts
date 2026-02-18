import { Agent } from '../../domain/entities/Agent';
import { IAgentRepository } from '../../domain/interfaces/IAgentRepository';

export class InMemoryAgentRepository implements IAgentRepository {
  private store = new Map<string, Agent>();

  async findAll(): Promise<Agent[]> {
    return Array.from(this.store.values());
  }

  async findById(id: string): Promise<Agent | null> {
    return this.store.get(id) ?? null;
  }

  async save(agent: Agent): Promise<void> {
    this.store.set(agent.id, { ...agent });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async exportToAgentMd(agent: Agent): Promise<string> {
    return `# ${agent.metadata.name}\n\n${agent.metadata.description}`;
  }

  /** Test helper — direct access to internal store */
  get size() {
    return this.store.size;
  }
}
