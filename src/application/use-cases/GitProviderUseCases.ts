import { GitProviderService } from '../../infrastructure/services/GitProviderService';
import type { ProviderType, GitUser, GitRepo, GitPROptions, GitPRResult, GitSnippet, GitSnippetFile, GitFileEntry, OAuthAppConfig, DeviceFlowInit } from '../../domain/interfaces/IGitProvider';

export class GetConnectedAccountsUseCase {
  constructor(private svc: GitProviderService) {}
  execute() { return this.svc.getConnectedAccounts(); }
}

export class GetProviderSettingsUseCase {
  constructor(private svc: GitProviderService) {}
  execute() { return this.svc.loadSettings(); }
}

export class SetProviderClientIdUseCase {
  constructor(private svc: GitProviderService) {}
  execute(type: ProviderType, clientId: string) { return this.svc.setClientId(type, clientId); }
}

// ── Device Flow (GitHub + GitLab) ──────────────────────────────────────────

export class StartDeviceFlowUseCase {
  constructor(private svc: GitProviderService) {}
  async execute(type: ProviderType): Promise<DeviceFlowInit> {
    const clientId = await this.svc.getClientId(type);
    if (!clientId) throw new Error(`No OAuth App client_id configured for ${type}. Go to Settings to add it.`);
    return this.svc.get(type).startDeviceFlow({ clientId });
  }
}

export class CompleteDeviceFlowUseCase {
  constructor(private svc: GitProviderService) {}
  async execute(type: ProviderType, init: DeviceFlowInit): Promise<GitUser> {
    const clientId = await this.svc.getClientId(type);
    if (!clientId) throw new Error(`No OAuth App client_id configured for ${type}.`);
    const provider = this.svc.get(type);
    const token = await provider.pollDeviceFlow({ clientId }, init);
    await provider.saveToken(token);
    const user = await provider.getAuthenticatedUser();
    if (!user) throw new Error('Token obtained but could not fetch user — check app scopes.');
    return user;
  }
}

// ── Bitbucket App Password ─────────────────────────────────────────────────

export class ConnectWithAppPasswordUseCase {
  constructor(private svc: GitProviderService) {}
  async execute(type: ProviderType, token: string, extra?: Record<string, string>): Promise<GitUser> {
    const provider = this.svc.get(type);
    const user = await provider.validateToken(token, extra);
    if (!user) throw new Error(`Invalid credentials for ${type}.`);
    await provider.saveToken(token);
    return user;
  }
}

// ── Disconnect ────────────────────────────────────────────────────────────

export class DisconnectProviderUseCase {
  constructor(private svc: GitProviderService) {}
  execute(type: ProviderType) { return this.svc.get(type).clearToken(); }
}

// ── Repos ─────────────────────────────────────────────────────────────────

export class ListReposUseCase {
  constructor(private svc: GitProviderService) {}
  execute(type: ProviderType): Promise<GitRepo[]> { return this.svc.get(type).listRepositories(); }
}

// ── PR creation ───────────────────────────────────────────────────────────

export class PushFilesUseCase {
  constructor(private svc: GitProviderService) {}
  execute(type: ProviderType, owner: string, repo: string, baseBranch: string, newBranch: string, files: GitFileEntry[], message: string) {
    return this.svc.get(type).pushFilesToBranch(owner, repo, baseBranch, newBranch, files, message);
  }
}

export class CreatePRUseCase {
  constructor(private svc: GitProviderService) {}
  execute(type: ProviderType, options: GitPROptions): Promise<GitPRResult> {
    return this.svc.get(type).createPullRequest(options);
  }
}

// ── Marketplace (Snippets) ────────────────────────────────────────────────

export class ListMarketplaceSnippetsUseCase {
  constructor(private svc: GitProviderService) {}
  execute(type: ProviderType): Promise<GitSnippet[]> { return this.svc.get(type).listMarketplaceSnippets(); }
}

export class GetSnippetUseCase {
  constructor(private svc: GitProviderService) {}
  execute(type: ProviderType, id: string): Promise<GitSnippet> { return this.svc.get(type).getSnippet(id); }
}

export class PublishSnippetUseCase {
  constructor(private svc: GitProviderService) {}
  execute(type: ProviderType, description: string, files: GitSnippetFile[], isPublic: boolean): Promise<GitSnippet> {
    return this.svc.get(type).publishSnippet(description, files, isPublic);
  }
}
