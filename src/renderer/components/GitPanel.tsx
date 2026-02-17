import { useState, useEffect } from 'react';
import '../styles/GitPanel.css';

interface GitStatus {
  branch: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

function GitPanel() {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [isRepository, setIsRepository] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  useEffect(() => {
    checkRepository();
  }, []);

  const checkRepository = async () => {
    try {
      const isRepo = await (window as any).api.git.isRepository();
      setIsRepository(isRepo);
      if (isRepo) {
        refreshStatus();
      }
    } catch (error) {
      console.error('Failed to check Git repository:', error);
    }
  };

  const refreshStatus = async () => {
    try {
      const status = await (window as any).api.git.getStatus();
      setGitStatus(status);
    } catch (error) {
      console.error('Failed to get Git status:', error);
    }
  };

  const handleCommit = async (push: boolean = false) => {
    if (!commitMessage.trim()) {
      alert('Please enter a commit message');
      return;
    }

    try {
      setIsCommitting(true);
      await (window as any).api.git.atomicCommit({
        message: commitMessage,
        files: selectedFiles.length > 0 ? selectedFiles : undefined,
        push: push,
      });

      alert(`Successfully ${push ? 'committed and pushed' : 'committed'} changes!`);
      setCommitMessage('');
      setSelectedFiles([]);
      refreshStatus();
    } catch (error: any) {
      console.error('Failed to commit:', error);
      alert(`Failed to commit: ${error.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const toggleFileSelection = (file: string) => {
    setSelectedFiles(prev =>
      prev.includes(file)
        ? prev.filter(f => f !== file)
        : [...prev, file]
    );
  };

  const selectAllFiles = () => {
    if (!gitStatus) return;
    const allFiles = [
      ...gitStatus.modified,
      ...gitStatus.added,
      ...gitStatus.deleted,
      ...gitStatus.untracked,
    ];
    setSelectedFiles(allFiles);
  };

  const deselectAllFiles = () => {
    setSelectedFiles([]);
  };

  if (!isRepository) {
    return (
      <div className="git-panel">
        <div className="git-header">
          <h3>Git Integration</h3>
        </div>
        <div className="not-a-repo">
          <p>This is not a Git repository.</p>
          <p>Initialize a repository to use Git features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="git-panel">
      <div className="git-header">
        <h3>Git Integration</h3>
        <button className="btn btn-sm" onClick={refreshStatus}>
          🔄 Refresh
        </button>
      </div>

      {gitStatus && (
        <div className="git-status">
          <div className="status-row">
            <strong>Branch:</strong> {gitStatus.branch}
          </div>
          {gitStatus.ahead > 0 && (
            <div className="status-row ahead">
              ↑ {gitStatus.ahead} commit(s) ahead
            </div>
          )}
          {gitStatus.behind > 0 && (
            <div className="status-row behind">
              ↓ {gitStatus.behind} commit(s) behind
            </div>
          )}
        </div>
      )}

      {gitStatus && (gitStatus.modified.length > 0 || gitStatus.added.length > 0 || 
                      gitStatus.deleted.length > 0 || gitStatus.untracked.length > 0) && (
        <>
          <div className="file-changes">
            <div className="changes-header">
              <h4>Changes</h4>
              <div className="selection-actions">
                <button className="btn-link" onClick={selectAllFiles}>
                  Select All
                </button>
                <button className="btn-link" onClick={deselectAllFiles}>
                  Deselect All
                </button>
              </div>
            </div>

            {gitStatus.modified.length > 0 && (
              <div className="file-group">
                <div className="group-header">Modified ({gitStatus.modified.length})</div>
                {gitStatus.modified.map(file => (
                  <div key={file} className="file-item">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file)}
                      onChange={() => toggleFileSelection(file)}
                    />
                    <span className="file-name modified">M {file}</span>
                  </div>
                ))}
              </div>
            )}

            {gitStatus.added.length > 0 && (
              <div className="file-group">
                <div className="group-header">Added ({gitStatus.added.length})</div>
                {gitStatus.added.map(file => (
                  <div key={file} className="file-item">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file)}
                      onChange={() => toggleFileSelection(file)}
                    />
                    <span className="file-name added">A {file}</span>
                  </div>
                ))}
              </div>
            )}

            {gitStatus.deleted.length > 0 && (
              <div className="file-group">
                <div className="group-header">Deleted ({gitStatus.deleted.length})</div>
                {gitStatus.deleted.map(file => (
                  <div key={file} className="file-item">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file)}
                      onChange={() => toggleFileSelection(file)}
                    />
                    <span className="file-name deleted">D {file}</span>
                  </div>
                ))}
              </div>
            )}

            {gitStatus.untracked.length > 0 && (
              <div className="file-group">
                <div className="group-header">Untracked ({gitStatus.untracked.length})</div>
                {gitStatus.untracked.map(file => (
                  <div key={file} className="file-item">
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file)}
                      onChange={() => toggleFileSelection(file)}
                    />
                    <span className="file-name untracked">? {file}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="commit-section">
            <div className="form-group">
              <label>Commit Message</label>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Enter commit message..."
                rows={3}
                disabled={isCommitting}
              />
            </div>

            <div className="commit-actions">
              <button
                className="btn btn-primary"
                onClick={() => handleCommit(false)}
                disabled={isCommitting || !commitMessage.trim()}
              >
                {isCommitting ? 'Committing...' : '💾 Commit'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleCommit(true)}
                disabled={isCommitting || !commitMessage.trim()}
              >
                {isCommitting ? 'Committing...' : '🚀 Commit & Push'}
              </button>
            </div>

            {selectedFiles.length > 0 && (
              <div className="selected-files-info">
                Selected {selectedFiles.length} file(s)
              </div>
            )}
          </div>
        </>
      )}

      {gitStatus && gitStatus.modified.length === 0 && gitStatus.added.length === 0 && 
       gitStatus.deleted.length === 0 && gitStatus.untracked.length === 0 && (
        <div className="no-changes">
          <p>No changes to commit</p>
        </div>
      )}
    </div>
  );
}

export default GitPanel;
