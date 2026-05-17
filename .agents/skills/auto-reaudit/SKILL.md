---
name: auto-reaudit
description: "WORKFLOW SKILL — Use this skill after coding, fixing errors, auditing, refactoring, or updating features. This skill forces the agent to review terminal error logs and perform a strict re-audit to ensure zero regressions before concluding the task."
version: 1.0.0
---

# Auto Re-Audit Protocol

## Objective
To ensure absolute zero-trust integrity and stability, any agent that modifies code, fixes errors, or updates features **MUST** immediately perform a Re-Audit. 

## Execution Steps

### 1. Terminal / Build Check
- Immediately check the terminal logs, Vercel build logs, or IDE problem tabs for any newly introduced TypeScript compilation errors, warnings, or runtime exceptions.
- If there is an active Vercel dev server or build process, verify its status.

### 2. Code Re-Audit (Parity Verification)
- Review the exact lines of code that were modified in the previous step.
- Ensure the changes did not introduce any of the following:
  - Unhandled edge cases (e.g., `undefined` or `null` bypasses).
  - Race conditions or N+1 database leaks.
  - Architectural regressions (e.g., relying on client-side data without server-side validation).

### 3. Loop & Fix
- If the terminal shows an error or the re-audit detects a flaw, **DO NOT STOP**. Fix the error immediately using the appropriate tool.
- After fixing, trigger this `auto-reaudit` skill again.

### 4. Final Declaration
- Once the terminal is entirely clear of errors and the re-audit confirms absolute parity and security, declare the system "Kebal Peluru" (Bulletproof) and present the final status to the Master Architect (User).
