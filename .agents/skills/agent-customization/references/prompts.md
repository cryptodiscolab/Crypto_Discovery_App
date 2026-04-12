# Prompts Reference

## Purpose

Prompts (`.prompt.md`) are single-focused tasks with inputs. Appear as slash commands (e.g., `/secure-review`).

## When to Use

- Parameterized tasks (e.g., code review with options).
- Quick actions without full workflow.

## Location

- `.github/prompts/*.prompt.md`

## Template

```markdown
---
name: secure-review
description: "Review code for security vulnerabilities."
parameters:
  - name: code
    type: string
    description: "Code to review"
---

# Secure Code Review

Analyze {{code}} for:
- Vulnerabilities
- Privacy leaks
- Hardcoded secrets

Output: List issues and fixes.
```

## Frontmatter

- `name`: Command name.
- `description`: Slash command description.
- `parameters`: Input definitions.

## Examples

### Vulnerability Scan
```
---
name: vuln-scan
description: "Scan for common vulnerabilities."
parameters:
  - name: file
    type: string
---

Scan {{file}} for OWASP issues.
```

## Common Pitfalls

- Complex logic better as skill.
- Missing privacy checks.

## Security and Privacy Notes

- Ensure prompts don't expose data.
- Audit outputs for leaks.