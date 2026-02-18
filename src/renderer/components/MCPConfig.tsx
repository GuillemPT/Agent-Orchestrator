import { useState, useEffect, useCallback } from 'react';
import '../styles/MCPConfig.css';
import type { MCPProjectConfig, MCPServerConfig } from '../types/electron';

type Platform = 'github-copilot' | 'claude' | 'cursor' | 'antigravity' | 'opencode';

const PLATFORM_LABELS: Record<Platform, string> = {
  'github-copilot': 'GitHub Copilot',
  claude: 'Claude',
  cursor: 'Cursor',
  antigravity: 'Antigravity',
  opencode: 'OpenCode',
};

const CONFIG_FILE_PATHS: Record<Platform, string> = {
  'github-copilot': '.vscode/mcp.json',
  claude: '.claude/settings.json',
  cursor: '.cursor/mcp.json',
  antigravity: 'antigravity.config.json',
  opencode: '.opencode/mcp.json',
};

function emptyServer(): MCPServerConfig {
  return { command: '', args: [], env: {} };
}

function MCPConfig() {
  const [projects, setProjects] = useState<MCPProjectConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MCPProjectConfig | null>(null);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [newServerName, setNewServerName] = useState('');
  const [status, setStatus] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const list = await window.api.mcp.getAllProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load MCP projects', err);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (!selectedId) { setEditing(null); setSelectedServer(null); return; }
    const p = projects.find(p => p.id === selectedId);
    setEditing(p ? structuredClone(p) : null);
    setSelectedServer(null);
  }, [selectedId, projects]);

  const showStatus = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setStatus({ msg, kind });
    setTimeout(() => setStatus(null), 3000);
  };

  // ── Project CRUD ─────────────────────────────────────────────────────────

  const newProject = async () => {
    try {
      const created = await window.api.mcp.createProject({
        label: 'New Project',
        projectPath: '',
        platform: 'github-copilot',
        mcpServers: {},
      });
      await loadProjects();
      setSelectedId(created.id);
    } catch {
      showStatus('Failed to create project', 'err');
    }
  };

  const saveProject = async () => {
    if (!editing) return;
    try {
      await window.api.mcp.updateProject(editing.id, editing);
      await loadProjects();
      showStatus('Saved');
    } catch {
      showStatus('Save failed', 'err');
    }
  };

  const deleteProject = async () => {
    if (!editing) return;
    if (!confirm(`Delete project "${editing.label}"?`)) return;
    try {
      await window.api.mcp.deleteProject(editing.id);
      setSelectedId(null);
      await loadProjects();
      showStatus('Deleted');
    } catch {
      showStatus('Delete failed', 'err');
    }
  };

  const deployProject = async () => {
    if (!editing) return;
    if (!editing.projectPath.trim()) {
      showStatus('Set a project path before deploying', 'err');
      return;
    }
    try {
      const dest = await window.api.mcp.deployProject(editing);
      showStatus(`Deployed → ${dest}`);
    } catch {
      showStatus('Deploy failed', 'err');
    }
  };

  // ── Server CRUD ───────────────────────────────────────────────────────────

  const addServer = () => {
    if (!editing || !newServerName.trim()) return;
    const name = newServerName.trim();
    if (editing.mcpServers[name]) {
      showStatus('A server with that name already exists', 'err');
      return;
    }
    setEditing({ ...editing, mcpServers: { ...editing.mcpServers, [name]: emptyServer() } });
    setSelectedServer(name);
    setNewServerName('');
  };

  const removeServer = (name: string) => {
    if (!editing) return;
    const { [name]: _, ...rest } = editing.mcpServers;
    setEditing({ ...editing, mcpServers: rest });
    if (selectedServer === name) setSelectedServer(null);
  };

  const updateServerField = (key: keyof MCPServerConfig, value: unknown) => {
    if (!editing || !selectedServer) return;
    setEditing({
      ...editing,
      mcpServers: {
        ...editing.mcpServers,
        [selectedServer]: { ...editing.mcpServers[selectedServer], [key]: value },
      },
    });
  };

  const addArg = () => {
    if (!editing || !selectedServer) return;
    updateServerField('args', [...(editing.mcpServers[selectedServer].args || []), '']);
  };

  const updateArg = (i: number, v: string) => {
    if (!editing || !selectedServer) return;
    const args = [...(editing.mcpServers[selectedServer].args || [])];
    args[i] = v;
    updateServerField('args', args);
  };

  const removeArg = (i: number) => {
    if (!editing || !selectedServer) return;
    updateServerField('args', (editing.mcpServers[selectedServer].args || []).filter((_, j) => j !== i));
  };

  const addEnvVar = () => {
    if (!editing || !selectedServer) return;
    const key = prompt('Environment variable name:');
    if (!key) return;
    updateServerField('env', { ...editing.mcpServers[selectedServer].env, [key]: '' });
  };

  const updateEnvVal = (k: string, v: string) => {
    if (!editing || !selectedServer) return;
    updateServerField('env', { ...editing.mcpServers[selectedServer].env, [k]: v });
  };

  const removeEnvVar = (k: string) => {
    if (!editing || !selectedServer) return;
    const { [k]: _, ...rest } = editing.mcpServers[selectedServer].env || {};
    updateServerField('env', rest);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const server = editing && selectedServer ? editing.mcpServers[selectedServer] : null;

  return (
    <div className="mcp-config">
      {/* ── Left panel: project list ─────────────────────────── */}
      <div className="mcp-sidebar">
        <div className="mcp-sidebar-header">
          <h3>MCP Projects</h3>
          <button className="btn btn-sm btn-primary" onClick={newProject}>+ New</button>
        </div>
        {projects.length === 0 && (
          <p className="mcp-empty-hint">No projects yet. Create one to get started.</p>
        )}
        {projects.map(p => (
          <div
            key={p.id}
            className={`mcp-project-item${selectedId === p.id ? ' active' : ''}`}
            onClick={() => setSelectedId(p.id)}
          >
            <span className="mcp-project-label">{p.label}</span>
            <span className="mcp-project-platform">{PLATFORM_LABELS[p.platform as Platform] ?? p.platform}</span>
          </div>
        ))}
      </div>

      {/* ── Right panel ──────────────────────────────────────── */}
      <div className="mcp-main">
        {!editing ? (
          <div className="mcp-empty-state">
            <p>Select a project or create a new one.</p>
          </div>
        ) : (
          <>
            <div className="mcp-project-header">
              <div className="mcp-project-meta">
                <input
                  className="mcp-title-input"
                  value={editing.label}
                  onChange={e => setEditing({ ...editing, label: e.target.value })}
                  placeholder="Project name"
                />
                <div className="mcp-meta-row">
                  <label>Platform</label>
                  <select
                    value={editing.platform}
                    onChange={e => setEditing({ ...editing, platform: e.target.value as Platform })}
                  >
                    {(Object.keys(PLATFORM_LABELS) as Platform[]).map(p => (
                      <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div className="mcp-meta-row">
                  <label>Project path</label>
                  <input
                    value={editing.projectPath}
                    onChange={e => setEditing({ ...editing, projectPath: e.target.value })}
                    placeholder="/path/to/your/project"
                  />
                </div>
                <p className="mcp-dest-hint">
                  Deploys to: <code>{editing.projectPath || '/your/project'}/{CONFIG_FILE_PATHS[editing.platform as Platform] ?? '...'}</code>
                </p>
              </div>
              <div className="mcp-project-actions">
                <button className="btn btn-sm" onClick={deleteProject}>Delete</button>
                <button className="btn btn-sm" onClick={saveProject}>Save</button>
                <button className="btn btn-sm btn-primary" onClick={deployProject}>Deploy to Project</button>
              </div>
            </div>

            {status && (
              <div className={`mcp-status mcp-status--${status.kind}`}>{status.msg}</div>
            )}

            <div className="mcp-servers-layout">
              <div className="mcp-server-list">
                <div className="mcp-server-list-header"><span>Servers</span></div>
                {Object.keys(editing.mcpServers).map(name => (
                  <div
                    key={name}
                    className={`mcp-server-item${selectedServer === name ? ' active' : ''}`}
                    onClick={() => setSelectedServer(name)}
                  >
                    <span>{name}</span>
                    <button
                      className="btn btn-xs btn-danger"
                      onClick={e => { e.stopPropagation(); removeServer(name); }}
                    >×</button>
                  </div>
                ))}
                <div className="mcp-add-server-row">
                  <input
                    value={newServerName}
                    onChange={e => setNewServerName(e.target.value)}
                    placeholder="Server name"
                    onKeyDown={e => e.key === 'Enter' && addServer()}
                  />
                  <button className="btn btn-sm" onClick={addServer}>Add</button>
                </div>
              </div>

              <div className="mcp-server-detail">
                {!server ? (
                  <p className="mcp-empty-hint">Select a server to configure it.</p>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Command</label>
                      <input
                        value={server.command}
                        onChange={e => updateServerField('command', e.target.value)}
                        placeholder="e.g. node, npx, python"
                      />
                    </div>
                    <div className="form-group">
                      <label>Arguments</label>
                      {(server.args || []).map((arg, i) => (
                        <div key={i} className="arg-item">
                          <input value={arg} onChange={e => updateArg(i, e.target.value)} placeholder="argument" />
                          <button className="btn btn-xs btn-danger" onClick={() => removeArg(i)}>×</button>
                        </div>
                      ))}
                      <button className="btn btn-sm" onClick={addArg}>+ Add argument</button>
                    </div>
                    <div className="form-group">
                      <label>Environment variables</label>
                      {Object.entries(server.env || {}).map(([k, v]) => (
                        <div key={k} className="env-item">
                          <span className="env-key">{k}</span>
                          <input value={v} onChange={e => updateEnvVal(k, e.target.value)} placeholder="value" />
                          <button className="btn btn-xs btn-danger" onClick={() => removeEnvVar(k)}>×</button>
                        </div>
                      ))}
                      <button className="btn btn-sm" onClick={addEnvVar}>+ Add env var</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MCPConfig;

