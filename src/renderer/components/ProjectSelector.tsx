import { useState, useEffect, useRef } from 'react';
import type { Project, GitRepo, ProviderType } from '../types/electron';
import '../styles/ProjectSelector.css';
import { api } from '../api';

const PAGE_SIZE = 10;

interface DiscoveredItem {
  type: 'agent' | 'skill' | 'mcp';
  name: string;
  path: string;
  platform: string;
  content: string;
}

interface ProjectSelectorProps {
  currentProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
}

export function ProjectSelector({ currentProjectId, onProjectChange }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectedProviders, setConnectedProviders] = useState<ProviderType[]>([]);
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importPage, setImportPage] = useState(0);
  const [menuOpenProjectId, setMenuOpenProjectId] = useState<string | null>(null);
  const [providerLoadError, setProviderLoadError] = useState<string | null>(null);
  // Discovery state
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [discoveryProjectId, setDiscoveryProjectId] = useState<string | null>(null);
  const [discoveryProjectName, setDiscoveryProjectName] = useState('');
  const [discoveredItems, setDiscoveredItems] = useState<DiscoveredItem[]>([]);
  const [selectedDiscovered, setSelectedDiscovered] = useState<Set<number>>(new Set());
  const [discovering, setDiscovering] = useState(false);
  const [importingDiscovered, setImportingDiscovered] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
    loadConnectedProviders();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setMenuOpenProjectId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const loaded = await api.project.getAll();
      setProjects(loaded);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConnectedProviders = async (): Promise<ProviderType[]> => {
    try {
      setProviderLoadError(null);
      const accounts = await api.gitProvider.getConnectedAccounts();
      const types = accounts.map((a: { type: ProviderType }) => a.type);
      setConnectedProviders(types);
      return types;
    } catch (error) {
      console.error('Failed to load connected providers:', error);
      setProviderLoadError('Could not load connected accounts — check Settings → Git Providers.');
      return [];
    }
  };

  const loadReposFromProvider = async (provider: ProviderType) => {
    try {
      setLoadingRepos(true);
      const providerRepos = await api.gitProvider.listRepos(provider);
      setRepos(prev => {
        // Merge repos, avoiding duplicates by full_name
        const existing = new Set(prev.map(r => r.full_name));
        const newRepos = providerRepos.filter(r => !existing.has(r.full_name));
        return [...prev, ...newRepos];
      });
    } catch (error) {
      console.error(`Failed to load repos from ${provider}:`, error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleShowImport = async () => {
    setRepos([]);
    setSelectedRepos(new Set());
    setRepoSearch('');
    setImportPage(0);
    setIsOpen(false);
    // Fetch fresh accounts first so the modal shows correct state from the start
    const freshProviders = await loadConnectedProviders();
    setShowImportModal(true);
    // Load repos from all connected providers
    for (const provider of freshProviders) {
      await loadReposFromProvider(provider);
    }
  };

  const toggleRepoSelection = (repoKey: string) => {
    setSelectedRepos(prev => {
      const next = new Set(prev);
      if (next.has(repoKey)) {
        next.delete(repoKey);
      } else {
        next.add(repoKey);
      }
      return next;
    });
  };

  const handleImportSelected = async () => {
    if (selectedRepos.size === 0) return;

    setImporting(true);
    const newProjects: Project[] = [];

    for (const repoKey of selectedRepos) {
      const repo = repos.find(r => `${r.provider}-${r.id}` === repoKey);
      if (!repo) continue;

      try {
        const created = await api.project.create({
          name: repo.name,
          description: repo.description || `Imported from ${repo.provider}`,
          repoUrl: repo.html_url,
        });
        newProjects.push(created);
      } catch (error) {
        console.error(`Failed to import ${repo.full_name}:`, error);
      }
    }

    if (newProjects.length > 0) {
      setProjects(prev => [...newProjects, ...prev]);
      onProjectChange(newProjects[0].id);
    }

    setSelectedRepos(new Set());
    setImporting(false);
    setShowImportModal(false);

    // Auto-trigger discovery for the first imported project that has a repoUrl
    const firstWithRepo = newProjects.find(p => p.repoUrl);
    if (firstWithRepo) {
      runDiscovery(firstWithRepo.id, firstWithRepo.name);
    }
  };

  const runDiscovery = async (projectId: string, projectName: string) => {
    setDiscoveryProjectId(projectId);
    setDiscoveryProjectName(projectName);
    setDiscoveredItems([]);
    setSelectedDiscovered(new Set());
    setDiscoveryError(null);
    setDiscovering(true);
    setShowDiscoveryModal(true);

    try {
      const result = await api.project.discover(projectId);
      setDiscoveredItems(result.items ?? []);
      // Select all by default
      setSelectedDiscovered(new Set((result.items ?? []).map((_: any, i: number) => i)));
    } catch (err: any) {
      setDiscoveryError(err.message || 'Discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  const handleImportDiscovered = async () => {
    if (!discoveryProjectId || selectedDiscovered.size === 0) return;
    setImportingDiscovered(true);
    try {
      const items = discoveredItems.filter((_, i) => selectedDiscovered.has(i));
      const result = await api.project.importDiscovered(discoveryProjectId, items);
      setShowDiscoveryModal(false);
      loadProjects(); // refresh counts
      if (result.created?.skipped > 0) {
        alert(`Imported successfully. ${result.created.skipped} item(s) were skipped (already exist).`);
      }
    } catch (err) {
      console.error('Failed to import discovered items:', err);
    } finally {
      setImportingDiscovered(false);
    }
  };

  const toggleDiscoveredItem = (idx: number) => {
    setSelectedDiscovered(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSelectProject = (projectId: string | null) => {
    onProjectChange(projectId);
    setIsOpen(false);
    setMenuOpenProjectId(null);
  };

  const handleClearItems = async (id: string, name: string) => {
    if (!confirm(`Clear all imported agents, skills and MCP configs from "${name}"?\nYou can re-scan the repository afterwards.`)) return;
    try {
      const result = await api.project.clearItems(id);
      const d = result.deleted;
      alert(`Cleared: ${d.agents} agent(s), ${d.skills} skill(s), ${d.mcps} MCP config(s).`);
      // Refresh project list to update counts
      loadProjects();
      // If viewing this project, re-trigger a UI refresh
      if (currentProjectId === id) {
        onProjectChange(null);
        setTimeout(() => onProjectChange(id), 0);
      }
    } catch (err) {
      console.error('Failed to clear items:', err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!confirm(`Remove "${project?.name}"?\nThis will not delete its agents or skills.`)) return;
    try {
      await api.project.delete(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      // Always switch to "All Projects" after deleting so agents/skills refresh
      onProjectChange(null);
      setMenuOpenProjectId(null);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const currentProject = currentProjectId
    ? projects.find(p => p.id === currentProjectId)
    : null;

  // Filter repos by search term and exclude already imported ones
  const importedRepoUrls = new Set(projects.map(p => p.repoUrl).filter(Boolean));
  const filteredRepos = repos
    .filter(r => !importedRepoUrls.has(r.html_url))
    .filter(r => 
      !repoSearch || 
      r.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      r.description?.toLowerCase().includes(repoSearch.toLowerCase())
    );

  const PROVIDER_ICONS: Record<ProviderType, string> = {
    github: '🐙',
    gitlab: '🦊',
    bitbucket: '🪣',
  };

  // Paginated repo list
  const totalPages = Math.ceil(filteredRepos.length / PAGE_SIZE);
  const pagedRepos = filteredRepos.slice(importPage * PAGE_SIZE, (importPage + 1) * PAGE_SIZE);

  return (
    <>
      <div className="project-selector" ref={dropdownRef}>
        <button
          className="project-selector-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="project-icon">{currentProject?.repoUrl ? '🔗' : '📁'}</span>
          <span className="project-name">
            {isLoading ? 'Loading…' : (currentProject?.name ?? 'All Projects')}
          </span>
          <span className="project-chevron">{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div className="project-selector-dropdown">
            <button
              className={`project-option ${!currentProjectId ? 'active' : ''}`}
              onClick={() => handleSelectProject(null)}
            >
              <span className="project-option-icon">🌐</span>
              <span>All Projects</span>
            </button>

            <div className="project-option-divider" />

            {projects.map(project => (
              <div key={project.id} className="project-option-row">
                <button
                  className={`project-option project-option-main ${currentProjectId === project.id ? 'active' : ''}`}
                  onClick={() => handleSelectProject(project.id)}
                  title={project.repoUrl || undefined}
                >
                  <span className="project-option-icon">{project.repoUrl ? '🔗' : '📁'}</span>
                  <span>{project.name}</span>
                </button>
                <button
                  className="project-option-menu-btn"
                  onClick={e => { e.stopPropagation(); setMenuOpenProjectId(prev => prev === project.id ? null : project.id); }}
                >
                  ⋮
                </button>
                {menuOpenProjectId === project.id && (
                  <div className="project-option-inline-menu" onClick={e => e.stopPropagation()}>
                    <button className="project-option-inline-item"
                            onClick={() => { handleSelectProject(project.id); setMenuOpenProjectId(null); }}>
                      📌 Select
                    </button>
                    {project.repoUrl && (
                      <button className="project-option-inline-item"
                              onClick={() => { runDiscovery(project.id, project.name); setMenuOpenProjectId(null); setIsOpen(false); }}>
                        🔍 Scan for agents/skills
                      </button>
                    )}
                    <button className="project-option-inline-item"
                            onClick={() => { handleClearItems(project.id, project.name); setMenuOpenProjectId(null); }}>
                      🧹 Clear imported items
                    </button>
                    <button className="project-option-inline-item project-option-delete"
                            onClick={() => handleDeleteProject(project.id)}>
                      🗑️ Remove project
                    </button>
                  </div>
                )}
              </div>
            ))}

            {projects.length === 0 && !isLoading && (
              <div className="project-option-empty">No projects yet</div>
            )}

            <div className="project-option-divider" />

            <button
              className="project-option project-option-import"
              onClick={handleShowImport}
            >
              <span className="project-option-icon">⬇️</span>
              <span>Import repos…</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Import Modal ──────────────────────────────────────────────────── */}
      {showImportModal && (
        <div className="import-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowImportModal(false); }}>
          <div className="import-modal">
            <div className="import-modal-header">
              <h3>Import repositories</h3>
              <button className="btn btn-xs import-modal-close" onClick={() => setShowImportModal(false)}>✕</button>
            </div>

            {connectedProviders.length === 0 && !loadingRepos ? (
              <div className="import-modal-empty">
                {providerLoadError || 'No providers connected. Go to Settings to connect GitHub, GitLab, or Bitbucket.'}
              </div>
            ) : (
              <>
                <div className="import-modal-search-row">
                  <input
                    type="text"
                    className="project-import-search"
                    placeholder="Search repositories…"
                    value={repoSearch}
                    onChange={e => { setRepoSearch(e.target.value); setImportPage(0); }}
                    autoFocus
                  />
                </div>

                {loadingRepos && (
                  <div className="project-import-loading">Loading repositories…</div>
                )}

                <div className="import-modal-repos">
                  {pagedRepos.map(repo => {
                    const repoKey = `${repo.provider}-${repo.id}`;
                    const isSelected = selectedRepos.has(repoKey);
                    return (
                      <label
                        key={repoKey}
                        className={`project-import-repo ${isSelected ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRepoSelection(repoKey)}
                          className="project-import-checkbox"
                        />
                        <span className="project-import-repo-icon">
                          {PROVIDER_ICONS[repo.provider]}
                        </span>
                        <div className="project-import-repo-info">
                          <span className="project-import-repo-name">{repo.full_name}</span>
                          {repo.description && (
                            <span className="project-import-repo-desc">{repo.description}</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                  {!loadingRepos && filteredRepos.length === 0 && (
                    <div className="project-import-empty">
                      {repoSearch ? 'No matching repositories' : 'No repositories to import'}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="import-modal-pagination">
                    <button
                      className="btn btn-xs"
                      onClick={() => setImportPage(p => Math.max(0, p - 1))}
                      disabled={importPage === 0}
                    >
                      ‹ Prev
                    </button>
                    <span className="import-modal-page-info">
                      {importPage + 1} / {totalPages}
                    </span>
                    <button
                      className="btn btn-xs"
                      onClick={() => setImportPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={importPage >= totalPages - 1}
                    >
                      Next ›
                    </button>
                  </div>
                )}

                <div className="import-modal-footer">
                  <span className="project-import-count">
                    {selectedRepos.size > 0 ? `${selectedRepos.size} selected` : `${filteredRepos.length} repos`}
                  </span>
                  <div className="import-modal-footer-actions">
                    <button className="btn btn-sm" onClick={() => setShowImportModal(false)}>
                      Cancel
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleImportSelected}
                      disabled={importing || selectedRepos.size === 0}
                    >
                      {importing ? 'Importing…' : `Import ${selectedRepos.size > 0 ? selectedRepos.size : ''} Project${selectedRepos.size !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Discovery Modal ───────────────────────────────────────────────── */}
      {showDiscoveryModal && (
        <div className="import-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowDiscoveryModal(false); }}>
          <div className="import-modal">
            <div className="import-modal-header">
              <h3>🔍 Scan: {discoveryProjectName}</h3>
              <button className="btn btn-xs import-modal-close" onClick={() => setShowDiscoveryModal(false)}>✕</button>
            </div>

            {discovering ? (
              <div className="project-import-loading">
                Scanning repository for agents, skills and MCP configs…
              </div>
            ) : discoveryError ? (
              <div className="import-modal-empty" style={{ color: 'var(--text-error, #f44)' }}>
                {discoveryError}
              </div>
            ) : discoveredItems.length === 0 ? (
              <div className="import-modal-empty">
                No agents, skills or MCP configs found in this repository.
              </div>
            ) : (
              <>
                <div style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Found {discoveredItems.length} item{discoveredItems.length !== 1 ? 's' : ''}. Select which to import:
                </div>
                <div className="import-modal-repos">
                  {discoveredItems.map((item, idx) => {
                    const isSelected = selectedDiscovered.has(idx);
                    const typeIcons: Record<string, string> = { agent: '🤖', skill: '⚡', mcp: '🔧' };
                    return (
                      <label key={idx} className={`project-import-repo ${isSelected ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDiscoveredItem(idx)}
                          className="project-import-checkbox"
                        />
                        <span className="project-import-repo-icon">
                          {typeIcons[item.type] ?? '📄'}
                        </span>
                        <div className="project-import-repo-info">
                          <span className="project-import-repo-name">
                            {item.name}
                          </span>
                          <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6, textTransform: 'uppercase' }}>{item.type}</span>
                          <span className="project-import-repo-desc">{item.path} · {item.platform}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="import-modal-footer">
                  <span className="project-import-count">{selectedDiscovered.size} selected</span>
                  <div className="import-modal-footer-actions">
                    <button className="btn btn-sm" onClick={() => setShowDiscoveryModal(false)}>
                      Skip
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleImportDiscovered}
                      disabled={importingDiscovered || selectedDiscovered.size === 0}
                    >
                      {importingDiscovered ? 'Importing…' : `Import ${selectedDiscovered.size} Item${selectedDiscovered.size !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
