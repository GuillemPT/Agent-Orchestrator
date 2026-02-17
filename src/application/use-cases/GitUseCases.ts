import { GitService, GitCommitOptions, GitStatus } from '@infrastructure/services/GitService';

export class GetGitStatusUseCase {
  constructor(private gitService: GitService) {}

  async execute(): Promise<GitStatus> {
    return await this.gitService.getStatus();
  }
}

export class AtomicCommitUseCase {
  constructor(private gitService: GitService) {}

  async execute(options: GitCommitOptions): Promise<void> {
    return await this.gitService.atomicCommit(options);
  }
}

export class CheckGitRepositoryUseCase {
  constructor(private gitService: GitService) {}

  async execute(): Promise<boolean> {
    return await this.gitService.isGitRepository();
  }
}
