import { Hono } from 'hono';
import type { Session } from '../auth';
import { generateAgent, generateSkill, isAIConfigured } from '../services/AIService';

const generate = new Hono<{ Variables: { session: Session | null } }>();

// ── Rate limiting (in-memory) ─────────────────────────────────────────
const RATE_LIMIT = 20;           // max requests
const RATE_WINDOW_MS = 3_600_000; // per hour

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (bucket.count >= RATE_LIMIT) return false;

  bucket.count++;
  return true;
}

// ── Middleware ─────────────────────────────────────────────────────────

const requireAuth = async (c: any, next: any) => {
  const session = c.get('session');
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

const requireAI = async (c: any, next: any) => {
  if (!isAIConfigured()) {
    return c.json({ error: 'AI provider is not configured. Set AI_API_KEY in environment or Settings.' }, 503);
  }
  await next();
};

const rateLimit = async (c: any, next: any) => {
  const session = c.get('session')!;
  if (!checkRateLimit(session.user.id)) {
    return c.json({ error: 'Rate limit exceeded. Max 20 requests per hour.' }, 429);
  }
  await next();
};

// ── Routes ────────────────────────────────────────────────────────────

generate.post('/agent', requireAuth, requireAI, rateLimit, async (c) => {
  const { prompt } = await c.req.json<{ prompt: string }>();

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return c.json({ error: 'prompt is required' }, 400);
  }

  if (prompt.length > 2000) {
    return c.json({ error: 'prompt must be under 2000 characters' }, 400);
  }

  try {
    const agent = await generateAgent(prompt.trim());
    return c.json(agent);
  } catch (err: any) {
    console.error('Agent generation failed:', err);
    return c.json(
      { error: 'Generation failed', message: err?.message ?? 'Unknown error' },
      500
    );
  }
});

generate.post('/skill', requireAuth, requireAI, rateLimit, async (c) => {
  const { prompt } = await c.req.json<{ prompt: string }>();

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return c.json({ error: 'prompt is required' }, 400);
  }

  if (prompt.length > 2000) {
    return c.json({ error: 'prompt must be under 2000 characters' }, 400);
  }

  try {
    const skill = await generateSkill(prompt.trim());
    return c.json(skill);
  } catch (err: any) {
    console.error('Skill generation failed:', err);
    return c.json(
      { error: 'Generation failed', message: err?.message ?? 'Unknown error' },
      500
    );
  }
});

export default generate;
