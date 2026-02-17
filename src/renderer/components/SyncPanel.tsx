import { useState, useEffect } from 'react';
import '../styles/SyncPanel.css';

interface SyncChanges {
  github: string[];
  home: string[];
}

function SyncPanel() {
  const [changes, setChanges] = useState<SyncChanges | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copyingSkills, setCopyingSkills] = useState(false);
  const [direction, setDirection] = useState<'toGithub' | 'toHome' | 'bidirectional'>('bidirectional');
  const [conflictResolution, setConflictResolution] = useState<'newer' | 'github' | 'home'>('newer');

  useEffect(() => {
    detectChanges();
  }, []);

  const detectChanges = async () => {
    try {
      const detected = await (window as any).api.sync.detectChanges();
      setChanges(detected);
    } catch (error) {
      console.error('Failed to detect changes:', error);
    }
  };

  const performSync = async () => {
    setSyncing(true);
    try {
      await (window as any).api.sync.syncDirectories({
        direction,
        conflictResolution,
      });
      alert('Sync completed successfully!');
      await detectChanges();
    } catch (error) {
      console.error('Failed to sync:', error);
      alert('Sync failed. Check console for details.');
    } finally {
      setSyncing(false);
    }
  };

  const copySkillsToRepo = async () => {
    if (!confirm('This will copy all skills from ~/.copilot/skills to .github/skills. Continue?')) {
      return;
    }

    setCopyingSkills(true);
    try {
      await (window as any).api.sync.syncDirectories({
        direction: 'toGithub',
        conflictResolution: 'home',
        specificPath: 'skills',
      });
      alert('Skills copied to repository successfully!');
      await detectChanges();
    } catch (error) {
      console.error('Failed to copy skills:', error);
      alert('Failed to copy skills. Check console for details.');
    } finally {
      setCopyingSkills(false);
    }
  };

  return (
    <div className="sync-panel">
      <div className="panel-header">
        <h2>Copilot Directory Sync</h2>
        <p className="subtitle">Sync between ~/.copilot and .github directories</p>
      </div>

      <div className="sync-config">
        <div className="config-section">
          <h3>Sync Direction</h3>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="toGithub"
                checked={direction === 'toGithub'}
                onChange={(e) => setDirection(e.target.value as any)}
              />
              <span>Home → GitHub (.github)</span>
            </label>
            <label>
              <input
                type="radio"
                value="toHome"
                checked={direction === 'toHome'}
                onChange={(e) => setDirection(e.target.value as any)}
              />
              <span>GitHub (.github) → Home</span>
            </label>
            <label>
              <input
                type="radio"
                value="bidirectional"
                checked={direction === 'bidirectional'}
                onChange={(e) => setDirection(e.target.value as any)}
              />
              <span>Bidirectional Sync</span>
            </label>
          </div>
        </div>

        <div className="config-section">
          <h3>Conflict Resolution</h3>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="newer"
                checked={conflictResolution === 'newer'}
                onChange={(e) => setConflictResolution(e.target.value as any)}
              />
              <span>Use Newer File</span>
            </label>
            <label>
              <input
                type="radio"
                value="github"
                checked={conflictResolution === 'github'}
                onChange={(e) => setConflictResolution(e.target.value as any)}
              />
              <span>Prefer GitHub</span>
            </label>
            <label>
              <input
                type="radio"
                value="home"
                checked={conflictResolution === 'home'}
                onChange={(e) => setConflictResolution(e.target.value as any)}
              />
              <span>Prefer Home</span>
            </label>
          </div>
        </div>
      </div>

      <div className="sync-actions">
        <button className="btn" onClick={detectChanges} disabled={syncing}>
          🔍 Detect Changes
        </button>
        <button className="btn btn-primary" onClick={performSync} disabled={syncing}>
          {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
        </button>
      </div>

      <div className="quick-actions">
        <h3>⚡ Quick Actions</h3>
        <div className="quick-action-buttons">
          <button 
            className="btn btn-primary" 
            onClick={copySkillsToRepo} 
            disabled={copyingSkills || syncing}
          >
            {copyingSkills ? '⏳ Copying...' : '📦 Copy Skills to Repository'}
          </button>
          <p className="help-text">
            Copy all skills from ~/.copilot/skills to .github/skills in one click
          </p>
        </div>
      </div>

      {changes && (
        <div className="changes-overview">
          <div className="change-section">
            <h3>GitHub (.github) Files</h3>
            <div className="file-list">
              {changes.github.length > 0 ? (
                changes.github.map((file) => (
                  <div key={file} className="file-item">
                    📄 {file}
                  </div>
                ))
              ) : (
                <p className="empty">No files found</p>
              )}
            </div>
          </div>

          <div className="change-section">
            <h3>Home (~/.copilot) Files</h3>
            <div className="file-list">
              {changes.home.length > 0 ? (
                changes.home.map((file) => (
                  <div key={file} className="file-item">
                    📄 {file}
                  </div>
                ))
              ) : (
                <p className="empty">No files found</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="info-section">
        <h3>ℹ️ Information</h3>
        <ul>
          <li>
            <strong>Home Directory:</strong> ~/.copilot
          </li>
          <li>
            <strong>GitHub Directory:</strong> .github
          </li>
          <li>
            Syncing helps maintain consistency between your local Copilot configuration and
            project-specific settings.
          </li>
          <li>
            Use bidirectional sync to keep both directories in sync automatically.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default SyncPanel;
