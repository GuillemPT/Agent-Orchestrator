import { useState, useEffect } from 'react';
import ToolSelector from './ToolSelector';
import '../styles/AgentEditor.css';

interface Agent {
  id: string;
  metadata: {
    name: string;
    version: string;
    description: string;
    author?: string;
    tags?: string[];
    compatibility: string[];
  };
  skills: any[];
  mcpConfig: {
    tools?: string[];
    target?: string;
  };
  instructions?: string;
}

interface AgentEditorProps {
  agentId: string | null;
  onAgentChange: (id: string | null) => void;
}

function AgentEditor({ agentId, onAgentChange }: AgentEditorProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showToolSelector, setShowToolSelector] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (agentId) {
      loadAgent(agentId);
    }
  }, [agentId]);

  const loadAgents = async () => {
    try {
      const loadedAgents = await (window as any).api.agent.getAll();
      setAgents(loadedAgents);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadAgent = async (id: string) => {
    try {
      const agent = await (window as any).api.agent.getById(id);
      setCurrentAgent(agent);
    } catch (error) {
      console.error('Failed to load agent:', error);
    }
  };

  const createNewAgent = async () => {
    try {
      const newAgent = await (window as any).api.agent.create({
        metadata: {
          name: 'New Agent',
          version: '1.0.0',
          description: '',
          compatibility: ['github-copilot', 'claude-code', 'opencode', 'cursor', 'antigravity'],
        },
        skills: [],
        mcpConfig: { tools: [], target: '' },
      });
      setAgents([...agents, newAgent]);
      onAgentChange(newAgent.id);
      setIsEditing(true);
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const saveAgent = async () => {
    if (!currentAgent) return;

    try {
      await (window as any).api.agent.update(currentAgent.id, currentAgent);
      setIsEditing(false);
      loadAgents();
    } catch (error) {
      console.error('Failed to save agent:', error);
    }
  };

  const deleteAgent = async () => {
    if (!currentAgent) return;

    if (confirm(`Are you sure you want to delete "${currentAgent.metadata.name}"?`)) {
      try {
        await (window as any).api.agent.delete(currentAgent.id);
        setCurrentAgent(null);
        onAgentChange(null);
        loadAgents();
      } catch (error) {
        console.error('Failed to delete agent:', error);
      }
    }
  };

  const exportToMd = async () => {
    if (!currentAgent) return;

    try {
      const markdown = await (window as any).api.agent.exportToMd(currentAgent);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentAgent.metadata.name}.agent.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export agent:', error);
    }
  };

  const updateField = (path: string[], value: any) => {
    if (!currentAgent) return;

    const updated = { ...currentAgent };
    let obj: any = updated;
    for (let i = 0; i < path.length - 1; i++) {
      obj = obj[path[i]];
    }
    obj[path[path.length - 1]] = value;
    setCurrentAgent(updated);
  };

  const addTool = () => {
    if (!currentAgent) return;
    const tools = currentAgent.mcpConfig.tools || [];
    updateField(['mcpConfig', 'tools'], [...tools, '']);
  };

  const removeTool = (index: number) => {
    if (!currentAgent) return;
    const tools = currentAgent.mcpConfig.tools || [];
    updateField(['mcpConfig', 'tools'], tools.filter((_, i) => i !== index));
  };

  const updateTool = (index: number, value: string) => {
    if (!currentAgent) return;
    const tools = [...(currentAgent.mcpConfig.tools || [])];
    tools[index] = value;
    updateField(['mcpConfig', 'tools'], tools);
  };

  return (
    <div className="agent-editor">
      <div className="editor-header">
        <h2>Agent Editor</h2>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={createNewAgent}>
            + New Agent
          </button>
        </div>
      </div>

      <div className="editor-content">
        <div className="agent-list">
          <h3>Agents</h3>
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`agent-item ${agentId === agent.id ? 'active' : ''}`}
              onClick={() => onAgentChange(agent.id)}
            >
              <div className="agent-name">{agent.metadata.name}</div>
              <div className="agent-version">{agent.metadata.version}</div>
            </div>
          ))}
        </div>

        <div className="agent-details">
          {currentAgent ? (
            <>
              <div className="details-header">
                <h3>{isEditing ? 'Edit Agent' : currentAgent.metadata.name}</h3>
                <div className="details-actions">
                  {!isEditing ? (
                    <>
                      <button className="btn" onClick={() => setIsEditing(true)}>
                        Edit
                      </button>
                      <button className="btn" onClick={exportToMd}>
                        Export .md
                      </button>
                      <button className="btn btn-danger" onClick={deleteAgent}>
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-primary" onClick={saveAgent}>
                        Save
                      </button>
                      <button className="btn" onClick={() => setIsEditing(false)}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="form-section">
                <h4>Metadata</h4>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={currentAgent.metadata.name}
                    onChange={(e) => updateField(['metadata', 'name'], e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="form-group">
                  <label>Version</label>
                  <input
                    type="text"
                    value={currentAgent.metadata.version}
                    onChange={(e) => updateField(['metadata', 'version'], e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={currentAgent.metadata.description}
                    onChange={(e) => updateField(['metadata', 'description'], e.target.value)}
                    disabled={!isEditing}
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label>Author</label>
                  <input
                    type="text"
                    value={currentAgent.metadata.author || ''}
                    onChange={(e) => updateField(['metadata', 'author'], e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>MCP Configuration</h4>
                <div className="form-group">
                  <label>Target</label>
                  <select
                    value={currentAgent.mcpConfig.target || ''}
                    onChange={(e) => updateField(['mcpConfig', 'target'], e.target.value)}
                    disabled={!isEditing}
                  >
                    <option value="">Select target environment</option>
                    <option value="vscode">VS Code</option>
                    <option value="github">GitHub.com</option>
                    <option value="workspace">Workspace</option>
                    <option value="user">User</option>
                    <option value="global">Global</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Tools</label>
                  {isEditing && (
                    <button 
                      className="btn btn-sm" 
                      onClick={() => setShowToolSelector(!showToolSelector)}
                      style={{ marginBottom: '0.5rem' }}
                    >
                      {showToolSelector ? '✕ Hide' : '🔧 Select from Registry'}
                    </button>
                  )}
                  
                  {showToolSelector && isEditing && (
                    <ToolSelector
                      selectedTools={currentAgent.mcpConfig.tools || []}
                      onToolsChange={(tools) => updateField(['mcpConfig', 'tools'], tools)}
                    />
                  )}
                  
                  {currentAgent.mcpConfig.tools?.map((tool, index) => (
                    <div key={index} className="tool-item">
                      <input
                        type="text"
                        value={tool}
                        onChange={(e) => updateTool(index, e.target.value)}
                        disabled={!isEditing}
                        placeholder="Tool name"
                      />
                      {isEditing && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => removeTool(index)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <button className="btn btn-sm" onClick={addTool}>
                      + Add Tool Manually
                    </button>
                  )}
                </div>
              </div>

              <div className="form-section">
                <h4>Instructions</h4>
                <div className="form-group">
                  <textarea
                    value={currentAgent.instructions || ''}
                    onChange={(e) => updateField(['instructions'], e.target.value)}
                    disabled={!isEditing}
                    rows={10}
                    placeholder="Enter custom instructions for the agent..."
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select an agent to view details or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentEditor;
