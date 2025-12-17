# Security Policy

## Supported Versions

Currently, only the latest version of the `main` branch is supported for security updates.

| Version | Supported          |
| ------- | ------------------ |
| Main    | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an e-mail to the project maintainers. All security vulnerability reports will be promptly addressed.

**Please do not report security vulnerabilities through public GitHub issues.**

## Credential Management Policy

### 1. Environment Variables
- **NEVER** commit `.env` files to the repository.
- Use `.env.example` as a template for required variables.
- In production (e.g., Vercel, AWS), use the platform's secret management system.
- In CI/CD (GitHub Actions), use [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets).

### 2. Secret Rotation
- Rotate API keys (Dify, Supabase, etc.) immediately if a leak is suspected.
- Regularly rotate production secrets every 90 days.

### 3. Automated Checks
This repository employs automated checks to prevent security issues:
- **Pre-commit hooks**: Scans for potential secret leaks before every commit.
- **CI Security Workflow**: Runs `npm audit` and secret scanning on every push and pull request.
- **Dependabot**: Automatically monitors and updates vulnerable dependencies.

## Development Guidelines

- Avoid hardcoding secrets in source code.
- Run `npm audit` locally before adding new dependencies.
- Ensure all external API calls are made over HTTPS.
