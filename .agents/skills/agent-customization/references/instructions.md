# File Instructions Reference

## Purpose

File instructions (`.instructions.md`) apply to specific files or patterns via `applyTo`. Use for context-specific guidance, like API security for backend files.

## When to Use

- File-type specific rules (e.g., Python files must use type hints).
- Security for sensitive files (e.g., config files no hardcode).
- On-demand via description matching.

## Location

- `.github/instructions/*.instructions.md`

## Template

```markdown
---
description: "Secure handling for {file type} files."
applyTo: "**/*.{extension}"
---

# File Instructions

## Rules
- {Specific rules}

## Security
- No hardcoding secrets.
- Ensure data privacy in {context}.
```

## Frontmatter

- `description`: Trigger phrase (e.g., "secure API").
- `applyTo`: Glob pattern (e.g., `src/**/*.js`).

## Examples

### API Security
```
---
description: "Secure API endpoints."
applyTo: "src/api/**/*.js"
---

Validate inputs, use HTTPS, no secrets in code.
```

## Common Pitfalls

- Overly broad `applyTo` burns context.
- Silent failures from YAML errors.

## Security and Privacy Notes

- Emphasize no frontend data exposure.
- Prevent Git pushes of sensitive info.