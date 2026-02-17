export interface AgentMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
  compatibility: string[];
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  script?: string;
  yaml?: string;
}

export interface AgentMCPConfig {
  tools?: string[];
  target?: string;
  servers?: MCPServer[];
}

export interface MCPServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface Agent {
  id: string;
  metadata: AgentMetadata;
  skills: AgentSkill[];
  mcpConfig: AgentMCPConfig;
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AgentEntity implements Agent {
  constructor(
    public id: string,
    public metadata: AgentMetadata,
    public skills: AgentSkill[],
    public mcpConfig: AgentMCPConfig,
    public instructions?: string,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  static create(data: Partial<Agent>): AgentEntity {
    const id = data.id || crypto.randomUUID();
    const now = new Date();
    
    return new AgentEntity(
      id,
      data.metadata || {
        name: 'New Agent',
        version: '1.0.0',
        description: '',
        compatibility: ['github-copilot', 'claude-code', 'opencode', 'cursor', 'antigravity'],
      },
      data.skills || [],
      data.mcpConfig || { tools: [], target: '' },
      data.instructions,
      data.createdAt || now,
      data.updatedAt || now
    );
  }

  addSkill(skill: AgentSkill): void {
    this.skills.push(skill);
    this.updatedAt = new Date();
  }

  removeSkill(skillId: string): void {
    this.skills = this.skills.filter((s) => s.id !== skillId);
    this.updatedAt = new Date();
  }

  updateMetadata(metadata: Partial<AgentMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.updatedAt = new Date();
  }

  updateMCPConfig(config: Partial<AgentMCPConfig>): void {
    this.mcpConfig = { ...this.mcpConfig, ...config };
    this.updatedAt = new Date();
  }
}
