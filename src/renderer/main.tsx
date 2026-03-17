import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

const IS_WEB = import.meta.env.VITE_MODE === 'web';

const container = document.getElementById('root');
if (container) {
  if (IS_WEB || (window as unknown as Record<string, unknown>)['api']) {
    const root = createRoot(container);
    root.render(<App />);
  } else {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1e1e1e;color:#ccc;font-family:sans-serif;gap:12px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h2 style="margin:0;font-size:18px;color:#eee;">Agent Orchestrator</h2>
        <p style="margin:0;font-size:14px;color:#888;">This app must be opened inside Electron, not in a browser.</p>
      </div>`;
  }
}
