---
description: How to run the automated Nexus Orchestron to audit and resolve ecosystem errors across Local IDX, Supabase, and Vercel.
---

# Nexus Orchestron Loop

The **Nexus Orchestron** is an automated multi-agent framework designed to ensure 100% ecosystem synchronization and zero errors. It manages the execution of **Qwen** (Syntax), **OpenClaw** (Security), and **DeepSeek** (Logic/Sync) audits.

## 1. How It Works

1. The Orchestron (`scripts/orchestrator/nexus_orchestrator.cjs`) is run locally.
2. It executes all three agent phases sequentially.
3. If an error is detected, the Orchestron connects to Supabase and inserts an `OPEN` report into the `nexus_agent_reports` table.
4. It also checks Vercel for the latest cloud deployment health.

## 2. Triggering the Orchestron

As the Lead Orchestrator (Antigravity), you should run this command daily, before merging features, or whenever requested by the user:

```bash
npm run orchestron
```

## 3. The Resolution Loop

1. **Review Reports**: The Orchestron will output any `Failed` statuses to the console and log them to Supabase.
2. **Read Database**: You can view all currently OPEN issues via the Supabase Dashboard (`nexus_agent_reports` table) or by running a quick SQL query via the Vercel/Node CLI.
3. **Fix and Re-Audit**: Once you fix the code (e.g., fixing a syntax error, removing a leaked secret, updating an ABI), you MUST run `npm run orchestron` again.
4. **Close Loop**: Once an issue is fixed and the Orchestron passes, you can manually update the Supabase report status to `RESOLVED` or instruct the user that the ecosystem is completely clean.

## 4. Sub-Agent Responsibilities
- **Qwen**: Validates `node -c` for backend bundles and `npm run lint` for the frontend.
- **OpenClaw**: Runs `npm run gitleaks-check` to enforce the Zero-Secret Leak guard.
- **DeepSeek**: Runs `scripts/audits/check_sync_status.cjs` and `verify-db-sync.cjs` to ensure Database, Contracts, and APIs are 100% aligned.
