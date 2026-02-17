import { ISyncService, SyncOptions } from '@domain/interfaces/ISyncService';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { watch } from 'chokidar';

export class CopilotSyncService implements ISyncService {
  private homeDir: string;
  private githubDir: string;

  constructor(projectRoot?: string) {
    this.homeDir = path.join(os.homedir(), '.copilot');
    this.githubDir = projectRoot
      ? path.join(projectRoot, '.github')
      : path.join(process.cwd(), '.github');
  }

  async syncCopilotDirectories(options: SyncOptions): Promise<void> {
    const { direction, conflictResolution } = options;

    // Ensure directories exist
    await fs.mkdir(this.homeDir, { recursive: true });
    await fs.mkdir(this.githubDir, { recursive: true });

    switch (direction) {
      case 'toGithub':
        await this.copyDirectory(this.homeDir, this.githubDir, conflictResolution);
        break;
      case 'toHome':
        await this.copyDirectory(this.githubDir, this.homeDir, conflictResolution);
        break;
      case 'bidirectional':
        await this.bidirectionalSync(conflictResolution);
        break;
    }
  }

  async detectChanges(): Promise<{ github: string[]; home: string[] }> {
    const githubFiles = await this.getFileList(this.githubDir);
    const homeFiles = await this.getFileList(this.homeDir);

    return {
      github: githubFiles,
      home: homeFiles,
    };
  }

  async resolveConflicts(files: string[], resolution: SyncOptions['conflictResolution']): Promise<void> {
    for (const file of files) {
      const githubPath = path.join(this.githubDir, file);
      const homePath = path.join(this.homeDir, file);

      try {
        const githubStat = await fs.stat(githubPath);
        const homeStat = await fs.stat(homePath);

        let sourceFile: string;
        let destFile: string;

        switch (resolution) {
          case 'newer':
            if (githubStat.mtime > homeStat.mtime) {
              sourceFile = githubPath;
              destFile = homePath;
            } else {
              sourceFile = homePath;
              destFile = githubPath;
            }
            break;
          case 'github':
            sourceFile = githubPath;
            destFile = homePath;
            break;
          case 'home':
            sourceFile = homePath;
            destFile = githubPath;
            break;
          default:
            continue; // Skip manual resolution
        }

        await fs.copyFile(sourceFile, destFile);
      } catch (error) {
        console.error(`Error resolving conflict for ${file}:`, error);
      }
    }
  }

  private async copyDirectory(
    source: string,
    dest: string,
    conflictResolution: SyncOptions['conflictResolution']
  ): Promise<void> {
    try {
      const files = await this.getFileList(source);

      for (const file of files) {
        const sourcePath = path.join(source, file);
        const destPath = path.join(dest, file);

        // Check if file exists in destination
        try {
          await fs.access(destPath);
          // File exists, resolve conflict
          await this.resolveConflicts([file], conflictResolution);
        } catch {
          // File doesn't exist, copy it
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(sourcePath, destPath);
        }
      }
    } catch (error) {
      console.error('Error copying directory:', error);
      throw error;
    }
  }

  private async bidirectionalSync(conflictResolution: SyncOptions['conflictResolution']): Promise<void> {
    const changes = await this.detectChanges();
    const allFiles = new Set([...changes.github, ...changes.home]);

    for (const file of allFiles) {
      const githubPath = path.join(this.githubDir, file);
      const homePath = path.join(this.homeDir, file);

      const githubExists = await this.fileExists(githubPath);
      const homeExists = await this.fileExists(homePath);

      if (githubExists && !homeExists) {
        await fs.mkdir(path.dirname(homePath), { recursive: true });
        await fs.copyFile(githubPath, homePath);
      } else if (!githubExists && homeExists) {
        await fs.mkdir(path.dirname(githubPath), { recursive: true });
        await fs.copyFile(homePath, githubPath);
      } else if (githubExists && homeExists) {
        await this.resolveConflicts([file], conflictResolution);
      }
    }
  }

  private async getFileList(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(dir, fullPath);

        if (entry.isDirectory()) {
          const subFiles = await this.getFileList(fullPath);
          files.push(...subFiles.map((f) => path.join(relativePath, f)));
        } else {
          files.push(relativePath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is inaccessible
      return [];
    }

    return files;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  watchForChanges(callback: (path: string, event: string) => void): void {
    const watcher = watch([this.homeDir, this.githubDir], {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('all', (event, filePath) => {
      callback(filePath, event);
    });
  }
}
