import { useState, useEffect, useCallback } from 'react';
import '../styles/Discover.css';
import type { GistItem } from '../types/electron';

type Tab = 'browse' | 'publish';

interface Agent { id: string; metadata: { name: string; description?: string } }
interface Skill { id: string; metadata: { name: string } }

function Discover() {
  const [tab, setTab] = useState<Tab>('browse');
  const [ghConnected, setGhConnected] = useState(false);

  // ── Browse state ─────────────────────────────────────────────────────────
  const [gists, setGists] = useState<GistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ gist: GistItem; rawContent: string; filename: string } | null>(null);
  const [importing, setImporting] = useState(false);

  // ── Publish state ─────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<Agent[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [publishType, setPublishType] = useState<'agent' | 'skill'>('agent');
  const [publishId, setPublishId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [publishStatus, setPublishStatus] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    window.api.github.getUser()
      .then(u => setGhConnected(!!u))
      .catch(() => setGhConnected(false));
    window.api.agent.getAll().then(setAgents).catch(console.error);
    window.api.skill.getAll().then(setSkills).catch(console.error);
  }, []);

  const showPublishStatus = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setPublishStatus({ msg, kind });
    setTimeout(() => setPublishStatus(null), 4000);
  };

  // ── Browse actions ────────────────────────────────────────────────────────

  const loadMarketplace = useCallback(async () => {
    setLoading(true);
    try {
      setGists(await window.api.github.getMarketplaceGists());
    } catch {
      setGists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'browse' && ghConnected) loadMarketplace();
  }, [tab, ghConnected, loadMarketplace]);

  const openPreview = async (gist: GistItem) => {
    const firstFile = Object.values(gist.files)[0];
    if (!firstFile) return;
    let content = firstFile.content ?? '';
    if (!content && firstFile.raw_url) {
      try { content = await fetch(firstFile.raw_url).then(r => r.text()); }
      catch { content = '(failed to load content)'; }
    }
    setPreview({ gist, rawContent: content, filename: firstFile.filename });
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
          name: nameMatch?.[1]?.trim() || preview.gist.description.replace('[agent-orchestrator]', '').trim() || 'Imported Agent',
          description: descMatch?.[1]?.trim() || '',
          tags: ['imported'],
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

  const publishToGist = async () => {
    if (!publishId) { showPublishStatus('Select an item to publish', 'err'); return; }
    setPublishing(true);
    setPublishedUrl('');
    try {
      if (publishType === 'agent') {
        const agent = await window.api.agent.getById(publishId);
        const content = await window.api.agent.exportToMd(agent, 'github-copilot');
        const slugName = (agent.metadata?.name || 'agent').replace(/\s+/g, '-').toLowerCase();
        const gist = await window.api.github.publishGist(
          `[agent-orchestrator] ${agent.metadata?.name}`,
          [{ filename: `${slugName}.agent.md`, content }],
        );
        setPublishedUrl(gist.html_url);
        showPublishStatus('Published!');
      } else {
        const allSkills: Skill[] = await window.api.skill.getAll();
        const skill = allSkills.find(s => s.id === publishId);
        if (!skill) throw new Error('Skill not found');
        const content = await window.api.skill.exportToMd(skill as any, 'github-copilot');
        const slugName = (skill.metadata?.name || 'skill').replace(/\s+/g, '-').toLowerCase();
        const gist = await window.api.github.publishGist(
          `[agent-orchestrator] skill: ${skill.metadata?.name}`,
          [{ filename: `${slugName}.skill.md`, content }],
        );
        setPublishedUrl(gist.html_url);
        showPublishStatus('Published!');
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
        <p className="discover-subtitle">Browse the Agent Orchestrator marketplace powered by GitHub Gists.</p>
        <div className="ws-tabs">
          <button className={`ws-tab${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>Browse Marketplace</button>
          <button className={`ws-tab${tab === 'publish' ? ' active' : ''}`} onClick={() => setTab('publish')}>Publish</button>
        </div>
      </div>

      <div className="discover-body">
        {!ghConnected && (
          <div className="discover-no-auth">
            Connect your GitHub account (via the sidebar) to browse and publish agents.
          </div>
        )}

        {/* ── Browse tab ─────────────────────────────────────────── */}
        {tab === 'browse' && ghConnected && (
          <>
            <div className="discover-toolbar">
              <button className="btn" onClick={loadMarketplace} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
              <span className="discover-count">{gists.length} item{gists.length !== 1 ? 's' : ''}</span>
            </div>

            {gists.length === 0 && !loading && (
              <div className="discover-empty">
                No marketplace gists found. Be the first to publish one!
              </div>
            )}

            <div className="discover-grid">
              {gists.map(g => (
                <div key={g.id} className="discover-card">
                  <div className="discover-card-title">
                    {g.description.replace('[agent-orchestrator]', '').trim() || 'Untitled'}
                  </div>
                  <div className="discover-card-meta">
                    <span className="discover-author">{g.owner?.login ?? 'unknown'}</span>
                    <span className="discover-date">{formatDate(g.created_at)}</span>
                  </div>
                  <div className="discover-card-files">
                    {Object.keys(g.files).map(f => (
                      <span key={f} className="tag">{f.endsWith('.agent.md') ? 'agent' : f.endsWith('.skill.md') ? 'skill' : f}</span>
                    ))}
                  </div>
                  <div className="discover-card-actions">
                    <a href={g.html_url} target="_blank" rel="noreferrer" className="btn btn-xs">View Gist</a>
                    <button className="btn btn-xs btn-primary" onClick={() => openPreview(g)}>Preview & Import</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Publish tab ─────────────────────────────────────────── */}
        {tab === 'publish' && (
          <div className="discover-publish">
            {!ghConnected ? (
              <p className="help-text">Connect GitHub to publish.</p>
            ) : (
              <>
                <div className="discover-publish-form">
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

                  <button className="btn btn-primary" onClick={publishToGist} disabled={publishing || !publishId}>
                    {publishing ? 'Publishing…' : 'Publish as GitHub Gist'}
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
                    <li>Your agent/skill is exported as a Markdown file and published as a public GitHub Gist.</li>
                    <li>The Gist is tagged with <code>[agent-orchestrator]</code> so others can find it.</li>
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
