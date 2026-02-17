import { useState, useEffect } from 'react';
import '../styles/MCPConfig.css';

interface MCPConfig {
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  >;
  tools?: Array<{
    name: string;
    enabled: boolean;
    servers?: string[];
  }>;
  credentials?: Record<string, string>;
}

function MCPConfig() {
  const [config, setConfig] = useState<MCPConfig | null>(null);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [showCredentialDialog, setShowCredentialDialog] = useState(false);
  const [credentialKey, setCredentialKey] = useState('');
  const [credentialValue, setCredentialValue] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await (window as any).api.mcp.load();
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Failed to load MCP config:', error);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      await (window as any).api.mcp.save(config);
      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save configuration');
    }
  };

  const exportConfig = async () => {
    try {
      const json = await (window as any).api.mcp.export();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mcp.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export config:', error);
    }
  };

  const addServer = () => {
    if (!config) return;

    const serverName = prompt('Enter server name:');
    if (!serverName) return;

    setConfig({
      ...config,
      mcpServers: {
        ...config.mcpServers,
        [serverName]: {
          command: '',
          args: [],
          env: {},
        },
      },
    });
    setSelectedServer(serverName);
  };

  const removeServer = (name: string) => {
    if (!config) return;

    if (confirm(`Are you sure you want to remove server "${name}"?`)) {
      const { [name]: _, ...rest } = config.mcpServers;
      setConfig({
        ...config,
        mcpServers: rest,
      });
      if (selectedServer === name) {
        setSelectedServer(null);
      }
    }
  };

  const updateServer = (name: string, field: string, value: any) => {
    if (!config) return;

    setConfig({
      ...config,
      mcpServers: {
        ...config.mcpServers,
        [name]: {
          ...config.mcpServers[name],
          [field]: value,
        },
      },
    });
  };

  const addArg = (serverName: string) => {
    if (!config) return;

    const server = config.mcpServers[serverName];
    const args = server.args || [];
    updateServer(serverName, 'args', [...args, '']);
  };

  const updateArg = (serverName: string, index: number, value: string) => {
    if (!config) return;

    const server = config.mcpServers[serverName];
    const args = [...(server.args || [])];
    args[index] = value;
    updateServer(serverName, 'args', args);
  };

  const removeArg = (serverName: string, index: number) => {
    if (!config) return;

    const server = config.mcpServers[serverName];
    const args = server.args?.filter((_, i) => i !== index) || [];
    updateServer(serverName, 'args', args);
  };

  const addEnvVar = (serverName: string) => {
    if (!config) return;

    const key = prompt('Enter environment variable name:');
    if (!key) return;

    const server = config.mcpServers[serverName];
    const env = { ...(server.env || {}), [key]: '' };
    updateServer(serverName, 'env', env);
  };

  const updateEnvVar = (serverName: string, key: string, value: string) => {
    if (!config) return;

    const server = config.mcpServers[serverName];
    const env = { ...(server.env || {}), [key]: value };
    updateServer(serverName, 'env', env);
  };

  const removeEnvVar = (serverName: string, key: string) => {
    if (!config) return;

    const server = config.mcpServers[serverName];
    const { [key]: _, ...rest } = server.env || {};
    updateServer(serverName, 'env', rest);
  };

  const saveCredential = async () => {
    if (!credentialKey || !credentialValue) return;

    try {
      await (window as any).api.secure.setPassword('agent-orchestrator', credentialKey, credentialValue);
      setShowCredentialDialog(false);
      setCredentialKey('');
      setCredentialValue('');
      alert('Credential saved securely!');
    } catch (error) {
      console.error('Failed to save credential:', error);
      alert('Failed to save credential');
    }
  };

  if (!config) {
    return <div className="loading">Loading MCP configuration...</div>;
  }

  return (
    <div className="mcp-config">
      <div className="config-header">
        <h2>MCP Configuration</h2>
        <div className="header-actions">
          <button className="btn" onClick={() => setShowCredentialDialog(true)}>
            🔐 Manage Credentials
          </button>
          <button className="btn" onClick={exportConfig}>
            Export
          </button>
          <button className="btn btn-primary" onClick={saveConfig}>
            Save
          </button>
        </div>
      </div>

      <div className="config-content">
        <div className="server-list">
          <div className="list-header">
            <h3>MCP Servers</h3>
            <button className="btn btn-sm" onClick={addServer}>
              + Add Server
            </button>
          </div>
          {Object.keys(config.mcpServers).map((serverName) => (
            <div
              key={serverName}
              className={`server-item ${selectedServer === serverName ? 'active' : ''}`}
              onClick={() => setSelectedServer(serverName)}
            >
              <span>{serverName}</span>
              <button
                className="btn btn-sm btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removeServer(serverName);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="server-details">
          {selectedServer && config.mcpServers[selectedServer] ? (
            <>
              <h3>{selectedServer}</h3>
              <div className="form-section">
                <div className="form-group">
                  <label>Command</label>
                  <input
                    type="text"
                    value={config.mcpServers[selectedServer].command}
                    onChange={(e) => updateServer(selectedServer, 'command', e.target.value)}
                    placeholder="e.g., node, python, npx"
                  />
                </div>

                <div className="form-group">
                  <label>Arguments</label>
                  {config.mcpServers[selectedServer].args?.map((arg, index) => (
                    <div key={index} className="arg-item">
                      <input
                        type="text"
                        value={arg}
                        onChange={(e) => updateArg(selectedServer, index, e.target.value)}
                        placeholder="Argument"
                      />
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeArg(selectedServer, index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-sm" onClick={() => addArg(selectedServer)}>
                    + Add Argument
                  </button>
                </div>

                <div className="form-group">
                  <label>Environment Variables</label>
                  {Object.entries(config.mcpServers[selectedServer].env || {}).map(
                    ([key, value]) => (
                      <div key={key} className="env-item">
                        <div className="env-key">{key}</div>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateEnvVar(selectedServer, key, e.target.value)}
                          placeholder="Value"
                        />
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => removeEnvVar(selectedServer, key)}
                        >
                          Remove
                        </button>
                      </div>
                    )
                  )}
                  <button className="btn btn-sm" onClick={() => addEnvVar(selectedServer)}>
                    + Add Environment Variable
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a server to edit or add a new one</p>
            </div>
          )}
        </div>
      </div>

      {showCredentialDialog && (
        <div className="modal-overlay" onClick={() => setShowCredentialDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Save Secure Credential</h3>
            <div className="form-group">
              <label>Key</label>
              <input
                type="text"
                value={credentialKey}
                onChange={(e) => setCredentialKey(e.target.value)}
                placeholder="e.g., API_KEY, TOKEN"
              />
            </div>
            <div className="form-group">
              <label>Value</label>
              <input
                type="password"
                value={credentialValue}
                onChange={(e) => setCredentialValue(e.target.value)}
                placeholder="Enter credential value"
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowCredentialDialog(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveCredential}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MCPConfig;
