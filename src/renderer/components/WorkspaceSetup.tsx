import { useState, useEffect } from 'react';
import '../styles/WorkspaceSetup.css';

type Platform = 'github-copilot' | 'claude' | 'cursor' | 'antigravity' | 'opencode';

const PLATFORM_LABELS: Record<Platform, string> = {
  'github-copilot': 'GitHub Copilot',
  claude: 'Claude',
  cursor: 'Cursor',
  antigravity: 'Antigravity',
  opencode: 'OpenCode',
};

const PLATFORM_OUTPUT_PATHS: Record<Platform, string> = {
  'github-copilot': '.github/copilot-instructions.md',
  claude: 'CLAUDE.md',
  cursor: '.cursor/rules/{name}.mdc',
  antigravity: 'antigravity.config.json',
  opencode: '.opencode/instructions.md',
};

const ALL_PLATFORMS = Object.keys(PLATFORM_LABELS) as Platform[];

interface Agent { id: string; metadata: { name: string } }
interface RepositoryAnalysis {
  languages: Record<string, number>;
  frameworks: string[];
  patterns: string[];
  suggestedInstructions: string;
}
interface GenerateResult { platform: Platform; path: string; content: string; deployed?: boolean }

type Tab = 'analyze' | 'generate';

function WorkspaceSetup() {
  const [tab, setTab] = useState<Tab>('analyze');

  // ── Analyze tab state ────────────────────────────────────────────────────
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [codebasePatterns, setCodebasePatterns] = useState('');
  const [globPattern, setGlobPattern] = useState('**/*.instructions.md');
  const [matchingFiles, setMatchingFiles] = useState<string[]>([]);
  const [repoAnalysis, setRepoAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [analyzingRepo, setAnalyzingRepo] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [instructions, setInstructions] = useState<{ content: string; patterns: string[]; recommendations: string[] } | null>(null);

  // ── Generate tab state ───────────────────────────────────────────────────
  const [genAgentId, setGenAgentId] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [checkedPlatforms, setCheckedPlatforms] = useState<Set<Platform>>(new Set(ALL_PLATFORMS));
  const [genResults, setGenResults] = useState<GenerateResult[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [genStatus, setGenStatus] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    window.api.agent.getAll()
      .then(setAgents)
      .catch(console.error);
  }, []);

  const showGenStatus = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setGenStatus({ msg, kind });
    setTimeout(() => setGenStatus(null), 4000);
  };

  // ── Analyze tab actions ──────────────────────────────────────────────────

  const analyzeRepository = async () => {
    setAnalyzingRepo(true);
    try {
      const result = await window.api.pattern.analyzeRepository();
      setRepoAnalysis(result);
      if (result.patterns.length > 0) setCodebasePatterns(result.patterns.join('\n'));
    } catch { alert('Failed to analyze repository'); }
    finally { setAnalyzingRepo(false); }
  };

  const findMatchingFiles = async () => {
    try {
      const valid = await window.api.pattern.validateGlobPattern(globPattern);
      if (!valid) { alert('Invalid glob pattern'); return; }
      setMatchingFiles(await window.api.pattern.findFilesMatchingPattern(globPattern));
    } catch { alert('Failed to find files'); }
  };

  const generateInstructions = async () => {
    if (!selectedAgentId) { alert('Select an agent first'); return; }
    setGenerating(true);
    try {
      const agent = await window.api.agent.getById(selectedAgentId);
      const patterns = codebasePatterns.split('\n').map(p => p.trim()).filter(Boolean);
      setInstructions(await window.api.pattern.generateInstructions(agent, patterns.length ? patterns : undefined));
    } catch { alert('Failed to generate instructions'); }
    finally { setGenerating(false); }
  };

  const downloadInstructions = () => {
    if (!instructions) return;
    const blob = new Blob([instructions.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'copilot-instructions.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Generate tab actions ─────────────────────────────────────────────────

  const togglePlatform = (p: Platform) => {
    setCheckedPlatforms(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  };

  const generateAll = async () => {
    if (!genAgentId) { showGenStatus('Select an agent first', 'err'); return; }
    setDeploying(true);
    setGenResults([]);
    try {
      const agent = await window.api.agent.getById(genAgentId);
      const results: GenerateResult[] = [];
      for (const platform of checkedPlatforms) {
        const content = await window.api.agent.exportToMd(agent, platform);
        const relPath = PLATFORM_OUTPUT_PATHS[platform].replace(
          '{name}',
          (agent.metadata?.name || 'agent').replace(/\s+/g, '-').toLowerCase(),
        );
        results.push({ platform, path: relPath, content });
      }
      setGenResults(results);
      showGenStatus(`Generated ${results.length} file(s)`);
    } catch (e) {
      showGenStatus(`Generation failed: ${e}`, 'err');
    } finally {
      setDeploying(false);
    }
  };

  const deployAll = async () => {
    if (!projectPath.trim()) { showGenStatus('Set a project path first', 'err'); return; }
    if (!genResults.length) { showGenStatus('Generate files first', 'err'); return; }
    setDeploying(true);
    try {
      const agent = await window.api.agent.getById(genAgentId);
      const deployed: GenerateResult[] = [];
      for (const r of genResults) {
        const destPath = await window.api.workspace.deployAgent(agent, r.platform, projectPath);
        deployed.push({ ...r, deployed: true, path: destPath });
      }
      setGenResults(deployed);
      showGenStatus(`Deployed ${deployed.length} file(s) to ${projectPath}`);
    } catch (e) {
      showGenStatus(`Deploy failed: ${e}`, 'err');
    } finally {
      setDeploying(false);
    }
  };

  const downloadFile = (r: GenerateResult) => {
    const blob = new Blob([r.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.path.split('/').pop() || 'config';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="ws-layout">
      <div className="ws-header">
        <h2>Workspace Setup</h2>
        <p className="ws-subtitle">Analyze your repository and generate AI configuration files for every platform.</p>
        <div className="ws-tabs">
          <button className={`ws-tab${tab === 'analyze' ? ' active' : ''}`} onClick={() => setTab('analyze')}>Analyze</button>
          <button className={`ws-tab${tab === 'generate' ? ' active' : ''}`} onClick={() => setTab('generate')}>Generate All Platforms</button>
        </div>
      </div>

      <div className="ws-body">
        {/* ── Analyze tab ──────────────────────────────────────── */}
        {tab === 'analyze' && (
          <div className="ws-section-list">
            <section className="ws-section">
              <h3>Repository Analysis</h3>
              <p className="help-text">Detect languages, frameworks, and patterns automatically.</p>
              <button className="btn btn-primary" onClick={analyzeRepository} disabled={analyzingRepo}>
                {analyzingRepo ? 'Analyzing…' : 'Analyze Repository'}
              </button>
              {repoAnalysis && (
                <div className="ws-repo-results">
                  <div className="ws-tags-row">
                    <strong>Languages:</strong>
                    {Object.keys(repoAnalysis.languages).map(l => <span key={l} className="tag">{l}</span>)}
                  </div>
                  {repoAnalysis.frameworks.length > 0 && (
                    <div className="ws-tags-row">
                      <strong>Frameworks:</strong>
                      {repoAnalysis.frameworks.map(f => <span key={f} className="tag tag-framework">{f}</span>)}
                    </div>
                  )}
                  <div>
                    <strong>Detected patterns:</strong>
                    <ul className="ws-pattern-list">
                      {repoAnalysis.patterns.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </section>

            <section className="ws-section">
              <h3>Glob Pattern Finder</h3>
              <p className="help-text">Find instruction files that match a glob.</p>
              <div className="ws-inline-row">
                <input value={globPattern} onChange={e => setGlobPattern(e.target.value)} placeholder="**/*.instructions.md" />
                <button className="btn" onClick={findMatchingFiles}>Find Files</button>
              </div>
              {matchingFiles.length > 0 && (
                <ul className="ws-file-list">
                  {matchingFiles.map((f, i) => <li key={i} className="ws-file-item">{f}</li>)}
                </ul>
              )}
            </section>

            <section className="ws-section">
              <h3>Generate Copilot Instructions</h3>
              <div className="form-group">
                <label>Agent</label>
                <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)}>
                  <option value="">Select an agent…</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.metadata.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Codebase patterns (one per line)</label>
                <textarea
                  value={codebasePatterns}
                  onChange={e => setCodebasePatterns(e.target.value)}
                  rows={6}
                  placeholder="- Uses React with TypeScript&#10;- Clean Architecture&#10;- TDD"
                />
              </div>
              <button className="btn btn-primary" onClick={generateInstructions} disabled={generating || !selectedAgentId}>
                {generating ? 'Generating…' : 'Generate Instructions'}
              </button>

              {instructions && (
                <div className="ws-instructions-result">
                  <div className="ws-section-header">
                    <h4>Generated Instructions</h4>
                    <button className="btn btn-sm" onClick={downloadInstructions}>Download</button>
                  </div>
                  <pre className="ws-instructions-preview">{instructions.content}</pre>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Generate tab ──────────────────────────────────────── */}
        {tab === 'generate' && (
          <div className="ws-generate">
            <div className="ws-generate-config">
              <div className="form-group">
                <label>Agent to export</label>
                <select value={genAgentId} onChange={e => setGenAgentId(e.target.value)}>
                  <option value="">Select an agent…</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.metadata.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Target project path (for Deploy)</label>
                <input
                  value={projectPath}
                  onChange={e => setProjectPath(e.target.value)}
                  placeholder="/path/to/your/project"
                />
              </div>

              <div className="form-group">
                <label>Platforms</label>
                <div className="ws-platform-checks">
                  {ALL_PLATFORMS.map(p => (
                    <label key={p} className="ws-check-label">
                      <input
                        type="checkbox"
                        checked={checkedPlatforms.has(p)}
                        onChange={() => togglePlatform(p)}
                      />
                      {PLATFORM_LABELS[p]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="ws-generate-actions">
                <button className="btn btn-primary" onClick={generateAll} disabled={deploying || !genAgentId}>
                  {deploying ? 'Working…' : 'Generate'}
                </button>
                {projectPath.trim() && genResults.length > 0 && (
                  <button className="btn" onClick={deployAll} disabled={deploying}>
                    Deploy All to Project
                  </button>
                )}
              </div>

              {genStatus && (
                <div className={`ws-status ws-status--${genStatus.kind}`}>{genStatus.msg}</div>
              )}
            </div>

            {genResults.length > 0 && (
              <div className="ws-results-table">
                <h4>Generated files</h4>
                <table>
                  <thead>
                    <tr><th>Platform</th><th>Output path</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {genResults.map(r => (
                      <tr key={r.platform}>
                        <td>{PLATFORM_LABELS[r.platform]}</td>
                        <td className="ws-path-cell"><code>{r.path}</code></td>
                        <td>{r.deployed ? <span className="ws-badge ws-badge--ok">Deployed</span> : <span className="ws-badge">Ready</span>}</td>
                        <td><button className="btn btn-xs" onClick={() => downloadFile(r)}>Download</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkspaceSetup;
