import { Agent } from '@domain/entities/Agent';
import { RepositoryAnalyzerService, RepositoryAnalysis } from '@infrastructure/services/RepositoryAnalyzerService';

export interface PatternAnalysisResult {
  patterns: string[];
  recommendations: string[];
  instructions: string;
}

export class GenerateCopilotInstructionsUseCase {
  async execute(agent: Agent, codebasePatterns?: string[]): Promise<PatternAnalysisResult> {
    // Analyze agent configuration and codebase patterns
    const patterns = this.analyzePatterns(agent, codebasePatterns);
    const recommendations = this.generateRecommendations(agent, patterns);
    const instructions = this.generateInstructions(agent, patterns, recommendations);

    return {
      patterns,
      recommendations,
      instructions,
    };
  }

  private analyzePatterns(agent: Agent, codebasePatterns?: string[]): string[] {
    const patterns: string[] = [];

    // Analyze agent skills
    agent.skills.forEach((skill) => {
      patterns.push(`Skill: ${skill.name} - ${skill.description}`);
    });

    // Analyze MCP configuration
    if (agent.mcpConfig.tools && agent.mcpConfig.tools.length > 0) {
      patterns.push(`MCP Tools: ${agent.mcpConfig.tools.join(', ')}`);
    }

    // Add codebase patterns if provided
    if (codebasePatterns) {
      patterns.push(...codebasePatterns);
    }

    return patterns;
  }

  private generateRecommendations(agent: Agent, _patterns: string[]): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on agent metadata
    recommendations.push(
      `Focus on ${agent.metadata.description || 'general development tasks'}`
    );

    // Add compatibility-specific recommendations
    agent.metadata.compatibility.forEach((tool) => {
      recommendations.push(`Optimize for ${tool} compatibility`);
    });

    return recommendations;
  }

  private generateInstructions(
    agent: Agent,
    _patterns: string[],
    recommendations: string[]
  ): string {
    let instructions = `# Copilot Instructions for ${agent.metadata.name}\n\n`;
    instructions += `## Overview\n${agent.metadata.description || 'No description provided'}\n\n`;

    if (agent.skills.length > 0) {
      instructions += `## Skills\n`;
      agent.skills.forEach((skill) => {
        instructions += `- **${skill.name}**: ${skill.description}\n`;
      });
      instructions += '\n';
    }

    if (agent.mcpConfig.tools && agent.mcpConfig.tools.length > 0) {
      instructions += `## Available Tools\n`;
      agent.mcpConfig.tools.forEach((tool) => {
        instructions += `- ${tool}\n`;
      });
      instructions += '\n';
    }

    if (recommendations.length > 0) {
      instructions += `## Recommendations\n`;
      recommendations.forEach((rec) => {
        instructions += `- ${rec}\n`;
      });
      instructions += '\n';
    }

    if (agent.instructions) {
      instructions += `## Custom Instructions\n${agent.instructions}\n`;
    }

    return instructions;
  }
}

export class AnalyzeRepositoryUseCase {
  constructor(private repositoryAnalyzer: RepositoryAnalyzerService) {}

  async execute(): Promise<RepositoryAnalysis> {
    return await this.repositoryAnalyzer.analyzeRepository();
  }
}

export class ValidateGlobPatternUseCase {
  constructor(private repositoryAnalyzer: RepositoryAnalyzerService) {}

  async execute(pattern: string): Promise<boolean> {
    return this.repositoryAnalyzer.validateGlobPattern(pattern);
  }
}

export class FindFilesMatchingPatternUseCase {
  constructor(private repositoryAnalyzer: RepositoryAnalyzerService) {}

  async execute(pattern: string): Promise<string[]> {
    return await this.repositoryAnalyzer.findFilesMatchingPattern(pattern);
  }
}
