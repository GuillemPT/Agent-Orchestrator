import * as fs from 'fs/promises';
import * as path from 'path';

export interface GlobPattern {
  pattern: string;
  description: string;
  files?: string[];
}

export interface RepositoryAnalysis {
  languages: { [key: string]: number };
  frameworks: string[];
  patterns: string[];
  suggestedInstructions: string;
}

/**
 * RepositoryAnalyzerService - Analyzes repository structure and content
 */
export class RepositoryAnalyzerService {
  constructor(private repoPath: string = process.cwd()) {}

  /**
   * Analyze repository structure and detect languages/frameworks
   */
  async analyzeRepository(): Promise<RepositoryAnalysis> {
    const languages: { [key: string]: number } = {};
    const frameworks: string[] = [];
    const patterns: string[] = [];

    try {
      // Analyze package.json if exists
      const packageJson = await this.readJsonFile(path.join(this.repoPath, 'package.json'));
      if (packageJson) {
        patterns.push('Node.js/JavaScript project detected');
        
        // Detect frameworks from dependencies
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        if (allDeps.react) frameworks.push('React');
        if (allDeps.vue) frameworks.push('Vue');
        if (allDeps.angular) frameworks.push('Angular');
        if (allDeps.express) frameworks.push('Express');
        if (allDeps.next) frameworks.push('Next.js');
        if (allDeps['@nestjs/core']) frameworks.push('NestJS');
        if (allDeps.typescript) {
          languages.TypeScript = 100;
          patterns.push('TypeScript configuration detected');
        } else {
          languages.JavaScript = 100;
        }
      }

      // Check for Python files
      const pythonFiles = await this.findFilesByExtension('.py');
      if (pythonFiles.length > 0) {
        languages.Python = pythonFiles.length;
        patterns.push(`Python project with ${pythonFiles.length} files`);

        // Check for Python frameworks
        const requirementsTxt = await this.fileExists('requirements.txt');
        const pipfile = await this.fileExists('Pipfile');
        
        if (requirementsTxt || pipfile) {
          const content = requirementsTxt 
            ? await fs.readFile(path.join(this.repoPath, 'requirements.txt'), 'utf-8')
            : await fs.readFile(path.join(this.repoPath, 'Pipfile'), 'utf-8');

          if (content.includes('django')) frameworks.push('Django');
          if (content.includes('flask')) frameworks.push('Flask');
          if (content.includes('fastapi')) frameworks.push('FastAPI');
        }
      }

      // Check for Go files
      const goFiles = await this.findFilesByExtension('.go');
      if (goFiles.length > 0) {
        languages.Go = goFiles.length;
        patterns.push(`Go project with ${goFiles.length} files`);
      }

      // Check for Rust files
      const rsFiles = await this.findFilesByExtension('.rs');
      if (rsFiles.length > 0) {
        languages.Rust = rsFiles.length;
        patterns.push(`Rust project with ${rsFiles.length} files`);
      }

      // Check for Java files
      const javaFiles = await this.findFilesByExtension('.java');
      if (javaFiles.length > 0) {
        languages.Java = javaFiles.length;
        patterns.push(`Java project with ${javaFiles.length} files`);

        // Check for Java frameworks
        const pomXml = await this.fileExists('pom.xml');
        const buildGradle = await this.fileExists('build.gradle');
        
        if (pomXml) frameworks.push('Maven');
        if (buildGradle) frameworks.push('Gradle');
      }

      // Generate suggested instructions
      const suggestedInstructions = this.generateInstructions(languages, frameworks, patterns);

      return {
        languages,
        frameworks,
        patterns,
        suggestedInstructions,
      };
    } catch (error) {
      console.error('Error analyzing repository:', error);
      return {
        languages: {},
        frameworks: [],
        patterns: ['Unable to analyze repository'],
        suggestedInstructions: '# Copilot Instructions\n\nUnable to analyze repository structure.',
      };
    }
  }

  /**
   * Generate copilot instructions based on analysis
   */
  private generateInstructions(
    languages: { [key: string]: number },
    frameworks: string[],
    _patterns: string[]
  ): string {
    let instructions = '# Copilot Instructions\n\n';
    instructions += 'This file contains instructions for AI coding assistants.\n\n';

    if (Object.keys(languages).length > 0) {
      instructions += '## Languages\n\n';
      instructions += 'This repository primarily uses:\n';
      const sortedLangs = Object.entries(languages).sort((a, b) => b[1] - a[1]);
      sortedLangs.forEach(([lang]) => {
        instructions += `- ${lang}\n`;
      });
      instructions += '\n';
    }

    if (frameworks.length > 0) {
      instructions += '## Frameworks & Tools\n\n';
      frameworks.forEach(framework => {
        instructions += `- ${framework}\n`;
      });
      instructions += '\n';
    }

    instructions += '## Code Style Guidelines\n\n';
    
    if (languages.TypeScript || languages.JavaScript) {
      instructions += '### JavaScript/TypeScript\n';
      instructions += '- Use modern ES6+ syntax\n';
      instructions += '- Prefer const over let, avoid var\n';
      instructions += '- Use arrow functions for callbacks\n';
      instructions += '- Follow async/await patterns for asynchronous code\n';
      if (languages.TypeScript) {
        instructions += '- Provide explicit types for function parameters and return values\n';
        instructions += '- Avoid using `any` type unless absolutely necessary\n';
      }
      instructions += '\n';
    }

    if (languages.Python) {
      instructions += '### Python\n';
      instructions += '- Follow PEP 8 style guide\n';
      instructions += '- Use type hints for function signatures\n';
      instructions += '- Write docstrings for functions and classes\n';
      instructions += '- Prefer list comprehensions over map/filter when readable\n\n';
    }

    if (languages.Go) {
      instructions += '### Go\n';
      instructions += '- Follow effective Go guidelines\n';
      instructions += '- Use gofmt for formatting\n';
      instructions += '- Handle errors explicitly\n';
      instructions += '- Keep functions small and focused\n\n';
    }

    instructions += '## Best Practices\n\n';
    instructions += '- Write clear, descriptive variable and function names\n';
    instructions += '- Add comments for complex logic\n';
    instructions += '- Keep functions small and focused on a single responsibility\n';
    instructions += '- Write tests for new features\n';
    instructions += '- Follow DRY (Don\'t Repeat Yourself) principle\n\n';

    instructions += '## AI Assistant Guidelines\n\n';
    instructions += '- Suggest improvements to code quality and performance\n';
    instructions += '- Point out potential bugs or security issues\n';
    instructions += '- Recommend appropriate design patterns\n';
    instructions += '- Help with documentation and comments\n';
    instructions += '- Assist with refactoring for better maintainability\n';

    return instructions;
  }

  /**
   * Find files by extension
   */
  private async findFilesByExtension(ext: string): Promise<string[]> {
    const files: string[] = [];
    await this.walkDirectory(this.repoPath, async (filePath) => {
      if (filePath.endsWith(ext)) {
        files.push(filePath);
      }
    });
    return files;
  }

  /**
   * Walk directory recursively
   */
  private async walkDirectory(dir: string, callback: (filePath: string) => Promise<void>): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip node_modules, .git, and other common directories
        if (entry.name === 'node_modules' || entry.name === '.git' || 
            entry.name === 'dist' || entry.name === 'build' || entry.name === '.next') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath, callback);
        } else {
          await callback(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filename: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.repoPath, filename));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read and parse JSON file
   */
  private async readJsonFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Validate glob patterns for instructions files
   */
  validateGlobPattern(pattern: string): boolean {
    // Basic validation - check if pattern is valid
    if (!pattern || pattern.trim() === '') return false;
    
    // Pattern should end with .md or contain wildcards
    return pattern.endsWith('.md') || pattern.includes('*') || pattern.includes('?');
  }

  /**
   * Find files matching glob pattern
   * Note: This is a simplified implementation. For production, consider using
   * a dedicated glob library like 'fast-glob' or 'minimatch' for better accuracy
   */
  async findFilesMatchingPattern(pattern: string): Promise<string[]> {
    const files: string[] = [];
    
    // For now, do a simple substring match for *.md patterns
    // TODO: Implement proper glob matching or integrate a glob library
    const isSimpleMdPattern = pattern.endsWith('*.md') || pattern.includes('*.instructions.md');
    
    await this.walkDirectory(this.repoPath, async (filePath) => {
      const relativePath = path.relative(this.repoPath, filePath);
      
      if (isSimpleMdPattern && relativePath.endsWith('.md')) {
        // For *.instructions.md patterns
        if (pattern.includes('.instructions.md')) {
          if (relativePath.endsWith('.instructions.md')) {
            files.push(relativePath);
          }
        } else {
          files.push(relativePath);
        }
      } else if (relativePath.includes(pattern.replace(/\*/g, ''))) {
        // Fallback: simple substring match
        files.push(relativePath);
      }
    });

    return files;
  }
}
