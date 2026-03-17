import { Hono } from 'hono';
import { prisma } from '../db';
import type { Session } from '../auth';
import type { ISecureStorage } from '../../domain/interfaces/ISecureStorage';
import type { IGitProvider, ProviderType } from '../../domain/interfaces/IGitProvider';
import { GitHubProvider } from '../../infrastructure/services/providers/GitHubProvider';
import { GitLabProvider } from '../../infrastructure/services/providers/GitLabProvider';
import { BitbucketProvider } from '../../infrastructure/services/providers/BitbucketProvider';

// ── Lightweight ISecureStorage that holds a pre-set token ─────────────────
class StaticSecureStorage implements ISecureStorage {
  constructor(private token: string) {}
  async setPassword() {}
  async getPassword() { return this.token; }
  async deletePassword() { return true; }
  async findCredentials() { return [{ account: 'token', password: this.token }]; }
}

function createProvider(provider: string, token: string): IGitProvider {
  const storage = new StaticSecureStorage(token);
  switch (provider) {
    case 'github':    return new GitHubProvider(storage);
    case 'gitlab':    return new GitLabProvider(storage);
    case 'bitbucket': return new BitbucketProvider(storage);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

const VALID_PROVIDERS = new Set(['github', 'gitlab', 'bitbucket']);

const git = new Hono<{ Variables: { session: Session | null } }>();

// Middleware: require authentication
const requireAuth = async (c: any, next: any) => {
  const session = c.get('session');
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

// Helper: get user's git token for a provider
const getToken = async (userId: string, provider: string) => {
  const gitToken = await prisma.gitToken.findFirst({
    where: { userId, provider },
  });
  return gitToken?.token ?? null;
};

// List connected providers (which have tokens stored)
git.get('/providers', requireAuth, async (c) => {
  const session = c.get('session')!;
  
  const tokens = await prisma.gitToken.findMany({
    where: { userId: session.user.id },
    select: { provider: true },
  });
  
  return c.json(tokens.map((t: { provider: string }) => t.provider));
});

// Connect a provider (store token)
git.post('/providers/:provider/connect', requireAuth, async (c) => {
  const session = c.get('session')!;
  const provider = c.req.param('provider');
  const body = await c.req.json();
  
  if (!VALID_PROVIDERS.has(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }
  
  if (!body.token) {
    return c.json({ error: 'Token required' }, 400);
  }
  
  // Upsert the token
  await prisma.gitToken.upsert({
    where: {
      userId_provider: {
        userId: session.user.id,
        provider,
      },
    },
    create: {
      userId: session.user.id,
      provider,
      token: body.token,
    },
    update: {
      token: body.token,
    },
  });
  
  return c.json({ success: true });
});

// Disconnect a provider (remove token)
git.delete('/providers/:provider/disconnect', requireAuth, async (c) => {
  const session = c.get('session')!;
  const provider = c.req.param('provider');
  
  await prisma.gitToken.deleteMany({
    where: {
      userId: session.user.id,
      provider,
    },
  });
  
  return c.json({ success: true });
});

// List repositories for a provider
git.get('/providers/:provider/repos', requireAuth, async (c) => {
  const session = c.get('session')!;
  const provider = c.req.param('provider');
  
  if (!VALID_PROVIDERS.has(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  const token = await getToken(session.user.id, provider);
  if (!token) {
    return c.json({ error: 'Provider not connected' }, 401);
  }

  const p = createProvider(provider, token);
  const repos = await p.listRepositories();
  return c.json(repos);
});

// Create a pull request / merge request
git.post('/providers/:provider/pull-requests', requireAuth, async (c) => {
  const session = c.get('session')!;
  const provider = c.req.param('provider');
  const body = await c.req.json();
  
  if (!VALID_PROVIDERS.has(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  const token = await getToken(session.user.id, provider);
  if (!token) {
    return c.json({ error: 'Provider not connected' }, 401);
  }
  
  const { owner, repo, title, body: prBody, head, base, files } = body;
  
  if (!owner || !repo || !title || !head || !base) {
    return c.json(
      { error: 'Missing required fields: owner, repo, title, head, base' },
      400
    );
  }

  const p = createProvider(provider, token);

  // Push files to head branch if provided
  if (files?.length) {
    await p.pushFilesToBranch(owner, repo, base, head, files, `chore: add files for PR "${title}"`);
  }

  const result = await p.createPullRequest({ owner, repo, title, body: prBody ?? '', head, base });
  return c.json(result);
});

// List all repos from all connected providers at once
git.get('/repos', requireAuth, async (c) => {
  const session = c.get('session')!;
  const providerFilter = c.req.query('provider');

  const tokens = await prisma.gitToken.findMany({
    where: {
      userId: session.user.id,
      ...(providerFilter ? { provider: providerFilter } : {}),
    },
  });

  const allRepos = await Promise.all(
    tokens.map(async (t: { provider: string; token: string }) => {
      try {
        const p = createProvider(t.provider, t.token);
        return await p.listRepositories();
      } catch (err) {
        console.error(`Failed to list repos for ${t.provider}:`, err);
        return [];
      }
    })
  );

  return c.json(allRepos.flat());
});

// Get connected accounts with user info
git.get('/accounts', requireAuth, async (c) => {
  const session = c.get('session')!;

  const tokens = await prisma.gitToken.findMany({
    where: { userId: session.user.id },
  });

  const accounts = await Promise.all(
    tokens.map(async (t: { provider: string; token: string }) => {
      try {
        const p = createProvider(t.provider, t.token);
        const user = await p.getAuthenticatedUser();
        return user ? { type: t.provider as ProviderType, user } : null;
      } catch {
        return null;
      }
    })
  );

  return c.json(accounts.filter(Boolean));
});

// Push files to a branch
git.post('/push-files', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();
  const { type, owner, repo, baseBranch, newBranch, files, message } = body;

  if (!type || !owner || !repo || !baseBranch || !newBranch || !files?.length || !message) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const token = await getToken(session.user.id, type);
  if (!token) {
    return c.json({ error: 'Provider not connected' }, 401);
  }

  const p = createProvider(type, token);
  await p.pushFilesToBranch(owner, repo, baseBranch, newBranch, files, message);
  return c.json({ success: true });
});

// Create a pull request (alternative flat route)
git.post('/pull-requests', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();
  const { type, owner, repo, title, body: prBody, head, base } = body;

  if (!type || !owner || !repo || !title || !head || !base) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const token = await getToken(session.user.id, type);
  if (!token) {
    return c.json({ error: 'Provider not connected' }, 401);
  }

  const p = createProvider(type, token);
  const result = await p.createPullRequest({ owner, repo, title, body: prBody ?? '', head, base });
  return c.json(result);
});

// Get marketplace snippets (gists/snippets from providers)
git.get('/snippets', requireAuth, async (c) => {
  const session = c.get('session')!;
  const providerFilter = c.req.query('provider');
  
  const tokens = await prisma.gitToken.findMany({
    where: {
      userId: session.user.id,
      ...(providerFilter ? { provider: providerFilter } : {}),
    },
  });
  
  if (tokens.length === 0) {
    return c.json([]);
  }

  const allSnippets = await Promise.all(
    tokens.map(async (t: { provider: string; token: string }) => {
      try {
        const p = createProvider(t.provider, t.token);
        return await p.listMarketplaceSnippets();
      } catch (err) {
        console.error(`Failed to list snippets for ${t.provider}:`, err);
        return [];
      }
    })
  );

  return c.json(allSnippets.flat());
});

// Get a single snippet
git.get('/snippets/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const provider = c.req.query('provider');

  if (!provider) {
    return c.json({ error: 'provider query param required' }, 400);
  }

  const token = await getToken(session.user.id, provider);
  if (!token) {
    return c.json({ error: 'Provider not connected' }, 401);
  }

  const p = createProvider(provider, token);
  const snippet = await p.getSnippet(id);
  return c.json(snippet);
});

// Publish to marketplace (create gist/snippet)
git.post('/snippets', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();
  const { type, description, files, isPublic } = body;
  
  if (!type || !description || !files?.length) {
    return c.json({ error: 'Missing required fields: type, description, files' }, 400);
  }
  
  const token = await getToken(session.user.id, type);
  if (!token) {
    return c.json({ error: 'Provider not connected' }, 401);
  }

  const p = createProvider(type, token);
  const snippet = await p.publishSnippet(description, files, isPublic ?? true);
  return c.json(snippet);
});
// ── Git Provider Settings & Device Flow ─────────────────────────────────────

// In-memory store for OAuth App client IDs (per user, per provider).
// These are non-secret identifiers; lost on server restart (user re-enters).
const clientIdStore = new Map<string, Record<string, string>>();

// GET /settings — return stored client IDs for the current user
git.get('/settings', requireAuth, async (c) => {
  const session = c.get('session')!;
  const userSettings = clientIdStore.get(session.user.id) ?? {};
  const result: Record<string, { clientId?: string }> = {};
  for (const [provider, clientId] of Object.entries(userSettings)) {
    result[provider] = { clientId };
  }
  return c.json(result);
});

// PUT /settings — save a client ID for a provider
git.put('/settings', requireAuth, async (c) => {
  const session = c.get('session')!;
  const { type, clientId } = await c.req.json();

  if (!type || !clientId || !VALID_PROVIDERS.has(type)) {
    return c.json({ error: 'Invalid type or clientId' }, 400);
  }

  const existing = clientIdStore.get(session.user.id) ?? {};
  existing[type] = clientId;
  clientIdStore.set(session.user.id, existing);
  return c.json({ success: true });
});

// POST /device-flow/start — initiate OAuth Device Flow
git.post('/device-flow/start', requireAuth, async (c) => {
  const session = c.get('session')!;
  const { type } = await c.req.json();

  if (!type || !VALID_PROVIDERS.has(type)) {
    return c.json({ error: 'Invalid provider type' }, 400);
  }

  const userSettings = clientIdStore.get(session.user.id) ?? {};
  const clientId = userSettings[type];
  if (!clientId) {
    return c.json({ error: 'Client ID not configured. Save it in Settings first.' }, 400);
  }

  // Device flow doesn't need an existing token — use an empty placeholder
  const storage = new StaticSecureStorage('');
  let provider: IGitProvider;
  switch (type) {
    case 'github':  provider = new GitHubProvider(storage);  break;
    case 'gitlab':  provider = new GitLabProvider(storage);  break;
    default:
      return c.json({ error: 'Device flow not supported for this provider' }, 400);
  }

  try {
    const init = await provider.startDeviceFlow({ clientId });
    return c.json(init);
  } catch (err: any) {
    return c.json({ error: err?.message ?? 'Failed to start device flow' }, 502);
  }
});

// POST /device-flow/complete — poll until user authorises, then store token
git.post('/device-flow/complete', requireAuth, async (c) => {
  const session = c.get('session')!;
  const { type, init } = await c.req.json();

  if (!type || !init || !VALID_PROVIDERS.has(type)) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const userSettings = clientIdStore.get(session.user.id) ?? {};
  const clientId = userSettings[type];
  if (!clientId) {
    return c.json({ error: 'Client ID not configured' }, 400);
  }

  const storage = new StaticSecureStorage('');
  let provider: IGitProvider;
  switch (type) {
    case 'github':  provider = new GitHubProvider(storage);  break;
    case 'gitlab':  provider = new GitLabProvider(storage);  break;
    default:
      return c.json({ error: 'Device flow not supported for this provider' }, 400);
  }

  try {
    const token = await provider.pollDeviceFlow({ clientId }, init);

    // Persist the access token in the database
    await prisma.gitToken.upsert({
      where: { userId_provider: { userId: session.user.id, provider: type } },
      create: { userId: session.user.id, provider: type, token },
      update: { token },
    });

    // Return the authenticated user
    const authedProvider = createProvider(type, token);
    const user = await authedProvider.getAuthenticatedUser();
    return c.json(user);
  } catch (err: any) {
    return c.json({ error: err?.message ?? 'Device flow failed' }, 502);
  }
});

// POST /disconnect — remove a provider's stored token
git.post('/disconnect', requireAuth, async (c) => {
  const session = c.get('session')!;
  const { type } = await c.req.json();

  if (!type || !VALID_PROVIDERS.has(type)) {
    return c.json({ error: 'Invalid provider type' }, 400);
  }

  await prisma.gitToken.deleteMany({
    where: { userId: session.user.id, provider: type },
  });
  return c.json({ success: true });
});

// POST /connect-app-password — validate & store a PAT or app password
git.post('/connect-app-password', requireAuth, async (c) => {
  const session = c.get('session')!;
  const { type, token, extra } = await c.req.json();

  if (!type || !token || !VALID_PROVIDERS.has(type)) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const provider = createProvider(type, token);
  const user = await provider.validateToken(token, extra);
  if (!user) {
    return c.json({ error: 'Invalid token or credentials' }, 401);
  }

  // Store the token (for Bitbucket, encode username:appPassword if needed)
  const storedToken = extra?.username ? `${extra.username}:${token}` : token;
  await prisma.gitToken.upsert({
    where: { userId_provider: { userId: session.user.id, provider: type } },
    create: { userId: session.user.id, provider: type, token: storedToken },
    update: { token: storedToken },
  });

  return c.json(user);
});
export default git;
