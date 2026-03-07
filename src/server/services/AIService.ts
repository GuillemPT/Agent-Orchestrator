import OpenAI from 'openai';

const PROVIDER_DEFAULTS: Record<string, { baseURL: string; model: string }> = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
  },
};

function getConfig() {
  const provider = process.env.AI_PROVIDER ?? 'groq';
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.groq;

  return {
    provider,
    baseURL: process.env.AI_BASE_URL || defaults.baseURL,
    apiKey: process.env.AI_API_KEY || 'none',
    model: process.env.AI_MODEL || defaults.model,
  };
}

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  const cfg = getConfig();
  if (!_client) {
    _client = new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL,
    });
  }
  return _client;
}

/** Reset client (e.g. after settings change). */
export function resetAIClient() {
  _client = null;
}

export function isAIConfigured(): boolean {
  const cfg = getConfig();
  // Ollama doesn't need a real key
  if (cfg.provider === 'ollama') return true;
  return !!cfg.apiKey && cfg.apiKey !== 'none';
}

// ── Agent generation ──────────────────────────────────────────────────

const AGENT_SYSTEM_PROMPT = `You are an expert AI agent designer. Given a natural-language description, generate a complete Agent definition as a JSON object.

The JSON must have this exact shape:
{
  "metadata": {
    "name": "<concise agent name>",
    "version": "1.0.0",
    "description": "<one-paragraph description>",
    "tags": ["<tag1>", "<tag2>", ...],
    "compatibility": ["github-copilot", "claude-code", "opencode", "cursor", "antigravity"]
  },
  "skills": [],
  "mcpConfig": {
    "tools": ["<tool1>", "<tool2>", ...],
    "target": ""
  },
  "instructions": "<detailed multi-paragraph instructions in Markdown telling the AI assistant how to behave as this agent>"
}

Rules:
- "instructions" should be thorough (at least 200 words) and written as if talking directly to an AI assistant.
- "tags" should include 3–6 relevant keywords.
- "mcpConfig.tools" should list relevant MCP tool names the agent would need (e.g. "file_search", "run_in_terminal", "semantic_search"). Leave empty if unsure.
- Output ONLY the JSON object, no markdown fences, no extra text.`;

export async function generateAgent(prompt: string): Promise<Record<string, unknown>> {
  const cfg = getConfig();
  const client = getClient();

  const response = await client.chat.completions.create({
    model: cfg.model,
    messages: [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('AI returned an empty response');

  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned);

  // Basic validation
  if (!parsed.metadata?.name || !parsed.instructions) {
    throw new Error('AI response missing required fields (metadata.name, instructions)');
  }

  return parsed;
}

// ── Skill generation ──────────────────────────────────────────────────

const SKILL_SYSTEM_PROMPT = `You are an expert AI skill designer. Given a natural-language description, generate a complete Skill definition as a JSON object.

The JSON must have this exact shape:
{
  "metadata": {
    "name": "<concise skill name>",
    "version": "1.0.0",
    "description": "<one-paragraph description>",
    "category": "<one of: coding, testing, devops, design, documentation, architecture, security, other>"
  },
  "markdown": "<detailed Markdown instructions (at least 300 words) explaining the skill, best practices, patterns, and examples>",
  "yaml": {
    "content": "<YAML configuration frontmatter for the skill file>",
    "schema": ""
  },
  "scripts": []
}

Rules:
- "markdown" is the main body of the skill — write it as detailed instructions for an AI coding assistant.
- "yaml.content" should be valid YAML frontmatter (name, description, applyTo glob patterns).
- Output ONLY the JSON object, no markdown fences, no extra text.`;

export async function generateSkill(prompt: string): Promise<Record<string, unknown>> {
  const cfg = getConfig();
  const client = getClient();

  const response = await client.chat.completions.create({
    model: cfg.model,
    messages: [
      { role: 'system', content: SKILL_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('AI returned an empty response');

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(cleaned);

  if (!parsed.metadata?.name || !parsed.markdown) {
    throw new Error('AI response missing required fields (metadata.name, markdown)');
  }

  return parsed;
}
