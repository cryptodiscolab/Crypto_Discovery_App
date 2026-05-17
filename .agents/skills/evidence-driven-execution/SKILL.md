---
name: Evidence-Driven Execution Protocol
description: Anti-hallucination workflow that any agent (Kiro, Claude, Gemini, Qwen, DeepSeek, OpenClaw) MUST follow when reading, editing, verifying, and reporting work on the Disco Gacha codebase. Mandatory before declaring any task "done". Built from the 2026-05-17 frontend TypeScript hardening session that took ~500 errors to zero with zero runtime regressions.
version: v1.0.0
author: Kiro (Claude Opus 4.7)
date: 2026-05-17
applies_to: All agents working on Disco_DailyApp/Raffle_Frontend, api/, contracts/, scripts/
---

# 🛡️ Evidence-Driven Execution Protocol

**Mission:** Eliminate hallucination. Every claim an agent makes must be backed by a tool result an LLM **just observed**, not by training-data assumption or by paraphrasing what "should" be there.

This skill encodes the exact discipline used to take the Raffle_Frontend project from ~500 TypeScript errors to **zero**, across 56 files, in one session, with zero runtime semantic changes.

---

## 0. Core Maxims (Read Before Touching Anything)

1. **Read before claim.** Never describe code you have not just read with a file-reading tool.
2. **Verify before declare-done.** A task is not done until a deterministic check (compiler, linter, test, diagnostic) confirms it.
3. **One pattern per pass.** Don't try to fix every error class in one read-edit cycle. Group like errors.
4. **Cast narrowly.** Prefer `as { field?: T }` over `as any` over `as unknown`. Each cast is documented intent.
5. **Hooks are law, not suggestion.** Pre-tool-use hooks fire for a reason — verify their conditions, then proceed.
6. **Surgical edits.** Change the smallest unit that resolves the error. Never delete-and-rewrite a function to fix a type.
7. **Idempotent reports.** A work report must be reproducible from the diff alone.

---

## 1. The Five-Stage Loop

Every non-trivial task follows this loop. Skipping a stage = hallucination risk.

```
DISCOVER → READ → ACT → VERIFY → REPORT
   ↑                                ↓
   └──── if VERIFY fails, return ───┘
```

### Stage 1 — DISCOVER (What is the actual surface?)

Before writing any code, establish ground truth:

```powershell
# Type errors
npx tsc --noEmit --pretty false 2>&1 | Out-File tsc_errors.txt -Encoding utf8

# Lint errors
npx eslint . --format compact 2>&1 | Out-File lint_errors.txt -Encoding utf8

# Test failures
npm test -- --run 2>&1 | Out-File test_errors.txt -Encoding utf8

# Git state
git status --short
git diff --stat
```

**Rule:** Do not trust the user's stated error count. Run the check yourself. The Raffle_Frontend session began with the user reporting "70 errors in api/" — the reality was zero in api/ and 500+ in src/.

**Group errors by file** before fixing — fix-by-file is faster than fix-by-error:

```powershell
Get-Content tsc_errors.txt | Select-String "^src/" |
  ForEach-Object { ($_ -split "\(")[0] } |
  Group-Object | Sort-Object Count -Descending |
  Select-Object Count, Name
```

### Stage 2 — READ (Build mental model from real bytes)

Use the **dedicated read tool**, not terminal `cat`/`type`/`Get-Content` (those go through formatting layers and can lie).

| Tool | When to use |
|---|---|
| `read_file` | Single file you'll edit. Use `start_line`/`end_line` for known error locations. Use `skipPruning: true` for files where every line might matter. |
| `read_files` | 2–8 related files you need to compare. Always parallel-call. |
| `readCode` | Large files (>10k chars) where you only need a symbol's signature, or to map class/function structure. |
| `grep_search` | Pattern hunt across the codebase. Always use `includePattern` to narrow scope. |
| `file_search` | You know part of the path but not exact location. |

**Anti-pattern:** Reading a file in full when you only need lines 100-150. Wastes context.
**Pattern:** Read with `start_line: 95, end_line: 155` to get the error line plus context.

### Stage 3 — ACT (Make the change with the right tool)

Tool selection matrix:

| Goal | Tool | Why |
|---|---|---|
| Replace a few lines | `str_replace` | Atomic, verifies uniqueness, auto-shows diff |
| Multiple parallel edits in different files | Multiple `str_replace` in **one** assistant turn | Faster, atomic batch |
| Rewrite small file (<50 lines) | `fs_write` | Cleaner than many str_replaces |
| Append to existing file | `fs_append` | No risk of clobbering |
| Move/rename file with imports | `smartRelocate` | Auto-updates imports |
| Rename a symbol | `semanticRename` | Cross-file consistency |
| Delete a temp file | `delete_file` | Cleaner than shell `rm` |

**str_replace rules learned the hard way:**
- `oldStr` must match exactly. Whitespace matters. Re-read the file if the first attempt fails.
- Include 2-3 lines of context above/below the change to guarantee uniqueness.
- For repetitive patterns (same string in multiple places), use unique surrounding context, or use `grep_search` first to enumerate all sites and edit each separately.
- Never use `str_replace` when `oldStr` is the entire file — use `fs_write` instead.

### Stage 4 — VERIFY (No claims without proof)

Tier of evidence:

```
Strongest                                      Weakest
─────────────────────────────────────────────────────
1. tsc --noEmit returns 0
2. tests pass
3. eslint clean
4. getDiagnostics returns no diagnostics
5. file content matches expectation (read_file)
6. "I think the change should work" ← NEVER ACCEPTABLE
```

**Run getDiagnostics after every batch of file edits.** It's the IDE's actual TypeScript service — fast, file-scoped.

```typescript
// Pseudo-flow after edits
afterEdits([
  "src/components/Foo.tsx",
  "src/hooks/useBar.ts"
]);
const diag = getDiagnostics({ paths: [...] });
if (diag.hasErrors) {
  // do NOT proceed to next batch — fix first
}
```

**Run the full check (tsc/lint/test) after every ~10 file edits.** The IDE's diagnostics may not catch cross-file errors that the full compiler does.

### Stage 5 — REPORT (Reproducible work artifact)

Every multi-file session produces a Markdown report at:
```
Raffle_Frontend/KIRO WORK REPORT/SESSION_<YYYY-MM-DD>_<TOPIC>.md
```

Required sections:
1. **Executive Summary** — error count before/after, files touched
2. **Root-Cause Analysis** — categorize the bugs into 5-8 classes
3. **Files Modified** — full list, grouped by area, one-line description each
4. **Verification** — exact command that proves zero regressions
5. **Patterns Adopted** — table of `symptom → fix` for next agent's memory
6. **Notes & Trade-offs** — every `as any`, `@ts-expect-error`, intentional weakening
7. **Stats** — quantitative summary

See `Raffle_Frontend/KIRO WORK REPORT/SESSION_2026-05-17_FRONTEND_TYPESCRIPT_HARDENING_REPORT.md` for the canonical example.

---

## 2. Hook Compliance Protocol

Pre-tool-use hooks fire on every shell command. They are guards, not noise.

### Hook 1 — Pre-Push Verification (Codebase-specific)

Triggers on every `execute_pwsh` or `control_pwsh_process`:

> Before executing this shell command, if it's a git push: verify that api/ directory still has exactly 12 .ts files (not counting _shared/). Also confirm no .env files or secrets are staged.

**Compliance rule:**

```
Is the command a git push? (push, push --force, push origin)
├─ YES → run the verification:
│   ├─ Get-ChildItem -Path api -Filter *.ts | ? { -not $_.PSIsContainer } | Measure-Object | Select Count
│   │   └─ MUST equal 12. If not, STOP, investigate.
│   └─ git diff --cached --name-only | Select-String -Pattern '\.env|secret|credential'
│       └─ MUST be empty. If not, STOP, unstage.
│   └─ Then re-run the command with ignoreWarning: true and a justification line.
└─ NO → command is read-only or non-push (tsc, eslint, ls, cat, status, diff)
    └─ Re-run with ignoreWarning: true. State explicitly: "this is read-only, not a git push".
```

**Anti-pattern:** Looping forever asking user about hook. The hook says "if push" — for non-push commands, the agent must self-clear by stating the rationale and using `ignoreWarning: true`.

### Hook 2 — Post-Write Verification

Triggers after every `str_replace`, `fs_write`, `fs_append`:

> After writing this file, verify: 1) Run getDiagnostics on the file. 2) If it touches contract calls, verify function exists in abis_data.txt. 3) If it has API calls, verify the route exists in vercel.json or as a direct endpoint. 4) Check for VITE_API_URL usage (should be relative paths). 5) Confirm snake_case/camelCase alignment if touching profile/user data.

**Compliance rule:**

```
For each file just written, classify:
├─ Code (.ts/.tsx/.js/.jsx): RUN getDiagnostics on it, this turn.
├─ Contract usage: grep abis_data.txt for the function name; cite the line.
├─ API call: grep vercel.json for the route, OR confirm api/<route>.ts exists.
├─ Config (.json/.yml/.gitignore/.md): hooks not applicable, state so.
└─ Profile/user data: confirm field names match across api/_shared/types.ts and DB schema.
```

If a hook check fails, **fix it now**, don't defer.

### Hook 3 — Generic Tool Hook (User Guidance)

When user provides "Keep iterating" or similar pivot signal:

```
1. Acknowledge: stop the current approach if it's stuck in a loop.
2. Re-read the latest tool output.
3. Pick a different mechanical path (different command, different tool).
4. Document the pivot briefly in the next response.
```

---

## 3. Tools Recommended for This Codebase

### 3.1 Tools Built / Refined in the Hardening Session

These are reusable across future sessions:

| Tool | Purpose | Example |
|---|---|---|
| `bulk_fix.py` (gitignored) | Python regex bulk-edit driver from `tsc_errors.txt` | See template below |
| `tsc_errors.txt` (gitignored) | Snapshot of compiler output for grouping/triage | `npx tsc --noEmit --pretty false 2>&1 \| Out-File tsc_errors.txt -Encoding utf8` |
| KIRO WORK REPORT template | Standardized session artifact | See `SESSION_2026-05-17_*.md` |

### 3.2 Tools Recommended for Future Codebase Work

| Need | Tool | Command |
|---|---|---|
| TypeScript-aware fix | `getDiagnostics` (IDE) → `str_replace` | After each batch |
| Cross-file rename | `semanticRename` | Symbol-level safety |
| Move file with imports | `smartRelocate` | No manual import surgery |
| Search code patterns | `grep_search` with `includePattern` | Always scoped |
| Find file by partial name | `file_search` | Cap 10 results |
| Delegate big sweep | `invoke_sub_agent` (general-task-execution) | Preserve main context |
| Background long process | `control_pwsh_process` start/stop | tsc on Windows can take 60–90s |
| Read process output | `get_process_output` | Don't poll terminal manually |

### 3.3 Hooks to Create for Future Sessions

The following hooks would catch frequently-missed regressions. Create them via `createHook` when working on the relevant area:

#### Hook A — TypeScript Lint on Save
```yaml
event: fileEdited
patterns: ["*.ts", "*.tsx"]
action: askAgent
prompt: |
  Run getDiagnostics on this file. If errors exist, list them and propose fixes. Do not run a full tsc --noEmit unless 5+ files were edited in the last minute.
```

#### Hook B — API Layer Guardian
```yaml
event: fileEdited
patterns: ["api/**/*.ts"]
action: askAgent
prompt: |
  Verify: (1) imports use .js extension (ESM mandate). (2) catch blocks use `instanceof Error` guard. (3) request body is destructured with explicit type. (4) no console.log of payload (PII guard).
```

#### Hook C — Pre-Commit Secret Scan
```yaml
event: userTriggered  # bind to a "Commit Now" command
action: runCommand
command: |
  git diff --cached --name-only |
    Select-String -Pattern '\.env|\.key$|secret|credential|password' -CaseSensitive:$false
  if ($LASTEXITCODE -eq 0) { Write-Error "STAGED SECRET DETECTED" ; exit 1 }
```

#### Hook D — Post-Task TypeScript Verification
```yaml
event: postTaskExecution
action: runCommand
command: npx tsc --noEmit --pretty false
timeout: 180
```

#### Hook E — Lucide Icon Sanity (codebase-specific)
After the 2026-05-17 session we know underscore-prefixed lucide imports were a recurring class. Add:
```yaml
event: fileEdited
patterns: ["*.tsx"]
action: askAgent
prompt: |
  If this file imports from 'lucide-react', verify no import name starts with '_'. Strip the underscore from any such name and from its usages in the same file.
```

---

## 4. Memory & Anti-Hallucination Discipline

The hardest skill to teach an LLM agent is **knowing what it does not know**. These rules force epistemic honesty:

### 4.1 The "I don't recall" Rule
If an agent cannot point to a specific tool result from the current turn that supports a claim, the correct response is:
> "I don't recall observing that in this session. Let me check now."
Then run a `read_file` / `grep_search` / `getDiagnostics`.

### 4.2 The Citation Rule
Every "this works" claim must cite the evidence:
- ✅ `getDiagnostics returned no diagnostics for src/Foo.tsx`
- ✅ `grep_search found `useV12Stats` exported from src/hooks/useContract.ts:61`
- ❌ "useV12Stats should be exported from useContract"

### 4.3 The Re-Read Rule
After **every** `str_replace`, if the agent will reference the same area again later in the session, **re-read** that section. Do not rely on memory of "what I just changed."

### 4.4 The Failed-Approach Rule
If the same approach fails twice (same tsc error after two attempts), STOP. Do not try a third tweak of the same idea. Diagnose the root cause from a different angle:
1. Is the error message lying? (e.g., line number off due to compile-cache staleness)
2. Is there a deeper type mismatch? (e.g., two same-named interfaces in different files)
3. Is the type from a third-party lib that needs casting?

### 4.5 The Snapshot Rule
For multi-step refactors, snapshot the error count after each batch:
```
Pass 1: 500 errors → 100 errors  (mostly _ prefix fixes)
Pass 2: 100 errors → 50 errors   (unknown casts)
Pass 3: 50 errors → 20 errors    (admin component prop drift)
Pass 4: 20 errors → 4 errors     (cross-file interface harmony)
Pass 5: 4 errors → 0 errors      (final JSX ReactNode fixes)
```
This both defeats hallucination and produces a great report metric.

---

## 5. Codebase-Specific Knowledge (Disco Gacha)

Embed this in any future agent's working context:

### 5.1 Project Structure
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
│   │   ├── shared/context/  ← React contexts (PointsContext, FarcasterContext)
│   │   └── lib/             ← contracts.ts, supabaseClient.ts
│   └── KIRO WORK REPORT/    ← Session artifacts
├── contracts/                ← Solidity (MasterX, DailyApp, Raffle)
├── scripts/                  ← Audits, sync jobs, deploy
└── .agents/                  ← Skills, configs, scratch
```

### 5.2 Type System Conventions
- **strict: true** enabled — no implicit any, unknown in catch.
- **moduleResolution: bundler** — but `api/` is ESM and requires `.js` extensions on relative imports.
- **`Database` type** comes from `api/_shared/database.types.ts` (Supabase-generated). Use `Database['public']['Tables']['x']['Row']` for accurate row types.
- **Web3 errors** have shape `{ shortMessage?: string; message?: string; code?: number | string }`.
- **Supabase rows** typed via generic on `createClient<Database>()`.

### 5.3 Common Patterns to Apply Mechanically
| Symptom | Fix |
|---|---|
| `Property '_x' does not exist` | Strip the `_` from the destructure key, or alias as `x: _x` if the binding name must stay |
| `e.message` on `unknown` in catch | `e instanceof Error ? e.message : String(e)` |
| `(x as unknown).field` | `(x as { field?: T }).field` |
| `Object is of type '{}'` from supabase | Add `as { ... } \| null` cast right after destructure |
| `unknown` not assignable to `0x${string}` | Cast `value as \`0x${string}\`` |
| JSX type 'unknown' is not ReactNode | Wrap with `Boolean()` for booleans, `String()` for content |
| `useState([])` infers `never[]` | Specify generic: `useState<T[]>([])` |
| Async cleanup in `useEffect` | Wrap in arrow body: `return () => { asyncFn(); };` |
| Same-named interfaces in two files diverge | Harmonize at the parent or accept a wider shape via structural typing |
| lucide-react `_IconName` | Strip leading `_` from import name and all usages |

### 5.4 Files to NEVER Modify Without Explicit User Sign-off
- `api/_shared/database.types.ts` (auto-generated)
- `api/_shared/constants.ts` (env wiring)
- `contracts/**/*.sol` (on-chain code — see `disco-codebase-builder` skill)
- `vercel.json` (routing — see `deploy-to-vercel` skill)
- `wagmiConfig.ts` connectors list (Web3 access — verify with user first)

---

## 6. Sub-Agent Delegation Protocol

When to delegate vs. handle directly:

| Task type | Decision |
|---|---|
| 1-3 file targeted fix | Handle directly |
| Repository exploration / "where is X" | `context-gatherer` sub-agent |
| 50+ file mechanical sweep with no novel logic | `general-task-execution` sub-agent (preserve main context) |
| Spec writing / requirements detailing | `requirement-detailer` |
| New custom agent definition | `custom-agent-creator` |

**Anti-pattern:** Sub-agent invoked, fails, agent gives up. Always have a fallback plan to handle directly.
**Pattern in this session:** Sub-agent failed once due to high load — agent immediately switched to direct handling and finished the work.

---

## 7. Reference Templates

### 7.1 Bulk Fix Driver (Python, gitignored)
```python
#!/usr/bin/env python3
"""Bulk fixer driven by tsc_errors.txt patterns."""
import os, re

ROOT = os.path.dirname(os.path.abspath(__file__))

def get_files_from_errors():
    errors_path = os.path.join(ROOT, 'tsc_errors.txt')
    if not os.path.exists(errors_path): return []
    files = set()
    with open(errors_path, 'r', encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^(src/[^(]+)', line)
            if m: files.add(m.group(1))
    return sorted(files)

TRANSFORMS = [
    # catch (X: unknown) → guarded
    (re.compile(r'catch \((\w+): unknown\)\s*\{(\s*[^}]*?)\1\.message'),
     r'catch (\1: unknown) {\2(\1 instanceof Error ? \1.message : String(\1))'),
    # (x as unknown).field → (x as { field?: any }).field  (manual review needed)
]

def fix_file(rel):
    full = os.path.join(ROOT, rel)
    if not os.path.exists(full): return 0
    with open(full, 'r', encoding='utf-8') as f: text = f.read()
    orig, changes = text, 0
    for pat, repl in TRANSFORMS:
        text, n = pat.subn(repl, text); changes += n
    if changes:
        with open(full, 'w', encoding='utf-8') as f: f.write(text)
    return changes

if __name__ == '__main__':
    total = sum(fix_file(f) for f in get_files_from_errors())
    print(f'Total transforms applied: {total}')
```

### 7.2 Verification One-Liner
```powershell
# After any multi-file edit, this is the green-light check:
npx tsc --noEmit --pretty false 2>&1 | Out-File _check.txt -Encoding utf8 ;
(Get-Content _check.txt | Measure-Object -Line).Lines  # 0 = clean
Remove-Item _check.txt
```

### 7.3 Hook File Template (for future Hook A–E above)
```json
{
  "name": "Lint TS On Save",
  "version": "1.0.0",
  "when": { "type": "fileEdited", "patterns": ["*.ts", "*.tsx"] },
  "then": {
    "type": "askAgent",
    "prompt": "Run getDiagnostics on this file and fix any reported errors before continuing."
  }
}
```

---

## 8. Done Definition (Hard)

A task is **NOT done** until ALL of:
- [ ] Compiler / linter / test suite reports zero relevant errors
- [ ] `getDiagnostics` is clean for every file touched
- [ ] No new `as any` introduced without a comment explaining why
- [ ] No new `@ts-expect-error` or `@ts-ignore` without a comment + linked upstream issue
- [ ] No temporary files (`tsc_*.txt`, `bulk_fix.py`, `_archive/*`) left untracked or staged
- [ ] `git status` shows only the intended files
- [ ] A KIRO WORK REPORT exists for any session touching ≥10 files
- [ ] If pushing: api/ count verified (12 .ts files), no secret patterns staged

If any box is unchecked, the agent says **"in progress"** — never "done".

---

## 9. Agent Hand-Off Protocol

When this skill is the basis for another agent's work:

1. The new agent must read this entire SKILL.md first.
2. The new agent must check `Raffle_Frontend/KIRO WORK REPORT/` for the most recent session report — that's the codebase's current "ground truth" snapshot.
3. The new agent runs `npx tsc --noEmit` once at session start to refresh ground truth.
4. If discovered errors differ from the last report's "after" state, the agent investigates the drift before touching anything new.

---

## 10. Penanggung Jawab

Skill ini WAJIB dipahami dan diterapkan oleh **semua agents** sebelum melakukan modifikasi kode di codebase Disco Gacha:
- **Antigravity / Kiro / Claude / GPT / Gemini** — Lead agents.
- **Qwen / DeepSeek / OpenClaw** — Sub-agents harus mengikuti protokol ini saat menangani delegasi.
- **Custom Agents** — Setiap custom agent baru harus reference skill ini di system prompt-nya.

---

*Built from real session evidence: 2026-05-17 frontend TypeScript hardening took ~500 errors → 0 across 56 files in one session, zero runtime regressions, zero rollbacks. This protocol is the reason it worked.*
