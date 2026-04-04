---
description: Automated synchronization of PRD version, Agent Skills, Gemini/Claude instructions, and .cursorrules across the ecosystem.
---

# /update-skills

This workflow automates the end-to-end synchronization of the Crypto Disco ecosystem documentation and protocols.

## Steps

1. **Increment PRD Version**
   - Identify the current version in `PRD/`.
   - Update `PRD/DISCO_DAILY_MASTER_PRD.md` and create a new version snapshot.
   - **MANDATORY**: Update `PRD/FEATURE_WORKFLOW_SOT.md` to reflect latest feature logic.
   - Generate the corresponding `.html` version using `npx marked`.

2. **Synchronize Agent Instruction Files**
   - Update `.agents/gemini.md` with latest mandates and version markers.
   - Update `CLAUDE.md` with identical mandates and "Nexus War Room" state logic.
   - Ensure "A-D-R-R-E" cycle and "Zero-Hardcode" rules are consistent.

3. **Update .cursorrules (Master Protocol)**
   - Audit `.cursorrules` for outdated addresses or magic numbers.
   - Inject new rules derived from recent "Nexus Evolution" (A-D-R-R-E) findings.
   - Ensure Section 29 (Audit-First) and Section 32 (ENV-SANITY) reflect current enforcement levels.

4. **Audit & Upgrade Skills**
   - Review each skill in `.agents/skills/`.
   - Update `SKILL.md` files if underlying technology or protocol has evolved.
   - **MANDATORY**: Update `.agents/WORKSPACE_MAP.md` to ensure version parity.
   - Verify `ecosystem-sentinel`, `secure-infrastructure-manager`, and `git-hygiene` are in-sync with `.cursorrules`.

5. **Nexus War Room Final Sync**
   - Ensure all sub-agents are aware of the new versioning via `agent_vault`.
   - Check `nexus-routing.json` for any necessary model upgrades.

6. **Verification**
   - Run `node scripts/check_sync_status.cjs`.
   - Verify build stability via `npm run build`.
   - Commit and push all documentation changes together.
