import { useState, useEffect } from 'react';
import type { ProviderType, GitUser, DeviceFlowInit, ProviderSettings } from '../types/electron';
import '../styles/Settings.css';

const PROVIDER_META: Record<ProviderType, {
  label: string; color: string; icon: string;
  supportsDeviceFlow: boolean;
  docsUrl: string; oauthAppUrl: string;
  scopeHint: string;
}> = {
  github: {
    label: 'GitHub', color: '#24292f', icon: '🐙',
    supportsDeviceFlow: true,
    docsUrl: 'https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps#device-flow',
    oauthAppUrl: 'https://github.com/settings/apps/new',
    scopeHint: 'Required scopes: repo, gist, read:user',
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
    await window.api.gitProvider.setClientId(type, clientId.trim());
    setClientIdSaved(true);
    setError(null);
  };

  const startConnect = async () => {
    setError(null);
    if (meta.supportsDeviceFlow) {
      try {
        setState('device-flow');
        const init = await window.api.gitProvider.startDeviceFlow(type);
        setDeviceFlow(init);
        setState('polling');
        const connectedUser = await window.api.gitProvider.completeDeviceFlow(type, init);
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
        const connectedUser = await window.api.gitProvider.connectAppPassword(type, bbPassword, { username: bbUsername });
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
    await window.api.gitProvider.disconnect(type);
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
              <p className="config-scope-hint">{meta.scopeHint}</p>
              <div className="config-row">
                <input
                  type="text"
                  className="config-input"
                  placeholder="OAuth App Client ID"
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

export default function Settings() {
  const [accounts, setAccounts] = useState<{ type: ProviderType; user: GitUser }[]>([]);
  const [settings, setSettings] = useState<ProviderSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      window.api.gitProvider.getConnectedAccounts(),
      window.api.gitProvider.getSettings(),
    ]).then(([accts, setts]) => {
      setAccounts(accts);
      setSettings(setts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleConnect = (type: ProviderType, user: GitUser) => {
    setAccounts(prev => [...prev.filter(a => a.type !== type), { type, user }]);
  };
  const handleDisconnect = (type: ProviderType) => {
    setAccounts(prev => prev.filter(a => a.type !== type));
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
        </section>

        <section className="settings-section">
          <h3>About</h3>
          <div className="about-grid">
            <div className="about-row"><span>Version</span><span>1.1.0</span></div>
            <div className="about-row"><span>Architecture</span><span>Electron 28 · React 18 · TypeScript 5.3</span></div>
            <div className="about-row">
              <span>Repository</span>
              <a href="https://github.com/guillem/Agent-Orchestrator" target="_blank" rel="noreferrer">
                GitHub ↗
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
