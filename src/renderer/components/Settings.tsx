import { useState, useEffect } from 'react';
import type { ProviderType, GitUser, DeviceFlowInit, ProviderSettings } from '../types/electron';
import { api } from '../api';
import '../styles/Settings.css';

const IS_WEB = import.meta.env.VITE_MODE === 'web';

type AIProvider = 'groq' | 'openai' | 'ollama' | 'disabled';

const AI_PROVIDER_META: Record<Exclude<AIProvider, 'disabled'>, { label: string; defaultModel: string }> = {
  groq: { label: 'Groq (Free)', defaultModel: 'llama-3.3-70b-versatile' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  ollama: { label: 'Ollama (Local)', defaultModel: 'qwen2.5:7b' },
};

const PROVIDER_META: Record<ProviderType, {
  label: string; color: string; icon: string;
  supportsDeviceFlow: boolean;
  docsUrl: string; oauthAppUrl: string;
  scopeHint: string;
  setupNote?: string;
}> = {
  github: {
    label: 'GitHub', color: '#24292f', icon: '🐙',
    supportsDeviceFlow: true,
    docsUrl: 'https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#device-flow',
    oauthAppUrl: 'https://github.com/settings/developers',
    scopeHint: 'Required scopes: repo, gist, read:user',
    setupNote: '⚠️ Create an "OAuth App" (NOT a GitHub App). Enable "Device Flow" checkbox.',
  },
  gitlab: {
    label: 'GitLab', color: '#fc6d26', icon: '🦊',
    supportsDeviceFlow: true,
    docsUrl: 'https://docs.gitlab.com/ee/api/oauth2.html#device-authorization-grant',
    oauthAppUrl: 'https://gitlab.com/-/profile/applications',
    scopeHint: 'Required scopes: api, read_user',
  },
  bitbucket: {
    label: 'Bitbucket', color: '#0052cc', icon: '🪣',
    supportsDeviceFlow: false,
    docsUrl: 'https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/',
    oauthAppUrl: 'https://bitbucket.org/account/settings/app-passwords/',
    scopeHint: 'Required permissions: Repositories (read/write), Pull requests (read/write)',
  },
};

type CardState = 'idle' | 'configuring' | 'device-flow' | 'polling' | 'connected';

interface ProviderCardProps {
  type: ProviderType;
  initialUser?: GitUser | null;
  initialClientId?: string;
  onConnect: (type: ProviderType, user: GitUser) => void;
  onDisconnect: (type: ProviderType) => void;
}

function ProviderCard({ type, initialUser, initialClientId, onConnect, onDisconnect }: ProviderCardProps) {
  const meta = PROVIDER_META[type];
  const [state, setState] = useState<CardState>(initialUser ? 'connected' : 'idle');
  const [user, setUser] = useState<GitUser | null>(initialUser ?? null);
  const [clientId, setClientId] = useState(initialClientId ?? '');
  const [clientIdSaved, setClientIdSaved] = useState(!!initialClientId);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowInit | null>(null);
  const [bbUsername, setBbUsername] = useState('');
  const [bbPassword, setBbPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const saveClientId = async () => {
    if (!clientId.trim()) return;
    await api.gitProvider.setClientId(type, clientId.trim());
    setClientIdSaved(true);
    setError(null);
  };

  const startConnect = async () => {
    setError(null);
    if (meta.supportsDeviceFlow) {
      try {
        setState('device-flow');
        const init = await api.gitProvider.startDeviceFlow(type);
        setDeviceFlow(init);
        setState('polling');
        const connectedUser = await api.gitProvider.completeDeviceFlow(type, init);
        setUser(connectedUser);
        setState('connected');
        onConnect(type, connectedUser);
      } catch (e: any) {
        setError(e?.message ?? 'Connection failed');
        setState('configuring');
      }
    } else {
      // Bitbucket App Password
      try {
        setState('polling');
        const connectedUser = await api.gitProvider.connectAppPassword(type, bbPassword, { username: bbUsername });
        setUser(connectedUser);
        setState('connected');
        onConnect(type, connectedUser);
      } catch (e: any) {
        setError(e?.message ?? 'Invalid credentials');
        setState('configuring');
      }
    }
  };

  const disconnect = async () => {
    await api.gitProvider.disconnect(type);
    setUser(null);
    setDeviceFlow(null);
    setState('idle');
    onDisconnect(type);
  };

  const copyCode = () => {
    if (deviceFlow?.user_code) navigator.clipboard.writeText(deviceFlow.user_code);
  };

  return (
    <div className={`provider-card ${state === 'connected' ? 'connected' : ''}`}>
      <div className="provider-card-header">
        <div className="provider-identity">
          <span className="provider-icon" style={{ background: meta.color }}>{meta.icon}</span>
          <span className="provider-label">{meta.label}</span>
        </div>
        {state === 'connected' && user ? (
          <div className="provider-connected-row">
            <img src={user.avatar_url} alt={user.login} className="provider-avatar" />
            <span className="provider-login">{user.login}</span>
            <button className="btn btn-xs btn-danger-outline" onClick={disconnect}>Disconnect</button>
          </div>
        ) : state === 'idle' ? (
          <button className="btn btn-sm" onClick={() => setState('configuring')}>Configure</button>
        ) : null}
      </div>

      {state === 'connected' && (
        <p className="provider-status connected">Connected ✓</p>
      )}

      {state === 'configuring' && (
        <div className="provider-config">
          {meta.supportsDeviceFlow ? (
            <>
              <p className="config-hint">
                Create an <a href={meta.oauthAppUrl} target="_blank" rel="noreferrer">OAuth App</a> and paste the Client ID below.
                {' '}<a href={meta.docsUrl} target="_blank" rel="noreferrer">Docs ↗</a>
              </p>
              {meta.setupNote && <p className="config-setup-note">{meta.setupNote}</p>}
              <p className="config-scope-hint">{meta.scopeHint}</p>
              <div className="config-row">
                <input
                  type="text"
                  className="config-input"
                  placeholder="OAuth App Client ID (hex string, NOT starting with Iv)"
                  value={clientId}
                  onChange={e => { setClientId(e.target.value); setClientIdSaved(false); }}
                  onBlur={saveClientId}
                  onKeyDown={e => e.key === 'Enter' && saveClientId()}
                />
                {clientIdSaved && <span className="config-saved">✓ saved</span>}
              </div>
              {error && <p className="config-error">{error}</p>}
              <div className="config-actions">
                <button className="btn btn-sm" onClick={() => { setState('idle'); setError(null); }}>Cancel</button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={startConnect}
                  disabled={!clientId.trim()}
                >
                  Connect with {meta.label}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="config-hint">
                Create an <a href={meta.oauthAppUrl} target="_blank" rel="noreferrer">App Password</a> in your Bitbucket account.
                {' '}<a href={meta.docsUrl} target="_blank" rel="noreferrer">Docs ↗</a>
              </p>
              <p className="config-scope-hint">{meta.scopeHint}</p>
              <input
                type="text"
                className="config-input"
                placeholder="Bitbucket username"
                value={bbUsername}
                onChange={e => setBbUsername(e.target.value)}
                style={{ marginBottom: 6 }}
              />
              <input
                type="password"
                className="config-input"
                placeholder="App Password"
                value={bbPassword}
                onChange={e => setBbPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startConnect()}
              />
              {error && <p className="config-error">{error}</p>}
              <div className="config-actions">
                <button className="btn btn-sm" onClick={() => { setState('idle'); setError(null); }}>Cancel</button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={startConnect}
                  disabled={!bbUsername.trim() || !bbPassword.trim()}
                >
                  Connect
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {(state === 'device-flow' || state === 'polling') && deviceFlow && (
        <div className="device-flow-box">
          <p className="df-instruction">
            Open <a href={deviceFlow.verification_url} target="_blank" rel="noreferrer">{deviceFlow.verification_url}</a> in your browser and enter:
          </p>
          <button className="df-code" onClick={copyCode} title="Click to copy">
            {deviceFlow.user_code}
          </button>
          <p className="df-hint">Click the code to copy it. Waiting for authorisation…</p>
          <div className="df-spinner" />
        </div>
      )}

      {state === 'polling' && !deviceFlow && (
        <div className="device-flow-box">
          <p>Connecting…</p>
          <div className="df-spinner" />
        </div>
      )}
    </div>
  );
}

// ── Main Settings component ──────────────────────────────────────────────────

type Theme = 'dark' | 'light';

export default function Settings() {
  const [accounts, setAccounts] = useState<{ type: ProviderType; user: GitUser }[]>([]);
  const [settings, setSettings] = useState<ProviderSettings>({});
  const [loading, setLoading] = useState(true);
  const [testingConnections, setTestingConnections] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<AIProvider>('groq');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('llama-3.3-70b-versatile');
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    Promise.all([
      api.gitProvider.getConnectedAccounts(),
      api.gitProvider.getSettings(),
    ]).then(([accts, setts]) => {
      setAccounts(accts);
      setSettings(setts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleConnect = (type: ProviderType, user: GitUser) => {
    setAccounts(prev => [...prev.filter(a => a.type !== type), { type, user }]);
  };
  const handleDisconnect = (type: ProviderType) => {
    setAccounts(prev => prev.filter(a => a.type !== type));
  };

  const testConnections = async () => {
    setTestingConnections(true);
    setConnectionTestResult(null);
    try {
      const accts = await api.gitProvider.getConnectedAccounts();
      setAccounts(accts);
      if (accts.length === 0) {
        setConnectionTestResult('No providers connected.');
      } else {
        const names = accts.map(a => `${PROVIDER_META[a.type].label} (${a.user.login})`).join(', ');
        setConnectionTestResult(`✓ Connected: ${names}`);
      }
    } catch (e: any) {
      setConnectionTestResult(`✗ Error: ${e?.message || 'Unknown error'}`);
    } finally {
      setTestingConnections(false);
      setTimeout(() => setConnectionTestResult(null), 5000);
    }
  };

  const testAIConnection = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const result = await api.generate.agent('A simple test agent that greets users');
      if (result?.metadata?.name) {
        setAiTestResult(`✓ Connected — generated "${result.metadata.name}"`);
      } else {
        setAiTestResult('✗ Unexpected response format');
      }
    } catch (e: any) {
      setAiTestResult(`✗ ${e?.message || 'Connection failed'}`);
    } finally {
      setAiTesting(false);
      setTimeout(() => setAiTestResult(null), 8000);
    }
  };

  if (loading) return <div className="settings-loading">Loading…</div>;

  const connectedMap = Object.fromEntries(accounts.map(a => [a.type, a.user])) as Record<ProviderType, GitUser | undefined>;

  return (
    <div className="settings-layout">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>
      <div className="settings-body">
        <section className="settings-section">
          <h3>Appearance</h3>
          <div className="theme-toggle">
            <label>Theme</label>
            <div className="theme-options">
              <button 
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                🌙 Dark
              </button>
              <button 
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                ☀️ Light
              </button>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>Git Providers</h3>
          <p className="section-desc">
            Connect your accounts to create pull requests, push files, and browse the shared snippet marketplace.
            Each connection requires a self-hosted OAuth App (GitHub / GitLab) or App Password (Bitbucket) — your credentials never leave your device.
          </p>
          <div className="provider-cards">
            {(['github', 'gitlab', 'bitbucket'] as ProviderType[]).map(type => (
              <ProviderCard
                key={type}
                type={type}
                initialUser={connectedMap[type] ?? null}
                initialClientId={settings[type]?.clientId ?? ''}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>
          <div className="test-connections-row">
            <button 
              className="btn" 
              onClick={testConnections} 
              disabled={testingConnections}
            >
              {testingConnections ? 'Testing…' : '🔌 Test Connections'}
            </button>
            {connectionTestResult && (
              <span className={`test-result ${connectionTestResult.startsWith('✓') ? 'success' : connectionTestResult.startsWith('✗') ? 'error' : ''}`}>
                {connectionTestResult}
              </span>
            )}
          </div>
        </section>

        {IS_WEB ? (
          <section className="settings-section">
            <h3>AI Provider</h3>
            <p className="section-desc">
              Configure the AI backend for agent and skill generation. Groq's free tier is recommended for most users.
            </p>
            <div className="ai-settings-grid">
              <div className="ai-field">
                <label>Provider</label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    const p = e.target.value as AIProvider;
                    setAiProvider(p);
                    if (p !== 'disabled') {
                      setAiModel(AI_PROVIDER_META[p].defaultModel);
                    }
                  }}
                  className="ai-select"
                >
                  <option value="groq">Groq (Free)</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              {aiProvider !== 'disabled' && aiProvider !== 'ollama' && (
                <div className="ai-field">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={`Enter ${aiProvider === 'groq' ? 'Groq' : 'OpenAI'} API key`}
                    className="ai-input"
                  />
                </div>
              )}

              {aiProvider !== 'disabled' && (
                <div className="ai-field">
                  <label>Model</label>
                  <input
                    type="text"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder="Model name"
                    className="ai-input"
                  />
                </div>
              )}
            </div>

            {aiProvider !== 'disabled' && (
              <div className="test-connections-row" style={{ marginTop: 12 }}>
                <button
                  className="btn"
                  onClick={testAIConnection}
                  disabled={aiTesting}
                >
                  {aiTesting ? 'Testing…' : '🧪 Test Connection'}
                </button>
                {aiTestResult && (
                  <span className={`test-result ${aiTestResult.startsWith('✓') ? 'success' : 'error'}`}>
                    {aiTestResult}
                  </span>
                )}
              </div>
            )}

            {aiProvider === 'ollama' && (
              <p className="section-desc" style={{ marginTop: 8 }}>
                Run Ollama locally: <code>docker compose up -d</code> then <code>docker exec … ollama pull qwen2.5:7b</code>
              </p>
            )}
          </section>
        ) : (
          <section className="settings-section">
            <h3>AI Provider</h3>
            <p className="section-desc">
              AI generation is only available in web mode. Run with <code>npm run dev:web</code> to enable it.
            </p>
          </section>
        )}

        <section className="settings-section">
          <h3>About</h3>
          <div className="about-grid">
            <div className="about-row"><span>Version</span><span>1.1.0</span></div>
            <div className="about-row"><span>Architecture</span><span>Electron 28 · React 18 · TypeScript 5.3</span></div>
            <div className="about-row">
              <span>Repository</span>
              <a href="https://github.com/GuillemPT/Agent-Orchestrator" target="_blank" rel="noreferrer">
                GitHub ↗
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
