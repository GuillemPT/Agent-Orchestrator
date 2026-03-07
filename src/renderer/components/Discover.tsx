import { useState, useEffect, useCallback } from 'react';
import '../styles/Discover.css';
import type { GitSnippet, ProviderType, GitUser } from '../types/electron';

type Tab = 'browse' | 'publish';

const PROVIDER_LABELS: Record<ProviderType, string> = {
  github: 'GitHub Gists',
  gitlab: 'GitLab Snippets',
  bitbucket: 'Bitbucket Snippets',
};

interface Agent { id: string; metadata: { name: string; description?: string } }
interface Skill { id: string; metadata: { name: string } }

function Discover() {
  const [tab, setTab] = useState<Tab>('browse');
  const [connectedProviders, setConnectedProviders] = useState<{ type: ProviderType; user: GitUser }[]>([]);
  const [activeProvider, setActiveProvider] = useState<ProviderType>('github');

  // ── Browse state ─────────────────────────────────────────────────────────
  const [snippets, setSnippets] = useState<GitSnippet[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ snippet: GitSnippet; rawContent: string; filename: string } | null>(null);
  const [importing, setImporting] = useState(false);

  // ── Publish state ─────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<Agent[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [publishType, setPublishType] = useState<'agent' | 'skill'>('agent');
  const [publishId, setPublishId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [publishStatus, setPublishStatus] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [publishProvider, setPublishProvider] = useState<ProviderType>('github');

  useEffect(() => {
    window.api.gitProvider.getConnectedAccounts()
      .then(accounts => {
        setConnectedProviders(accounts);
        if (accounts.length > 0) {
          setActiveProvider(accounts[0].type);
          setPublishProvider(accounts[0].type);
        }
      })
      .catch(() => setConnectedProviders([]));
    window.api.agent.getAll().then(setAgents).catch(console.error);
    window.api.skill.getAll().then(setSkills).catch(console.error);
  }, []);

  const isConnected = useCallback((provider: ProviderType) => 
    connectedProviders.some(p => p.type === provider)
  , [connectedProviders]);

  const showPublishStatus = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setPublishStatus({ msg, kind });
    setTimeout(() => setPublishStatus(null), 4000);
  };

  // ── Browse actions ────────────────────────────────────────────────────────

  const loadMarketplace = useCallback(async () => {
    if (!isConnected(activeProvider)) return;
    setLoading(true);
    try {
      const items = await window.api.gitProvider.listMarketplaceSnippets(activeProvider);
      setSnippets(items);
    } catch {
      setSnippets([]);
    } finally {
      setLoading(false);
    }
  }, [activeProvider, isConnected]);

  useEffect(() => {
    if (tab === 'browse' && isConnected(activeProvider)) loadMarketplace();
  }, [tab, activeProvider, isConnected, loadMarketplace]);

  const openPreview = async (snippet: GitSnippet) => {
    const firstFile = Object.values(snippet.files)[0];
    if (!firstFile) return;
    let content = firstFile.content ?? '';
    // If content not included, fetch the full snippet
    if (!content) {
      try {
        const full = await window.api.gitProvider.getSnippet(snippet.provider, snippet.id);
        const fullFile = Object.values(full.files)[0];
        content = fullFile?.content ?? '(failed to load content)';
      } catch {
        content = '(failed to load content)';
      }
    }
    setPreview({ snippet, rawContent: content, filename: firstFile.filename });
  };

  const importAsAgent = async () => {
    if (!preview) return;
    setImporting(true);
    try {
      // Parse YAML frontmatter to extract agent name/description
      const frontmatterMatch = preview.rawContent.match(/^---\n([\s\S]*?)\n---/);
      const fm = frontmatterMatch?.[1] ?? '';
      const nameMatch = fm.match(/name:\s*(.+)/);
      const descMatch = fm.match(/description:\s*(.+)/);
      const body = preview.rawContent.replace(/^---[\s\S]*?---\n?/, '').trim();

      await window.api.agent.create({
        metadata: {
          name: nameMatch?.[1]?.trim() || preview.snippet.description.replace('[agent-orchestrator]', '').trim() || 'Imported Agent',
          description: descMatch?.[1]?.trim() || '',
          tags: ['imported', `from-${preview.snippet.provider}`],
          version: '1.0.0',
        },
        instructions: body,
        tools: [],
        skills: [],
      });
      alert('Agent imported successfully! Find it in the Agents panel.');
      setPreview(null);
    } catch (e) {
      alert(`Import failed: ${e}`);
    } finally {
      setImporting(false);
    }
  };

  const downloadPreview = () => {
    if (!preview) return;
    const blob = new Blob([preview.rawContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = preview.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Publish actions ───────────────────────────────────────────────────────

  const publishToProvider = async () => {
    if (!publishId) { showPublishStatus('Select an item to publish', 'err'); return; }
    if (!isConnected(publishProvider)) {
      showPublishStatus(`Not connected to ${PROVIDER_LABELS[publishProvider]}. Go to Settings to connect.`, 'err');
      return;
    }
    setPublishing(true);
    setPublishedUrl('');
    try {
      if (publishType === 'agent') {
        const agent = await window.api.agent.getById(publishId);
        const content = await window.api.agent.exportToMd(agent, 'github-copilot');
        const slugName = (agent.metadata?.name || 'agent').replace(/\s+/g, '-').toLowerCase();
        const snippet = await window.api.gitProvider.publishSnippet(
          publishProvider,
          `[agent-orchestrator] ${agent.metadata?.name}`,
          [{ filename: `${slugName}.agent.md`, content }],
          true,
        );
        setPublishedUrl(snippet.html_url);
        showPublishStatus(`Published to ${PROVIDER_LABELS[publishProvider]}!`);
      } else {
        const allSkills: Skill[] = await window.api.skill.getAll();
        const skill = allSkills.find(s => s.id === publishId);
        if (!skill) throw new Error('Skill not found');
        const content = await window.api.skill.exportToMd(skill as any, 'github-copilot');
        const slugName = (skill.metadata?.name || 'skill').replace(/\s+/g, '-').toLowerCase();
        const snippet = await window.api.gitProvider.publishSnippet(
          publishProvider,
          `[agent-orchestrator] skill: ${skill.metadata?.name}`,
          [{ filename: `${slugName}.skill.md`, content }],
          true,
        );
        setPublishedUrl(snippet.html_url);
        showPublishStatus(`Published to ${PROVIDER_LABELS[publishProvider]}!`);
      }
    } catch (e) {
      showPublishStatus(`Publish failed: ${e}`, 'err');
    } finally {
      setPublishing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
  };

  return (
    <div className="discover-layout">
      <div className="discover-header">
        <h2>Discover</h2>
        <p className="discover-subtitle">Browse the Agent Orchestrator marketplace across multiple providers.</p>
        <div className="ws-tabs">
          <button className={`ws-tab${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>Browse Marketplace</button>
          <button className={`ws-tab${tab === 'publish' ? ' active' : ''}`} onClick={() => setTab('publish')}>Publish</button>
        </div>
      </div>

      <div className="discover-body">
        {connectedProviders.length === 0 && (
          <div className="discover-no-auth">
            Connect a provider account (via Settings) to browse and publish agents.
          </div>
        )}

        {/* ── Browse tab ─────────────────────────────────────────── */}
        {tab === 'browse' && connectedProviders.length > 0 && (
          <>
            <div className="discover-toolbar">
              <div className="provider-filter">
                <label>Provider:</label>
                <select 
                  value={activeProvider} 
                  onChange={e => setActiveProvider(e.target.value as ProviderType)}
                  disabled={loading}
                >
                  {(['github', 'gitlab', 'bitbucket'] as ProviderType[]).map(p => {
                    const connected = isConnected(p);
                    return (
                      <option key={p} value={p} disabled={!connected}>
                        {PROVIDER_LABELS[p]}{connected ? '' : ' (not connected)'}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button className="btn" onClick={loadMarketplace} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
              <span className="discover-count">{snippets.length} item{snippets.length !== 1 ? 's' : ''}</span>
            </div>

            {snippets.length === 0 && !loading && (
              <div className="discover-empty">
                No marketplace snippets found. Be the first to publish one!
              </div>
            )}

            <div className="discover-grid">
              {snippets.map(s => (
                <div key={s.id} className="discover-card">
                  <div className="discover-card-title">
                    {s.description.replace('[agent-orchestrator]', '').trim() || 'Untitled'}
                  </div>
                  <div className="discover-card-meta">
                    <span className="discover-author">{s.owner_login ?? 'unknown'}</span>
                    <span className="discover-date">{formatDate(s.created_at)}</span>
                  </div>
                  <div className="discover-card-files">
                    {Object.keys(s.files).map(f => (
                      <span key={f} className="tag">{f.endsWith('.agent.md') ? 'agent' : f.endsWith('.skill.md') ? 'skill' : f}</span>
                    ))}
                  </div>
                  <div className="discover-card-actions">
                    <a href={s.html_url} target="_blank" rel="noreferrer" className="btn btn-xs">View</a>
                    <button className="btn btn-xs btn-primary" onClick={() => openPreview(s)}>Preview & Import</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Publish tab ─────────────────────────────────────────── */}
        {tab === 'publish' && (
          <div className="discover-publish">
            {connectedProviders.length === 0 ? (
              <p className="help-text">Connect a provider in Settings to publish.</p>
            ) : (
              <>
                <div className="discover-publish-form">
                  <div className="form-group">
                    <label>Publish to</label>
                    <select
                      value={publishProvider}
                      onChange={e => setPublishProvider(e.target.value as ProviderType)}
                      disabled={publishing}
                    >
                      {(['github', 'gitlab', 'bitbucket'] as ProviderType[]).map(p => {
                        const connected = isConnected(p);
                        const account = connectedProviders.find(cp => cp.type === p);
                        return (
                          <option key={p} value={p} disabled={!connected}>
                            {PROVIDER_LABELS[p]}{connected ? ` (${account?.user.login})` : ' (not connected)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>What to publish</label>
                    <div className="discover-type-row">
                      <label className="ws-check-label">
                        <input type="radio" value="agent" checked={publishType === 'agent'} onChange={() => { setPublishType('agent'); setPublishId(''); }} />
                        Agent
                      </label>
                      <label className="ws-check-label">
                        <input type="radio" value="skill" checked={publishType === 'skill'} onChange={() => { setPublishType('skill'); setPublishId(''); }} />
                        Skill
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Select {publishType}</label>
                    <select value={publishId} onChange={e => setPublishId(e.target.value)}>
                      <option value="">Choose…</option>
                      {(publishType === 'agent' ? agents : skills).map(item =>
                        <option key={item.id} value={item.id}>{item.metadata.name}</option>
                      )}
                    </select>
                  </div>

                  <button className="btn btn-primary" onClick={publishToProvider} disabled={publishing || !publishId}>
                    {publishing ? 'Publishing…' : `Publish to ${PROVIDER_LABELS[publishProvider]}`}
                  </button>

                  {publishStatus && (
                    <div className={`ws-status ws-status--${publishStatus.kind}`}>{publishStatus.msg}</div>
                  )}

                  {publishedUrl && (
                    <div className="discover-published-url">
                      Published: <a href={publishedUrl} target="_blank" rel="noreferrer">{publishedUrl}</a>
                    </div>
                  )}
                </div>

                <div className="discover-publish-info">
                  <h4>How it works</h4>
                  <ul>
                    <li>Your agent/skill is exported as a Markdown file and published as a public snippet.</li>
                    <li>The snippet is tagged with <code>[agent-orchestrator]</code> so others can find it.</li>
                    <li>Anyone using Agent Orchestrator can browse and import your agents.</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Preview modal ─────────────────────────────────────────── */}
      {preview && (
        <div className="discover-modal-overlay" onClick={() => setPreview(null)}>
          <div className="discover-modal" onClick={e => e.stopPropagation()}>
            <div className="discover-modal-header">
              <h3>{preview.filename}</h3>
              <button className="btn btn-xs" onClick={() => setPreview(null)}>✕</button>
            </div>
            <pre className="discover-modal-body">{preview.rawContent}</pre>
            <div className="discover-modal-footer">
              <button className="btn btn-sm" onClick={downloadPreview}>Download</button>
              {preview.filename.endsWith('.agent.md') && (
                <button className="btn btn-sm btn-primary" onClick={importAsAgent} disabled={importing}>
                  {importing ? 'Importing…' : 'Import as Agent'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Discover;
