import * as path from 'path';
import * as fs from 'fs/promises';
import { ISecureStorage } from '../../domain/interfaces/ISecureStorage';
import type { IGitProvider, ProviderType, ProviderConfig } from '../../domain/interfaces/IGitProvider';
import { GitHubProvider } from './providers/GitHubProvider';
import { GitLabProvider } from './providers/GitLabProvider';
import { BitbucketProvider } from './providers/BitbucketProvider';

export interface ProviderSettings {
  github?: { clientId?: string; baseUrl?: string };
  gitlab?: { clientId?: string; baseUrl?: string };
  bitbucket?: { clientId?: string };
}

/**
 * Holds the three provider instances and persists OAuth app client IDs
 * in a JSON config file (secrets stay in the system keyring via ISecureStorage).
 */
export class GitProviderService {
  private readonly providers: Record<ProviderType, IGitProvider>;
  private settingsPath: string;

  constructor(storage: ISecureStorage, dataDir: string) {
    this.settingsPath = path.join(dataDir, 'git-providers.json');
    this.providers = {
      github: new GitHubProvider(storage),
      gitlab: new GitLabProvider(storage),
      bitbucket: new BitbucketProvider(storage),
    };
  }

  get(type: ProviderType): IGitProvider {
    return this.providers[type];
  }

  all(): IGitProvider[] {
    return Object.values(this.providers);
  }

  // ── Per-provider OAuth App config (client IDs stored on disk) ────────────

  async loadSettings(): Promise<ProviderSettings> {
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf-8');
      return JSON.parse(raw) as ProviderSettings;
    } catch {
      return {};
    }
  }

  async saveSettings(settings: ProviderSettings): Promise<void> {
    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
    await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  async getClientId(type: ProviderType): Promise<string | undefined> {
    const settings = await this.loadSettings();
    return settings[type]?.clientId;
  }

  async setClientId(type: ProviderType, clientId: string): Promise<void> {
    const settings = await this.loadSettings();
    settings[type] = { ...(settings[type] ?? {}), clientId };
    await this.saveSettings(settings);
  }

  async setBaseUrl(type: 'gitlab', baseUrl: string): Promise<void> {
    const settings = await this.loadSettings();
    settings[type] = { ...(settings[type] ?? {}), baseUrl };
    await this.saveSettings(settings);
    // Recreate provider with new base URL
    const storage = (this.providers.gitlab as GitLabProvider)['storage' as any];
    this.providers.gitlab = new GitLabProvider(storage, baseUrl);
  }

  /** Returns connected users for all providers that have a token. */
  async getConnectedAccounts(): Promise<{ type: ProviderType; user: import('../../domain/interfaces/IGitProvider').GitUser }[]> {
    const results: { type: ProviderType; user: import('../../domain/interfaces/IGitProvider').GitUser }[] = [];
    for (const provider of this.all()) {
      const user = await provider.getAuthenticatedUser().catch(() => null);
      if (user) results.push({ type: provider.type, user });
    }
    return results;
  }

  /** Metadata for UI (label, icon colour, help links) */
  static getProviderInfo(type: ProviderType): ProviderConfig & { color: string; docsUrl: string; oauthAppUrl: string; supportsDeviceFlow: boolean } {
    const info = {
      github: {
        type: 'github' as ProviderType,
        label: 'GitHub',
        color: '#24292f',
        docsUrl: 'https://docs.github.com/en/developers/apps/building-oauth-apps',
        oauthAppUrl: 'https://github.com/settings/apps/new',
        supportsDeviceFlow: true,
      },
      gitlab: {
        type: 'gitlab' as ProviderType,
        label: 'GitLab',
        color: '#fc6d26',
        docsUrl: 'https://docs.gitlab.com/ee/api/oauth2.html',
        oauthAppUrl: 'https://gitlab.com/-/profile/applications',
        supportsDeviceFlow: true,
      },
      bitbucket: {
        type: 'bitbucket' as ProviderType,
        label: 'Bitbucket',
        color: '#0052cc',
        docsUrl: 'https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/',
        oauthAppUrl: 'https://bitbucket.org/account/settings/app-passwords/',
        supportsDeviceFlow: false,
      },
    };
    return info[type];
  }
}
