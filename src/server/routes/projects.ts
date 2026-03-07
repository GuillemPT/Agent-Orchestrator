import { Hono } from 'hono';
import { prisma } from '../db';
import { auth } from '../auth';
import type { Session } from '../auth';

const projects = new Hono<{ Variables: { session: Session | null } }>();

// Middleware: require authentication
const requireAuth = async (c: any, next: any) => {
  const session = c.get('session');
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

// List all projects for the authenticated user
projects.get('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  
  const userProjects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { agents: true, skills: true, mcps: true },
      },
    },
  });
  
  return c.json(userProjects);
});

// Get a single project
projects.get('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: {
      agents: { select: { id: true, name: true, version: true, updatedAt: true } },
      skills: { select: { id: true, name: true, updatedAt: true } },
      mcps: { select: { id: true, label: true, updatedAt: true } },
    },
  });
  
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  return c.json(project);
});

// Create a new project
projects.post('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();
  
  const project = await prisma.project.create({
    data: {
      userId: session.user.id,
      name: body.name,
      repoUrl: body.repoUrl ?? null,
    },
  });
  
  return c.json(project, 201);
});

// Update a project
projects.put('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const body = await c.req.json();
  
  // Verify ownership
  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });
  
  if (!existing) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  const project = await prisma.project.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      repoUrl: body.repoUrl ?? existing.repoUrl,
    },
  });
  
  return c.json(project);
});

// Delete a project
projects.delete('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  // Verify ownership
  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });
  
  if (!existing) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  await prisma.project.delete({ where: { id } });
  
  return c.json({ success: true });
});

export default projects;
