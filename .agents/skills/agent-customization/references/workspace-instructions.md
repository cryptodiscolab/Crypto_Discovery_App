# Workspace Instructions Reference

## Purpose

Workspace instructions (`copilot-instructions.md`, `AGENTS.md`) apply globally to all files in the project. Use for always-on behaviors like security auditing, coding standards, or team conventions.

## When to Use

- Project-wide coding preferences (e.g., always use TypeScript strict mode).
- Security policies (e.g., no hardcoding secrets).
- Team workflows (e.g., always include tests).

## Location

- `.github/copilot-instructions.md` (primary)
- `.github/AGENTS.md` (for agent definitions)

## Template

```markdown
---
description: "Always enforce security best practices and data privacy in all code suggestions."
---

# Workspace Instructions

## Security Auditing
- Review all code for vulnerabilities (e.g., SQL injection, XSS).
- Prohibit hardcoding sensitive data (API keys, passwords).
- Ensure no sensitive data is written in frontend or pushed to Git.

## Data Privacy
- Use environment variables for secrets.
- Implement end-to-end encryption.
- Warn about potential leaks.

## Coding Standards
- {Add project-specific rules}
```

## Frontmatter

- `description`: Short summary for agent discovery (include keywords like "security", "privacy").

## Examples

### Basic Security Instructions
```
---
description: "Enforce secure coding practices."
---

Always check for OWASP top 10 vulnerabilities.
```

### Privacy-Focused
```
---
description: "Protect user data end-to-end."
---

Never expose sensitive data in logs or frontend.
```

## Common Pitfalls

- Too broad `description` leads to irrelevant triggering.
- Missing security checks in instructions.

## Security and Privacy Notes

- Always include data privacy rules to prevent leaks.
- Ensure instructions align with end-to-end protection.