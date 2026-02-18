import { describe, it, expect } from 'vitest';
import { RepositoryAnalyzerService } from '../RepositoryAnalyzerService';

describe('RepositoryAnalyzerService', () => {
  const service = new RepositoryAnalyzerService('/tmp');

  describe('validateGlobPattern', () => {
    it('returns false for empty string', () => {
      expect(service.validateGlobPattern('')).toBe(false);
    });

    it('returns false for whitespace', () => {
      expect(service.validateGlobPattern('   ')).toBe(false);
    });

    it('returns false for unclosed bracket', () => {
      expect(service.validateGlobPattern('[unclosed')).toBe(false);
    });

    it('returns false for triple star', () => {
      expect(service.validateGlobPattern('***/*.ts')).toBe(false);
    });

    it('returns true for a valid wildcard pattern', () => {
      expect(service.validateGlobPattern('**/*.md')).toBe(true);
    });

    it('returns true for a specific file path', () => {
      expect(service.validateGlobPattern('src/index.ts')).toBe(true);
    });

    it('returns true for a ? wildcard pattern', () => {
      expect(service.validateGlobPattern('src/?.ts')).toBe(true);
    });
  });
});
