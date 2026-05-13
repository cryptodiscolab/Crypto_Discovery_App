import { useState, useEffect, useCallback, useMemo } from 'react';

const DEX_SCREENER_BASE_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const PRICE_CACHE = new Map();
const CACHE_DURATION = 60000; // 1 minute

/**
 * usePriceOracle
 * Fetches real-time prices for ERC20 tokens or ETH using DexScreener.
 * @param {string[]} tokenAddresses - Array of token addresses to fetch prices for.
 * @returns {object} { prices, isLoading, error, refetch }
 */
export function usePriceOracle(tokenAddresses: string[] = []) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const data = await response.json();

      const newPrices: Record<string, number> = {};
      
      if (data.pairs && data.pairs.length > 0) {
        // Group pairs by baseToken address and pick the one with most liquidity
        const bestPairs: Record<string, any> = {};
        data.pairs.forEach((pair: any) => {
          const addr = pair.baseToken.address.toLowerCase();
          const liquidity = parseFloat(pair.liquidity?.usd || 0);
          if (!bestPairs[addr] || liquidity > parseFloat(bestPairs[addr].liquidity?.usd || 0)) {
            bestPairs[addr] = pair;
          }
        });

        Object.keys(bestPairs).forEach(addr => {
          const price = parseFloat(bestPairs[addr].priceUsd || 0);
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
      const wethAddr = '0x4200000000000000000000000000000000000006';
      if (addrsToFetch.some(a => a.toLowerCase() === wethAddr) && !newPrices[wethAddr]) {
        try {
          const binRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDC');
          const binData = await binRes.json();
          if (binData.price) {
            const ethUsd = parseFloat(binData.price);
            newPrices[wethAddr] = ethUsd;
            PRICE_CACHE.set(wethAddr, { price: ethUsd, timestamp: now });
            // Also set for native ETH placeholder
            newPrices['0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'] = ethUsd;
            PRICE_CACHE.set('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', { price: ethUsd, timestamp: now });
          }
        } catch (e) { /* Binance fallback failed, leave as 0 */ }
      }

      setPrices(prev => ({ ...prev, ...newPrices }));
    } catch (err: any) {
      console.error('[PriceOracle] Fetch error:', err);
      setError(err.message || "Unknown error");
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

  return { prices, isLoading, error, refetch: fetchPrices };
}
