# Clean Architecture Skill

**Version:** 1.0.0

**Description:** Enforces Clean Architecture layer boundaries and dependency rules across the Agent Orchestrator codebase.

**Category:** Architecture

## Overview

This skill validates and guides the implementation of Clean Architecture patterns used in the Agent Orchestrator project. The four layers are:

1. **Domain** (`src/domain/`) — Entities and interfaces. Zero external dependencies.
2. **Application** (`src/application/use-cases/`) — Business logic. Depends only on the Domain layer.
3. **Infrastructure** (`src/infrastructure/`) — Implements domain interfaces with real I/O (fs, keytar, GitHub API).
4. **Presentation** (`src/renderer/`) — React components. Communicates with the main process via `window.electronAPI`.

## Rules

- No `import` from `infrastructure/` or `renderer/` inside `domain/` or `application/`
- Use-cases receive all dependencies as constructor arguments typed as domain interfaces
- Entities must be serializable plain objects (no class methods with side effects)
- Infrastructure classes are instantiated only in `src/main/main.ts`

## Scripts

### bash

```bash
#!/bin/bash
# Validate Clean Architecture import boundaries

echo "=== Clean Architecture Boundary Check ==="

echo ""
echo "1. Domain layer must not import from application/infrastructure/renderer..."
violations=$(grep -rn "from '.*application\|from '.*infrastructure\|from '.*renderer" src/domain/ 2>/dev/null)
if [ -n "$violations" ]; then
  echo "❌ VIOLATIONS FOUND:"
  echo "$violations"
else
  echo "✅ Domain layer is clean"
fi

echo ""
echo "2. Application layer must not import from infrastructure/renderer..."
violations=$(grep -rn "from '.*infrastructure\|from '.*renderer" src/application/ 2>/dev/null)
if [ -n "$violations" ]; then
  echo "❌ VIOLATIONS FOUND:"
  echo "$violations"
else
  echo "✅ Application layer is clean"
fi

echo ""
echo "3. Renderer must not use Node built-ins directly..."
violations=$(grep -rn "require('fs')\|require('path')\|import.*from 'fs'\|import.*from 'path'" src/renderer/ 2>/dev/null)
if [ -n "$violations" ]; then
  echo "❌ VIOLATIONS FOUND:"
  echo "$violations"
else
  echo "✅ Renderer layer is clean"
fi

echo ""
echo "=== Check complete ==="
```

### python

```python
#!/usr/bin/env python3
"""Analyse import boundaries for Clean Architecture compliance."""

import os
import re
import sys

LAYER_RULES = {
    "domain": ["application", "infrastructure", "renderer", "main"],
    "application": ["infrastructure", "renderer", "main"],
    "renderer": [],  # renderer CAN import from domain/application types (type-only)
}

SRC = "src"
violations = []

for layer, forbidden in LAYER_RULES.items():
    layer_path = os.path.join(SRC, layer)
    if not os.path.isdir(layer_path):
        continue
    for root, _, files in os.walk(layer_path):
        for fname in files:
            if not fname.endswith((".ts", ".tsx")):
                continue
            fpath = os.path.join(root, fname)
            with open(fpath, encoding="utf-8") as f:
                for i, line in enumerate(f, 1):
                    for forbidden_layer in forbidden:
                        pattern = rf"from ['\"].*{forbidden_layer}"
                        if re.search(pattern, line):
                            violations.append(f"{fpath}:{i} — imports from '{forbidden_layer}': {line.strip()}")

if violations:
    print("❌ Architecture violations found:\n")
    for v in violations:
        print(" ", v)
    sys.exit(1)
else:
    print("✅ All layer boundaries respected.")
```

## Configuration

```yaml
name: clean-architecture
version: 1.0.0
category: architecture
enabled: true

layers:
  - name: domain
    path: src/domain
    forbiddenImports:
      - application
      - infrastructure
      - renderer
      - main
  - name: application
    path: src/application
    forbiddenImports:
      - infrastructure
      - renderer
      - main
  - name: infrastructure
    path: src/infrastructure
    forbiddenImports:
      - renderer
  - name: renderer
    path: src/renderer
    forbiddenImports: []

settings:
  strict: true
  failOnViolation: true
```
