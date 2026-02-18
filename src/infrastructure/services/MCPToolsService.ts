/**
 * MCPToolsService - Service to fetch and manage MCP tools from GitHub's registry
 */

export interface MCPTool {
  name: string;
  description: string;
  category?: string;
  enabled: boolean;
}

export class MCPToolsService {
  // TODO: Use this URL when implementing actual GitHub API integration
  // private static GITHUB_MCP_REGISTRY_URL = 'https://api.github.com/repos/modelcontextprotocol/servers/contents/src';
  
  /**
   * Fetch available MCP tools from GitHub's registry
   * This is a placeholder implementation - in production this would make actual API calls
   */
  async fetchAvailableTools(): Promise<MCPTool[]> {
    // TODO: Implement actual GitHub API call when registry is available
    // For now, return a curated list of common MCP tools
    return [
      { name: 'filesystem', description: 'Access and manipulate files on the local filesystem', category: 'System', enabled: false },
      { name: 'git', description: 'Git repository operations and version control', category: 'Development', enabled: false },
      { name: 'github', description: 'GitHub API integration for repository management', category: 'Development', enabled: false },
      { name: 'postgres', description: 'PostgreSQL database operations', category: 'Database', enabled: false },
      { name: 'sqlite', description: 'SQLite database operations', category: 'Database', enabled: false },
      { name: 'puppeteer', description: 'Browser automation and web scraping', category: 'Automation', enabled: false },
      { name: 'slack', description: 'Slack messaging and workspace management', category: 'Communication', enabled: false },
      { name: 'brave-search', description: 'Web search using Brave Search API', category: 'Search', enabled: false },
      { name: 'google-maps', description: 'Google Maps integration for location services', category: 'Location', enabled: false },
      { name: 'memory', description: 'Persistent memory and context management', category: 'System', enabled: false },
      { name: 'time', description: 'Time and date utilities', category: 'Utilities', enabled: false },
      { name: 'fetch', description: 'HTTP requests and API calls', category: 'Network', enabled: false },
      { name: 'sequential-thinking', description: 'Enhanced reasoning and planning capabilities', category: 'AI', enabled: false },
      { name: 'aws', description: 'AWS cloud services integration', category: 'Cloud', enabled: false },
      { name: 'kubernetes', description: 'Kubernetes cluster management', category: 'DevOps', enabled: false },
      { name: 'docker', description: 'Docker container management', category: 'DevOps', enabled: false },
      { name: 'everart', description: 'AI image generation service', category: 'AI', enabled: false },
      { name: 'sentry', description: 'Error tracking and monitoring', category: 'Monitoring', enabled: false },
    ];
  }

  /**
   * Get tools grouped by category
   */
  async getToolsByCategory(): Promise<Map<string, MCPTool[]>> {
    const tools = await this.fetchAvailableTools();
    const grouped = new Map<string, MCPTool[]>();

    tools.forEach(tool => {
      const category = tool.category || 'Other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(tool);
    });

    return grouped;
  }

  /**
   * Search tools by name or description
   */
  async searchTools(query: string): Promise<MCPTool[]> {
    const tools = await this.fetchAvailableTools();
    const lowerQuery = query.toLowerCase();

    return tools.filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    );
  }
}
