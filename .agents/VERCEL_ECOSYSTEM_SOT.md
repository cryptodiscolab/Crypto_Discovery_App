# 🌐 VERCEL ECOSYSTEM AGENT SKILLS (v3.42.9)
**Status**: 🛡️ ACTIVE & LOCKED
**Source of Truth for Vercel Integrations, Deployment, and Next.js/React Best Practices.**

This document defines the canonical guidelines and skill integrations derived from the `vercel-labs/agent-skills` package. All AI agents (Antigravity, Qwen, DeepSeek, Lurah) **MUST** adhere to this document whenever interacting with Vercel deployment pipelines, React/Next.js UI components, or the AI SDK.

## 🚨 MANDATORY: ZERO HARDCODE PHILOSOPHY
**NO VERCEL TOKENS, PROJECT IDs, OR ORG IDs SHALL EVER BE HARDCODED IN ANY SCRIPT OR DOCUMENT.**
1. **Dynamic Resolution**: All access to Vercel APIs or CLIs MUST rely on `process.env.VERCEL_TOKEN` or `process.env.AI_GATEWAY_API_KEY`.
2. **Environment Linking**: Run `vercel link` to generate `.vercel/project.json` for Project ID resolution. **Never** manually type a Project ID in source code.
3. **Mocking for Tests**: Use `.env.test` for any test environments. Hardcoding `vck_...` or `prj_...` in tests is a Protocol Breach Level-1.

---

## 1. CLI & DEPLOYMENT PROTOCOLS

### 1.1 `vercel-cli-with-tokens`
- **Purpose**: Authenticating and executing Vercel CLI commands securely across disparate environments (CI/CD, local agents).
- **Execution Mandate**: Always use `--token=$VERCEL_TOKEN` when triggering deployments via script.
- **Prohibited Flags**: Never use `--yes` blindly on production deployments unless explicitly executing an approved automation script. (Preview deployments may use `--yes`).

### 1.2 `deploy-to-vercel`
- **Purpose**: Automating the push of applications and websites to Vercel environments.
- **Workflow**:
  1. Audit Ecosystem (`check_sync_status.cjs`).
  2. Syntax & Build Check (`vite build` or `next build`).
  3. Deploy Preview (`vercel --token=$VERCEL_TOKEN`).
  4. User Approval.
  5. Deploy Production (`vercel --prod --token=$VERCEL_TOKEN`).

---

## 2. REACT & UI ARCHITECTURE STANDARDS

### 2.1 `vercel-react-best-practices`
- **Purpose**: Strict performance optimization and memory profiling based on Vercel Engineering standards.
- **Memoization**: Only use `useMemo` and `useCallback` when there is provable expensive calculation or referential equality issues (e.g., dependency array for generic hooks). Avoid premature optimization.
- **Server Components (if applicable)**: Default to Server Components (`RSC`). Only use `"use client"` at the furthest leaf nodes where interactivity (e.g., `onClick`, `useState`) is strictly required.

### 2.2 `vercel-composition-patterns`
- **Purpose**: Solving prop-drilling and boolean proliferation within massive UI components.
- **Mandate**: Use "Compound Components" or "Render Props" instead of a monolithic component with 20+ boolean props (`isExpanded`, `isSmall`, `isPrimary`).

### 2.3 `vercel-react-view-transitions`
- **Purpose**: Implementing smooth, native-feeling micro-animations.
- **Integration**: Leverage the experimental `ViewTransition` API when available, or fallback to our Native+ CSS Keyframes (`@keyframes`) constraint.
- **Warning**: Do NOT use `framer-motion` (as per `Master Architect Protocol`). All transitions must utilize the browser's native View Transitions API or lightweight CSS to satisfy Vercel's performance constraints.

### 2.4 `vercel-react-native-skills`
- **Purpose**: Standardization of React Native/Expo integrations.
- **List Optimization**: Always use `FlashList` or strictly memoized `FlatList`. Avoid heavy renders inside `renderItem`.

---

## 3. AGENT OPERATIONAL TRIGGER
**When to reference these skills:**
- "Deploy updates to Vercel."
- "Refactor this massive UI component." (Triggers `vercel-composition-patterns`).
- "Make the UI feel more native/smooth." (Triggers `vercel-react-view-transitions`).
- "Audit my app for performance." (Triggers `vercel-react-best-practices`).

*Integrity Confirmed. Zero Hardcode Inspected. v3.42.9 Parity Reached.*
