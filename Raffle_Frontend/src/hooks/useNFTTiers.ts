import { useReadContract, useWriteContract, useAccount, usePublicClient } from 'wagmi';
import { ABIS, CONTRACTS } from '../lib/contracts';
import { useMemo } from 'react';
import { formatEther, parseEther } from 'viem';

const V12 = CONTRACTS.DAILY_APP as `0x${string}`;

export function useNFTTiers() {
    useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const writeAndWait = async (params: Parameters<typeof writeContractAsync>[0]) => {
        const hash = await writeContractAsync(params);
        await publicClient!.waitForTransactionReceipt({ hash });
        return hash;
    };

    // Fetch configs for tiers 1-5 (Bronze - Diamond)
    const { data: bConfig, refetch: r1 } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'nftConfigs', args: [1] });
    const { data: sConfig, refetch: r2 } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'nftConfigs', args: [2] });
    const { data: gConfig, refetch: r3 } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'nftConfigs', args: [3] });
    const { data: pConfig, refetch: r4 } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'nftConfigs', args: [4] });
    const { data: dConfig, refetch: r5 } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'nftConfigs', args: [5] });

    const { data: bURI } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'tierURIs', args: [1] });
    const { data: sURI } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'tierURIs', args: [2] });
    const { data: gURI } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'tierURIs', args: [3] });
    const { data: pURI } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'tierURIs', args: [4] });
    const { data: dURI } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'tierURIs', args: [5] });

    const tiers = useMemo(() => [
        { id: 1, name: 'Bronze', data: bConfig },
        { id: 2, name: 'Silver', data: sConfig },
        { id: 3, name: 'Gold', data: gConfig },
        { id: 4, name: 'Platinum', data: pConfig },
        { id: 5, name: 'Diamond', data: dConfig },
    ].map(t => {
        const d = t.data as readonly unknown[] | undefined;
        return {
            ...t,
            pointsRequired: d ? Number(d[0]) : 0,
            mintPrice: d ? (d[1] as bigint) : 0n,
            dailyBonus: d ? Number(d[2]) : 0,
            multiplierBP: d ? Number(d[3]) : 0,
            maxSupply: d ? Number(d[4]) : 0,
            currentSupply: d ? Number(d[5]) : 0,
            isOpen: d ? (d[6] as boolean) : false,
            uri: t.id === 1 ? bURI : t.id === 2 ? sURI : t.id === 3 ? gURI : t.id === 4 ? pURI : dURI
        };
    }), [bConfig, sConfig, gConfig, pConfig, dConfig, bURI, sURI, gURI, pURI, dURI]);

    // Global Economic Variables
    const { data: tokenPrice } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'tokenPriceUSD' });
    const { data: withdrawalFee } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'withdrawalFeeBP' });
    const { data: dailyBonus } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'dailyBonusAmount' });

    const economy = useMemo(() => ({
        tokenPriceUSD: tokenPrice ? formatEther(tokenPrice as bigint) : "0",
        withdrawalFeeBP: withdrawalFee ? Number(withdrawalFee) : 0,
        dailyBonusAmount: dailyBonus ? Number(dailyBonus) : 0
    }), [tokenPrice, withdrawalFee, dailyBonus]);

    const updateEconomy = async (tokenP: string) => {
        if (tokenP) {
            await writeAndWait({
                address: V12,
                abi: ABIS.DAILY_APP,
                functionName: 'setTokenPriceUSD',
                args: [parseEther(tokenP)]
            });
        }
    };

    const setCreatorToken = async (tokenAddr: `0x${string}`) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setCreatorToken',
            args: [tokenAddr]
        });
    };

    const setUSDCToken = async (tokenAddr: `0x${string}`) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setUSDCToken',
            args: [tokenAddr]
        });
    };

    const setMasterX = async (masterAddr: `0x${string}`) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setMasterX',
            args: [masterAddr]
        });
    };

    const setPaymentTokenStatus = async (tokenAddr: `0x${string}`, status: boolean, decimals = 18, symbol = '') => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setAllowedToken',
            args: [tokenAddr, status, decimals, symbol]
        });
    };

    const setWithdrawalFeeBP = async (feeBP: number | string | bigint) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setWithdrawalFee',
            args: [BigInt(feeBP as string | number | bigint)]
        });
    };

    const setDailyBonusAmount = async (amount: number | string | bigint) => {
        // setGlobalRewards(daily, referral) — pass 0 for referral to keep it unchanged
        // Note: This will reset referral to 0. For production, read current referral first.
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setGlobalRewards',
            args: [BigInt(amount as string | number | bigint), BigInt(0)]
        });
    };

    const setAutoApproveSponsorship = async (status: boolean) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setAutoApproveSponsorship',
            args: [status]
        });
    };

    const setSponsorshipSettings = async (rewardClaim: number | string | bigint, tasksGoal: number | string | bigint, minPool: number | string | bigint, fee: number | string | bigint) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setSponsorshipParams',
            args: [BigInt(rewardClaim as string | number | bigint), BigInt(tasksGoal as string | number | bigint), BigInt(minPool as string | number | bigint), BigInt(fee as string | number | bigint)]
        });
    };

    const updateTierConfig = async (id: number, points: number | string | bigint, price: bigint, multiplier: number | string | bigint, bonus: number | string | bigint, maxSupply: number | string | bigint, isOpen: boolean) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'updateNFTConfig',
            args: [id, BigInt(points as string | number | bigint), price, BigInt(multiplier as string | number | bigint), BigInt(bonus as string | number | bigint), BigInt(maxSupply as string | number | bigint), isOpen]
        });
    };

    const updateBatchConfig = async (tiersArr: unknown[], pointsArr: unknown[], pricesArr: unknown[], bonusesArr: unknown[], multipliersArr: unknown[], suppliesArr: unknown[], openArr: unknown[]) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setNFTConfigsBatch',
            args: [tiersArr, pointsArr, pricesArr, bonusesArr, multipliersArr, suppliesArr, openArr]
        });
    };

    const updateTierURI = async (id: number, uri: string) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setTierURI',
            args: [id, uri]
        });
    };

    const toggleTier = async (id: number, status: boolean) => {
        return await writeAndWait({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setTierStatus',
            args: [id, status]
        });
    };

    const mintTier = async (id: number, price: bigint) => {
        // Return hash only — caller (SBTUpgradeCard) handles receipt wait + confirmation check
        const hash = await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'mintNFT',
            args: [id],
            value: price
        });
        return hash;
    };

    const refetch = () => { r1(); r2(); r3(); r4(); r5(); };

    return {
        tiers,
        economy,
        updateTierConfig,
        updateBatchConfig,
        updateTierURI,
        toggleTier,
        updateEconomy,
        mintTier,
        setCreatorToken,
        setUSDCToken,
        setMasterX,
        setPaymentTokenStatus,
        setWithdrawalFeeBP,
        setDailyBonusAmount,
        setAutoApproveSponsorship,
        setSponsorshipSettings,
        refetch
    };
}
