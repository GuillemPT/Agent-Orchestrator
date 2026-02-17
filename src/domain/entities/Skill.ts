export interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  category?: string;
}

export interface SkillScript {
  language: string;
  content: string;
  path?: string;
}

export interface SkillYAML {
  content: string;
  schema?: string;
}

export interface Skill {
  id: string;
  metadata: SkillMetadata;
  markdown?: string;
  yaml?: SkillYAML;
  scripts: SkillScript[];
  createdAt: Date;
  updatedAt: Date;
}

export class SkillEntity implements Skill {
  constructor(
    public id: string,
    public metadata: SkillMetadata,
    public markdown?: string,
    public yaml?: SkillYAML,
    public scripts: SkillScript[] = [],
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  static create(data: Partial<Skill>): SkillEntity {
    const id = data.id || crypto.randomUUID();
    const now = new Date();

    return new SkillEntity(
      id,
      data.metadata || {
        name: 'New Skill',
        description: '',
        version: '1.0.0',
      },
      data.markdown,
      data.yaml,
      data.scripts || [],
      data.createdAt || now,
      data.updatedAt || now
    );
  }

  addScript(script: SkillScript): void {
    this.scripts.push(script);
    this.updatedAt = new Date();
  }

  removeScript(index: number): void {
    this.scripts.splice(index, 1);
    this.updatedAt = new Date();
  }

  updateMetadata(metadata: Partial<SkillMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
    this.updatedAt = new Date();
  }

  updateYAML(yaml: SkillYAML): void {
    this.yaml = yaml;
    this.updatedAt = new Date();
  }

  updateMarkdown(markdown: string): void {
    this.markdown = markdown;
    this.updatedAt = new Date();
  }
}
