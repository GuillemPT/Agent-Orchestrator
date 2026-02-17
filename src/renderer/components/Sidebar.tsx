import { ViewType } from '../App';
import '../styles/Sidebar.css';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const menuItems: { view: ViewType; label: string; icon: string }[] = [
    { view: 'agents', label: 'Agents', icon: '🤖' },
    { view: 'skills', label: 'Skills', icon: '⚡' },
    { view: 'mcp', label: 'MCP Config', icon: '🔧' },
    { view: 'sync', label: 'Sync', icon: '🔄' },
    { view: 'patterns', label: 'Pattern Analysis', icon: '📊' },
    { view: 'git', label: 'Git Integration', icon: '🌿' },
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
            onClick={() => onViewChange(item.view)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <p className="version">v1.0.0</p>
        <p className="compatibility">
          Compatible with: GitHub Copilot, Claude-Code, OpenCode, Cursor, Antigravity
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
