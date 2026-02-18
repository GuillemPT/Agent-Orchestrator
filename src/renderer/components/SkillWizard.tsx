import { useState, useEffect } from 'react';
import '../styles/SkillWizard.css';

type Platform = 'github-copilot' | 'claude' | 'cursor' | 'antigravity' | 'opencode';

const PLATFORM_LABELS: Record<Platform, string> = {
  'github-copilot': 'GitHub Copilot',
  claude: 'Claude',
  cursor: 'Cursor',
  antigravity: 'Antigravity',
  opencode: 'OpenCode',
};

interface Skill {
  id: string;
  metadata: {
    name: string;
    version: string;
    description: string;
    category?: string;
  };
  markdown?: string;
  yaml?: {
    content: string;
    schema?: string;
  };
  scripts: {
    language: string;
    content: string;
    path?: string;
  }[];
}

function SkillWizard() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null);
  const [step, setStep] = useState<'metadata' | 'markdown' | 'yaml' | 'scripts'>('metadata');
  const [descriptionValidation, setDescriptionValidation] = useState<{ score: number; suggestions: string[] } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [exportPlatform, setExportPlatform] = useState<Platform>('github-copilot');

  // PR modal state
  const [showPRModal, setShowPRModal] = useState(false);
  const [prOwnerRepo, setPrOwnerRepo] = useState('');
  const [prHead, setPrHead] = useState('');
  const [prBase, setPrBase] = useState('main');
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [prCreating, setPrCreating] = useState(false);
  const [prResult, setPrResult] = useState<{ url: string; number: number } | null>(null);
  const [prError, setPrError] = useState<string | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const loadedSkills = await window.api.skill.getAll();
      setSkills(loadedSkills);
    } catch (error) {
      console.error('Failed to load skills:', error);
    }
  };

  const createNewSkill = async () => {
    try {
      const newSkill = await window.api.skill.create({
        metadata: {
          name: 'New Skill',
          version: '1.0.0',
          description: '',
        },
        scripts: [],
      });
      setSkills([...skills, newSkill]);
      setCurrentSkill(newSkill);
      setStep('metadata');
    } catch (error) {
      console.error('Failed to create skill:', error);
    }
  };

  const saveSkill = async () => {
    if (!currentSkill) return;

    try {
      await window.api.skill.update(currentSkill.id, currentSkill);
      loadSkills();
    } catch (error) {
      console.error('Failed to save skill:', error);
    }
  };

  const deleteSkill = async () => {
    if (!currentSkill) return;

    if (confirm(`Are you sure you want to delete "${currentSkill.metadata.name}"?`)) {
      try {
        await window.api.skill.delete(currentSkill.id);
        setCurrentSkill(null);
        loadSkills();
      } catch (error) {
        console.error('Failed to delete skill:', error);
      }
    }
  };

  const exportToMd = async () => {
    if (!currentSkill) return;

    try {
      const content = await window.api.skill.exportToMd(currentSkill, exportPlatform);
      const isJson = exportPlatform === 'antigravity';
      const isMdc = exportPlatform === 'cursor';
      const ext = isJson ? '.json' : isMdc ? '.mdc' : '.md';
      const blob = new Blob([content], { type: isJson ? 'application/json' : 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentSkill.metadata.name}.skill${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export skill:', error);
    }
  };

  const exportToYaml = async () => {
    if (!currentSkill) return;

    try {
      const yaml = await window.api.skill.exportToYaml(currentSkill);
      const blob = new Blob([yaml], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentSkill.metadata.name}.yaml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export skill to YAML:', error);
    }
  };

  const createDirectory = async () => {
    if (!currentSkill) return;

    try {
      // Ask user for directory path
      const basePath = prompt('Enter the base path where the skill directory should be created:', '.github/skills');
      if (!basePath) return;

      await window.api.skill.createDirectory(currentSkill, basePath);
      alert(`Skill directory created successfully at ${basePath}/${currentSkill.metadata.name.toLowerCase().replace(/\s+/g, '-')}`);
    } catch (error) {
      console.error('Failed to create skill directory:', error);
      alert('Failed to create skill directory. Check console for details.');
    }
  };

  const validateDescription = async () => {
    if (!currentSkill || !currentSkill.metadata.description) return;

    try {
      setIsValidating(true);
      const validation = await window.api.skill.validateDescription(currentSkill.metadata.description);
      setDescriptionValidation(validation);
    } catch (error) {
      console.error('Failed to validate description:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const openPRModal = () => {
    if (!currentSkill) return;
    const name = currentSkill.metadata.name;
    setPrTitle(`Add skill: ${name}`);
    setPrBody(`Adds the **${name}** skill configuration generated by Agent Orchestrator.\n\n${currentSkill.metadata.description || ''}`);
    setPrHead(`feat/add-skill-${name.replace(/\s+/g, '-').toLowerCase()}`);
    setPrResult(null);
    setPrError(null);
    setShowPRModal(true);
  };

  const handleCreatePR = async () => {
    if (!currentSkill) return;
    const [owner, repo] = prOwnerRepo.split('/');
    if (!owner || !repo || !prHead || !prTitle) {
      setPrError('Please fill in all required fields (owner/repo, head branch, title).');
      return;
    }
    setPrCreating(true);
    setPrError(null);
    try {
      const name = currentSkill.metadata.name.replace(/\s+/g, '-').toLowerCase();
      const content = await window.api.skill.exportToMd(currentSkill, 'github-copilot');
      await window.api.github.pushFiles(
        owner, repo, prBase, prHead,
        [{ path: `.github/instructions/${name}.instructions.md`, content }],
        `chore: add ${currentSkill.metadata.name} skill config`,
      );
      const result = await window.api.github.createPR({ owner, repo, head: prHead, base: prBase, title: prTitle, body: prBody });
      setPrResult(result);
    } catch (e: any) {
      setPrError(e?.message || String(e));
    } finally {
      setPrCreating(false);
    }
  };

  const updateField = (path: string[], value: any) => {
    if (!currentSkill) return;

    const updated = { ...currentSkill };
    let obj: any = updated;
    for (let i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) obj[path[i]] = {};
      obj = obj[path[i]];
    }
    obj[path[path.length - 1]] = value;
    setCurrentSkill(updated);

    // Auto-validate description when it changes
    if (path.join('.') === 'metadata.description' && value) {
      validateDescription();
    }
  };

  const addScript = () => {
    if (!currentSkill) return;
    const scripts = [...currentSkill.scripts, { language: 'bash', content: '', path: '' }];
    setCurrentSkill({ ...currentSkill, scripts });
  };

  const removeScript = (index: number) => {
    if (!currentSkill) return;
    const scripts = currentSkill.scripts.filter((_, i) => i !== index);
    setCurrentSkill({ ...currentSkill, scripts });
  };

  const updateScript = (index: number, field: string, value: string) => {
    if (!currentSkill) return;
    const scripts = [...currentSkill.scripts];
    scripts[index] = { ...scripts[index], [field]: value };
    setCurrentSkill({ ...currentSkill, scripts });
  };

  return (
    <div className="skill-wizard">
      <div className="wizard-header">
        <h2>Skill Wizard</h2>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={createNewSkill}>
            + New Skill
          </button>
        </div>
      </div>

      <div className="wizard-content">
        <div className="skill-list">
          <h3>Skills</h3>
          {skills.map((skill) => (
            <div
              key={skill.id}
              className={`skill-item ${currentSkill?.id === skill.id ? 'active' : ''}`}
              onClick={() => setCurrentSkill(skill)}
            >
              <div className="skill-name">{skill.metadata.name}</div>
              <div className="skill-version">{skill.metadata.version}</div>
            </div>
          ))}
        </div>

        <div className="skill-editor">
          {currentSkill ? (
            <>
              <div className="editor-header">
                <h3>{currentSkill.metadata.name}</h3>
                <div className="editor-actions">
                  <button className="btn btn-primary" onClick={saveSkill}>
                    Save
                  </button>
                  <button className="btn" onClick={createDirectory}>
                    📁 Create Directory
                  </button>
                  <div className="export-group">
                    <select
                      className="platform-select"
                      value={exportPlatform}
                      onChange={(e) => setExportPlatform(e.target.value as Platform)}
                    >
                      {(Object.keys(PLATFORM_LABELS) as Platform[]).map(p => (
                        <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                      ))}
                    </select>
                    <button className="btn" onClick={exportToMd}>
                      Export
                    </button>
                  </div>
                  <button className="btn" onClick={exportToYaml}>
                    Export YAML
                  </button>
                  <button className="btn btn-danger" onClick={deleteSkill}>
                    Delete
                  </button>
                  <button className="btn btn-github" onClick={openPRModal} title="Create GitHub Pull Request">
                    Create PR
                  </button>
                </div>
              </div>

              <div className="wizard-steps">
                <button
                  className={`step ${step === 'metadata' ? 'active' : ''}`}
                  onClick={() => setStep('metadata')}
                >
                  1. Metadata
                </button>
                <button
                  className={`step ${step === 'markdown' ? 'active' : ''}`}
                  onClick={() => setStep('markdown')}
                >
                  2. Markdown
                </button>
                <button
                  className={`step ${step === 'yaml' ? 'active' : ''}`}
                  onClick={() => setStep('yaml')}
                >
                  3. YAML
                </button>
                <button
                  className={`step ${step === 'scripts' ? 'active' : ''}`}
                  onClick={() => setStep('scripts')}
                >
                  4. Scripts
                </button>
              </div>

              <div className="wizard-step-content">
                {step === 'metadata' && (
                  <div className="form-section">
                    <h4>Skill Metadata</h4>
                    <div className="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        value={currentSkill.metadata.name}
                        onChange={(e) => updateField(['metadata', 'name'], e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Version</label>
                      <input
                        type="text"
                        value={currentSkill.metadata.version}
                        onChange={(e) => updateField(['metadata', 'version'], e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={currentSkill.metadata.description}
                        onChange={(e) => updateField(['metadata', 'description'], e.target.value)}
                        rows={3}
                      />
                      {descriptionValidation && (
                        <div className={`validation-result ${descriptionValidation.score >= 70 ? 'good' : 'needs-improvement'}`}>
                          <div className="validation-score">
                            Score: {descriptionValidation.score}/100
                          </div>
                          {descriptionValidation.suggestions.length > 0 && (
                            <ul className="validation-suggestions">
                              {descriptionValidation.suggestions.map((suggestion, idx) => (
                                <li key={idx}>{suggestion}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {isValidating && <div className="validating">Validating description...</div>}
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <input
                        type="text"
                        value={currentSkill.metadata.category || ''}
                        onChange={(e) => updateField(['metadata', 'category'], e.target.value)}
                        placeholder="e.g., Development, Testing, Deployment"
                      />
                    </div>
                  </div>
                )}

                {step === 'markdown' && (
                  <div className="form-section">
                    <h4>Skill Documentation (Markdown)</h4>
                    <div className="form-group">
                      <textarea
                        value={currentSkill.markdown || ''}
                        onChange={(e) => updateField(['markdown'], e.target.value)}
                        rows={15}
                        placeholder="Enter markdown documentation for this skill..."
                      />
                    </div>
                  </div>
                )}

                {step === 'yaml' && (
                  <div className="form-section">
                    <h4>YAML Configuration</h4>
                    <div className="form-group">
                      <label>Schema (optional)</label>
                      <input
                        type="text"
                        value={currentSkill.yaml?.schema || ''}
                        onChange={(e) => updateField(['yaml', 'schema'], e.target.value)}
                        placeholder="YAML schema URL or type"
                      />
                    </div>
                    <div className="form-group">
                      <label>Content</label>
                      <textarea
                        value={currentSkill.yaml?.content || ''}
                        onChange={(e) => updateField(['yaml', 'content'], e.target.value)}
                        rows={15}
                        placeholder="Enter YAML configuration..."
                      />
                    </div>
                  </div>
                )}

                {step === 'scripts' && (
                  <div className="form-section">
                    <h4>Scripts</h4>
                    {currentSkill.scripts.map((script, index) => (
                      <div key={index} className="script-item">
                        <div className="script-header">
                          <h5>Script {index + 1}</h5>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => removeScript(index)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="form-group">
                          <label>Language</label>
                          <select
                            value={script.language}
                            onChange={(e) => updateScript(index, 'language', e.target.value)}
                          >
                            <option value="bash">Bash</option>
                            <option value="python">Python</option>
                            <option value="javascript">JavaScript</option>
                            <option value="typescript">TypeScript</option>
                            <option value="powershell">PowerShell</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Path (optional)</label>
                          <input
                            type="text"
                            value={script.path || ''}
                            onChange={(e) => updateScript(index, 'path', e.target.value)}
                            placeholder="scripts/example.sh"
                          />
                        </div>
                        <div className="form-group">
                          <label>Content</label>
                          <textarea
                            value={script.content}
                            onChange={(e) => updateScript(index, 'content', e.target.value)}
                            rows={10}
                            placeholder="Enter script content..."
                          />
                        </div>
                      </div>
                    ))}
                    <button className="btn" onClick={addScript}>
                      + Add Script
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>Select a skill to edit or create a new one</p>
            </div>
          )}
        </div>
      </div>
      {/* PR Modal */}
      {showPRModal && (
        <div className="modal-overlay" onClick={() => !prCreating && setShowPRModal(false)}>
          <div className="modal-content pr-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create GitHub Pull Request</h3>
              <button className="modal-close" onClick={() => setShowPRModal(false)} disabled={prCreating}>✕</button>
            </div>

            {prResult ? (
              <div className="pr-success">
                <p>✅ Pull Request <strong>#{prResult.number}</strong> created successfully!</p>
                <a href={prResult.url} target="_blank" rel="noreferrer" className="btn btn-primary">
                  View PR on GitHub
                </a>
                <button className="btn" onClick={() => setShowPRModal(false)} style={{ marginLeft: '8px' }}>Close</button>
              </div>
            ) : (
              <div className="pr-form">
                <div className="form-group">
                  <label>Repository <span className="required">*</span></label>
                  <input
                    type="text"
                    placeholder="owner/repo"
                    value={prOwnerRepo}
                    onChange={e => setPrOwnerRepo(e.target.value)}
                    disabled={prCreating}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Base branch <span className="required">*</span></label>
                    <input
                      type="text"
                      value={prBase}
                      onChange={e => setPrBase(e.target.value)}
                      disabled={prCreating}
                    />
                  </div>
                  <div className="form-group">
                    <label>Head branch <span className="required">*</span></label>
                    <input
                      type="text"
                      value={prHead}
                      onChange={e => setPrHead(e.target.value)}
                      disabled={prCreating}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Title <span className="required">*</span></label>
                  <input
                    type="text"
                    value={prTitle}
                    onChange={e => setPrTitle(e.target.value)}
                    disabled={prCreating}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={prBody}
                    onChange={e => setPrBody(e.target.value)}
                    rows={4}
                    disabled={prCreating}
                  />
                </div>
                {prError && <p className="pr-error">{prError}</p>}
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={handleCreatePR} disabled={prCreating}>
                    {prCreating ? 'Creating…' : 'Create Pull Request'}
                  </button>
                  <button className="btn" onClick={() => setShowPRModal(false)} disabled={prCreating}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SkillWizard;
