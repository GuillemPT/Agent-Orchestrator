import { Hono } from 'hono';
import { prisma } from '../db';
import type { Session } from '../auth';

const skills = new Hono<{ Variables: { session: Session | null } }>();

// Middleware: require authentication
const requireAuth = async (c: any, next: any) => {
  const session = c.get('session');
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};

// Helper: verify project ownership
const verifyProject = async (projectId: string, userId: string) => {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  });
};

// List all skills for a project (or all if no projectId given)
skills.get('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const projectId = c.req.query('projectId');
  
  if (projectId) {
    const project = await verifyProject(projectId, session.user.id);
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
  }
  
  const skillList = await prisma.skill.findMany({
    where: projectId
      ? { projectId }
      : { project: { userId: session.user.id, deletedAt: null } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      projectId: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  return c.json(skillList);
});

// Get a single skill
skills.get('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  const skill = await prisma.skill.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!skill || skill.project.userId !== session.user.id) {
    return c.json({ error: 'Skill not found' }, 404);
  }
  
  const content = JSON.parse(skill.content);
  return c.json({
    id: skill.id,
    projectId: skill.projectId,
    name: skill.name,
    ...content,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  });
});

// Create a new skill
skills.post('/', requireAuth, async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json();
  
  const projectId = body.projectId;
  if (!projectId) {
    return c.json({ error: 'projectId required' }, 400);
  }
  
  const project = await verifyProject(projectId, session.user.id);
  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }
  
  const { name, ...contentData } = body;
  
  const skill = await prisma.skill.create({
    data: {
      projectId,
      name: name ?? 'New Skill',
      content: JSON.stringify(contentData),
    },
  });
  
  return c.json({
    id: skill.id,
    projectId: skill.projectId,
    name: skill.name,
    ...contentData,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  }, 201);
});

// Update a skill
skills.put('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const existing = await prisma.skill.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'Skill not found' }, 404);
  }
  
  const { name, ...contentData } = body;
  
  const skill = await prisma.skill.update({
    where: { id },
    data: {
      name: name ?? existing.name,
      content: JSON.stringify(contentData),
    },
  });
  
  return c.json({
    id: skill.id,
    projectId: skill.projectId,
    name: skill.name,
    ...contentData,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  });
});

// Delete a skill
skills.delete('/:id', requireAuth, async (c) => {
  const session = c.get('session')!;
  const id = c.req.param('id');
  
  const existing = await prisma.skill.findFirst({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  
  if (!existing || existing.project.userId !== session.user.id) {
    return c.json({ error: 'Skill not found' }, 404);
  }
  
  await prisma.skill.delete({ where: { id } });
  
  return c.json({ success: true });
});

// ── Export ───────────────────────────────────────────────────────────────────

function exportSkillForCopilot(skill: any): string {
  let md = '---\n';
  md += `name: ${skill.metadata.name}\n`;
  md += `version: ${skill.metadata.version}\n`;
  md += `description: ${skill.metadata.description}\n`;
  if (skill.metadata.category) md += `category: ${skill.metadata.category}\n`;
  md += '---\n\n';
  md += `# ${skill.metadata.name}\n\n`;
  md += `**Version:** ${skill.metadata.version}\n\n`;
  md += `**Description:** ${skill.metadata.description}\n\n`;
  if (skill.metadata.category) md += `**Category:** ${skill.metadata.category}\n\n`;
  if (skill.markdown) md += skill.markdown;
  if (skill.scripts?.length) {
    md += '\n## Scripts\n\n';
    skill.scripts.forEach((s: any) => { md += `### ${s.language}\n\n\`\`\`${s.language}\n${s.content}\n\`\`\`\n\n`; });
  }
  return md;
}

function exportSkillPlainMarkdown(skill: any): string {
  let md = `# ${skill.metadata.name}\n\n> ${skill.metadata.description}\n\n`;
  if (skill.metadata.category) md += `**Category:** ${skill.metadata.category}  \n`;
  md += `**Version:** ${skill.metadata.version}\n\n`;
  if (skill.markdown) md += skill.markdown + '\n\n';
  if (skill.scripts?.length) {
    md += '## Scripts\n\n';
    skill.scripts.forEach((s: any) => { md += `\`\`\`${s.language}\n${s.content}\n\`\`\`\n\n`; });
  }
  return md;
}

function exportSkillToMd(skill: any, platform: string = 'github-copilot'): string {
  switch (platform) {
    case 'claude':
    case 'opencode': return exportSkillPlainMarkdown(skill);
    case 'cursor': {
      let mdc = `---\ndescription: ${skill.metadata.description}\nglobs:\nalwaysApply: false\n---\n\n`;
      mdc += `# ${skill.metadata.name}\n\n`;
      if (skill.markdown) mdc += skill.markdown + '\n\n';
      if (skill.scripts?.length) {
        mdc += '## Scripts\n\n';
        skill.scripts.forEach((s: any) => { mdc += `\`\`\`${s.language}\n${s.content}\n\`\`\`\n\n`; });
      }
      return mdc;
    }
    case 'antigravity': return JSON.stringify({
      name: skill.metadata.name, version: skill.metadata.version,
      description: skill.metadata.description, category: skill.metadata.category,
      scripts: (skill.scripts || []).map((s: any) => ({ language: s.language, path: s.path })),
    }, null, 2);
    default: return exportSkillForCopilot(skill);
  }
}

function exportSkillToYaml(skill: any): string {
  if (skill.yaml?.content) return skill.yaml.content;
  // Simple YAML generation without external dep
  let yaml = `name: ${JSON.stringify(skill.metadata.name)}\n`;
  yaml += `version: ${JSON.stringify(skill.metadata.version)}\n`;
  yaml += `description: ${JSON.stringify(skill.metadata.description)}\n`;
  if (skill.metadata.category) yaml += `category: ${JSON.stringify(skill.metadata.category)}\n`;
  if (skill.scripts?.length) {
    yaml += 'scripts:\n';
    skill.scripts.forEach((s: any) => {
      yaml += `  - language: ${JSON.stringify(s.language)}\n`;
      if (s.path) yaml += `    path: ${JSON.stringify(s.path)}\n`;
    });
  }
  return yaml;
}

// Export skill to markdown
skills.post('/export-md', requireAuth, async (c) => {
  const body = await c.req.json();
  const { skill, platform } = body;
  if (!skill) return c.json({ error: 'skill required' }, 400);
  return c.json(exportSkillToMd(skill, platform));
});

// Export skill to YAML
skills.post('/export-yaml', requireAuth, async (c) => {
  const body = await c.req.json();
  const { skill } = body;
  if (!skill) return c.json({ error: 'skill required' }, 400);
  return c.json(exportSkillToYaml(skill));
});

export default skills;
