# 🗺️ MIDNIGHT CYBER UI — E2E IMPLEMENTATION ROADMAP & TASKS
- **Ecosystem Version:** v3.64.35-Hardened
- **Status:** IMPLEMENTATION COMPLETE (Phase 1-5 done, dashboard card/function audit applied 2026-05-30)
- **Last Updated:** 2026-05-30T22:57:14+07:00
- **Author/Agent:** Antigravity (Lead Blockchain Architect)
- **Target Surface:** `Raffle_Frontend/` (Vite + React + Tailwind + Supabase)

---

## 🔍 1. UI & UX COMPARISON: BLUEPRINT vs. LIVE SERVER

A detailed audit has been conducted comparing the `NEW UI DESIGN` vanilla blueprint (HTML/CSS/JS) with the current live React server codebase (`Raffle_Frontend/`).

| Feature/Screen | Blueprint (NEW UI DESIGN) | Live Server (React) | Gap & Work Required |
|--- |--- |--- |--- |
| **Global Theme & CSS** | CSS variables, radial background, animated cyber grid, scrollbars, glassmorphism card shine. | Fully integrated in `index.css` and `design-tokens.css`. | ✅ None. Foundations are 100% styled. |
| **Desktop Layout** | Fixed 260px `sidebar-desktop` with 10 navigation links. Sticky header inside wrapper. | Sidebar updated with full navigation links. | ✅ DONE. UGC, Meteora, Swap routes registered. |
| **Mobile Layout** | Hidden sidebar, sticky `mobile-top-bar` with user stats, `bottom-nav` with 5 core items, and a **"More" Drawer overlay** for remaining items. | `MobileTopBar.tsx` created, `BottomNav.tsx` updated with drawer. | ✅ DONE. Top bar + bottom nav + drawer fully implemented. |
| **Dashboard (`HomePage.tsx`)** | Welcome Card with linked socials, SBT Reward Pool progress & countdown, Stats Grid (4 items), Daily Check-in with wallet/cooldown guard, CMS Feature Cards, Activity Feed logs. | `HomePage.tsx` is the single active dashboard source. Copy wallet, X/Profile routing, Basename verified state, daily-claim countdown/disabled state, internal/external CMS card links, CMS empty state, API-backed merged profile hydration, and empty-pool SBT telemetry are active. | ✅ DONE. Dashboard card functions rechecked 2026-05-31. |
| **Tasks (`TasksPage.tsx`)** | Quest Board header, Daily/Partner tabs, disappearing tasks, **2-step task verification with 5s countdown timer**. | Tabs and disappearing tasks are active. 5s countdown implemented. | ✅ DONE. |
| **Raffles & Gacha (`RafflesPage.tsx`)** | Dual tabs: "Explore Campaigns" (Raffles List) and **"Gacha Spin Wheel" (Buyer Calculator + HTML5 Canvas Spin Wheel)**. | `GachaWheel.tsx` built with calculator + spin wheel. | ✅ DONE. Ticket calculator (ETH/WETH/USDC, volume discount) + CSS wheel + backend `spin-gacha` endpoint. |
| **Meteora Engine (`MeteoraPage.tsx`)** | Dynamic pools list, TVL/APY telemetry, rebalancing sliders (slippage, allocation), bot toggle controls. | `MeteoraPage.tsx` created with telemetry + rebalancing inputs. | ✅ DONE. |
| **Token Swap (`SwapPage.tsx`)** | Standalone Swap screen with payment/receive tokens, input bounds, rate quote, and execution button. | `SwapPage.tsx` registered + `SwapModal.tsx` kept as global trigger. | ✅ DONE. |
| **UGC Hub (`UgcPage.tsx`)** | Unified stats overview, dual creator form (Sponsor Raffle vs Launch Mission), budget fee calculators, live campaign card preview. | `UgcPage.tsx` created with unified dashboard. | ✅ DONE. |
| **Admin Panel (`AdminPage.tsx`)** | Admin settings editing, **Security Agent Matrix status indicators, live Sentinel Terminal logs box**. | `NexusMonitorTab.tsx` integrated with 12-agent matrix + Sentinel logs. | ✅ DONE. |

---

## 📋 2. STEP-BY-STEP IMPLEMENTATION CHECKLIST

### 🛠️ Phase 1: Navigation & Layout Hardening (Web & Mobile) ✅
- [x] **1.1. Sidebar Navigation Synchronization (`Sidebar.tsx`)** — UGC, Meteora, Swap routes added.
- [x] **1.2. Sticky Mobile Top Bar (`MobileTopBar.tsx`)** — Created with Basename avatar, name, address, streak, XP.
- [x] **1.3. Mobile Bottom Nav & More Drawer Overlay (`BottomNav.tsx`)** — "More" button + sliding drawer with UGC, Leaderboard, Swap, SBT, Admin links.

### 🎡 Phase 2: Gacha Spin Wheel & Ticket Calculator (Raffles Page) ✅
- [x] **2.1. Dual Tabs Layout (`RafflesPage.tsx`)** — `Explore Campaigns` + `Gacha Spin Wheel` tabs active.
- [x] **2.2. Ticket Buy Calculator (`GachaWheel.tsx`)** — ETH/WETH/USDC selector, quantity slider, MAX button, volume discount (-10% for ≥5), total cost preview.
- [x] **2.3. CSS Gacha Spin Wheel (`GachaWheel.tsx`)** — 6 segments with spin animation via CSS `transform: rotate()`.
- [x] **2.4. Backend Gacha Spin Endpoint (`_tasks-bundle.ts`)** — `case 'spin-gacha'` route registered, EIP-191 signature verification, prize distribution via `fn_increment_xp`.
- [x] **2.5. Victory Reward Modal (`GachaWheel.tsx`)** — Glassmorphism modal with Award icon, prize label/detail, audit log stamp.

### 🪐 Phase 3: Meteora LP Engine Integration ✅
- [x] **3.1. Create Meteora Page (`MeteoraPage.tsx`)** — TVL/Volume/APY telemetry, slippage slider, allocation ratio, bot toggles (RUNNING/PAUSED), Rebalance Pools button with loading spinner.

### 📢 Phase 4: UGC Sponsor Campaign Hub Consolidation ✅
- [x] **4.1. Create Unified UGC Page (`UgcPage.tsx`)** — Stats cards (Budget, Campaigns, Revenue, XP), dual-form tabs (Sponsor Raffle / Launch Mission), budget calculators, live preview card.

### 🛡️ Phase 5: Security Matrix & Sentinel Logs in Admin Panel ✅
- [x] **5.1. Admin Panel (`AdminPage.tsx` + `NexusMonitorTab.tsx`)** — 12-agent Security Matrix with health indicators, hierarchical task feed, Sentinel Terminal live logs via Supabase real-time subscription.

---

## 🔧 6. POST-IMPLEMENTATION FIXES (2026-05-27 Session)

| Fix | File | Issue | Resolution |
|---|---|---|---|
| JSX structural error | `CreateRafflePage.tsx` | Missing 3 closing `</div>` tags + garbage `)>` token at end | Full rewrite with correct JSX structure |
| TSC TS2345 | `GachaWheel.tsx` | `usePriceOracle` received `(0x${string}\|undefined)[]` | Cast via `.filter(Boolean) as string[]` |
| TSC TS2322 | `NFTGalleryPage.tsx` | `DAILY_APP_ADDRESS` possibly `undefined` assigned to `string` field | Added `\|\| ''` fallback |
| Lint warnings | `GachaWheel.tsx` | Unused imports (`React`, `Zap`, `RefreshCw`), unused `buyTicketsGasless`, unused `ethPriceUsd`, `any` type error | Removed unused imports/destructure/var, added eslint-disable comment for `any` |

---

## 🔬 7. VERIFICATION & STABILITY GUIDELINES

To comply with the strict **Evidence-Driven Execution Protocol** and prevent build/runtime regressions, the following verification commands must be run prior to claiming any work as done:

```bash
# 1. Compile Check (TypeScript strict mode)
cd Raffle_Frontend
npx tsc --noEmit --project tsconfig.json

# 2. Local Production Build Check (Windows Vite-8 Safe Mode)
node node_modules/vite/bin/vite.js build

# 3. Code Quality Linting
npm run lint

# 4. Ecosystem Sync Health Audit
cd ..
.\.bin\rtk.exe node scripts/audits/check_sync_status.cjs
