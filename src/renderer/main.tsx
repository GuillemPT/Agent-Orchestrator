import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

const container = document.getElementById('root');
if (container) {
  // This is an Electron app — window.api is only available inside Electron
  if (!(window as unknown as Record<string, unknown>)['api']) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1e1e1e;color:#ccc;font-family:sans-serif;gap:12px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h2 style="margin:0;font-size:18px;color:#eee;">Agent Orchestrator</h2>
        <p style="margin:0;font-size:14px;color:#888;">This app must be opened inside Electron, not in a browser.</p>
      </div>`;
  } else {
    const root = createRoot(container);
    root.render(<App />);
  }
}
