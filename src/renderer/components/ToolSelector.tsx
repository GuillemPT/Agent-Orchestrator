import { useState, useEffect } from 'react';
import '../styles/ToolSelector.css';

interface MCPTool {
  name: string;
  description: string;
  category?: string;
  enabled: boolean;
}

interface ToolSelectorProps {
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
}

function ToolSelector({ selectedTools, onToolsChange }: ToolSelectorProps) {
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAvailableTools();
  }, []);

  const loadAvailableTools = async () => {
    try {
      setIsLoading(true);
      const tools = await (window as any).api.mcp.getAvailableTools();
      
      // Mark tools as enabled based on selectedTools
      const toolsWithState = tools.map((tool: MCPTool) => ({
        ...tool,
        enabled: selectedTools.includes(tool.name),
      }));
      
      setAvailableTools(toolsWithState);
    } catch (error) {
      console.error('Failed to load available tools:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadAvailableTools();
      return;
    }

    try {
      setIsLoading(true);
      const tools = await (window as any).api.mcp.searchTools(searchQuery);
      
      const toolsWithState = tools.map((tool: MCPTool) => ({
        ...tool,
        enabled: selectedTools.includes(tool.name),
      }));
      
      setAvailableTools(toolsWithState);
    } catch (error) {
      console.error('Failed to search tools:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTool = (toolName: string) => {
    const isEnabled = selectedTools.includes(toolName);
    let newSelectedTools: string[];

    if (isEnabled) {
      newSelectedTools = selectedTools.filter(t => t !== toolName);
    } else {
      newSelectedTools = [...selectedTools, toolName];
    }

    onToolsChange(newSelectedTools);

    // Update local state
    setAvailableTools(tools =>
      tools.map(tool =>
        tool.name === toolName ? { ...tool, enabled: !isEnabled } : tool
      )
    );
  };

  const categories = ['All', ...new Set(availableTools.map(t => t.category || 'Other'))];
  
  const filteredTools = selectedCategory === 'All'
    ? availableTools
    : availableTools.filter(t => (t.category || 'Other') === selectedCategory);

  return (
    <div className="tool-selector">
      <div className="tool-selector-header">
        <h4>MCP Tools Registry</h4>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-sm" onClick={handleSearch}>
            🔍 Search
          </button>
        </div>
      </div>

      <div className="category-filter">
        {categories.map(category => (
          <button
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading">Loading tools...</div>
      ) : (
        <div className="tools-grid">
          {filteredTools.map(tool => (
            <div
              key={tool.name}
              className={`tool-card ${tool.enabled ? 'enabled' : ''}`}
              onClick={() => toggleTool(tool.name)}
            >
              <div className="tool-header">
                <span className="tool-name">{tool.name}</span>
                <input
                  type="checkbox"
                  checked={tool.enabled}
                  onChange={() => {}}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="tool-description">{tool.description}</div>
              {tool.category && (
                <div className="tool-category">{tool.category}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="selected-tools-summary">
        <strong>Selected Tools ({selectedTools.length}):</strong>{' '}
        {selectedTools.length === 0 ? (
          <span className="no-tools">No tools selected</span>
        ) : (
          selectedTools.join(', ')
        )}
      </div>
    </div>
  );
}

export default ToolSelector;
