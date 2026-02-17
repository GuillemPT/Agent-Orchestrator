# Contributing to Agent Orchestrator

Thank you for your interest in contributing to Agent Orchestrator! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful and professional in all interactions. We're building a tool to help developers, and we expect contributors to be helpful and constructive.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git
- Basic understanding of TypeScript, React, and Electron

### Setting Up Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Agent-Orchestrator.git
   cd Agent-Orchestrator
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## Architecture

Agent Orchestrator follows Clean Architecture principles with clear separation of concerns:

```
src/
├── domain/              # Business logic and entities
│   ├── entities/        # Core business objects
│   └── interfaces/      # Port definitions
├── application/         # Use cases
│   └── use-cases/       # Business workflows
├── infrastructure/      # External implementations
│   ├── repositories/    # Data persistence
│   └── services/        # External services
├── presentation/        # UI layer
│   └── components/      # React components
├── main/               # Electron main process
└── renderer/           # Electron renderer process
```

### Key Principles

1. **Dependency Rule**: Dependencies should point inward. Domain layer should not depend on outer layers.
2. **Interface Segregation**: Define clear interfaces between layers.
3. **Single Responsibility**: Each module should have one reason to change.
4. **Open/Closed**: Open for extension, closed for modification.

## Development Workflow

### Creating a New Feature

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the architecture guidelines

3. Write tests if applicable

4. Lint and format your code:
   ```bash
   npm run lint
   npm run format
   ```

5. Build the project:
   ```bash
   npm run build
   ```

6. Commit your changes:
   ```bash
   git commit -m "feat: add your feature description"
   ```

7. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

8. Create a Pull Request

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: add MCP server configuration UI
fix: resolve sync conflict when files are identical
docs: update README with installation instructions
refactor: improve pattern analysis algorithm
```

## Adding New Features

### Adding a New Domain Entity

1. Create the entity in `src/domain/entities/`
2. Define interfaces in `src/domain/interfaces/`
3. Create use cases in `src/application/use-cases/`
4. Implement infrastructure in `src/infrastructure/`
5. Add UI components in `src/presentation/components/`

Example:
```typescript
// src/domain/entities/MyEntity.ts
export class MyEntity {
  constructor(public id: string, public name: string) {}
  
  static create(data: Partial<MyEntity>): MyEntity {
    return new MyEntity(data.id || crypto.randomUUID(), data.name || '');
  }
}
```

### Adding a New UI Component

1. Create component file in `src/renderer/components/`
2. Create corresponding CSS file in `src/renderer/styles/`
3. Follow the VS Code theme variables
4. Import and use in parent component

Example:
```typescript
// src/renderer/components/MyComponent.tsx
import '../styles/MyComponent.css';

function MyComponent() {
  return (
    <div className="my-component">
      {/* Component content */}
    </div>
  );
}

export default MyComponent;
```

## Testing

Currently, the project focuses on manual testing. When adding automated tests:

1. Place unit tests next to the files they test (e.g., `MyEntity.test.ts`)
2. Use descriptive test names
3. Test both success and failure cases
4. Mock external dependencies

## Code Style

- Use TypeScript for all new code
- Follow the ESLint configuration
- Use Prettier for formatting
- Prefer functional components in React
- Use meaningful variable and function names
- Add comments for complex logic

## Pull Request Process

1. Update README.md if adding new features
2. Ensure all builds pass
3. Update examples/ if relevant
4. Request review from maintainers
5. Address review feedback
6. Wait for approval and merge

## Questions?

If you have questions:

1. Check existing issues and discussions
2. Create a new issue with the "question" label
3. Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
