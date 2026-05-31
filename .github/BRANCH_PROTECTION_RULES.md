# GitHub Branch Protection Rules

Apply these rules to `main` and `develop` in GitHub repository settings.

## Required Rules

1. Require a pull request before merging.
2. Require at least 1 approving review before merge.
3. Dismiss stale approvals when new commits are pushed.
4. Require status checks to pass before merging.
5. Required status checks:
   - `Strict Git Flow / Branch and PR Policy`
   - `Strict Git Flow / Required Tests`
   - `Smart Contracts CI / Compile and Test Smart Contracts`
6. Require branches to be up to date before merging.
7. Restrict direct pushes to `main` and `develop`.
8. Do not allow bypassing the above settings except for emergency owner recovery.

## Agent Rule

Agents must not merge or instruct a merge while any required check is red, pending, or missing. If GitHub branch protection is not configured yet, treat this file as the manual checklist and report the configuration gap.
