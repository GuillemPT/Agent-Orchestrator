import { useState, useEffect } from 'react';
import { ViewType } from '../App';
import '../styles/Sidebar.css';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  github: '#24292f',
  gitlab: '#fc6d26',
  bitbucket: '#0052cc',
};
const PROVIDER_ICONS: Record<string, string> = {
  github: '🐙', gitlab: '🦊', bitbucket: '🪣',
};

function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [connectedAccounts, setConnectedAccounts] = useState<{ type: string; user: { login: string; avatar_url: string } }[]>([]);

  useEffect(() => {
    window.api.gitProvider.getConnectedAccounts()
      .then(setConnectedAccounts)
      .catch(() => setConnectedAccounts([]));
  }, []);

  // Refresh accounts when settings view is left (user may have just connected)
  const handleViewChange = (view: ViewType) => {
    if (currentView === 'settings' && view !== 'settings') {
      window.api.gitProvider.getConnectedAccounts()
        .then(setConnectedAccounts)
        .catch(() => {});
    }
    onViewChange(view);
  };

  const menuItems: { view: ViewType; label: string; icon: string }[] = [
    { view: 'agents',    label: 'Agents',          icon: '🤖' },
    { view: 'skills',    label: 'Skills',           icon: '⚡' },
    { view: 'mcp',       label: 'MCP Config',       icon: '🔧' },
    { view: 'sync',      label: 'Sync',             icon: '🔄' },
    { view: 'workspace', label: 'Workspace Setup',  icon: '🗂️'  },
    { view: 'discover',  label: 'Discover',         icon: '🛒' },
    { view: 'git',       label: 'Git Integration',  icon: '🌿' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Agent Orchestrator</h1>
        <p className="subtitle">DevTools Architect</p>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.view}
            className={`nav-item ${currentView === item.view ? 'active' : ''}`}
            onClick={() => handleViewChange(item.view)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        {/* Connected provider badges */}
        {connectedAccounts.length > 0 ? (
          <div className="providers-strip">
            {connectedAccounts.map(({ type, user }) => (
              <div key={type} className="provider-badge" title={`${type}: ${user.login}`}>
                <span className="provider-badge-icon" style={{ background: PROVIDER_COLORS[type] ?? '#444' }}>
                  {PROVIDER_ICONS[type] ?? '🔗'}
                </span>
                <img src={user.avatar_url} alt={user.login} className="provider-badge-avatar" />
                <span className="provider-badge-login">{user.login}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-providers-hint">No accounts connected</p>
        )}
        <button
          className={`btn btn-sm settings-btn ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => handleViewChange('settings')}
        >
          ⚙️ Settings
        </button>
        <p className="version">v1.1.0</p>
      </div>
    </aside>
  );
}

export default Sidebar;


