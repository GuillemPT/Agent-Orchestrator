import { useState, useEffect } from 'react';
import { ViewType } from '../App';
import { ProjectSelector } from './ProjectSelector';
import '../styles/Sidebar.css';
import { api } from '../api';
import { signOut, getSession } from '../api/auth';

const IS_WEB = import.meta.env.VITE_MODE === 'web';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  currentProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  github: '#24292f',
  gitlab: '#fc6d26',
  bitbucket: '#0052cc',
};
const PROVIDER_ICONS: Record<string, string> = {
  github: '🐙', gitlab: '🦊', bitbucket: '🪣',
};

function Sidebar({ currentView, onViewChange, currentProjectId, onProjectChange }: SidebarProps) {
  const [connectedAccounts, setConnectedAccounts] = useState<{ type: string; user: { login: string; avatar_url: string } }[]>([]);
  const [user, setUser] = useState<{ name?: string; email: string; avatar?: string } | null>(null);

  useEffect(() => {
    api.gitProvider.getConnectedAccounts()
      .then(setConnectedAccounts)
      .catch(() => setConnectedAccounts([]));
    if (IS_WEB) {
      getSession().then(setUser).catch(() => {});
    }
  }, []);

  // Refresh accounts when settings view is left (user may have just connected)
  const handleViewChange = (view: ViewType) => {
    if (currentView === 'settings' && view !== 'settings') {
      api.gitProvider.getConnectedAccounts()
        .then(setConnectedAccounts)
        .catch(() => {});
    }
    onViewChange(view);
  };

  const menuItems: { view: ViewType; label: string; icon: string }[] = [
    { view: 'agents',  label: 'Agents',     icon: '🤖' },
    { view: 'skills',  label: 'Skills',     icon: '⚡' },
    { view: 'mcp',     label: 'MCP Config', icon: '🔧' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Agent Orchestrator</h1>
        <p className="subtitle">DevTools Architect</p>
      </div>

      {/* Project selector */}
      <div className="sidebar-project">
        <ProjectSelector
          currentProjectId={currentProjectId}
          onProjectChange={onProjectChange}
        />
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
        {/* User profile (web mode) */}
        {IS_WEB && user && (
          <div className="sidebar-user">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="sidebar-user-avatar" />
            ) : (
              <span className="sidebar-user-avatar-placeholder">👤</span>
            )}
            <span className="sidebar-user-name">{user.name || user.email}</span>
            <button className="btn btn-xs sidebar-logout-btn" onClick={signOut} title="Sign out">
              ↪
            </button>
          </div>
        )}
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


