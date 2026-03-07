import { IProjectRepository } from '../../domain/interfaces/IProjectRepository';
import { Project, CreateProjectInput, UpdateProjectInput } from '../../domain/entities/Project';

// ── Get All Projects ──────────────────────────────────────────────────────────
export class GetAllProjectsUseCase {
  constructor(private repository: IProjectRepository) {}

  async execute(): Promise<Project[]> {
    return this.repository.findAll();
  }
}

// ── Get Project By ID ─────────────────────────────────────────────────────────
export class GetProjectByIdUseCase {
  constructor(private repository: IProjectRepository) {}

  async execute(id: string): Promise<Project | null> {
    return this.repository.findById(id);
  }
}

// ── Create Project ────────────────────────────────────────────────────────────
export class CreateProjectUseCase {
  constructor(private repository: IProjectRepository) {}

  async execute(data: CreateProjectInput): Promise<Project> {
    return this.repository.create(data);
  }
}

// ── Update Project ────────────────────────────────────────────────────────────
export class UpdateProjectUseCase {
  constructor(private repository: IProjectRepository) {}

  async execute(id: string, data: UpdateProjectInput): Promise<Project> {
    return this.repository.update(id, data);
  }
}

// ── Delete Project ────────────────────────────────────────────────────────────
export class DeleteProjectUseCase {
  constructor(private repository: IProjectRepository) {}

  async execute(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
