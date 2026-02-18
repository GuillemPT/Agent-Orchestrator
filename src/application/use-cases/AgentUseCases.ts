import { Agent, AgentEntity } from '../../domain/entities/Agent';
import { Platform } from '../../domain/entities/Platform';
import { IAgentRepository } from '../../domain/interfaces/IAgentRepository';

export class CreateAgentUseCase {
  constructor(private agentRepository: IAgentRepository) {}

  async execute(data: Partial<Agent>): Promise<Agent> {
    const agent = AgentEntity.create(data);
    await this.agentRepository.save(agent);
    return agent;
  }
}

export class UpdateAgentUseCase {
  constructor(private agentRepository: IAgentRepository) {}

  async execute(id: string, updates: Partial<Agent>): Promise<Agent> {
    const agent = await this.agentRepository.findById(id);
    if (!agent) {
      throw new Error(`Agent with id ${id} not found`);
    }

    const updatedAgent = { ...agent, ...updates, updatedAt: new Date() };
    await this.agentRepository.save(updatedAgent);
    return updatedAgent;
  }
}

export class DeleteAgentUseCase {
  constructor(private agentRepository: IAgentRepository) {}

  async execute(id: string): Promise<void> {
    await this.agentRepository.delete(id);
  }
}

export class GetAllAgentsUseCase {
  constructor(private agentRepository: IAgentRepository) {}

  async execute(): Promise<Agent[]> {
    return await this.agentRepository.findAll();
  }
}

export class GetAgentByIdUseCase {
  constructor(private agentRepository: IAgentRepository) {}

  async execute(id: string): Promise<Agent | null> {
    return await this.agentRepository.findById(id);
  }
}

export class ExportAgentToMdUseCase {
  constructor(private agentRepository: IAgentRepository) {}

  async execute(agent: Agent, platform?: Platform): Promise<string> {
    return await this.agentRepository.exportToAgentMd(agent, platform);
  }
}
