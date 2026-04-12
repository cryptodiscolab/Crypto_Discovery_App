# Hooks Reference

## Purpose

Hooks (`.json`) enforce deterministic behavior at agent lifecycle points (e.g., PreToolUse to block unsafe tools).

## When to Use

- Enforce policies (e.g., no network calls without approval).
- Automate security (e.g., format code post-edit).

## Location

- `.github/hooks/*.json`

## Template

```json
{
  "name": "security-hook",
  "description": "Block unsafe operations.",
  "when": "PreToolUse",
  "if": "tool == 'run_terminal' && command.contains('curl')",
  "then": "block",
  "message": "Unsafe network call blocked for privacy."
}
```

## Events

- `PreToolUse`: Before tool execution.
- `PostToolUse`: After tool.
- `PreResponse`: Before response.
- `PostResponse`: After response.

## Examples

### Block Hardcode
```
{
  "when": "PreToolUse",
  "if": "code.contains('password')",
  "then": "warn",
  "message": "Potential hardcode detected."
}
```

## Common Pitfalls

- Over-blocking disrupts workflow.
- JSON syntax errors.

## Security and Privacy Notes

- Use to prevent data leaks.
- Enforce end-to-end protection.