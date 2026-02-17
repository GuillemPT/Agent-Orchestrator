export interface SyncOptions {
  direction: 'toGithub' | 'toHome' | 'bidirectional';
  conflictResolution: 'newer' | 'github' | 'home' | 'manual';
}

export interface ISyncService {
  syncCopilotDirectories(options: SyncOptions): Promise<void>;
  detectChanges(): Promise<{ github: string[]; home: string[] }>;
  resolveConflicts(files: string[], resolution: SyncOptions['conflictResolution']): Promise<void>;
}
