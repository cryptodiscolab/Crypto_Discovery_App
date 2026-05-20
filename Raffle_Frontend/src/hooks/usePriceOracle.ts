import { useState, useEffect, useCallback, useMemo } from 'react';
import { WETH_ADDRESS, NATIVE_ETH_ADDRESS, NATIVE_ETH_ALT_ADDRESS } from '../lib/contracts';

const DEX_SCREENER_BASE_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const CACHE_DURATION = 60000; // 1 minute

interface PriceCacheEntry {
  price: number;
  timestamp: number;
}

interface DexScreenerPair {
  baseToken?: { address?: string };
  liquidity?: { usd?: string | number };
  priceUsd?: string;
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[];
}

interface BinanceTickerResponse {
  price?: string;
}

const PRICE_CACHE = new Map<string, PriceCacheEntry>();

/**
 * usePriceOracle
 * Fetches real-time prices for ERC20 tokens or ETH using DexScreener.
 * @param {string[]} tokenAddresses - Array of token addresses to fetch prices for.
 * @returns {object} { prices, isLoading, error, refetch, priceStale, lastFetchedAt }
 *
 * `priceStale` is true if:
 * - No price has been fetched yet, OR
 * - Latest fetch returned 0/missing prices for requested tokens, OR
 * - Last successful fetch is older than STALE_THRESHOLD (10 minutes).
 *
 * Financial actions (buy/swap/raffle creation) should block on `priceStale === true`
 * and show a degraded state to the user.
 */
const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes

export function usePriceOracle(tokenAddresses: string[] = []) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(0);

  // Memoize the stringified addresses to prevent unnecessary re-fetches
  const joinedAddresses = useMemo(() =>
    [...new Set(tokenAddresses.filter(addr => addr && addr.startsWith('0x')))].sort().join(','),
    [tokenAddresses]
  );

  const fetchPrices = useCallback(async () => {
    if (!joinedAddresses) return;

    setIsLoading(true);
    setError(null);

    const now = Date.now();
    const addrsToFetch = joinedAddresses.split(',').filter(addr => {
      const cached = PRICE_CACHE.get(addr.toLowerCase());
      return !cached || (now - cached.timestamp > CACHE_DURATION);
    });

    if (addrsToFetch.length === 0) {
      const cachedPrices: Record<string, number> = {};
      joinedAddresses.split(',').forEach(addr => {
        const cached = PRICE_CACHE.get(addr.toLowerCase());
        if (cached) cachedPrices[addr.toLowerCase()] = cached.price;
      });
      setPrices(prev => ({ ...prev, ...cachedPrices }));
      setIsLoading(false);
      return;
    }

    try {
      // DexScreener allows fetching by comma-separated addresses
      // Note: If too many, we might need to batch, but for our whitelist it should be fine.
      const url = `${DEX_SCREENER_BASE_URL}/${addrsToFetch.join(',')}`;
      const response = await fetch(url);
      const data = await response.json() as DexScreenerResponse;

      const newPrices: Record<string, number> = {};

      if (data.pairs && data.pairs.length > 0) {
        // Group pairs by baseToken address and pick the one with most liquidity
        const bestPairs: Record<string, DexScreenerPair> = {};
        data.pairs.forEach((pair) => {
          const baseAddress = pair.baseToken?.address;
          if (!baseAddress) return;
          const addr = baseAddress.toLowerCase();
          const liquidity = parseFloat(String(pair.liquidity?.usd || '0'));
          if (!bestPairs[addr] || liquidity > parseFloat(String(bestPairs[addr].liquidity?.usd || '0'))) {
            bestPairs[addr] = pair;
          }
        });

        Object.keys(bestPairs).forEach(addr => {
          const price = parseFloat(bestPairs[addr].priceUsd || '0');
          newPrices[addr] = price;
          PRICE_CACHE.set(addr, { price, timestamp: now });
        });
      }

      // Handle addresses that didn't return a price (e.g. new tokens)
      addrsToFetch.forEach(addr => {
        const lowerAddr = addr.toLowerCase();
        if (!newPrices[lowerAddr]) {
          newPrices[lowerAddr] = newPrices[lowerAddr] || 0;
          PRICE_CACHE.set(lowerAddr, { price: newPrices[lowerAddr], timestamp: now });
        }
      });

      // Fallback: If WETH price is still 0, fetch from Binance
      const wethAddr = WETH_ADDRESS.toLowerCase();
      const nativeEthAddr = NATIVE_ETH_ADDRESS.toLowerCase();
      const needsEthPrice = addrsToFetch.some(a => {
        const la = a.toLowerCase();
        return la === wethAddr || la === nativeEthAddr || la === NATIVE_ETH_ALT_ADDRESS;
      });
      if (needsEthPrice && !newPrices[wethAddr]) {
        try {
          const binRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDC');
          const binData = await binRes.json() as BinanceTickerResponse;
          if (binData.price) {
            const ethUsd = parseFloat(binData.price);
            // Set price for all ETH representations
            newPrices[wethAddr] = ethUsd;
            PRICE_CACHE.set(wethAddr, { price: ethUsd, timestamp: now });
            newPrices[NATIVE_ETH_ALT_ADDRESS] = ethUsd;
            PRICE_CACHE.set(NATIVE_ETH_ALT_ADDRESS, { price: ethUsd, timestamp: now });
            newPrices[nativeEthAddr] = ethUsd;
            PRICE_CACHE.set(nativeEthAddr, { price: ethUsd, timestamp: now });
          }
        } catch { /* Binance fallback failed, leave as 0 */ }
      }

      setPrices(prev => ({ ...prev, ...newPrices }));
      setLastFetchedAt(Date.now());
    } catch (err: unknown) {
      console.error('[PriceOracle] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [joinedAddresses]);

  useEffect(() => {
    fetchPrices();
    // Auto-refresh every 5 minutes if component stays mounted
    const interval = setInterval(fetchPrices, 300000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Stale detection: no fetch yet OR last fetch too old OR all requested tokens have 0 price
  const priceStale = useMemo(() => {
    if (lastFetchedAt === 0) return true;
    if (Date.now() - lastFetchedAt > STALE_THRESHOLD) return true;
    const requested = joinedAddresses.split(',').filter(Boolean);
    if (requested.length === 0) return false;
    const allZero = requested.every(addr => {
      const p = prices[addr.toLowerCase()];
      return !p || p === 0;
    });
    return allZero;
  }, [lastFetchedAt, prices, joinedAddresses]);

  return { prices, isLoading, error, refetch: fetchPrices, priceStale, lastFetchedAt };
}
