# Custom Agents Reference

## Purpose

Custom agents (`.agent.md`) isolate workflows with tool restrictions for security or focus.

## When to Use

- Multi-stage tasks with different tools.
- Context isolation (subagent returns single output).
- Restricted environments (e.g., no file edits).

## Location

- `.github/agents/*.agent.md`

## Template

```markdown
---
name: security-auditor
description: "Audit code for security."
tools: ["read_file", "grep_search"]
---

# Security Auditor Agent

Focus on vulnerability detection.

## Workflow
1. Scan code.
2. Report issues.
```

## Frontmatter

- `name`: Agent name.
- `description`: When to invoke.
- `tools`: Allowed tools (restrict for security).

## Examples

### Privacy Agent
```
---
name: privacy-guard
description: "Check data privacy."
tools: ["read_file"]
---

Ensure no leaks.
```

## Common Pitfalls

- Over-restriction limits utility.
- Missing isolation.

## Security and Privacy Notes

- Restrict tools to prevent breaches.
- Ensure end-to-end privacy in outputs.