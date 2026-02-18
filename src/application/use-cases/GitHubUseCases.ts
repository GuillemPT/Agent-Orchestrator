import {
  GitHubService,
  GitHubUser,
  GitHubRepo,
  PROptions,
  PRResult,
  GistItem,
} from '../../infrastructure/services/GitHubService';

export class SaveGitHubTokenUseCase {
  constructor(private svc: GitHubService) {}
  async execute(token: string): Promise<GitHubUser> {
    const user = await this.svc.validateToken(token);
    if (!user) throw new Error('Invalid GitHub token');
    await this.svc.saveToken(token);
    return user;
  }
}

export class GetGitHubUserUseCase {
  constructor(private svc: GitHubService) {}
  async execute(): Promise<GitHubUser | null> {
    return this.svc.getAuthenticatedUser();
  }
}

export class ClearGitHubTokenUseCase {
  constructor(private svc: GitHubService) {}
  async execute(): Promise<void> {
    return this.svc.clearToken();
  }
}

export class ListGitHubReposUseCase {
  constructor(private svc: GitHubService) {}
  async execute(): Promise<GitHubRepo[]> {
    return this.svc.listRepositories();
  }
}

export class CreatePullRequestUseCase {
  constructor(private svc: GitHubService) {}
  async execute(options: PROptions): Promise<PRResult> {
    return this.svc.createPullRequest(options);
  }
}

export class GetMarketplaceGistsUseCase {
  constructor(private svc: GitHubService) {}
  async execute(): Promise<GistItem[]> {
    return this.svc.searchMarketplaceGists();
  }
}

export class GetGistUseCase {
  constructor(private svc: GitHubService) {}
  async execute(id: string): Promise<GistItem> {
    return this.svc.getGist(id);
  }
}

export class PublishGistUseCase {
  constructor(private svc: GitHubService) {}
  async execute(
    description: string,
    files: { filename: string; content: string }[],
  ): Promise<GistItem> {
    return this.svc.createGist(description, files, true);
  }
}
