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
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return origin;
      }
      // Add production domains here
      return null;
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

// Add session to all requests
app.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set('session', session);
  await next();
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
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
      image: true,
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
