/**
 * Project entity - represents a user's project that groups agents, skills, and MCP configs
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  repoUrl?: string;           // Optional link to Git repository
  localPath?: string;         // Optional local workspace path
  deletedAt?: string | null;  // Soft delete timestamp (null = active)
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  repoUrl?: string;
  localPath?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  repoUrl?: string;
  localPath?: string;
}

/**
 * Generate unique project ID
 */
export function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
