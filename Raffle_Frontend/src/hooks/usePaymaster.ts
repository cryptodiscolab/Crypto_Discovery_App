import { useCallback, useMemo } from 'react';
import { useAccount, useCapabilities, useSendCalls } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { encodeFunctionData } from 'viem';
import toast from 'react-hot-toast';

/**
 * usePaymaster
 *
 * Hook untuk mendeteksi apakah wallet user mendukung Gasless transaction
 * via EIP-5792 (wallet_sendCalls + paymasterService).
 *
 * Kompatibel dengan: Coinbase Smart Wallet, Coinbase Wallet (Smart mode)
 * Tidak kompatibel: MetaMask reguler, Rainbow (akan fallback ke tx normal)
 *
 * Rule .cursorrules §3: Base Smart Wallet is King.
 */

const PAYMASTER_URL = import.meta.env.VITE_PAYMASTER_URL
    || `https://api.developer.coinbase.com/rpc/v1/base-sepolia/${import.meta.env.VITE_ONCHAINKIT_API_KEY}`;

export function usePaymaster() {
    const { address, chainId } = useAccount();

    // Fetch wallet capabilities via EIP-5792
    const { data: capabilities } = useCapabilities({
        account: address,
        query: { enabled: !!address },
    });

    // Periksa apakah wallet mendukung paymasterService di chain yang aktif
    const isGaslessSupported = useMemo(() => {
        if (!capabilities || !chainId) return false;
        const chainCapabilities = capabilities[chainId];
        if (!chainCapabilities) return false;
        // Wallet EIP-5792: key 'paymasterService' atau 'atomicBatch'
        return !!(
            chainCapabilities.paymasterService?.supported ||
            chainCapabilities.atomicBatch?.supported
        );
    }, [capabilities, chainId]);

    // Paymaster capability object untuk disertakan dalam sendCalls
    const paymasterCapabilities = useMemo(() => {
        if (!isGaslessSupported) return {};
        return {
            paymasterService: {
                url: PAYMASTER_URL,
            },
        };
    }, [isGaslessSupported]);

    return {
        isGaslessSupported,
        paymasterCapabilities,
        paymasterUrl: PAYMASTER_URL,
    };
}

/**
 * useGaslessContractCall
 *
 * Wraps useSendCalls dari Wagmi v2 untuk mengirim satu contract call
 * dengan paymaster capability jika didukung, atau fallback ke tx biasa.
 *
 * @param {Object} contractConfig - { address, abi, functionName, args }
 * @param {string} label - Label untuk toast notification
 */
export function useGaslessContractCall(contractConfig, label = 'Transaction') {
    const { isGaslessSupported, paymasterCapabilities } = usePaymaster();
    const { sendCallsAsync, isPending, isSuccess, data: callId } = useSendCalls();

    const sendGasless = useCallback(async (overrideArgs = null) => {
        if (!contractConfig?.address || !contractConfig?.abi) {
            throw new Error('[Paymaster] Contract config missing');
        }

        const args = overrideArgs ?? contractConfig.args ?? [];
        let value = contractConfig.value ?? undefined;

        const callData = encodeFunctionData({
            abi: contractConfig.abi,
            functionName: contractConfig.functionName,
            args,
        });

        const tid = toast.loading(
            isGaslessSupported
                ? `⛽ Sending gasless ${label}...`
                : `📤 Sending ${label}...`
        );

        try {
            const result = await sendCallsAsync({
                calls: [
                    {
                        to: contractConfig.address,
                        data: callData,
                        ...(value !== undefined ? { value } : {}),
                    },
                ],
                ...(isGaslessSupported ? { capabilities: paymasterCapabilities } : {}),
            });

            toast.success(
                isGaslessSupported ? `✅ ${label} sent gasless!` : `✅ ${label} sent!`,
                { id: tid }
            );
            return result;
        } catch (err) {
            toast.error(err.shortMessage || err.message || `${label} failed`, { id: tid });
            throw err;
        }
    }, [contractConfig, isGaslessSupported, paymasterCapabilities, sendCallsAsync, label]);

    return {
        sendGasless,
        isPending,
        isSuccess,
        callId,
        isGaslessSupported,
    };
}
