# Environment Variable Registry

This document is the canonical source of truth for environment variables used across the Crypto Disco DailyApp.

## Conventions

- **Frontend-visible vars MUST start with `VITE_`** (Vite/Vercel convention).
- **Server-only secrets MUST NOT start with `VITE_`** (would leak to browser bundle).
- All contract addresses use `getAddr()` resolver in `src/lib/contracts.ts` for chain-aware fallback.

## Categories

### Public Frontend (`VITE_*`)

| Key | Purpose | Required |
|---|---|---|
| `VITE_CHAIN_ID` | Active chain ID (`8453` mainnet, `84532` sepolia) | Yes |
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (RLS-protected) key | Yes |
| `VITE_BASE_MAINNET_RPC_URL` | Base mainnet RPC | Yes (mainnet) |
| `VITE_BASE_SEPOLIA_RPC_URL` | Base sepolia RPC | Yes (testnet) |
| `VITE_RAFFLE_ADDRESS` | Raffle contract address (mainnet) | Yes (mainnet) |
| `VITE_RAFFLE_ADDRESS_SEPOLIA` | Raffle contract address (sepolia) | Yes (testnet) |
| `VITE_DAILY_APP_ADDRESS` | Daily App contract address (mainnet) | Yes (mainnet) |
| `VITE_DAILY_APP_ADDRESS_SEPOLIA` | Daily App contract address (sepolia) | Yes (testnet) |
| `VITE_MASTER_X_ADDRESS` | MasterX contract address (mainnet) | Yes (mainnet) |
| `VITE_MASTER_X_ADDRESS_SEPOLIA` | MasterX contract address (sepolia) | Yes (testnet) |
| `VITE_USDC_ADDRESS` | USDC token address (mainnet) | Yes |
| `VITE_USDC_ADDRESS_SEPOLIA` | USDC token address (sepolia) | Yes |
| `VITE_CMS_CONTRACT_ADDRESS` | CMS contract (mainnet) | Optional |
| `VITE_CMS_CONTRACT_ADDRESS_SEPOLIA` | CMS contract (sepolia) | Optional |
| `VITE_PRICE_FEED_ADDRESS` | Chainlink price feed | Optional |
| `VITE_SAFE_MULTISIG` | Safe multisig treasury | Yes |
| `VITE_FARCASTER_REFERRAL` | Farcaster referral URL | Optional |

### Legacy / Deprecated `VITE_*` (still in code with fallback)

These are kept for backwards compatibility. **Do NOT use in new code.**

| Legacy Key | Replacement |
|---|---|
| `VITE_V12_CONTRACT_ADDRESS` | `VITE_DAILY_APP_ADDRESS` |
| `VITE_V12_CONTRACT_ADDRESS_SEPOLIA` | `VITE_DAILY_APP_ADDRESS_SEPOLIA` |
| `VITE_RPC_URL` | `VITE_BASE_MAINNET_RPC_URL` / `VITE_BASE_SEPOLIA_RPC_URL` |

### Server-Only Secrets (NO `VITE_` prefix)

| Key | Purpose | Required |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for backend writes | Yes |
| `CRON_SECRET` | Bearer token for cron endpoints | Yes (production) |
| `PRIVATE_KEY` | Backend signer private key | Yes (sync-xp-onchain) |
| `WALLET_BOT_SIGNER` | Signer for sync signature endpoint | Yes |
| `NEYNAR_API_KEY` | Farcaster API key | Yes (Farcaster features) |
| `PINATA_JWT` | Pinata IPFS pin auth | Yes (UGC raffle creation) |
| `TELEGRAM_BOT_TOKEN` | Telegram notification bot token | Optional |
| `TELEGRAM_CHAT_ID` | Telegram destination chat ID | Optional |
| `ALCHEMY_API_KEY` | Alchemy RPC key (server-side proxy) | Optional |
| `BASE_SEPOLIA_RPC_URL` | Server-side sepolia RPC | Optional |
| `BASE_MAINNET_RPC_URL` | Server-side mainnet RPC | Optional |
| `V15_CONTRACT_ADDRESS` | New canonical name for sync-xp-onchain contract | Recommended |

### Cron Schedule (Vercel)

| Path | Schedule | Auth |
|---|---|---|
| `/api/cron/sync-events` | `0 0 * * *` (daily midnight) | `CRON_SECRET` |
| `/api/sync-xp-onchain` | `0 2 * * *` (daily 2am) | `CRON_SECRET` |
| `/api/lurah-cron` | `0 1 * * *` (daily 1am) | `CRON_SECRET` |
| `/api/audit-bundle?action=reconcile-pending` | `0 */6 * * *` (every 6h) | `CRON_SECRET` |

## Runtime Assertion

Use `/api/ping?debug=1` (admin-authed in production) to inspect:
- `node_version`
- Set env keys matching `SUPABASE`, `SECRET`, `VITE`

For deeper diagnostics, run the route registry test: `npm run check-routes`.

## Migration Plan

1. **Now**: Both legacy `VITE_V12_*` and new `VITE_DAILY_APP_*` work via `getAddr()` resolver.
2. **Soon**: Update all Vercel env vars to new naming convention.
3. **Then**: Remove legacy fallback from `src/lib/contracts.ts` and `_shared/constants.ts`.
4. **Server-side**: Migrate `sync-xp-onchain.ts` from `VITE_V12_CONTRACT_ADDRESS_SEPOLIA` to `V15_CONTRACT_ADDRESS` (already supports both).

## Hardcoded Constants (intentional)

These are NOT env-tunable and are committed to source:

- `WETH_ADDRESS` = `0x4200000000000000000000000000000000000006` (same on all Base chains)
- `NATIVE_ETH_ADDRESS` = `0x0` (zero address placeholder)
- `NATIVE_ETH_ALT_ADDRESS` = `0xeeee...eeee` (LiFi/1inch placeholder)

See `src/lib/contracts.ts` for source.
