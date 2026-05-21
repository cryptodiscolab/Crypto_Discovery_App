/**
 * useHoldingStatus.ts — Phase 4: Tiered NFT Holding Validation
 *
 * ⚠️ ZERO-RIBA MANDATE: This hook validates NFT HOLDING ONLY.
 * No APY, no interest, no inflationary rewards.
 * Privilege unlocks are utility-based, not financial returns.
 *
 * v3.64.19-Hardened | ANTI-WHALE: Diamond capped at 1.5x (15000 BP)
 */

import { useMemo } from 'react';
import { useReadContracts, useAccount } from 'wagmi';
import { useNFTTiers } from '../../../hooks/useNFTTiers';
import { ABIS, CONTRACTS } from '../../../lib/contracts';

// ─── Raffle Fee Discount per Tier (basis points, sourced from PRD §7) ───────
// These are computed privilege rates, NOT APY. Cannot be hardcoded in contract.
// Enforced by backend at claim time via system_settings.
const RAFFLE_DISCOUNT_BP_BY_TIER: Record<number, number> = {
  0: 0,    // No tier
  1: 0,    // Bronze: no raffle discount
  2: 250,  // Silver: 2.5% discount on rake
  3: 500,  // Gold: 5% discount
  4: 750,  // Platinum: 7.5% discount
  5: 1000, // Diamond: 10% discount
};

// ─── Sponsored Task Gate: minimum tier required ──────────────────────────────
const SPONSORED_TASK_MIN_TIER = 3; // Gold+

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HoldingStatus {
  /** Highest tier ID owned (0 = no NFT) */
  highestTier: number;
  /** "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "None" */
  highestTierName: string;
  /** Multiplier in basis points from on-chain nftConfigs.multiplierBP */
  activeMultiplierBP: number;
  /** Human-readable string, e.g. "+10%" */
  activeMultiplierDisplay: string;
  /** Daily XP bonus from on-chain nftConfigs.dailyBonus */
  currentDailyBonus: number;
  /** True if user owns Silver or higher */
  hasRaffleDiscount: boolean;
  /** Raffle fee discount in percent (0–10) */
  raffleDiscountPercent: number;
  /** True if user owns Gold or higher — unlocks Sponsored Tasks */
  unlockedSponsored: boolean;
  /** Tier IDs the wallet currently holds (1–5) */
  ownedTierIds: number[];
  /** Multiplier above baseline (10000 BP), e.g. 1000 = +10% */
  bonusBP: number;
  isLoading: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useHoldingStatus(): HoldingStatus {
  const { address } = useAccount();
  const { tiers } = useNFTTiers();

  const V12 = CONTRACTS.DAILY_APP as `0x${string}`;

  // Read balanceOf(wallet, tierId) for tiers 1–5 via multicall
  const balanceContracts = useMemo(() => {
    if (!address) return [];
    return [1, 2, 3, 4, 5].map((id) => ({
      address: V12,
      abi: ABIS.DAILY_APP as import('viem').Abi,
      functionName: 'balanceOf' as const,
      args: [address, BigInt(id)],
    }));
  }, [address, V12]);

  const { data: balanceResults, isLoading } = useReadContracts({
    contracts: balanceContracts,
    query: { enabled: !!address && balanceContracts.length > 0 },
  });

  return useMemo<HoldingStatus>(() => {
    const NONE: HoldingStatus = {
      highestTier: 0,
      highestTierName: 'None',
      activeMultiplierBP: 10000,
      activeMultiplierDisplay: '+0%',
      currentDailyBonus: 0,
      hasRaffleDiscount: false,
      raffleDiscountPercent: 0,
      unlockedSponsored: false,
      ownedTierIds: [],
      bonusBP: 0,
      isLoading,
    };

    if (!address || !balanceResults || tiers.length === 0) return { ...NONE, isLoading };

    // Determine which tiers the user holds
    const ownedTierIds: number[] = [];
    balanceResults.forEach((result, idx) => {
      if (result.status === 'success' && result.result !== undefined) {
        const balance = BigInt(result.result as bigint | number | string);
        if (balance > 0n) {
          ownedTierIds.push(idx + 1); // tier IDs are 1-indexed
        }
      }
    });

    if (ownedTierIds.length === 0) return { ...NONE, isLoading };

    // Find highest owned tier
    const highestTier = Math.max(...ownedTierIds);

    // Fetch on-chain config for the highest tier
    const tierData = tiers.find((t) => t.id === highestTier);
    const rawMultiplierBP = tierData?.multiplierBP ?? 10000;

    // ANTI-WHALE CAP: Diamond tier MUST NOT exceed 1.5x (15000 BP)
    const activeMultiplierBP = Math.min(rawMultiplierBP, 15000);
    const bonusBP = Math.max(0, activeMultiplierBP - 10000);
    const bonusPercent = bonusBP / 100;
    const activeMultiplierDisplay = bonusPercent > 0 ? `+${bonusPercent.toFixed(0)}%` : '+0%';

    const currentDailyBonus = tierData?.dailyBonus ?? 0;

    const hasRaffleDiscount = highestTier >= 2;
    const raffleDiscountBP = RAFFLE_DISCOUNT_BP_BY_TIER[highestTier] ?? 0;
    const raffleDiscountPercent = raffleDiscountBP / 100;

    const unlockedSponsored = highestTier >= SPONSORED_TASK_MIN_TIER;

    const tierNames: Record<number, string> = {
      1: 'Bronze',
      2: 'Silver',
      3: 'Gold',
      4: 'Platinum',
      5: 'Diamond',
    };

    return {
      highestTier,
      highestTierName: tierNames[highestTier] ?? 'Unknown',
      activeMultiplierBP,
      activeMultiplierDisplay,
      currentDailyBonus,
      hasRaffleDiscount,
      raffleDiscountPercent,
      unlockedSponsored,
      ownedTierIds,
      bonusBP,
      isLoading,
    };
  }, [address, balanceResults, tiers, isLoading]);
}
