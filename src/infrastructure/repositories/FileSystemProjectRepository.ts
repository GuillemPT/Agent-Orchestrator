import { IProjectRepository } from '../../domain/interfaces/IProjectRepository';
import { Project, CreateProjectInput, UpdateProjectInput, generateProjectId } from '../../domain/entities/Project';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileSystemProjectRepository implements IProjectRepository {
  private storageDir: string;

  constructor(baseDir: string) {
    this.storageDir = path.join(baseDir, 'projects');
  }

  async findAll(): Promise<Project[]> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const files = await fs.readdir(this.storageDir);
      const projects: Project[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.storageDir, file), 'utf-8');
          projects.push(JSON.parse(content));
        }
      }

      // Sort by updatedAt descending (most recent first)
      return projects.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      console.error('Error reading projects:', error);
      return [];
    }
  }

  async findById(id: string): Promise<Project | null> {
    try {
      const filePath = path.join(this.storageDir, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async create(data: CreateProjectInput): Promise<Project> {
    await fs.mkdir(this.storageDir, { recursive: true });

    const now = new Date().toISOString();
    const project: Project = {
      id: generateProjectId(),
      name: data.name,
      description: data.description,
      repoUrl: data.repoUrl,
      localPath: data.localPath,
      createdAt: now,
      updatedAt: now,
    };

    const filePath = path.join(this.storageDir, `${project.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
    return project;
  }

  async update(id: string, data: UpdateProjectInput): Promise<Project> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    const updated: Project = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.storageDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  async delete(id: string): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${id}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }
}
