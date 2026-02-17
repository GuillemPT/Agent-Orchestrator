import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitCommitOptions {
  message: string;
  files?: string[];
  push?: boolean;
}

export interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

/**
 * GitService - Service for Git operations with atomic commits
 */
export class GitService {
  constructor(private repoPath: string = process.cwd()) {}

  /**
   * Check if the current directory is a Git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: this.repoPath });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current Git status
   */
  async getStatus(): Promise<GitStatus> {
    const isRepo = await this.isGitRepository();
    if (!isRepo) {
      throw new Error('Not a Git repository');
    }

    const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: this.repoPath });
    const branch = branchOut.trim();

    const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: this.repoPath });
    const lines = statusOut.split('\n').filter(line => line.trim());

    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];
    const untracked: string[] = [];

    lines.forEach(line => {
      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status.includes('M')) modified.push(file);
      else if (status.includes('A')) added.push(file);
      else if (status.includes('D')) deleted.push(file);
      else if (status.includes('?')) untracked.push(file);
    });

    // Get ahead/behind info
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: aheadBehind } = await execAsync(
        `git rev-list --left-right --count @{u}...HEAD`,
        { cwd: this.repoPath }
      );
      const parts = aheadBehind.trim().split(/\s+/);
      behind = parseInt(parts[0], 10) || 0;
      ahead = parseInt(parts[1], 10) || 0;
    } catch {
      // No upstream branch
    }

    return { branch, modified, added, deleted, untracked, ahead, behind };
  }

  /**
   * Add files to staging area
   */
  async add(files: string[] = ['.']): Promise<void> {
    const isRepo = await this.isGitRepository();
    if (!isRepo) {
      throw new Error('Not a Git repository');
    }

    const filesArg = files.join(' ');
    await execAsync(`git add ${filesArg}`, { cwd: this.repoPath });
  }

  /**
   * Commit changes with a message
   */
  async commit(message: string): Promise<void> {
    const isRepo = await this.isGitRepository();
    if (!isRepo) {
      throw new Error('Not a Git repository');
    }

    // Escape quotes in commit message
    const escapedMessage = message.replace(/"/g, '\\"');
    await execAsync(`git commit -m "${escapedMessage}"`, { cwd: this.repoPath });
  }

  /**
   * Push commits to remote
   */
  async push(remote: string = 'origin', branch?: string): Promise<void> {
    const isRepo = await this.isGitRepository();
    if (!isRepo) {
      throw new Error('Not a Git repository');
    }

    const branchArg = branch ? ` ${branch}` : '';
    await execAsync(`git push ${remote}${branchArg}`, { cwd: this.repoPath });
  }

  /**
   * Perform an atomic commit and optionally push
   * This is the main method for the "atomic git commit" feature
   */
  async atomicCommit(options: GitCommitOptions): Promise<void> {
    const isRepo = await this.isGitRepository();
    if (!isRepo) {
      throw new Error('Not a Git repository');
    }

    try {
      // Add specified files or all changes
      await this.add(options.files || ['.']);

      // Commit with message
      await this.commit(options.message);

      // Push if requested
      if (options.push) {
        await this.push();
      }
    } catch (error: any) {
      throw new Error(`Git operation failed: ${error.message}`);
    }
  }

  /**
   * Create a .gitignore file with common patterns
   */
  async createGitignore(patterns: string[]): Promise<void> {
    const gitignorePath = `${this.repoPath}/.gitignore`;
    const content = patterns.join('\n') + '\n';
    await fs.writeFile(gitignorePath, content, 'utf-8');
  }

  /**
   * Add patterns to existing .gitignore
   */
  async addToGitignore(patterns: string[]): Promise<void> {
    const gitignorePath = `${this.repoPath}/.gitignore`;
    
    try {
      const existing = await fs.readFile(gitignorePath, 'utf-8');
      const newContent = existing + '\n' + patterns.join('\n') + '\n';
      await fs.writeFile(gitignorePath, newContent, 'utf-8');
    } catch {
      // File doesn't exist, create it
      await this.createGitignore(patterns);
    }
  }
}
