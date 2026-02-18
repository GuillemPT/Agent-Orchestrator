/**
 * Supported AI platform targets for export.
 */
export type Platform =
  | 'github-copilot'
  | 'claude'
  | 'cursor'
  | 'antigravity'
  | 'opencode';

export const PLATFORM_LABELS: Record<Platform, string> = {
  'github-copilot': 'GitHub Copilot',
  claude: 'Claude',
  cursor: 'Cursor',
  antigravity: 'Antigravity',
  opencode: 'OpenCode',
};

/** Where the exported file should go, per platform. */
export const PLATFORM_OUTPUT_PATHS: Record<Platform, string> = {
  'github-copilot': '.github/copilot-instructions.md',
  claude: 'CLAUDE.md',
  cursor: '.cursor/rules/{name}.mdc',
  antigravity: 'antigravity.config.json',
  opencode: '.opencode/instructions.md',
};
