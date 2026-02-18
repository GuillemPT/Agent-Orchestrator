# Electron IPC Skill

**Version:** 1.0.0

**Description:** Implements and validates safe Electron IPC communication between the main process and the React renderer via the context bridge.

**Category:** Electron

## Overview

Agent Orchestrator uses Electron's `contextBridge` to expose a typed `window.electronAPI` object to the renderer. Every feature that requires Node.js or OS access must follow this three-file pattern:

1. **`src/main/main.ts`** — Register `ipcMain.handle('namespace:action', handler)`
2. **`src/main/preload.ts`** — Expose the channel via `contextBridge.exposeInMainWorld`
3. **`src/renderer/types/electron.d.ts`** — Declare the TypeScript signature on `window.electronAPI`

Channel naming convention: `namespace:action` (e.g., `agent:create`, `mcp:load`, `github:createPR`).

## Scripts

### bash

```bash
#!/bin/bash
# Audit IPC channel consistency across main.ts, preload.ts, and electron.d.ts

echo "=== IPC Channel Audit ==="

echo ""
echo "Channels registered in main.ts (ipcMain.handle):"
grep -n "ipcMain.handle" src/main/main.ts | sed "s/.*ipcMain.handle('\([^']*\)'.*/  \1/"

echo ""
echo "Channels exposed in preload.ts (contextBridge):"
grep -n "ipcRenderer.invoke\|ipcRenderer.send\|ipcRenderer.on" src/main/preload.ts | grep -oP "'[a-z]+:[a-zA-Z]+'" | sort | uniq

echo ""
echo "Channels declared in electron.d.ts:"
grep -n "[a-z]*:[a-zA-Z]*" src/renderer/types/electron.d.ts | grep -v "//"

echo ""
echo "Checking for channels in main.ts missing from electron.d.ts..."
main_channels=$(grep "ipcMain.handle" src/main/main.ts | grep -oP "'[a-z]+:[a-zA-Z]+'")
for ch in $main_channels; do
  clean=$(echo "$ch" | tr -d "'")
  if ! grep -q "$clean" src/renderer/types/electron.d.ts; then
    echo "  ⚠️  Missing in electron.d.ts: $clean"
  fi
done

echo ""
echo "=== Audit complete ==="
```

### typescript

```typescript
// Template: Adding a new IPC channel
// Replace `namespace`, `action`, `InputType`, and `OutputType` with real values.

// ── 1. main.ts ────────────────────────────────────────────────────────────────
import { ipcMain } from 'electron';

ipcMain.handle('namespace:action', async (_event, payload: InputType): Promise<OutputType> => {
  // Validate payload before processing
  if (!payload || typeof payload.id !== 'string') {
    throw new Error('Invalid payload for namespace:action');
  }
  // Call the appropriate use-case
  return useCaseInstance.execute(payload);
});

// ── 2. preload.ts ─────────────────────────────────────────────────────────────
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing channels ...
  namespaceAction: (payload: InputType) =>
    ipcRenderer.invoke('namespace:action', payload),
});

// ── 3. electron.d.ts ─────────────────────────────────────────────────────────
interface ElectronAPI {
  // ... existing declarations ...
  namespaceAction: (payload: InputType) => Promise<OutputType>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

## Configuration

```yaml
name: electron-ipc
version: 1.0.0
category: electron
enabled: true

conventions:
  channelPattern: "^[a-z]+:[a-zA-Z]+$"
  exposedObjectName: "electronAPI"
  contextIsolation: true
  nodeIntegration: false

files:
  mainProcess: src/main/main.ts
  preload: src/main/preload.ts
  typeDeclaration: src/renderer/types/electron.d.ts

settings:
  validatePayloads: true
  requireTypeDeclaration: true
```
