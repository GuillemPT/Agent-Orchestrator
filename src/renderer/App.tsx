import { useState, useEffect } from 'react';
import './styles/App.css';
import Sidebar from './components/Sidebar';
import AgentEditor from './components/AgentEditor';
import SkillWizard from './components/SkillWizard';
import MCPConfig from './components/MCPConfig';
import Settings from './components/Settings';
import { Login } from './components/Login';
import { ErrorBoundary } from './components/ErrorBoundary';

export type ViewType = 'agents' | 'skills' | 'mcp' | 'settings';

const IS_WEB = import.meta.env.VITE_MODE === 'web';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('agents');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    IS_WEB ? 'loading' : 'authenticated'
  );

  useEffect(() => {
    if (!IS_WEB) return;
    fetch('/api/me', { credentials: 'include' })
      .then(res => setAuthStatus(res.ok ? 'authenticated' : 'unauthenticated'))
      .catch(() => setAuthStatus('unauthenticated'));
  }, []);

  if (authStatus === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
        Loading…
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <Login />;
  }

  return (
    <div className="app">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        currentProjectId={currentProjectId}
        onProjectChange={setCurrentProjectId}
      />
      <main className="main-content">
        {currentView === 'agents' && (
          <ErrorBoundary name="Agents">
            <AgentEditor
              agentId={selectedAgentId}
              onAgentChange={setSelectedAgentId}
              projectId={currentProjectId}
            />
          </ErrorBoundary>
        )}
        {currentView === 'skills' && (
          <ErrorBoundary name="Skills">
            <SkillWizard projectId={currentProjectId} />
          </ErrorBoundary>
        )}
        {currentView === 'mcp' && (
          <ErrorBoundary name="MCP Config">
            <MCPConfig />
          </ErrorBoundary>
        )}
        {currentView === 'settings' && (
          <ErrorBoundary name="Settings">
            <Settings />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

export default App;
