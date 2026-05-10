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
export function usePriceOracle(tokenAddresses = []) {
  const [prices, setPrices] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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
      const cachedPrices = {};
      joinedAddresses.split(',').forEach(addr => {
        cachedPrices[addr.toLowerCase()] = PRICE_CACHE.get(addr.toLowerCase()).price;
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

      const newPrices = {};
      
      if (data.pairs && data.pairs.length > 0) {
        // Group pairs by baseToken address and pick the one with most liquidity
        const bestPairs = {};
        data.pairs.forEach(pair => {
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
          // If it's WETH or ETH on Base
          if (lowerAddr === '0x4200000000000000000000000000000000000006' || lowerAddr === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
              // Try to find WETH if we fetched it, or just leave as 0 for now
          }
          newPrices[lowerAddr] = newPrices[lowerAddr] || 0;
          PRICE_CACHE.set(lowerAddr, { price: newPrices[lowerAddr], timestamp: now });
        }
      });

      setPrices(prev => ({ ...prev, ...newPrices }));
    } catch (err) {
      console.error('[PriceOracle] Fetch error:', err);
      setError(err.message);
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
