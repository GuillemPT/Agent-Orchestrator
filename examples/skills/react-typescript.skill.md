# React + TypeScript Skill

**Version:** 1.0.0

**Description:** Guidelines and templates for building VS Code-style React components with TypeScript in the Agent Orchestrator renderer layer.

**Category:** Frontend

## Overview

All UI components live in `src/renderer/components/`. Each component:
- Is a functional component with typed props
- Has a paired CSS file in `src/renderer/styles/` using CSS variables from `index.css`
- Uses `window.electronAPI` for any main-process communication
- Never imports from `infrastructure/` or uses Node built-ins

The UI follows a VS Code dark theme. Use `--vscode-*` CSS variable naming conventions.

## Component Checklist

- [ ] Props interface defined (not inlined)
- [ ] No `any` types
- [ ] No inline styles for layout
- [ ] Paired `.css` file created
- [ ] Error boundary handled (or `ErrorBoundary` wrapping provided)
- [ ] Loading and error states handled
- [ ] `useEffect` cleanup functions defined for subscriptions

## Scripts

### typescript

```typescript
// Component template for Agent Orchestrator
// Replace ComponentName, Props, etc.

import React, { useState, useEffect, useCallback } from 'react';
import './ComponentName.css';

interface ComponentNameProps {
  /** Short description of the prop */
  exampleProp: string;
  onAction?: (result: string) => void;
}

const ComponentName: React.FC<ComponentNameProps> = ({ exampleProp, onAction }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await window.electronAPI.someChannel(exampleProp);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [exampleProp]);

  const handleAction = useCallback(async () => {
    if (!data) return;
    onAction?.(data);
  }, [data, onAction]);

  if (isLoading) return <div className="component-name__loading">Loading...</div>;
  if (error) return <div className="component-name__error">{error}</div>;

  return (
    <div className="component-name">
      <div className="component-name__header">
        <h2 className="component-name__title">Component Title</h2>
      </div>
      <div className="component-name__body">
        <p>{data}</p>
        <button className="btn btn--primary" onClick={handleAction}>
          Action
        </button>
      </div>
    </div>
  );
};

export default ComponentName;
```

### bash

```bash
#!/bin/bash
# Lint and type-check the renderer layer

set -e

echo "=== React + TypeScript Quality Check ==="

echo ""
echo "1. TypeScript type check..."
npx tsc --noEmit
echo "✅ No type errors"

echo ""
echo "2. ESLint..."
npx eslint src/renderer --ext .ts,.tsx --max-warnings 0
echo "✅ No lint warnings"

echo ""
echo "3. Checking for inline styles in components..."
inline_styles=$(grep -rn "style={{" src/renderer/components/ 2>/dev/null || true)
if [ -n "$inline_styles" ]; then
  echo "⚠️  Inline styles found (prefer CSS variables):"
  echo "$inline_styles"
else
  echo "✅ No inline styles"
fi

echo ""
echo "4. Checking for direct Node API usage in renderer..."
node_usage=$(grep -rn "require('fs')\|require('path')\|process\.env" src/renderer/ 2>/dev/null || true)
if [ -n "$node_usage" ]; then
  echo "❌ Direct Node API usage in renderer:"
  echo "$node_usage"
  exit 1
fi
echo "✅ No direct Node API usage"

echo ""
echo "=== All checks passed ==="
```

## CSS Template

```css
/* ComponentName.css */
/* Use CSS variables from index.css — never hardcode colors */

.component-name {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
}

.component-name__header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

.component-name__title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vscode-sideBarTitle-foreground);
  margin: 0;
}

.component-name__body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.component-name__loading,
.component-name__error {
  padding: 16px;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
}

.component-name__error {
  color: var(--vscode-errorForeground);
}
```

## Configuration

```yaml
name: react-typescript
version: 1.0.0
category: frontend
enabled: true

conventions:
  componentDir: src/renderer/components
  styleDir: src/renderer/styles
  typeDir: src/renderer/types
  functionalComponentsOnly: true
  pairedCssRequired: true

settings:
  strictTypeCheck: true
  noAny: true
  noInlineStyles: true
  noDirectNodeAPIs: true
```
