import { useState } from 'react';
import './styles/App.css';
import Sidebar from './components/Sidebar';
import AgentEditor from './components/AgentEditor';
import SkillWizard from './components/SkillWizard';
import MCPConfig from './components/MCPConfig';
import SyncPanel from './components/SyncPanel';
import PatternAnalysis from './components/PatternAnalysis';
import GitPanel from './components/GitPanel';

export type ViewType = 'agents' | 'skills' | 'mcp' | 'sync' | 'patterns' | 'git';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('agents');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  return (
    <div className="app">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="main-content">
        {currentView === 'agents' && (
          <AgentEditor
            agentId={selectedAgentId}
            onAgentChange={setSelectedAgentId}
          />
        )}
        {currentView === 'skills' && <SkillWizard />}
        {currentView === 'mcp' && <MCPConfig />}
        {currentView === 'sync' && <SyncPanel />}
        {currentView === 'patterns' && <PatternAnalysis />}
        {currentView === 'git' && <GitPanel />}
      </main>
    </div>
  );
}

export default App;
