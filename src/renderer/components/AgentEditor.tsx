import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import ToolSelector from './ToolSelector';
import GenerateModal from './GenerateModal';
import '../styles/AgentEditor.css';
import type { ProviderType, GitUser } from '../types/electron';
import { api } from '../api';

const IS_WEB = import.meta.env.VITE_MODE === 'web';

type Platform = 'github-copilot' | 'claude' | 'cursor' | 'antigravity' | 'opencode';

const PROVIDER_LABELS: Record<ProviderType, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
};

const PLATFORM_LABELS: Record<Platform, string> = {
  'github-copilot': 'GitHub Copilot',
  claude: 'Claude',
  cursor: 'Cursor',
  antigravity: 'Antigravity',
  opencode: 'OpenCode',
};

const PLATFORM_FILENAMES: Record<Platform, string> = {
  'github-copilot': 'copilot-instructions.md',
  claude: 'CLAUDE.md',
  cursor: '{name}.mdc',
  antigravity: 'antigravity.config.json',
  opencode: 'instructions.md',
};

interface Agent {
  id: string;
  projectId?: string;
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
  projectId: string | null;
}

function AgentEditor({ agentId, onAgentChange, projectId }: AgentEditorProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showToolSelector, setShowToolSelector] = useState(false);
  const [exportPlatform, setExportPlatform] = useState<Platform>('github-copilot');

  // PR modal state
  const [showPRModal, setShowPRModal] = useState(false);
  const [prProvider, setPrProvider] = useState<ProviderType>('github');
  const [prOwnerRepo, setPrOwnerRepo] = useState('');
  const [prHead, setPrHead] = useState('');
  const [prBase, setPrBase] = useState('main');
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [prCreating, setPrCreating] = useState(false);
  const [prResult, setPrResult] = useState<{ url: string; number: number } | null>(null);
  const [prError, setPrError] = useState<string | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<{ type: ProviderType; user: GitUser }[]>([]);
  const [allProjects, setAllProjects] = useState<{ id: string; name: string }[]>([]);
  const [contextMenuAgentId, setContextMenuAgentId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');
  const [pushError, setPushError] = useState<string | null>(null);

  // Auto-save in web mode (debounced, 1 s)
  useEffect(() => {
    if (!IS_WEB || !currentAgent || !isEditing) return;
    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await api.agent.update(currentAgent.id, currentAgent);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [currentAgent, isEditing]);

  useEffect(() => {
    api.project.getAll()
      .then(ps => setAllProjects(ps))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.gitProvider.getConnectedAccounts()
      .then(accounts => {
        setConnectedProviders(accounts);
        if (accounts.length > 0 && !accounts.find(a => a.type === prProvider)) {
          setPrProvider(accounts[0].type);
        }
      })
      .catch(() => setConnectedProviders([]));
  }, []);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (agentId) {
      // Reset edit state when switching to a different agent
      setIsEditing(false);
      setShowToolSelector(false);
      loadAgent(agentId);
    } else {
      setIsEditing(false);
      setCurrentAgent(null);
    }
  }, [agentId]);

  // Reload agents when project changes
  useEffect(() => {
    loadAgents();
    setCurrentAgent(null);
    onAgentChange(null);
  }, [projectId]);

  const loadAgents = async () => {
    try {
      const allAgents = await api.agent.getAll();
      // Filter agents by projectId
      // null   → "All Projects" view: show every agent
      // string → specific project: show only agents belonging to it
      const filtered = projectId === null
        ? allAgents
        : allAgents.filter((a: Agent) => a.projectId === projectId);
      setAgents(filtered);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadAgent = async (id: string) => {
    try {
      const agent = await api.agent.getById(id);
      setCurrentAgent(agent);
    } catch (error) {
      console.error('Failed to load agent:', error);
    }
  };

  const createNewAgent = async () => {
    if (!projectId) {
      alert('Please select a project first to create a new agent.');
      return;
    }
    try {
      const newAgent = await api.agent.create({
        projectId,  // Assign to current project
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
      await api.agent.update(currentAgent.id, currentAgent);
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
        await api.agent.delete(currentAgent.id);
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
      const content = await api.agent.exportToMd(currentAgent, exportPlatform);
      const isJson = exportPlatform === 'antigravity';
      const mimeType = isJson ? 'application/json' : 'text/markdown';
      const filename = PLATFORM_FILENAMES[exportPlatform].replace('{name}', currentAgent.metadata.name);
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export agent:', error);
    }
  };

  const openPRModal = () => {
    if (!currentAgent) return;
    setPrTitle(`Add agent: ${currentAgent.metadata.name}`);
    setPrBody(`Adds the **${currentAgent.metadata.name}** agent configuration generated by Agent Orchestrator.\n\n${currentAgent.metadata.description || ''}`);
    setPrHead(`feat/add-agent-${currentAgent.metadata.name.replace(/\s+/g, '-').toLowerCase()}`);
    setPrResult(null);
    setPrError(null);
    setShowPRModal(true);
  };

  const handleCreatePR = async () => {
    if (!currentAgent) return;
    const [owner, repo] = prOwnerRepo.split('/');
    if (!owner || !repo || !prHead || !prTitle) {
      setPrError('Please fill in all required fields (owner/repo, head branch, title).');
      return;
    }
    if (!connectedProviders.find(p => p.type === prProvider)) {
      setPrError(`Not connected to ${PROVIDER_LABELS[prProvider]}. Go to Settings to connect.`);
      return;
    }
    setPrCreating(true);
    setPrError(null);
    try {
      // Export agent markdown and push to branch via the selected provider
      const content = await api.agent.exportToMd(currentAgent, 'github-copilot');
      await api.gitProvider.pushFiles(
        prProvider,
        owner, repo, prBase, prHead,
        [{ path: '.github/copilot-instructions.md', content }],
        `chore: add ${currentAgent.metadata.name} agent config`,
      );
      const result = await api.gitProvider.createPR(prProvider, { owner, repo, head: prHead, base: prBase, title: prTitle, body: prBody });
      setPrResult(result);
    } catch (e: any) {
      setPrError(e?.message || String(e));
    } finally {
      setPrCreating(false);
    }
  };

  const handlePushToMain = async () => {
    if (!currentAgent) return;
    if (connectedProviders.length === 0) {
      setPushError('No providers connected. Go to Settings to connect.');
      setPushStatus('error');
      return;
    }
    if (!prOwnerRepo) {
      const repo = prompt('Enter repository (owner/repo):');
      if (!repo) return;
      setPrOwnerRepo(repo);
      // Use the value directly since state won't be updated yet
      doPushToMain(repo);
      return;
    }
    doPushToMain(prOwnerRepo);
  };

  const doPushToMain = async (ownerRepo: string) => {
    if (!currentAgent) return;
    const [owner, repo] = ownerRepo.split('/');
    if (!owner || !repo) {
      setPushError('Invalid repository format. Use owner/repo.');
      setPushStatus('error');
      return;
    }
    const provider = connectedProviders[0];
    setPushStatus('pushing');
    setPushError(null);
    try {
      const content = await api.agent.exportToMd(currentAgent, 'github-copilot');
      await api.gitProvider.pushFiles(
        provider.type,
        owner, repo, 'main', 'main',
        [{ path: '.github/copilot-instructions.md', content }],
        `chore: update ${currentAgent.metadata.name} agent config`,
      );
      setPushStatus('success');
      setTimeout(() => setPushStatus('idle'), 3000);
    } catch (e: any) {
      setPushError(e?.message || String(e));
      setPushStatus('error');
    }
  };

  const updateField = (path: string[], value: any) => {
    if (!currentAgent) return;

    // Deep clone to avoid mutating nested shared state
    const updated = structuredClone(currentAgent);
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

  const handleMoveAgent = async (agentToMoveId: string, targetProjectId: string | null) => {
    try {
      const agent = agents.find(a => a.id === agentToMoveId);
      if (!agent) return;
      await api.agent.update(agentToMoveId, { ...agent, projectId: targetProjectId ?? undefined });
      setContextMenuAgentId(null);
      loadAgents();
    } catch (error) {
      console.error('Failed to move agent:', error);
    }
  };

  const handleCopyAgent = async (agentToCopy: Agent, targetProjectId: string | null) => {
    try {
      await api.agent.create({
        ...agentToCopy,
        projectId: targetProjectId ?? undefined,
        metadata: { ...agentToCopy.metadata, name: `${agentToCopy.metadata.name} (copy)` },
      });
      setContextMenuAgentId(null);
      loadAgents();
    } catch (error) {
      console.error('Failed to copy agent:', error);
    }
  };

  const handleGenerated = async (result: any) => {
    try {
      const newAgent = await api.agent.create({
        projectId: projectId ?? undefined,
        ...result,
      });
      setAgents(prev => [...prev, newAgent]);
      onAgentChange(newAgent.id);
      setIsEditing(true);
      setShowGenerateModal(false);
    } catch (error) {
      console.error('Failed to save generated agent:', error);
    }
  };

  return (
    <div className="agent-editor">
      <div className="agent-header">
        <h2>Agent Editor</h2>
        <div className="header-actions">
          {IS_WEB && (
            <button className="btn" onClick={() => setShowGenerateModal(true)}>
              ✨ Generate
            </button>
          )}
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
              <div className="agent-item-row">
                <div className="agent-name">{agent.metadata.name}</div>
                <button
                  className="agent-context-btn"
                  title="Move / Copy"
                  onClick={e => { e.stopPropagation(); setContextMenuAgentId(contextMenuAgentId === agent.id ? null : agent.id); }}
                >
                  ⋮
                </button>
              </div>
              <div className="agent-version">{agent.metadata.version}</div>
              {contextMenuAgentId === agent.id && (
                <div className="agent-context-menu" onClick={e => e.stopPropagation()}>
                  <div className="context-menu-section">Move to project</div>
                  <button className="context-menu-item" onClick={() => handleMoveAgent(agent.id, null)}>🌐 No project</button>
                  {allProjects.filter(p => p.id !== agent.projectId).map(p => (
                    <button key={p.id} className="context-menu-item" onClick={() => handleMoveAgent(agent.id, p.id)}>
                      📁 {p.name}
                    </button>
                  ))}
                  <div className="context-menu-divider" />
                  <div className="context-menu-section">Copy to project</div>
                  <button className="context-menu-item" onClick={() => handleCopyAgent(agent, null)}>🌐 No project</button>
                  {allProjects.map(p => (
                    <button key={p.id} className="context-menu-item" onClick={() => handleCopyAgent(agent, p.id)}>
                      📁 {p.name}
                    </button>
                  ))}
                </div>
              )}
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
                      <div className="export-group">
                        <select
                          className="platform-select"
                          value={exportPlatform}
                          onChange={(e) => setExportPlatform(e.target.value as Platform)}
                        >
                          {(Object.keys(PLATFORM_LABELS) as Platform[]).map(p => (
                            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                          ))}
                        </select>
                        <button className="btn" onClick={exportToMd}>
                          Export
                        </button>
                      </div>
                      <button className="btn btn-danger" onClick={deleteAgent}>
                        Delete
                      </button>
                      <button className="btn btn-github" onClick={openPRModal} title="Create Pull Request">
                        Create PR
                      </button>
                      <button
                        className="btn btn-push-main"
                        onClick={handlePushToMain}
                        disabled={pushStatus === 'pushing'}
                        title="Push agent directly to main branch"
                      >
                        {pushStatus === 'pushing' ? '⏳ Pushing…' : '🚀 Push to Main'}
                      </button>
                      {pushStatus === 'success' && (
                        <span className="push-main-status success">✓ Pushed</span>
                      )}
                      {pushStatus === 'error' && (
                        <span className="push-main-status error" title={pushError || ''}>✕ Failed</span>
                      )}
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
                <h4>Instructions {IS_WEB && isEditing && <span className="save-status">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : ''}</span>}</h4>
                <div className="form-group monaco-field">
                  <Editor
                    height="260px"
                    language="markdown"
                    theme="vs-dark"
                    value={currentAgent.instructions || ''}
                    options={{ readOnly: !isEditing, minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false }}
                    onChange={value => { if (isEditing) updateField(['instructions'], value ?? ''); }}
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
      {/* PR Modal */}
      {showPRModal && (
        <div className="modal-overlay" onClick={() => !prCreating && setShowPRModal(false)}>
          <div className="modal-content pr-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Pull Request</h3>
              <button className="modal-close" onClick={() => setShowPRModal(false)} disabled={prCreating}>✕</button>
            </div>

            {prResult ? (
              <div className="pr-success">
                <p>✅ Pull Request <strong>#{prResult.number}</strong> created successfully!</p>
                <a href={prResult.url} target="_blank" rel="noreferrer" className="btn btn-primary">
                  View PR on {PROVIDER_LABELS[prProvider]}
                </a>
                <button className="btn" onClick={() => setShowPRModal(false)} style={{ marginLeft: '8px' }}>Close</button>
              </div>
            ) : (
              <div className="pr-form">
                <div className="form-group">
                  <label>Provider <span className="required">*</span></label>
                  <select
                    value={prProvider}
                    onChange={e => setPrProvider(e.target.value as ProviderType)}
                    disabled={prCreating}
                    className="provider-select"
                  >
                    {(['github', 'gitlab', 'bitbucket'] as ProviderType[]).map(p => {
                      const connected = connectedProviders.find(cp => cp.type === p);
                      return (
                        <option key={p} value={p} disabled={!connected}>
                          {PROVIDER_LABELS[p]}{connected ? ` (${connected.user.login})` : ' (not connected)'}
                        </option>
                      );
                    })}
                  </select>
                  {connectedProviders.length === 0 && (
                    <p className="hint-text">No providers connected. Go to Settings to connect.</p>
                  )}
                </div>
                <div className="form-group">
                  <label>Repository <span className="required">*</span></label>
                  <input
                    type="text"
                    placeholder={prProvider === 'bitbucket' ? 'workspace/repo' : 'owner/repo'}
                    value={prOwnerRepo}
                    onChange={e => setPrOwnerRepo(e.target.value)}
                    disabled={prCreating}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Base branch <span className="required">*</span></label>
                    <input
                      type="text"
                      value={prBase}
                      onChange={e => setPrBase(e.target.value)}
                      disabled={prCreating}
                    />
                  </div>
                  <div className="form-group">
                    <label>Head branch <span className="required">*</span></label>
                    <input
                      type="text"
                      value={prHead}
                      onChange={e => setPrHead(e.target.value)}
                      disabled={prCreating}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Title <span className="required">*</span></label>
                  <input
                    type="text"
                    value={prTitle}
                    onChange={e => setPrTitle(e.target.value)}
                    disabled={prCreating}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={prBody}
                    onChange={e => setPrBody(e.target.value)}
                    rows={4}
                    disabled={prCreating}
                  />
                </div>
                {prError && <p className="pr-error">{prError}</p>}
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={handleCreatePR} disabled={prCreating}>
                    {prCreating ? 'Creating…' : 'Create Pull Request'}
                  </button>
                  <button className="btn" onClick={() => setShowPRModal(false)} disabled={prCreating}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showGenerateModal && (
        <GenerateModal
          type="agent"
          onClose={() => setShowGenerateModal(false)}
          onGenerated={handleGenerated}
          generateFn={api.generate.agent}
        />
      )}
    </div>
  );
}

export default AgentEditor;
