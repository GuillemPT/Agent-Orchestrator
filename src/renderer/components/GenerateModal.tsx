import { useState } from 'react';
import '../styles/GenerateModal.css';

interface GenerateModalProps {
  type: 'agent' | 'skill';
  onClose: () => void;
  onGenerated: (result: any) => void;
  generateFn: (prompt: string) => Promise<any>;
}

export default function GenerateModal({ type, onClose, onGenerated, generateFn }: GenerateModalProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholder = type === 'agent'
    ? 'A Python backend developer that specialises in FastAPI, writes clean code with type hints, and follows the repository pattern…'
    : 'A skill for writing comprehensive unit tests using Vitest with AAA pattern, mocking best practices, and coverage targets…';

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await generateFn(prompt.trim());
      onGenerated(result);
    } catch (err: any) {
      setError(err?.message ?? 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading && prompt.trim()) {
      handleGenerate();
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="modal generate-modal">
        <h3>✨ Generate {type === 'agent' ? 'Agent' : 'Skill'}</h3>
        <p className="generate-hint">
          Describe the {type} you want to create in natural language. The AI will generate a complete scaffold you can review and edit.
        </p>
        <textarea
          className="generate-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={5}
          maxLength={2000}
          disabled={loading}
          autoFocus
        />
        <div className="generate-meta">
          <span className="char-count">{prompt.length}/2000</span>
          <span className="shortcut-hint">⌘+Enter to generate</span>
        </div>
        {error && <div className="generate-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
          >
            {loading ? 'Generating…' : '✨ Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
