import { ISyncService, SyncOptions } from '@domain/interfaces/ISyncService';

export class SyncCopilotDirectoriesUseCase {
  constructor(private syncService: ISyncService) {}

  async execute(options: SyncOptions): Promise<void> {
    await this.syncService.syncCopilotDirectories(options);
  }
}

export class DetectChangesUseCase {
  constructor(private syncService: ISyncService) {}

  async execute(): Promise<{ github: string[]; home: string[] }> {
    return await this.syncService.detectChanges();
  }
}
