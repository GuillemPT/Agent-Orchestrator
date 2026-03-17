# Fix: project flow — 4 pending bugs

## Diagnostic summary

All four bugs were partially addressed in source but some remain broken at runtime or were misunderstood. Exact root causes per issue below.

---

## Bug 1 — Create buttons produce agents/skills with no project association

### Real root cause
`AgentEntity.create()` and `SkillEntity.create()` now correctly accept and pass `projectId` through the constructor (fix is in `src/domain/entities/Agent.ts` and `src/domain/entities/Skill.ts`). **BUT** this code lives in the Electron **main process bundle** (`dist/main/`). If the app was not fully rebuilt and restarted after the entity change, the old bundle is still running and the fix has no effect.

Secondary issue: agents and skills created before the fix have no `projectId` in their `.json` files on disk. After the strict-filter change, they become invisible when any project is selected. They are still visible in "All Projects" view.

### What to do
1. Run `npm run build:main` (or kill + restart `npm run dev`) to force a rebuild of the main process bundle.
2. For pre-existing orphaned items: do **not** auto-migrate. Leave them in "All Projects". Users can re-assign them via the existing ⋮ context menu "Move to project".
3. Verify end-to-end: select a project → click "+ New Agent" → the new agent appears in the list → its `.json` file in `userData/data/agents/` contains `"projectId": "<id>"`.

---

## Bug 2 — Agents/skills not loading after selecting a project

### Real root cause
The filter in `AgentEditor.tsx` and `SkillWizard.tsx` is already the correct strict version:
```ts
const filtered = projectId === null
  ? allAgents
  : allAgents.filter((a: Agent) => a.projectId === projectId);
```
The failure is the **same as Bug 1** — old main-process bundle + pre-existing files without `projectId`. Once the bundle is rebuilt and new items are created with the correct `projectId`, the filter works. **No additional code change needed.**

---

## Bug 3 — "Deselect project" was misunderstood — user wants to DELETE (unimport) a project

### Clarification
"Deseleccionar = desimportar." The `×` button we added only switches back to the "All Projects" view — it does not delete anything. The user wants to **permanently remove an imported project** from the list.

### What to remove
- Remove the `project-deselect-btn` JSX from the trigger button in `ProjectSelector.tsx`.
- Remove the `.project-deselect-btn` CSS rule from `ProjectSelector.css`.
- Restore the chevron `▼/▲` as the only trailing element in the trigger (always visible).

### What to add
A **⋮ options button per project row in the dropdown**. Steps:

1. Add state `const [menuOpenProjectId, setMenuOpenProjectId] = useState<string | null>(null)`.

2. Change each project row from a plain `<button>` to a `<div className="project-option-row">` containing:
   - `<button className="project-option-main">` — the existing select-project click action
   - `<button className="project-option-menu-btn">⋮</button>` — toggles `menuOpenProjectId`

3. Below that div, conditionally render the inline mini-menu when `menuOpenProjectId === project.id`:
   ```tsx
   {menuOpenProjectId === project.id && (
     <div className="project-option-inline-menu" onClick={e => e.stopPropagation()}>
       <button className="project-option-inline-item"
               onClick={() => { handleSelectProject(project.id); setMenuOpenProjectId(null); }}>
         📌 Select
       </button>
       <button className="project-option-inline-item project-option-delete"
               onClick={() => handleDeleteProject(project.id)}>
         🗑️ Remove project
       </button>
     </div>
   )}
   ```

4. Add `handleDeleteProject`:
   ```ts
   const handleDeleteProject = async (id: string) => {
     const project = projects.find(p => p.id === id);
     if (!confirm(`Remove "${project?.name}"?\nThis will not delete its agents or skills.`)) return;
     try {
       await api.project.delete(id);
       setProjects(prev => prev.filter(p => p.id !== id));
       if (currentProjectId === id) onProjectChange(null);
       setMenuOpenProjectId(null);
       setIsOpen(false);
     } catch (err) {
       console.error('Failed to delete project:', err);
     }
   };
   ```

5. `api.project.delete` already exists in both `webApi.project` and `electronApi` (via `window.api.project.delete` → `project:delete` IPC → `DeleteProjectUseCase`). **No backend change needed.**

6. Close `menuOpenProjectId` when clicking outside the dropdown (add to the existing `handleClickOutside` handler: `setMenuOpenProjectId(null)`).

7. CSS to add in `ProjectSelector.css`:
   ```css
   .project-option-row {
     display: flex;
     align-items: stretch;
     position: relative;
   }
   .project-option-main {
     flex: 1;
     /* inherit existing .project-option styles */
   }
   .project-option-menu-btn {
     flex-shrink: 0;
     background: none;
     border: none;
     color: var(--text-secondary);
     padding: 0 8px;
     cursor: pointer;
     opacity: 0;
     border-radius: 4px;
     transition: opacity 0.15s, background 0.15s;
   }
   .project-option-row:hover .project-option-menu-btn {
     opacity: 1;
   }
   .project-option-inline-menu {
     position: absolute;
     right: 0;
     top: 100%;
     background: var(--bg-secondary);
     border: 1px solid var(--border-color);
     border-radius: 6px;
     box-shadow: 0 4px 12px rgba(0,0,0,0.3);
     z-index: 1100;
     min-width: 140px;
   }
   .project-option-inline-item {
     display: flex;
     align-items: center;
     gap: 6px;
     width: 100%;
     background: none;
     border: none;
     color: var(--text-primary);
     padding: 8px 12px;
     cursor: pointer;
     font-size: 13px;
     text-align: left;
   }
   .project-option-inline-item:hover { background: var(--hover-bg, rgba(255,255,255,0.06)); }
   .project-option-delete { color: #f87171; }
   .project-option-delete:hover { background: rgba(248,113,113,0.1); }
   ```

---

## Bug 4 — GitHub repos not visible until app restart after connecting account

### Root cause
`loadConnectedProviders()` was only called on mount. The fix (already in source) re-fetches accounts inside `handleShowImport` before the modal opens, using the returned fresh list directly to avoid stale-state races. This fix is renderer-side (Vite HMR) so it takes effect without a main-process rebuild.

### If it still fails
Check DevTools console for errors when opening the import modal. If `api.gitProvider.getConnectedAccounts()` throws, `loadConnectedProviders` silently returns `[]` and the modal shows "No providers connected."

Hardening step — add an error message to the modal. In `ProjectSelector.tsx`:
```tsx
const [providerLoadError, setProviderLoadError] = useState<string | null>(null);
```
In the `catch` block of `loadConnectedProviders`:
```ts
setProviderLoadError('Could not load connected accounts — check Settings → Git Providers.');
```
In the modal body, when `connectedProviders.length === 0 && !loadingRepos`, show `providerLoadError` instead of the generic "No providers connected" string.

---

## Verification

| Bug | Test |
|---|---|
| Bug 1 | Kill + restart `npm run dev` → select project → "+ New Agent" → open `userData/data/agents/<id>.json` → must contain `"projectId"` |
| Bug 2 | Create 2 agents in project A, 2 in project B → switch projects → only matching agents appear |
| Bug 3 | Open project dropdown → hover a project row → ⋮ appears → "Remove project" → confirm → project removed, active view resets to All Projects |
| Bug 4 | Fresh app, no account → open import modal → see error/empty message → go to Settings, connect GitHub → open import modal again → repos appear without restart |
