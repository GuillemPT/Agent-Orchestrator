import { useState, useEffect } from 'react';
import '../styles/PatternAnalysis.css';

interface Agent {
  id: string;
  metadata: {
    name: string;
  };
}

interface AnalysisResult {
  patterns: string[];
  recommendations: string[];
  instructions: string;
}

function PatternAnalysis() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [codebasePatterns, setCodebasePatterns] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const loadedAgents = await (window as any).api.agent.getAll();
      setAgents(loadedAgents);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const analyzePatterns = async () => {
    if (!selectedAgentId) {
      alert('Please select an agent');
      return;
    }

    setAnalyzing(true);
    try {
      const agent = await (window as any).api.agent.getById(selectedAgentId);
      const patterns = codebasePatterns
        .split('\n')
        .filter((p) => p.trim())
        .map((p) => p.trim());

      const result = await (window as any).api.pattern.generateInstructions(
        agent,
        patterns.length > 0 ? patterns : undefined
      );

      setAnalysis(result);
    } catch (error) {
      console.error('Failed to analyze patterns:', error);
      alert('Failed to analyze patterns');
    } finally {
      setAnalyzing(false);
    }
  };

  const exportInstructions = () => {
    if (!analysis) return;

    const blob = new Blob([analysis.instructions], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'copilot-instructions.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pattern-analysis">
      <div className="analysis-header">
        <h2>Pattern Analysis & Copilot Instructions Generator</h2>
        <p className="subtitle">Generate optimized copilot-instructions.md from agent patterns</p>
      </div>

      <div className="analysis-config">
        <div className="form-group">
          <label>Select Agent</label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="agent-select"
          >
            <option value="">Choose an agent...</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.metadata.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Codebase Patterns (optional)</label>
          <textarea
            value={codebasePatterns}
            onChange={(e) => setCodebasePatterns(e.target.value)}
            rows={10}
            placeholder="Enter codebase patterns, one per line&#10;Example:&#10;- Uses React with TypeScript&#10;- Clean Architecture pattern&#10;- Test-driven development&#10;- RESTful API design"
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={analyzePatterns}
          disabled={analyzing || !selectedAgentId}
        >
          {analyzing ? '⏳ Analyzing...' : '🔍 Analyze & Generate'}
        </button>
      </div>

      {analysis && (
        <div className="analysis-results">
          <div className="result-section">
            <div className="section-header">
              <h3>📊 Detected Patterns</h3>
            </div>
            <div className="pattern-list">
              {analysis.patterns.map((pattern, index) => (
                <div key={index} className="pattern-item">
                  {pattern}
                </div>
              ))}
            </div>
          </div>

          <div className="result-section">
            <div className="section-header">
              <h3>💡 Recommendations</h3>
            </div>
            <div className="recommendation-list">
              {analysis.recommendations.map((rec, index) => (
                <div key={index} className="recommendation-item">
                  {rec}
                </div>
              ))}
            </div>
          </div>

          <div className="result-section">
            <div className="section-header">
              <h3>📝 Generated Instructions</h3>
              <button className="btn" onClick={exportInstructions}>
                💾 Export
              </button>
            </div>
            <div className="instructions-preview">
              <pre>{analysis.instructions}</pre>
            </div>
          </div>
        </div>
      )}

      <div className="info-section">
        <h3>ℹ️ How It Works</h3>
        <ul>
          <li>
            Select an agent to analyze its configuration, skills, and MCP settings
          </li>
          <li>
            Optionally provide codebase-specific patterns to enhance the analysis
          </li>
          <li>
            The generator will create optimized instructions compatible with:
            <ul>
              <li>GitHub Copilot</li>
              <li>Claude-Code</li>
              <li>OpenCode</li>
              <li>Cursor</li>
              <li>Antigravity</li>
            </ul>
          </li>
          <li>
            Export the generated instructions as copilot-instructions.md
          </li>
        </ul>
      </div>
    </div>
  );
}

export default PatternAnalysis;
