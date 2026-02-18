# Vitest Testing Skill

**Version:** 1.0.0

**Description:** Testing strategy and templates for the Agent Orchestrator project using Vitest 3 and @testing-library/react.

**Category:** Testing

## Overview

Agent Orchestrator uses **Vitest 3** as the test runner with two test scopes:

| Scope | Location | Tools |
|---|---|---|
| Use-case unit tests | `src/application/use-cases/__tests__/` | Vitest + in-memory fakes |
| React component tests | `src/renderer/__tests__/` | Vitest + jsdom + @testing-library/react |
| Infrastructure tests | `src/infrastructure/services/__tests__/` | Vitest + mocks |

In-memory repository fakes live in `src/application/use-cases/__tests__/helpers/` and implement the domain interfaces (`IAgentRepository`, `ISkillRepository`, `IMCPRepository`).

Run all tests: `npm test`
Watch mode: `npm run test:watch`
Coverage: `npm run test:coverage` (target ≥ 80 %)

## Scripts

### typescript

```typescript
// Template: Use-case unit test
// File: src/application/use-cases/__tests__/ExampleUseCases.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { ExampleUseCases } from '../ExampleUseCases';
import { InMemoryExampleRepository } from './helpers/InMemoryExampleRepository';

describe('ExampleUseCases', () => {
  let repo: InMemoryExampleRepository;
  let useCases: ExampleUseCases;

  beforeEach(() => {
    repo = new InMemoryExampleRepository();
    useCases = new ExampleUseCases(repo);
  });

  describe('create', () => {
    it('stores a new entity and returns it', async () => {
      const input = { name: 'Test Entity', description: 'desc' };
      const result = await useCases.create(input);

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Entity');
      const stored = await repo.findById(result.id);
      expect(stored).toEqual(result);
    });

    it('throws when name is empty', async () => {
      await expect(useCases.create({ name: '', description: 'x' }))
        .rejects.toThrow('Name is required');
    });
  });

  describe('getAll', () => {
    it('returns an empty array when no entities exist', async () => {
      const all = await useCases.getAll();
      expect(all).toEqual([]);
    });
  });
});
```

### typescript

```typescript
// Template: In-memory repository fake
// File: src/application/use-cases/__tests__/helpers/InMemoryExampleRepository.ts

import type { IExampleRepository } from '../../../../domain/interfaces/IExampleRepository';
import type { Example } from '../../../../domain/entities/Example';

export class InMemoryExampleRepository implements IExampleRepository {
  private store = new Map<string, Example>();

  async save(entity: Example): Promise<void> {
    this.store.set(entity.id, entity);
  }

  async findById(id: string): Promise<Example | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Example[]> {
    return Array.from(this.store.values());
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
```

### bash

```bash
#!/bin/bash
# Run full test suite with coverage and fail below threshold

echo "=== Running Vitest Suite ==="

npm run test:coverage

echo ""
echo "=== Checking for untested use-cases ==="

tested=$(find src/application/use-cases/__tests__ -name "*.test.ts" | xargs grep -l "describe" | sed 's|.*__tests__/||;s|.test.ts||')
all=$(find src/application/use-cases -maxdepth 1 -name "*.ts" ! -name "*.test.ts" | sed 's|.*/||;s|\.ts||')

for uc in $all; do
  if ! echo "$tested" | grep -qi "$uc"; then
    echo "  ⚠️  No test found for: $uc"
  fi
done

echo ""
echo "=== Done ==="
```

## Configuration

```yaml
name: vitest-testing
version: 1.0.0
category: testing
enabled: true

runner: vitest
configFile: vitest.config.ts

scopes:
  useCases:
    path: src/application/use-cases/__tests__
    pattern: "**/*.test.ts"
    helpers: src/application/use-cases/__tests__/helpers
  components:
    path: src/renderer/__tests__
    pattern: "**/*.test.tsx"
    environment: jsdom
  infrastructure:
    path: src/infrastructure/services/__tests__
    pattern: "**/*.test.ts"

coverage:
  provider: v8
  threshold:
    lines: 80
    functions: 80
    branches: 70

settings:
  fakeRepositories: true
  mockElectronAPI: true
  setupFile: src/renderer/__tests__/setup.ts
```
