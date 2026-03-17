import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth, type Session } from './auth';
import { prisma } from './db';

// Import routes
import projects from './routes/projects';
import agents from './routes/agents';
import skills from './routes/skills';
import mcps from './routes/mcps';
import git from './routes/git';
import generate from './routes/generate';

// Create the main Hono app
const app = new Hono<{ Variables: { session: Session | null } }>();

// Global middleware
app.use('*', logger());
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];

app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return origin;
      }
      // Allow configured production domains
      if (CORS_ORIGINS.some(allowed => origin === allowed || origin.endsWith(allowed))) {
        return origin;
      }
      return null;
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

// Add session to all requests
app.use('*', async (c, next) => {
  let session = await auth.api.getSession({ headers: c.req.raw.headers });
  
  // DEV-ONLY: fallback to dev_session_user cookie
  if (!session && process.env.NODE_ENV !== 'production') {
    const cookies = c.req.header('cookie') || '';
    const match = cookies.match(/dev_session_user=([^;]+)/);
    if (match) {
      const user = await prisma.user.findUnique({ where: { id: match[1] } });
      if (user) {
        session = { user: { id: user.id, email: user.email, name: user.name || '', image: user.avatar || '' }, session: { id: 'dev', token: 'dev', userId: user.id, expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(), updatedAt: new Date() } } as any;
      }
    }
  }
  
  c.set('session', session);
  await next();
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DEV-ONLY: bypass login for QA testing
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/dev-login', async (c) => {
    const user = await prisma.user.upsert({
      where: { email: 'test@qa.local' },
      update: {},
      create: { id: 'test-user-qa', email: 'test@qa.local', name: 'QA Tester' },
    });
    const token = 'dev-session-' + Date.now();
    await prisma.session.create({
      data: {
        sessionToken: token,
        userId: user.id,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    // BetterAuth stores the session token in a signed cookie, but in dev
    // we can set it via the raw cookie header and bypass the signing.
    // Instead, we'll fake the session in a simpler way:
    // set a plain cookie that our middleware can pick up.
    c.header('Set-Cookie', `dev_session_user=${user.id}; Path=/; HttpOnly; SameSite=Lax`);
    return c.redirect('/');
  });

  // DEV-ONLY: logout by clearing the dev cookie
  app.post('/api/dev-logout', (c) => {
    c.header('Set-Cookie', 'dev_session_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return c.json({ ok: true });
  });
}

// Explicit sign-out handler (clears both BetterAuth and dev sessions)
app.post('/api/auth/sign-out', async (c) => {
  // Clear dev session cookie if present
  c.header('Set-Cookie', 'dev_session_user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  // Delegate to BetterAuth to clear OAuth session
  try {
    const response = await auth.handler(c.req.raw);
    // Copy BetterAuth set-cookie headers to clear the session cookie
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) c.header('Set-Cookie', setCookie);
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: true });
  }
});

// Which OAuth providers are actually configured?
app.get('/api/auth/providers', (c) => {
  const gh = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  const gl = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return c.json({
    github: gh,
    google: gl,
    devLogin: process.env.NODE_ENV !== 'production',
  });
});

// Better Auth handler - handles all /api/auth/* routes
app.on(['GET', 'POST'], '/api/auth/**', (c) => {
  return auth.handler(c.req.raw);
});

// Mount API routes
app.route('/api/projects', projects);
app.route('/api/agents', agents);
app.route('/api/skills', skills);
app.route('/api/mcps', mcps);
app.route('/api/git', git);
app.route('/api/generate', generate);

// User profile endpoint
app.get('/api/me', async (c) => {
  const session = c.get('session');
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      createdAt: true,
    },
  });

  return c.json(user);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json(
    {
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

// Export for different deployment targets
export default app;

// Node.js native server (for local development)
import { serve } from '@hono/node-server';

const port = parseInt(process.env.PORT ?? '3001', 10);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});
