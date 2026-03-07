import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GetConnectedAccountsUseCase,
  GetProviderSettingsUseCase,
  SetProviderClientIdUseCase,
  StartDeviceFlowUseCase,
  CompleteDeviceFlowUseCase,
  ConnectWithAppPasswordUseCase,
  DisconnectProviderUseCase,
  ListReposUseCase,
  PushFilesUseCase,
  CreatePRUseCase,
  ListMarketplaceSnippetsUseCase,
  GetSnippetUseCase,
  PublishSnippetUseCase,
} from '../GitProviderUseCases';
import type {
  ProviderType,
  GitUser,
  GitRepo,
  GitPROptions,
  GitPRResult,
  GitSnippet,
  GitFileEntry,
  GitSnippetFile,
  DeviceFlowInit,
  IGitProvider,
} from '../../../domain/interfaces/IGitProvider';

// ── Shared test data ──────────────────────────────────────────────────────────

const MOCK_GITHUB_USER: GitUser = {
  login: 'octocat',
  name: 'The Octocat',
  avatar_url: 'https://github.com/images/error/octocat.png',
  email: 'octocat@github.com',
  provider: 'github',
};

const MOCK_GITLAB_USER: GitUser = {
  login: 'gitlabuser',
  name: 'GitLab User',
  avatar_url: 'https://gitlab.com/avatar.png',
  provider: 'gitlab',
};

const MOCK_REPOS: GitRepo[] = [
  { id: 1, name: 'Hello-World', full_name: 'octocat/Hello-World', private: false, description: 'My first repo', html_url: 'https://github.com/octocat/Hello-World', default_branch: 'main', provider: 'github' },
  { id: 2, name: 'Spoon-Knife', full_name: 'octocat/Spoon-Knife', private: false, description: 'A fork test repo', html_url: 'https://github.com/octocat/Spoon-Knife', default_branch: 'main', provider: 'github' },
];

const MOCK_PR_RESULT: GitPRResult = {
  number: 42,
  url: 'https://github.com/octocat/Hello-World/pull/42',
  title: 'Add agent config',
};

const MOCK_SNIPPET: GitSnippet = {
  id: 'abc123',
  description: 'My gist [agent-orchestrator]',
  html_url: 'https://gist.github.com/abc123',
  public: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  owner_login: 'octocat',
  files: {
    'agent.md': { filename: 'agent.md', content: '# Agent' },
  },
  provider: 'github',
};

const MOCK_DEVICE_FLOW: DeviceFlowInit = {
  device_code: 'device_code_123',
  user_code: 'ABCD-1234',
  verification_url: 'https://github.com/login/device',
  expires_in: 900,
  interval: 5,
};

const MOCK_SETTINGS = {
  github: { clientId: 'gh_client_id' },
  gitlab: { clientId: 'gl_client_id', baseUrl: 'https://gitlab.com' },
  bitbucket: {},
};

// ── Mock provider factory ─────────────────────────────────────────────────────

function makeMockProvider(type: ProviderType, overrides: Partial<IGitProvider> = {}): IGitProvider {
  return {
    type,
    startDeviceFlow: vi.fn().mockResolvedValue(MOCK_DEVICE_FLOW),
    pollDeviceFlow: vi.fn().mockResolvedValue('access_token_123'),
    validateToken: vi.fn().mockResolvedValue(MOCK_GITHUB_USER),
    saveToken: vi.fn().mockResolvedValue(undefined),
    getToken: vi.fn().mockResolvedValue('access_token_123'),
    clearToken: vi.fn().mockResolvedValue(undefined),
    getAuthenticatedUser: vi.fn().mockResolvedValue(type === 'github' ? MOCK_GITHUB_USER : MOCK_GITLAB_USER),
    listRepositories: vi.fn().mockResolvedValue(MOCK_REPOS),
    pushFilesToBranch: vi.fn().mockResolvedValue(undefined),
    createPullRequest: vi.fn().mockResolvedValue(MOCK_PR_RESULT),
    listMarketplaceSnippets: vi.fn().mockResolvedValue([MOCK_SNIPPET]),
    getSnippet: vi.fn().mockResolvedValue(MOCK_SNIPPET),
    publishSnippet: vi.fn().mockResolvedValue(MOCK_SNIPPET),
    ...overrides,
  };
}

// ── Mock GitProviderService factory ───────────────────────────────────────────

function makeMockService(providerOverrides: Partial<Record<ProviderType, Partial<IGitProvider>>> = {}) {
  const providers: Record<ProviderType, IGitProvider> = {
    github: makeMockProvider('github', providerOverrides.github),
    gitlab: makeMockProvider('gitlab', providerOverrides.gitlab),
    bitbucket: makeMockProvider('bitbucket', providerOverrides.bitbucket),
  };

  return {
    get: vi.fn((type: ProviderType) => providers[type]),
    all: vi.fn(() => Object.values(providers)),
    loadSettings: vi.fn().mockResolvedValue(MOCK_SETTINGS),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    getClientId: vi.fn().mockResolvedValue('test_client_id'),
    setClientId: vi.fn().mockResolvedValue(undefined),
    getConnectedAccounts: vi.fn().mockResolvedValue([
      { type: 'github', user: MOCK_GITHUB_USER },
      { type: 'gitlab', user: MOCK_GITLAB_USER },
    ]),
    _providers: providers,
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GitProviderUseCases', () => {
  // ── GetConnectedAccountsUseCase ────────────────────────────────────────────

  describe('GetConnectedAccountsUseCase', () => {
    it('returns all connected accounts from the service', async () => {
      const svc = makeMockService();
      const useCase = new GetConnectedAccountsUseCase(svc);

      const accounts = await useCase.execute();

      expect(svc.getConnectedAccounts).toHaveBeenCalled();
      expect(accounts).toHaveLength(2);
      expect(accounts[0].type).toBe('github');
      expect(accounts[1].type).toBe('gitlab');
    });

    it('returns empty array when no accounts are connected', async () => {
      const svc = makeMockService();
      svc.getConnectedAccounts.mockResolvedValue([]);
      const useCase = new GetConnectedAccountsUseCase(svc);

      const accounts = await useCase.execute();
      expect(accounts).toEqual([]);
    });
  });

  // ── GetProviderSettingsUseCase ─────────────────────────────────────────────

  describe('GetProviderSettingsUseCase', () => {
    it('returns provider settings from the service', async () => {
      const svc = makeMockService();
      const useCase = new GetProviderSettingsUseCase(svc);

      const settings = await useCase.execute();

      expect(svc.loadSettings).toHaveBeenCalled();
      expect(settings.github?.clientId).toBe('gh_client_id');
      expect(settings.gitlab?.clientId).toBe('gl_client_id');
    });
  });

  // ── SetProviderClientIdUseCase ─────────────────────────────────────────────

  describe('SetProviderClientIdUseCase', () => {
    it('saves the client ID for a provider', async () => {
      const svc = makeMockService();
      const useCase = new SetProviderClientIdUseCase(svc);

      await useCase.execute('github', 'new_client_id');

      expect(svc.setClientId).toHaveBeenCalledWith('github', 'new_client_id');
    });
  });

  // ── StartDeviceFlowUseCase ─────────────────────────────────────────────────

  describe('StartDeviceFlowUseCase', () => {
    it('initiates device flow for a provider', async () => {
      const svc = makeMockService();
      const useCase = new StartDeviceFlowUseCase(svc);

      const init = await useCase.execute('github');

      expect(svc.getClientId).toHaveBeenCalledWith('github');
      expect(svc.get).toHaveBeenCalledWith('github');
      expect(init.user_code).toBe('ABCD-1234');
      expect(init.verification_url).toBe('https://github.com/login/device');
    });

    it('throws when no client ID is configured', async () => {
      const svc = makeMockService();
      svc.getClientId.mockResolvedValue(undefined);
      const useCase = new StartDeviceFlowUseCase(svc);

      await expect(useCase.execute('github')).rejects.toThrow('No OAuth App client_id configured for github');
    });
  });

  // ── CompleteDeviceFlowUseCase ──────────────────────────────────────────────

  describe('CompleteDeviceFlowUseCase', () => {
    it('polls for access token and returns authenticated user', async () => {
      const svc = makeMockService();
      const useCase = new CompleteDeviceFlowUseCase(svc);

      const user = await useCase.execute('github', MOCK_DEVICE_FLOW);

      expect(svc._providers.github.pollDeviceFlow).toHaveBeenCalled();
      expect(svc._providers.github.saveToken).toHaveBeenCalledWith('access_token_123');
      expect(user.login).toBe('octocat');
    });

    it('throws when no client ID is configured', async () => {
      const svc = makeMockService();
      svc.getClientId.mockResolvedValue(undefined);
      const useCase = new CompleteDeviceFlowUseCase(svc);

      await expect(useCase.execute('github', MOCK_DEVICE_FLOW)).rejects.toThrow('No OAuth App client_id configured for github');
    });

    it('throws when user fetch fails after obtaining token', async () => {
      const svc = makeMockService({
        github: { getAuthenticatedUser: vi.fn().mockResolvedValue(null) },
      });
      const useCase = new CompleteDeviceFlowUseCase(svc);

      await expect(useCase.execute('github', MOCK_DEVICE_FLOW)).rejects.toThrow('Token obtained but could not fetch user');
    });
  });

  // ── ConnectWithAppPasswordUseCase ──────────────────────────────────────────

  describe('ConnectWithAppPasswordUseCase', () => {
    it('validates credentials and saves token for Bitbucket', async () => {
      const svc = makeMockService();
      const bbUser: GitUser = { login: 'bbuser', avatar_url: 'https://bb.com/avatar.png', provider: 'bitbucket' };
      svc._providers.bitbucket.validateToken = vi.fn().mockResolvedValue(bbUser);
      const useCase = new ConnectWithAppPasswordUseCase(svc);

      const user = await useCase.execute('bitbucket', 'app_password', { username: 'bbuser' });

      expect(svc._providers.bitbucket.validateToken).toHaveBeenCalledWith('app_password', { username: 'bbuser' });
      expect(svc._providers.bitbucket.saveToken).toHaveBeenCalledWith('app_password');
      expect(user.login).toBe('bbuser');
    });

    it('throws when credentials are invalid', async () => {
      const svc = makeMockService({
        bitbucket: { validateToken: vi.fn().mockResolvedValue(null) },
      });
      const useCase = new ConnectWithAppPasswordUseCase(svc);

      await expect(useCase.execute('bitbucket', 'bad_password')).rejects.toThrow('Invalid credentials for bitbucket');
    });
  });

  // ── DisconnectProviderUseCase ──────────────────────────────────────────────

  describe('DisconnectProviderUseCase', () => {
    it('clears the token for a provider', async () => {
      const svc = makeMockService();
      const useCase = new DisconnectProviderUseCase(svc);

      await useCase.execute('github');

      expect(svc._providers.github.clearToken).toHaveBeenCalled();
    });
  });

  // ── ListReposUseCase ───────────────────────────────────────────────────────

  describe('ListReposUseCase', () => {
    it('returns repositories from the specified provider', async () => {
      const svc = makeMockService();
      const useCase = new ListReposUseCase(svc);

      const repos = await useCase.execute('github');

      expect(svc._providers.github.listRepositories).toHaveBeenCalled();
      expect(repos).toHaveLength(2);
      expect(repos[0].name).toBe('Hello-World');
    });

    it('returns empty array when no repos exist', async () => {
      const svc = makeMockService({
        github: { listRepositories: vi.fn().mockResolvedValue([]) },
      });
      const useCase = new ListReposUseCase(svc);

      const repos = await useCase.execute('github');
      expect(repos).toEqual([]);
    });
  });

  // ── PushFilesUseCase ───────────────────────────────────────────────────────

  describe('PushFilesUseCase', () => {
    it('pushes files to a branch via the provider', async () => {
      const svc = makeMockService();
      const useCase = new PushFilesUseCase(svc);
      const files: GitFileEntry[] = [{ path: '.github/copilot.md', content: '# Agent' }];

      await useCase.execute('github', 'owner', 'repo', 'main', 'feature', files, 'Add agent');

      expect(svc._providers.github.pushFilesToBranch).toHaveBeenCalledWith(
        'owner', 'repo', 'main', 'feature', files, 'Add agent'
      );
    });
  });

  // ── CreatePRUseCase ────────────────────────────────────────────────────────

  describe('CreatePRUseCase', () => {
    it('creates a pull request via the provider', async () => {
      const svc = makeMockService();
      const useCase = new CreatePRUseCase(svc);
      const options: GitPROptions = {
        owner: 'octocat',
        repo: 'Hello-World',
        title: 'Add agent config',
        body: 'This PR adds agent configuration.',
        head: 'feature',
        base: 'main',
      };

      const result = await useCase.execute('github', options);

      expect(svc._providers.github.createPullRequest).toHaveBeenCalledWith(options);
      expect(result.number).toBe(42);
      expect(result.url).toContain('pull/42');
    });
  });

  // ── ListMarketplaceSnippetsUseCase ─────────────────────────────────────────

  describe('ListMarketplaceSnippetsUseCase', () => {
    it('returns marketplace snippets from the provider', async () => {
      const svc = makeMockService();
      const useCase = new ListMarketplaceSnippetsUseCase(svc);

      const snippets = await useCase.execute('github');

      expect(svc._providers.github.listMarketplaceSnippets).toHaveBeenCalled();
      expect(snippets).toHaveLength(1);
      expect(snippets[0].description).toContain('agent-orchestrator');
    });
  });

  // ── GetSnippetUseCase ──────────────────────────────────────────────────────

  describe('GetSnippetUseCase', () => {
    it('returns a snippet by ID from the provider', async () => {
      const svc = makeMockService();
      const useCase = new GetSnippetUseCase(svc);

      const snippet = await useCase.execute('github', 'abc123');

      expect(svc._providers.github.getSnippet).toHaveBeenCalledWith('abc123');
      expect(snippet.id).toBe('abc123');
    });
  });

  // ── PublishSnippetUseCase ──────────────────────────────────────────────────

  describe('PublishSnippetUseCase', () => {
    it('publishes a snippet via the provider', async () => {
      const svc = makeMockService();
      const useCase = new PublishSnippetUseCase(svc);
      const files: GitSnippetFile[] = [{ filename: 'agent.md', content: '# My Agent' }];

      const snippet = await useCase.execute('github', 'My agent', files, true);

      expect(svc._providers.github.publishSnippet).toHaveBeenCalledWith('My agent', files, true);
      expect(snippet.id).toBe('abc123');
    });

    it('passes isPublic=false for private snippets', async () => {
      const svc = makeMockService();
      const useCase = new PublishSnippetUseCase(svc);
      const files: GitSnippetFile[] = [{ filename: 'secret.md', content: '# Secret' }];

      await useCase.execute('github', 'Private snippet', files, false);

      expect(svc._providers.github.publishSnippet).toHaveBeenCalledWith('Private snippet', files, false);
    });
  });
});
