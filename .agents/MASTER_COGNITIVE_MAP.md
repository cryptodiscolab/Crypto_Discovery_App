# 🧠 DEEP MASTER COGNITIVE MAP (v1.9.8)
*Project: Crypto Disco | Ecosystem: Base Mainnet | Security: Hardened v3.56.4*

Dokumen ini adalah **Jangkar Kognitif** utama bagi Antigravity dan seluruh sub-agen. Peta ini mendefinisikan bagaimana data mengalir, bagaimana kontrak berinteraksi, dan bagaimana agen beroperasi secara otonom.

---

## 1. 🌍 THE WORLD MAP (High-Level Ecosystem)
Visualisasi makro dari seluruh pilar utama ekosistem.

```mermaid
graph TD
    subgraph Client_Layer [CLIENT LAYER]
        User((User))
        FE[Raffle_Frontend]
        NCC[Nexus Command Center]
    end

    subgraph Logic_Layer [LOGIC LAYER - Vercel]
        API[Serverless Bundles]
        VS[Verification Server]
    end

    subgraph Data_Layer [DATA LAYER]
        DB[(Supabase DB)]
        S3[Supabase Storage]
    end

    subgraph Blockchain_Layer [BLOCKCHAIN LAYER - Base]
        DA[DailyApp V13.2]
        MX[MasterX XP]
        RF[Raffle v2.1]
        CMS[CMS Contract]
        ASSETS{Digital Assets}
        ASSETS -->|SBT| SBT((Soulbound NFT))
        ASSETS -->|TKT| TKT((Raffle Tickets))
    end

    subgraph Sentinel_Layer [SENTINEL & AUDIT]
        LR[Lurah Brain / AI Monitor]
        ORC[Nexus Orchestron]
    end

    %% Interactions
    User -->|Interact| FE
    FE -->|Auth/Data| API
    FE -->|Verify Social| VS
    FE -->|On-Chain TX| DA
    FE -->|On-Chain TX| RF

    API -->|Read/Write| DB
    VS -->|Verify API| Neynar[Neynar/Farcaster]
    VS -->|Verify API| X[Twitter/X API]

    DB <-->|Sync| MX
    DB <-->|Sync| DA
    
    %% Monitoring
    LR -.->|Audit| Logic_Layer
    LR -.->|Audit| Blockchain_Layer
    ORC -.->|Sync Audit| DB
```

---

## 2. 🔄 DATA FLOW & SYNC PIPELINE (Operational)
Bagaimana status "XP" dan "SBT Tier" disinkronkan. Menggunakan **Optimistic Trust Model (V13.2)** untuk mengatasi lag RPC.

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Vercel API
    participant DB as Supabase
    participant BC as Base Blockchain
    participant AG as Antigravity (Cron)

    U->>FE: Complete Task
    FE->>API: handleClaim(task_id)
    API->>DB: Check Eligibility & Limits
    API->>API: Execute Social Verification
    API->>DB: Increment XP (fn_increment_xp)
    API->>BC: Record TaskCompletion (if on-chain)
    
    Note over DB,BC: Daily Sync Loop
    AG->>BC: Read Tier Configs
    AG->>DB: Update user_profiles (Tier Parity)
    DB-->>FE: UI Refresh (Pulse Effect)
```

---

## 3. 🤖 AGENT ORCHESTRATION MATRIX
Struktur komando dan delegasi antara Antigravity dan sub-agen.

```mermaid
graph LR
    Owner((OWNER)) --> AG[Antigravity / Lead]
    
    subgraph Bridge [Multi-Agent Bridge v1.3.7]
        AG -->|Delegasi| OC[OpenClaw / Security]
        AG -->|Delegasi| QW[Qwen / Refactor]
        AG -->|Delegasi| DS[DeepSeek / Backend]
    end

    subgraph Sentinel_System
        AG -->|Monitor| NX[Nexus Monitor]
        NX -->|Alert| LR[Lurah Brain]
        LR -->|Memory| DB[(Chat History)]
    end

    AG -->|Update| SOT[Source of Truth / PRD]
    AG -->|Monitor| NX[Nexus Monitor]
    
    Note_Vault[State sharing via agents_vault]
```

---

## 4. 🛡️ SECURITY & TRUST MATRIX (Hardened)
Aturan emas yang menjaga integritas sistem.

| Komponen | Aturan Keamanan (Mandatory) | Status |
|---|---|---|
| **SBT Tier** | Sequential Upgrade Only (N+1) & Non-Transferable. | 🔒 Locked |
| **Identity** | **Identity Lock**: 1 Social ID (FID/X) = 1 Wallet Address. | 🔒 Sybil-Proof |
| **Environment** | Zero-Leak Sync via `robust_sync.cjs`. | 🔒 Verified |
| **XP Reward** | Zero-Hardcode (Must read from `point_settings`). | 🔒 Dynamic |
| **API Keys** | 9-Key Rotation for Gemini Resilience. | 🔒 Fail-Safe |
| **Audit** | Pre-Flight Audit mandatory before any code change. | 🔒 Active |

---

## 5. 🛠️ TECHNICAL PLUMBING (APIs & ABIs)
Jembatan efisiensi antara Frontend, Backend, dan On-Chain.

```mermaid
graph LR
    subgraph Frontend_Plumbing [SRC/LIB/CONTRACTS.JS]
        TXT[abis_data.txt] -->|JSON.parse| Proxy[createAbiProxy]
        Proxy -->|Lazy Load| ABI[DAILY_APP / MASTER_X / RAFFLE]
        ENV[.env / VITE_...] -->|getAddr| ADDR[Normalized Checksum Address]
    end

    subgraph API_Plumbing [VERCEL /API/..]
        VR[vercel.json] -->|Rewrites| TB[tasks-bundle.js]
        VR -->|Rewrites| UB[user-bundle.js]
        TB -->|RPC Call| PG[fn_increment_xp]
        UB -->|RPC Call| PG
        VS[Verification Server] -->|Verify| TB
    end

    ABI -->|viem/wagmi| Connect[On-Chain Interaction]
    ADDR -->|viem/wagmi| Connect
```

### ⚙️ Plumbing Rules:
1.  **ABI Proxy**: Gunakan `DAILY_APP_ABI` dari `contracts.js` (Lazy-loaded via `abis_data.txt`).
2.  **Address Normalization**: Semua alamat wajib melewati `cleanAddr/getAddress` (EIP-55 Checksum).
3.  **Dual-Path XP Sync**:
    *   **On-Chain (Daily Claim)**: Frontend menembak `/api/user-bundle?action=xp` setelah TX success. Backend menggunakan *Optimistic Fallback* jika RPC lag.
    *   **Off-Chain (Tasks)**: Verification-Server langsung memanggil `fn_increment_xp` via Supabase RPC.

---

## 6. 🚀 FEATURE IMPLEMENTATION LIFECYCLE
Bagaimana fitur dikembangkan dari ide hingga Production.

```mermaid
graph TD
    subgraph Planning
        PRD[Master PRD v3.56.4] --> Audit[Audit: check_sync_status.cjs]
    end

    subgraph Implementation
        Audit --> Development{Dev Path}
        Development -->|On-Chain| SC[Smart Contract / DailyApp]
        Development -->|Off-Chain| DB[Database / Supabase]
    end

    subgraph Validation
        SC --> Sync[Sync: sync-env.mjs]
        DB --> Sync
        Sync --> Test[E2E Verification]
    end

    subgraph Deployment
        Test --> Vercel[Vercel Deploy]
        Vercel --> SOT[Update Master SOT / PRD]
    end
```

### 🔑 Workflow Guardrails:
1.  **Audit-First**: Jalankan `node scripts/audits/check_sync_status.cjs` sebelum modifikasi.
2.  **Dual-Pipeline Awareness**: Bedakan alur XP On-Chain (DailyApp) dan Off-Chain (Supabase Tasks).
3.  **Zero-Hardcode**: Kontrak baru wajib di `.env` dan di-deploy via `sync-env.mjs`.

---

## 7. ⛓️ SMART CONTRACT TOPOLOGY
Hubungan fungsional antar kontrak di Base Sepolia.

```mermaid
graph TD
    subgraph Core_Engine [MASTERX - The Controller]
        MX[MasterX v3.56]
        MX_XP[XP Ledger]
        MX_SBT[SBT Tier Engine]
    end

    subgraph Satellite_Services [SATELLITES]
        DA[DailyApp V13.2]
        RF[Raffle Manager v2.1]
        CMS[CMS Contract]
    end

    %% Interactions
    DA -->|Award XP| MX
    RF -->|Verify Tier| MX
    RF -->|Burn XP| MX
    DA -->|Read Config| CMS

    %% Assets
    MX_SBT -->|Mint| SBT((Soulbound NFT))
    RF -->|Mint| TKT((Raffle Tickets))
```

### 📋 Active Contract Registry (v3.56.4):
| Kontrak | Alamat (Base Sepolia) | Peran Utama |
|---|---|---|
| **MasterX** | `0x980770dAcE8f13E10632D3EC1410FAA4c707076c` | Controller Utama, NFT/SBT Mint & Upgrade. |
| **DailyApp** | `0x369aBcD44d3D510f4a20788BBa6F47C99e57d267` | Satellite Tugas (Social Verify, Claims). |
| **Raffle** | `0xA13AF0d916E19fF5aE9473c5C5fb1f37cA3D90Ce` | Tiket Gacha & Refund Protocol V2.1. |
| **CMS** | `0xd992f0c869E82EC3B6779038Aa4fCE5F16305edC` | Content Text Mapping On-Chain. |

---

## 8. 🏆 THE SUPREME USER JOURNEY (End-to-End)
Siklus hidup user dari pendaftaran pertama hingga status Diamond Legacy.

```mermaid
graph TD
    %% Phase 1: Onboarding
    subgraph Phase_1 [PHASE 1: ONBOARDING]
        Login[Connect Wallet & Social] --> Identity[Identity Binding / Sybil Check]
        Identity --> Profile[Profile Initialization]
    end

    %% Phase 2: Engagement
    subgraph Phase_2 [PHASE 2: ENGAGEMENT]
        Profile --> Tasks[Complete Daily Tasks / Off-Chain]
        Profile --> Daily[Claim Daily Bonus / On-Chain]
        Tasks --> XP[XP Accrual via fn_increment_xp]
        Daily --> XP
    end

    %% Phase 3: Social Reputation
    subgraph Phase_3 [PHASE 3: SOCIAL REPUTATION]
        XP --> BaseLink[Link Basenames / Identity Guard]
        BaseLink --> HighTask[Unlock Premium Tasks]
        HighTask --> XP
    end

    %% Phase 4: Economy & Referral
    subgraph Phase_4 [PHASE 4: ECONOMY]
        XP --> Raffle[Buy Raffle Tickets]
        XP --> Invite[Refer New Users]
        Invite --> Passive[Passive XP Dividend]
        Raffle --> Prize[Win Prizes / USDC / ETH]
        Prize --> Swap[Li.Fi Swap / Liquidity]
    end

    %% Phase 5: Ascension
    subgraph Phase_5 [PHASE 5: ASCENSION]
        Swap --> TierCheck{Check Database Tier}
        TierCheck -->|Tier > NFT| Mint[Sequential SBT Upgrade / N+1]
        Mint --> Diamond[Diamond Legacy / Hardened Status]
    end
```

### 📖 Lifecycle Details:
1.  **Identity Binding**: FID/X-ID terkunci permanen pada wallet address saat registrasi.
2.  **Anti-Whale Scaling**: Perolehan XP menggunakan rumus `Final_XP = Base * G * I * U`.
3.  **Sequential Ascension**: Upgrade tier NFT bersifat linear (Rookie -> Bronze -> Silver, dst). UI menampilkan **Real-Time Financial Transparency** (Konversi ETH-to-USDC).

---

## 9. 🛠️ ADMIN MODERATION & REFUND FLOW (Protocol v2.1)
Mekanisme pengamanan dana sponsor dan moderasi konten UGC.

```mermaid
sequenceDiagram
    participant AD as Admin (Dashboard)
    participant RF as Raffle Contract
    participant DB as Supabase
    participant SP as Sponsor Wallet

    AD->>RF: cancelRaffle(raffleId)
    RF->>RF: Verify totalTickets == 0
    RF->>SP: Refund Deposit (ETH)
    RF-->>AD: tx_hash (RaffleCancelled)
    
    AD->>DB: POST /api/reject-raffle {tx_hash, reason}
    DB->>DB: Update raffle status -> 'rejected'
    DB->>DB: Log to admin_audit_logs
```

*   **Revenue Split**: Listing Fee dari misi UGC dialokasikan secara manual ke **SBT Pool (Treasury)** untuk pendanaan hadiah tier jangka panjang.

---

## 10. 🛡️ LURAH BRAIN (SENTINEL & MONITORING)
Sistem pengawas ekosistem otonom berbasis AI.

*   **Autonomous Monitoring**: Memantau RPC, drift database, dan Vercel builds.
*   **Self-Healing**: Lurah mampu mendeteksi "Stall" pada loop sinkronisasi dan memberikan instruksi perbaikan otomatis ke agen delegasi.
*   **Chat Memory**: Konteks diskusi teknis (10 pesan terakhir) di Telegram tersimpan di `telegram_chat_history`.

---

## 11. 📈 ECONOMIC MODEL: THE REWARD LOOP
Visualisasi alur XP, Referral, dan Revenue.

```mermaid
graph LR
    subgraph XP_Loop
        User -->|Task| XP[XP Accrual]
        XP -->|Scaling| FinalXP[Final XP / Anti-Whale]
    end

    subgraph Referral_System
        Inviter -->|Invite| Invitee
        Invitee -->|Threshold 500XP| Vesting[Referral Vesting +50XP]
        Invitee -->|Daily Earn| Dividend[10% Passive Dividend to Inviter]
    end

    subgraph Revenue_Cycle
        UGC[UGC Listing Fee] -->|Mark Funded| Treasury[SBT Pool / Treasury]
        Treasury -->|Rewards| Diamond[Diamond Legacy Status]
    end
```

| Fitur | Logika / Rumus | Tujuan |
|---|---|---|
| **XP Scaling** | `Final_XP = Base * G * I * U` | Mencegah dominasi Whale & membantu pemain baru (Underdog Bonus). |
| **Referral Vesting** | +50 XP saat Invitees mencapai 500 XP. | Mencegah *spam* akun palsu (High-Integrity Growth). |
| **Passive Dividend** | Referrer mendapat 10% dari XP harian Invitees. | Insentif pertumbuhan organik secara pasif. |
| **Revenue Allocation** | Admin Dashboard -> Revenue Tab -> Mark Funded. | Transparansi finansial dan penguncian dana operasional. |

---

## 12. 💰 SBT REWARD POOL & THRESHOLD DISTRIBUTION
Mekanisme distribusi hadiah berbasis **Target Cap** (Admin Defined).

```mermaid
graph TD
    subgraph Phase_Accumulation [PHASE 1: ACCUMULATION]
        UGC[UGC Fees] --> Pool[(SBT Pool Balance)]
        RF[Raffle 20%] --> Pool
    end

    subgraph Phase_Target [PHASE 2: THRESHOLD CHECK]
        Pool -->|Check| TC{Balance >= Target?}
        TC -->|No| Accum[Status: Accumulating / Claims Locked]
        TC -->|Yes| Trigger[Status: Ready / Claims Possible]
    end

    subgraph Phase_Distribution [PHASE 3: DISTRIBUTION]
        Trigger -->|Mark Funded| Snapshot[Snapshot Leaderboard]
        Snapshot -->|Legendary 35%| T5[Diamond / Rank 1-5]
        Snapshot -->|Epic 25%| T4[Platinum / Rank 6-20]
        Snapshot -->|Rare 20%| T3[Gold / Rank 21-50]
        Snapshot -->|Common 15%| T2[Silver / Rank 51-100]
        Snapshot -->|Participation 5%| T1[Bronze / All]
    end
```

### 📊 Hardened Reward Breakdown (v1.9.8):
| Rank Leaderboard | Share Pool | Syarat SBT Tier | Tipe Hadiah | Target Partisipan |
|---|---|---|---|---|
| **Rank 1 - 5** | **35%** | **Diamond (T5)** | **Legendary Share** | 5 Whale Elit |
| **Rank 6 - 20** | **25%** | **Platinum (T4)** | **Epic Share** | 15 Pemain Semi-Elit |
| **Rank 21 - 50** | **20%** | **Gold (T3)** | **Rare Share** | 30 Pemain Aktif |
| **Rank 51 - 100** | **15%** | **Silver (T2)** | **Common Share** | 50 Pemain Menengah |
| **All Holders** | **5%** | **Bronze (T1)** | **Participation** | Seluruh Komunitas |

*   **Threshold Governance**: Distribusi **TIDAK** didistribusikan secara otomatis. Distribusi hanya terjadi saat `Current Balance >= Target Pool` (Misal: $5,000).
*   **Admin Sentinel**: Admin harus menekan tombol **"Execute Distribution"** (Mark Funded) untuk mengunci peringkat Leaderboard dan membuka gerbang klaim.
*   **Rank-Tier Lock**: Aturan 1-to-1 Mapping tetap berlaku saat gerbang klaim dibuka.

---

## 13. 🚦 MAINNET ROLLOUT & GUARDRAILS
Keamanan transisi dan perlindungan aset di Mainnet.

*   **Feature Flags**: Dikontrol via `system_settings.active_features`.
*   **Kill Switch**: Administrator dapat mematikan fitur secara global melalui dompet terotorisasi jika terdeteksi anomali kontrak.
*   **Chain ID Parity**: Deteksi otomatis jaringan Base Mainnet (`8453`) vs Sepolia.

---

## 14. 🏛️ FRONTEND STANDARDS & MAINTENANCE LOOP
Standar kualitas UI dan protokol pembersihan ekosistem.

*   **Law 55 (Concurrent UI Mandate)**: UI tidak boleh *blocking*. Gunakan `startTransition` (React 18/19) dan *Optimistic UI* untuk semua interaksi on-chain.
*   **Nexus Orchestron Loop**: Protokol pembersihan otomatis:
    1.  **Local Audit**: `check_sync_status.cjs` mendeteksi drift.
    2.  **Global Sync**: `robust_sync.cjs` menyelaraskan `.env` lintas Vercel/Supabase.
    3.  **Contract Audit**: `/sync-contracts-audit` memastikan tidak ada alamat kontrak lama.

---

## 15. 🔗 EXTERNAL MODULES & IMMUTABLE MANDATES
Integrasi pihak ketiga dan aturan yang tidak boleh dilanggar.

*   **External Integrations**:
    *   **Li.Fi**: Protokol swap & bridging untuk likuiditas hadiah user.
    *   **Meteora Agent**: Modul analisis LP eksternal untuk optimasi PnL ekosistem.
    *   **Identity**: Neynar (Farcaster) & Twitter API sebagai jangkar reputasi sosial.
*   **The Immutable Mandates**:
    1.  **Zero Hallucination**: Dilarang menebak alamat kontrak atau struktur DB. Rujuk SOT.
    2.  **No-Skip Audit**: Dilarang push code tanpa `node scripts/audits/check_sync_status.cjs`.
    3.  **State Persistence**: Seluruh state diskusi teknis wajib disimpan di `agents_vault`.

---

## 16. 📍 CORE REGISTRY (Quick Access)
*   **Source of Truth**: [DISCO_DAILY_MASTER_PRD.md](file:///e:/Disco%20Gacha/Disco_DailyApp/PRD/DISCO_DAILY_MASTER_PRD.md)
*   **Feature Workflow**: [FEATURE_WORKFLOW_SOT.md](file:///e:/Disco%20Gacha/Disco_DailyApp/PRD/FEATURE_WORKFLOW_SOT.md)
*   **Task Deep-Dive**: [TASK_FEATURE_WORKFLOW.md](file:///e:/Disco%20Gacha/Disco_DailyApp/PRD/TASK_FEATURE_WORKFLOW.md)
*   **Audit Script**: `node scripts/audits/check_sync_status.cjs`

---
*Generated by Antigravity v3.56.4 | Cognitive Sync v1.9.8 Enabled*
