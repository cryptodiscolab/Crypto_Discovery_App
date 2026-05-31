## Summary

Describe the change and why it is needed.

## Strict Git Flow Checklist

- [ ] Branch name follows `feature/nama-fitur` or `bugfix/123-short-description`.
- [ ] PR targets `develop` or `main`; no direct commit or direct push to protected branches.
- [ ] Peer review requested, or AI code review attached before merge.
- [ ] GitHub required checks are enabled for `Strict Git Flow / Required Tests`.
- [ ] Baseline test suite was run before writing new code, or pre-existing failures are documented below.
- [ ] Final test suite passed with `npm run test:all`.
- [ ] Any affected dependency/functionality has new or updated regression tests.
- [ ] `npm run gitleaks-check` passed.

## Test Evidence

Paste command results or link CI run.

## Review Notes

Mention risk areas, rollout notes, or known limitations.
