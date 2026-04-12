# Skills Reference

## Purpose

Skills (`SKILL.md`) package workflows with assets (scripts, templates) for on-demand use.

## When to Use

- Complex multi-step tasks.
- Bundled resources (e.g., security scripts).

## Location

- `.github/skills/{name}/SKILL.md`
- Assets in subfolders.

## Template

```markdown
---
name: security-skill
description: "Comprehensive security audit."
---

# Security Skill

## Steps
1. Scan.
2. Report.

## Assets
- scripts/audit.py
```

## Frontmatter

- `name`: Skill name.
- `description`: Trigger.

## Structure

- `SKILL.md`: Instructions.
- `assets/`: Scripts, templates.
- `references/`: Docs.

## Examples

### Audit Skill
```
---
name: vuln-audit
description: "Audit vulnerabilities."
---

Run audit script.
```

## Common Pitfalls

- Large assets slow loading.
- Missing description.

## Security and Privacy Notes

- Include privacy checks in assets.
- No hardcode in scripts.