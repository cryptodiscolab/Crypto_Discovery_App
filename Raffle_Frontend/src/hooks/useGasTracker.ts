import { useGasPrice } from 'wagmi';
import { formatUnits } from 'viem';
import { useMemo } from 'react';

/**
 * Custom hook untuk memantau dan mengkategorikan harga gas jaringan (Base L2).
 * Kategori:
 * - Cheap: < 0.005 Gwei
 * - Normal: 0.005 – 0.05 Gwei
 * - High: 0.05 – 0.2 Gwei
 * - Very High: 0.2 - 0.5 Gwei
 * - Expensive: > 0.5 Gwei
 */
export function useGasTracker() {
    // Memantau harga gas dan otomatis memperbarui setiap 10 detik (polling)
    const { data: gasPriceWei, isLoading, isError } = useGasPrice({
        query: {
            refetchInterval: 10000, 
        }
    });

    return useMemo(() => {
        let gwei = 0;
        if (gasPriceWei) {
            // Konversi dari WEI ke GWEI (1 Gwei = 10^9 Wei)
            gwei = Number(formatUnits(gasPriceWei, 9));
        }

        let category = 'Unknown';
        
        // Descending threshold chain — no gaps, no overlaps
        // Each boundary is checked exactly once from highest to lowest
        if (gwei > 0) {
            if (gwei > 0.5) {
                category = 'Expensive';
            } else if (gwei >= 0.2) {
                category = 'Very High';
            } else if (gwei >= 0.05) {
                category = 'High';
            } else if (gwei >= 0.005) {
                category = 'Normal';
            } else {
                category = 'Cheap';
            }
        }

        return {
            gasPriceWei,
            gasPriceGwei: gwei,
            gasCategory: category,
            // Boolean helper yang bisa digunakan UI untuk men-disable tombol transaksi
            isGasHigh: category === 'High' || category === 'Very High' || category === 'Expensive',
            isGasExpensive: category === 'Expensive',
            isLoadingGas: isLoading,
            isGasError: isError
        };
    }, [gasPriceWei, isLoading, isError]);
}
