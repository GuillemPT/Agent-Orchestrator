# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Agent Orchestrator, please report it by:

1. **Email**: Create a GitHub issue with the "security" label
2. **Description**: Provide detailed information about the vulnerability
3. **Impact**: Describe the potential impact and attack scenarios
4. **Reproduction**: Include steps to reproduce the issue

## Security Measures

### Application Security

1. **Credential Storage**
   - Credentials are stored using system keyring (Keytar)
   - No credentials stored in plain text
   - Fallback to in-memory storage on systems without keyring (insecure - for development only)

2. **Electron Security**
   - Context isolation enabled
   - Node integration disabled in renderer process
   - Controlled IPC communication via preload script
   - No arbitrary code execution

3. **File Access**
   - Limited to designated directories
   - No unrestricted file system access
   - Validated file paths

4. **Dependencies**
   - Regular dependency updates
   - Security audits via npm audit
   - Minimal dependency footprint

### Known Issues

#### Development Dependencies

Current npm audit shows moderate vulnerabilities in ESLint dependencies:
- **ajv**: ReDoS vulnerability (moderate severity)
- **Impact**: Dev-only dependency, not included in production builds
- **Mitigation**: No action required for production use

These vulnerabilities only affect development tooling and are not present in the built application.

## Security Best Practices for Users

1. **Credentials**
   - Use strong, unique credentials
   - Regularly rotate sensitive credentials
   - Don't commit credentials to version control

2. **File Sync**
   - Review sync conflicts manually when using "manual" resolution
   - Be cautious when syncing to shared repositories
   - Verify sync destinations before executing

3. **MCP Servers**
   - Only add trusted MCP servers
   - Validate server commands before executing
   - Use environment variables for sensitive configuration

4. **Updates**
   - Keep the application updated
   - Review release notes for security updates
   - Follow security advisories

## Responsible Disclosure

We appreciate responsible disclosure of security vulnerabilities. We will:

1. Acknowledge receipt of your report within 48 hours
2. Provide an estimated timeline for a fix
3. Keep you informed of progress
4. Credit you in the security advisory (if desired)

## Security Updates

Security updates will be released as patch versions (e.g., 1.0.1) and announced via:

- GitHub Security Advisories
- Release notes
- README updates

## Contact

For security-related questions or concerns:
- Create a GitHub issue with the "security" label
- Tag maintainers for urgent issues

## License

This security policy is part of the Agent Orchestrator project and is licensed under the MIT License.
