---
name: Kiro Methodology
description: Complete workflow documentation for Kiro AI agent — how Kiro reads code, takes action, creates hooks, and verifies work. Designed for other agents to follow Kiro's patterns for anti-hallucination and memory-based execution.
version: v1.0.0
author: Kiro (MiniMax M2.5)
date: 2026-05-17
applies_to: All agents working on Disco_DailyApp/Raffle_Frontend, api/, contracts/, scripts/
---

# 🎯 Kiro Methodology — Complete Agent Workflow

This skill documents exactly how Kiro operates: from reading code to taking action, creating hooks, and verifying results. Other agents can follow these patterns to achieve the same level of reliability and anti-hallucination.

---

## 1. Kiro's Core Philosophy

### 1.1 Evidence Over Assumption
Kiro NEVER claims something works without proof. Every assertion must be backed by a tool result the agent **just observed**.

- ❌ "useV12Stats should be exported from useContract"
- ✅ `grep_search found useV12Stats exported from src/hooks/useContract.ts:61`

### 1.2 Read Before Touch
Before describing, editing, or claiming anything about code, Kiro reads it first using dedicated read tools — never terminal commands like `cat`, `type`, or `Get-Content` which can lie through formatting layers.

### 1.3 Verify Before Declare-Done
A task is NOT done until a deterministic check confirms it. Kiro runs TypeScript compiler, linter, or diagnostics after every batch of changes.

### 1.4 Iterate on Failure
If the same approach fails twice, Kiro stops, diagnoses the root cause from a different angle, and tries a fundamentally different approach.

---

## 2. Tool Selection Matrix

Kiro uses the right tool for each job. Here's the decision matrix:

### 2.1 Reading Tools

| Tool | When to Use | Example |
|---|---|---|
| `read_file` | Single file you'll edit. Use `start_line`/`end_line` for known locations. | `read_file(path: "src/components/Foo.tsx", start_line: 50, end_line: 100)` |
| `read_files` | 2–8 related files in parallel | `read_files(paths: ["api/user-bundle.ts", "api/_shared/types.ts"])` |
| `readCode` | Large files (>10k chars) where you need function/class signatures | `readCode(path: "src/hooks/useContract.ts", selector: "useV12Stats")` |
| `grep_search` | Pattern hunt across codebase. Always use `includePattern` to narrow scope. | `grep_search(query: "useV12Stats", includePattern: "src/**/*.ts")` |
| `file_search` | Know part of path but not exact location | `file_search(explanation: "find DailyClaimModal", query: "DailyClaim")` |
| `list_directory` | Explore directory structure | `list_directory(path: "src/features/profile")` |

### 2.2 Writing Tools

| Tool | When to Use | Why |
|---|---|---|
| `str_replace` | Replace a few lines in a file | Atomic, verifies uniqueness, auto-shows diff |
| `fs_write` | Rewrite small file (<50 lines) or create new | Cleaner than multiple str_replace |
| `fs_append` | Add content to existing file | No risk of clobbering |
| `smartRelocate` | Move/rename file with imports | Auto-updates all imports |
| `semanticRename` | Rename a symbol across codebase | Cross-file consistency guaranteed |
| `delete_file` | Delete temporary files | Clean up after verification |

### 2.3 Execution Tools

| Tool | When to Use | Example |
|---|---|---|
| `execute_pwsh` | Run shell commands (read-only or one-off) | `execute_pwsh(command: "npx tsc --noEmit")` |
| `control_pwsh_process` | Long-running processes (dev servers, watchers) | `control_pwsh_process(action: "start", command: "npm run dev")` |
| `get_process_output` | Read output from background process | `get_process_output(terminalId: "abc123")` |
| `getDiagnostics` | Check TypeScript/IDE diagnostics on specific files | `getDiagnostics(paths: ["src/components/Foo.tsx"])` |

### 2.4 Agent Tools

| Tool | When to Use | Example |
|---|---|---|
| `invoke_sub_agent` | Delegate work to specialized sub-agents | `invoke_sub_agent(name: "context-gatherer", prompt: "Find all files related to...")` |
| `createHook` | Create automated hooks for IDE events | `createHook(name: "Lint on Save", eventType: "fileEdited", ...)` |
| `kiroPowers` | Activate/deactivate Kiro Powers | `kiroPowers(action: "activate", powerName: "supabase-hosted")` |

---

## 3. The Five-Stage Execution Loop

Every non-trivial task follows this loop. Skipping a stage = hallucination risk.

```
DISCOVER → READ → ACT → VERIFY → REPORT
   ↑                                ↓
   └──── if VERIFY fails, return ───┘
```

### Stage 1 — DISCOVER (Ground Truth)

Before fixing anything, establish the actual state:

```powershell
# Type errors
npx tsc --noEmit --pretty false 2>&1 | Out-File tsc_errors.txt -Encoding utf8

# Lint errors
npx eslint . --format compact

# Git state
git status --short
git diff --stat
```

**Rule:** Never trust user's stated error count. Run the check yourself.

### Stage 2 — READ (Mental Model from Real Bytes)

Use the dedicated read tool. Read with purpose:

```typescript
// WRONG: Reading entire file when you only need lines 100-150
read_file(path: "src/components/Foo.tsx")

// RIGHT: Read only the error location plus context
read_file(path: "src/components/Foo.tsx", start_line: 95, end_line: 155)
```

### Stage 3 — ACT (Surgical Changes)

Make the smallest change that resolves the issue:

```typescript
// str_replace example with proper context (2-3 lines above/below)
str_replace({
  path: "api/user-bundle.ts",
  oldStr: `        // Rule 61: IDENTITY GATING MANDATE
        const isVerified = await checkIdentityStatus(cleanAddress);
        if (!isVerified) return res.status(403).json({ error: 'Identity verification required' });`,
  newStr: `        // Rule 61: IDENTITY GATING MANDATE
        // Exception: when skipSignature === true (on-chain tx provided), gas payment is sufficient
        if (!skipSignature) {
            const isVerified = await checkIdentityStatus(cleanAddress);
            if (!isVerified) return res.status(403).json({ error: 'Identity verification required' });
        }`
})
```

### Stage 4 — VERIFY (Proof, Not Hope)

Run verification in tier of evidence (strongest to weakest):

```
1. tsc --noEmit returns 0
2. tests pass
3. eslint clean
4. getDiagnostics returns no diagnostics
5. file content matches expectation
6. "I think it should work" ← NEVER ACCEPTABLE
```

```typescript
// After edits, always run diagnostics
const diag = getDiagnostics({ paths: ["api/user-bundle.ts"] });
if (diag.hasErrors) {
  // FIX FIRST, don't proceed
}
```

### Stage 5 — REPORT (Reproducible Artifact)

Every multi-file session produces a Markdown report:

```
Raffle_Frontend/KIRO WORK REPORT/SESSION_YYYY-MM-DD_TOPIC.md
```

Required sections:
1. Executive Summary
2. Root-Cause Analysis
3. Files Modified (list with one-line description)
4. Verification (exact command proving success)
5. Stats (quantitative summary)

---

## 4. Hook Compliance Protocol

Kiro follows strict hook compliance:

### Hook 1 — Pre-Push Verification (api/ count)

```powershell
# For git push ONLY:
Get-ChildItem -Path api -Filter *.ts | ? { -not $_.PSIsContainer } | Measure-Object | Select-Object Count
# MUST equal 12 (not counting _shared/)
```

This hook ONLY applies to git push commands. For non-push commands, Kiro self-clears by stating rationale.

### Hook 2 — Post-Write Verification

After every file write:
1. Run `getDiagnostics` on the file
2. If touching contracts, verify function exists in abis_data.txt
3. If touching API, verify route exists in vercel.json
4. Check for proper environment variable handling

### Hook 3 — User Pivot Signal

When user says "Keep Iterating" or similar:
1. Acknowledge and stop current stuck approach
2. Re-read latest tool output
3. Pick a different mechanical path
4. Document the pivot briefly

---

## 5. Anti-Hallucination Rules

### 5.1 The "I Don't Recall" Rule
If you can't point to a specific tool result supporting a claim, say:
> "I don't recall observing that. Let me check now."

Then run `read_file` / `grep_search` / `getDiagnostics`.

### 5.2 The Citation Rule
Every "this works" claim must cite evidence:
- ✅ `getDiagnostics returned no diagnostics for src/Foo.tsx`
- ✅ `grep_search found useV12Stats exported from src/hooks/useContract.ts:61`
- ❌ "useV12Stats should be exported from useContract"

### 5.3 The Re-Read Rule
After `str_replace`, if referencing the same area again, **re-read** it. Don't rely on memory.

### 5.4 The Failed-Approach Rule
If same approach fails twice, STOP. Diagnose from different angle:
- Is error message lying? (line number off due to stale cache)
- Is there a deeper type mismatch?
- Does the type need casting?

### 5.5 The Snapshot Rule
For multi-step refactors, snapshot error count after each batch:
```
Pass 1: 500 → 100 errors
Pass 2: 100 → 50 errors
Pass 3: 50 → 0 errors (done)
```

---

## 6. Codebase-Specific Knowledge

### 6.1 Project Structure

```
Disco_DailyApp/
├── Raffle_Frontend/         ← Vite + React + wagmi + viem + Supabase
│   ├── api/                 ← Vercel serverless (12 .ts files, NEVER more)
│   │   └── _shared/         ← Shared types/constants for api/
│   ├── src/                 ← Frontend source
│   │   ├── components/      ← UI primitives & shared components
│   │   ├── features/        ← admin/, profile/, raffle/, tasks/
│   │   ├── hooks/           ← React hooks (wagmi/viem-aware)
│   │   ├── pages/           ← Route components
│   │   ├── services/        ← API wrappers
│   │   ├── shared/context/  ← React contexts
│   │   └── lib/             ← contracts.ts, supabaseClient.ts
│   └── KIRO WORK REPORT/    ← Session artifacts
├── contracts/                ← Solidity (MasterX, DailyApp, Raffle)
├── scripts/                  ← Audits, sync jobs, deploy
└── .agents/                  ← Skills, configs, scratch
```

### 6.2 Type System Conventions

- **strict: true** — no implicit any, unknown in catch
- **moduleResolution: bundler** — but `api/` is ESM, requires `.js` extensions
- **`Database` type** from `api/_shared/database.types.ts`
- **Web3 errors**: `{ shortMessage?: string; message?: string; code?: number | string }`

### 6.3 Common Fix Patterns

| Symptom | Fix |
|---|---|
| `Property '_x' does not exist` | Strip `_` from destructure key, or alias as `x: _x` |
| `e.message` on `unknown` in catch | `e instanceof Error ? e.message : String(e)` |
| `(x as unknown).field` | `(x as { field?: T }).field` |
| JSX type 'unknown' is not ReactNode | Wrap with `Boolean()` or `String()` |
| `useState([])` infers `never[]` | Specify generic: `useState<T[]>([])` |
| lucide-react `_IconName` | Strip leading `_` from import name |

---

## 7. Creating Hooks

Kiro creates hooks for repetitive tasks. Here's how:

### 7.1 Hook Schema

```json
{
  "name": "string (required)",
  "version": "string (required)",
  "description": "string (optional)",
  "when": {
    "type": "fileEdited|fileCreated|fileDeleted|userTriggered|promptSubmit|agentStop|preToolUse|postToolUse|preTaskExecution|postTaskExecution",
    "patterns": ["array of file patterns (required for file events)"],
    "toolTypes": ["array of tool types or regex (required for preToolUse/postToolUse)"]
  },
  "then": {
    "type": "askAgent|runCommand",
    "prompt": "string (required for askAgent)",
    "command": "string (required for runCommand)"
  }
}
```

### 7.2 Example Hooks Kiro Uses

#### Hook A — TypeScript Lint on Save
```json
{
  "name": "Lint TS On Save",
  "version": "1.0.0",
  "when": { "type": "fileEdited", "patterns": ["*.ts", "*.tsx"] },
  "then": {
    "type": "askAgent",
    "prompt": "Run getDiagnostics on this file. If errors exist, list them and propose fixes."
  }
}
```

#### Hook B — API Layer Guardian
```json
{
  "name": "API Layer Guardian",
  "version": "1.0.0",
  "when": { "type": "fileEdited", "patterns": ["api/**/*.ts"] },
  "then": {
    "type": "askAgent",
    "prompt": "Verify: (1) imports use .js extension. (2) catch blocks use instanceof Error guard. (3) request body is destructured with explicit type. (4) no console.log of payload."
  }
}
```

#### Hook C — Pre-Commit Secret Scan
```json
{
  "name": "Secret Scanner",
  "version": "1.0.0",
  "when": { "type": "userTriggered" },
  "then": {
    "type": "runCommand",
    "command": "git diff --cached --name-only | Select-String -Pattern '\\.env|\\.key$|secret|credential' -CaseSensitive:$false"
  }
}
```

---

## 8. Verification Checklist

A task is NOT done until ALL of:

- [ ] Compiler / linter / test suite reports zero relevant errors
- [ ] `getDiagnostics` is clean for every file touched
- [ ] No new `as any` without documented why
- [ ] No new `@ts-expect-error` without comment + upstream issue link
- [ ] No temporary files left untracked
- [ ] `git status` shows only intended files
- [ ] A KIRO WORK REPORT exists for any session touching ≥2 files
- [ ] If pushing: api/ count verified (12 .ts files), no secrets staged

If any box unchecked, say **"in progress"** — never "done".

---

## 9. Memory & Context

### 9.1 Context Awareness
Kiro maintains awareness of:
- Current session goals
- Recent tool outputs (re-read when context is compacted)
- Open editor files (see `OPEN-EDITOR-FILES` in context)
- User's implicit intent from conversation flow

### 9.2 Before Delegating to Sub-Agent
1. Provide clear context in prompt
2. Specify expected output format
3. Have fallback plan if sub-agent fails

### 9.3 On Context Compaction
When context approaches limit:
- Re-confirm position by checking recent file states
- Don't assume previous context is still accurate

---

## 10. Windows-Specific Notes

Since this codebase runs on Windows (win32, cmd shell):

- Use `execute_pwsh` for PowerShell commands
- Path separator is `\` but tools accept both `\\` and `/`
- Long commands: split across lines or use script files
- Development servers: recommend user runs manually (`npm run dev`)
- Test commands: use `--run` flag to avoid watch mode blocking

---

## 11. Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kiro Quick Reference                        │
├─────────────────────────────────────────────────────────────────┤
│ READ before claim    → use read_file, read_files, grep_search │
│ VERIFY before done   → getDiagnostics, tsc --noEmit           │
│ CLAIM with evidence  → cite tool output, not assumption       │
│ FAIL twice?          → stop, diagnose, try new approach       │
│ PUSH?                → verify api/ count = 12, no secrets    │
│ REPORT?              → KIRO WORK REPORT/SESSION_*.md          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Related Skills

- **evidence-driven-execution** — Anti-hallucination protocol (mandatory read for all agents)
- **git-hygiene** — Commit, branch, push workflow
- **deploy-to-vercel** — Deployment and routing
- **supabase** — Database operations
- **disco-codebase-builder** — Contract interactions

---

*This skill captures Kiro's methodology from real sessions. Built from the 2026-05-17 daily claim hotfix and frontend TypeScript hardening sessions that achieved zero errors with zero runtime regressions.*