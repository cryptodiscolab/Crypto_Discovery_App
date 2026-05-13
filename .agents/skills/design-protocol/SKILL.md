---
name: design-protocol
description: "SSOT for all UI/UX development within the Crypto Disco DailyApp ecosystem. Enforces DESIGN.md compliance."
version: v3.63.5-Hardened
---

# Design Protocol Skill (v3.63.5-Hardened)

This skill enforces the use of `DESIGN.md` as the Single Source of Truth (SSOT) for all UI/UX development within the Crypto Disco DailyApp ecosystem.

## 🛡️ ESM RUNTIME RESOLUTION MANDATE (v3.63.5-Hardened)
- **Mandatory Extension**: Seluruh import relatif di dalam direktori `api/` (Serverless Functions) **WAJIB** menggunakan ekstensi `.js` (contoh: `import { data } from './database.js'`).
- **Type Segregation**: Gunakan `import type` untuk seluruh referensi TypeScript guna memastikan *clean stripping* saat runtime.
- **Pre-Fix Audit**: Sebelum melakukan modifikasi arsitektural, jalankan `node scripts/audits/check_sync_status.cjs` untuk memastikan paritas sistem.
- **Parity Verification**: Gunakan endpoint `/api/admin/parity-audit` untuk verifikasi akhir setelah implementasi kode baru.

## Core Mandate
Every agent MUST read `DESIGN.md` before:
1. Creating new UI components.
2. Refactoring existing styling.
3. Proposing UX changes.

## Protocols

### 1. Token-First Implementation
When building components, do not use ad-hoc hex codes. Map your styling to the tokens defined in the YAML frontmatter of `DESIGN.md`.
- **Backgrounds**: Use `background.primary`, `background.secondary`, etc.
- **Typography**: Use the specified `family.heading` for headers and `family.sans` for body.
- **Components**: Follow the specific guidelines for `card`, `button`, etc.

### 2. Midnight Cyber Aesthetic
Adhere to the "Midnight Cyber" spec:
- **Depth**: Use `backdrop-filter: blur(12px)` and low-opacity backgrounds (`rgba(255, 255, 255, 0.03)`).
- **Accents**: Use the primary brand color (`#3b82f6`) for actionable elements.
- **Micro-animations**: Implement `:hover` states with subtle scaling and glows.

### 3. Design Validation
Before finishing a UI task, run the design auditor (if available) or manually verify:
- [ ] Contrast ratios are accessible.
- [ ] Component structure matches the `DESIGN.md` rationale.
- [ ] No hardcoded colors that conflict with the theme.

## Tooling Integration
- **DESIGN.md**: Root-level specification.
- **scripts/audits/design_lint.cjs**: Automated linter for the spec.
