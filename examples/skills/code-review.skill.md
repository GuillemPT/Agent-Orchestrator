# Code Review Skill

**Version:** 1.0.0

**Description:** Automated code review skill that analyzes code for quality, security, and best practices.

**Category:** Development

## Overview

This skill performs comprehensive code reviews, checking for:
- Code quality and maintainability
- Security vulnerabilities
- Performance issues
- Best practice violations
- Documentation completeness

## Usage

The skill can be invoked manually or integrated into CI/CD pipelines to provide automated feedback on pull requests.

## Scripts

### bash

```bash
#!/bin/bash
# Code Review Script

echo "Starting code review..."

# Run linter
echo "Running linter..."
npm run lint

# Run security audit
echo "Running security audit..."
npm audit

# Check test coverage
echo "Checking test coverage..."
npm run test:coverage

echo "Code review complete!"
```

### python

```python
#!/usr/bin/env python3
# Advanced Code Review with Static Analysis

import subprocess
import sys

def run_command(cmd):
    """Run a shell command and return the result."""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr

def main():
    print("🔍 Advanced Code Review")
    print("=" * 50)
    
    # Check for TODO/FIXME comments
    print("\n📝 Checking for TODO/FIXME comments...")
    returncode, stdout, _ = run_command("grep -rn 'TODO\\|FIXME' src/")
    if returncode == 0:
        print("Found items requiring attention:")
        print(stdout)
    
    # Check for console.log statements
    print("\n🐛 Checking for console.log statements...")
    returncode, stdout, _ = run_command("grep -rn 'console.log' src/")
    if returncode == 0:
        print("Warning: Found console.log statements:")
        print(stdout)
    
    # Check for hardcoded credentials
    print("\n🔐 Checking for potential credentials...")
    returncode, stdout, _ = run_command("grep -rn 'password\\|api_key\\|secret' src/ | grep -v '.test'")
    if returncode == 0:
        print("⚠️  Warning: Found potential credential references:")
        print(stdout)
    
    print("\n✅ Code review complete!")

if __name__ == "__main__":
    main()
```

## Configuration

```yaml
name: code-review
version: 1.0.0
category: development
enabled: true

settings:
  severity_threshold: medium
  auto_fix: false
  report_format: markdown
  
checks:
  - linting
  - security
  - coverage
  - complexity
  - documentation
```
