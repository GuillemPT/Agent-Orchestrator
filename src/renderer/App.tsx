import { useState } from 'react';
import './styles/App.css';
import Sidebar from './components/Sidebar';
import AgentEditor from './components/AgentEditor';
import SkillWizard from './components/SkillWizard';
import MCPConfig from './components/MCPConfig';
import SyncPanel from './components/SyncPanel';
import WorkspaceSetup from './components/WorkspaceSetup';
import Discover from './components/Discover';
import GitPanel from './components/GitPanel';
import Settings from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';

export type ViewType = 'agents' | 'skills' | 'mcp' | 'sync' | 'workspace' | 'discover' | 'git' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('agents');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  return (
    <div className="app">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="main-content">
        {currentView === 'agents' && (
          <ErrorBoundary name="Agents">
            <AgentEditor
              agentId={selectedAgentId}
              onAgentChange={setSelectedAgentId}
            />
          </ErrorBoundary>
        )}
        {currentView === 'skills' && (
          <ErrorBoundary name="Skills">
            <SkillWizard />
          </ErrorBoundary>
        )}
        {currentView === 'mcp' && (
          <ErrorBoundary name="MCP Config">
            <MCPConfig />
          </ErrorBoundary>
        )}
        {currentView === 'sync' && (
          <ErrorBoundary name="Sync">
            <SyncPanel />
          </ErrorBoundary>
        )}
        {currentView === 'workspace' && (
          <ErrorBoundary name="Workspace Setup">
            <WorkspaceSetup />
          </ErrorBoundary>
        )}
        {currentView === 'discover' && (
          <ErrorBoundary name="Discover">
            <Discover />
          </ErrorBoundary>
        )}
        {currentView === 'git' && (
          <ErrorBoundary name="Git Panel">
            <GitPanel />
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
