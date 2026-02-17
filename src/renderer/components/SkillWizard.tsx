import { useState, useEffect } from 'react';
import '../styles/SkillWizard.css';

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

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const loadedSkills = await (window as any).api.skill.getAll();
      setSkills(loadedSkills);
    } catch (error) {
      console.error('Failed to load skills:', error);
    }
  };

  const createNewSkill = async () => {
    try {
      const newSkill = await (window as any).api.skill.create({
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
      await (window as any).api.skill.update(currentSkill.id, currentSkill);
      loadSkills();
    } catch (error) {
      console.error('Failed to save skill:', error);
    }
  };

  const deleteSkill = async () => {
    if (!currentSkill) return;

    if (confirm(`Are you sure you want to delete "${currentSkill.metadata.name}"?`)) {
      try {
        await (window as any).api.skill.delete(currentSkill.id);
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
      const markdown = await (window as any).api.skill.exportToMd(currentSkill);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentSkill.metadata.name}.skill.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export skill:', error);
    }
  };

  const exportToYaml = async () => {
    if (!currentSkill) return;

    try {
      const yaml = await (window as any).api.skill.exportToYaml(currentSkill);
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

      await (window as any).api.skill.createDirectory(currentSkill, basePath);
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
      const validation = await (window as any).api.skill.validateDescription(currentSkill.metadata.description);
      setDescriptionValidation(validation);
    } catch (error) {
      console.error('Failed to validate description:', error);
    } finally {
      setIsValidating(false);
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
                  <button className="btn" onClick={exportToMd}>
                    Export .md
                  </button>
                  <button className="btn" onClick={exportToYaml}>
                    Export .yaml
                  </button>
                  <button className="btn btn-danger" onClick={deleteSkill}>
                    Delete
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
    </div>
  );
}

export default SkillWizard;
