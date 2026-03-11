import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { ABIS, CONTRACTS } from '../lib/contracts';
import { useMemo } from 'react';
import { formatEther, parseEther } from 'viem';

const V12 = CONTRACTS.DAILY_APP;

export function useNFTTiers() {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();

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
    ].map(t => ({
        ...t,
        pointsRequired: t.data ? Number(t.data[0]) : 0,
        mintPrice: t.data ? t.data[1] : 0n,
        dailyBonus: t.data ? Number(t.data[2]) : 0,
        multiplierBP: t.data ? Number(t.data[3]) : 0,
        maxSupply: t.data ? Number(t.data[4]) : 0,
        currentSupply: t.data ? Number(t.data[5]) : 0,
        isOpen: t.data ? t.data[6] : false,
        uri: t.id === 1 ? bURI : t.id === 2 ? sURI : t.id === 3 ? gURI : t.id === 4 ? pURI : dURI
    })), [bConfig, sConfig, gConfig, pConfig, dConfig, bURI, sURI, gURI, pURI, dURI]);

    // Global Economic Variables
    const { data: withdrawalFee } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'withdrawalFeeBP' });
    const { data: dailyBonus } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'dailyBonusAmount' });
    const { data: sponsorFee } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'sponsorshipPlatformFee' });
    const { data: autoApprove } = useReadContract({ address: V12, abi: ABIS.DAILY_APP, functionName: 'autoApproveSponsorship' });

    const economy = useMemo(() => ({
        tokenPriceUSD: tokenPrice ? formatEther(tokenPrice) : "0",
        withdrawalFeeBP: withdrawalFee ? Number(withdrawalFee) : 0,
        dailyBonusAmount: dailyBonus ? Number(dailyBonus) : 0,
        sponsorshipPlatformFee: sponsorFee ? Number(sponsorFee) : 0,
        autoApproveSponsorship: !!autoApprove,
        packs: {
            bronze: packB ? Number(packB) : 0,
            silver: packS ? Number(packS) : 0,
            gold: packG ? Number(packG) : 0
        }
    }), [tokenPrice, packB, packS, packG, withdrawalFee, dailyBonus, sponsorFee, autoApprove]);

    const updateEconomy = async (tokenP, b, s, g) => {
        // This would require two separate transactions usually, or a batch function if exists.
        // We'll just provide individual ones or the most common one.
        await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setPackagePricesUSD',
            args: [BigInt(b), BigInt(s), BigInt(g)]
        });
        if (tokenP) {
            await writeContractAsync({
                address: V12,
                abi: ABIS.DAILY_APP,
                functionName: 'setTokenPriceUSD',
                args: [parseEther(tokenP)]
            });
        }
    };

    const setCreatorToken = async (tokenAddr) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setCreatorToken',
            args: [tokenAddr]
        });
    };

    const setUSDCToken = async (tokenAddr) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setUSDCToken',
            args: [tokenAddr]
        });
    };

    const setMasterX = async (masterAddr) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setMasterX',
            args: [masterAddr]
        });
    };

    const setPaymentTokenStatus = async (tokenAddr, status) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setAllowedToken',
            args: [tokenAddr, status]
        });
    };

    const setWithdrawalFeeBP = async (feeBP) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setWithdrawalFeeBP',
            args: [BigInt(feeBP)]
        });
    };

    const setDailyBonusAmount = async (amount) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setDailyBonusAmount',
            args: [BigInt(amount)]
        });
    };

    const setAutoApproveSponsorship = async (status) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setAutoApproveSponsorship',
            args: [status]
        });
    };

    const setSponsorshipSettings = async (fee, minPool, rewardClaim, tasksGoal) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setSettings',
            args: [BigInt(fee), BigInt(minPool), BigInt(rewardClaim), BigInt(tasksGoal)]
        });
    };

    const updateTierConfig = async (id, points, price, multiplier, bonus, maxSupply, isOpen) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'updateNFTConfig',
            args: [id, BigInt(points), price, BigInt(multiplier), BigInt(bonus), BigInt(maxSupply), isOpen]
        });
    };

    const updateBatchConfig = async (tiersArr, pointsArr, pricesArr, bonusesArr, multipliersArr, suppliesArr, openArr) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setNFTConfigsBatch',
            args: [tiersArr, pointsArr, pricesArr, bonusesArr, multipliersArr, suppliesArr, openArr]
        });
    };

    const updateTierURI = async (id, uri) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setTierURI',
            args: [id, uri]
        });
    };

    const toggleTier = async (id, status) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'setTierStatus',
            args: [id, status]
        });
    };

    const mintTier = async (id, price) => {
        return await writeContractAsync({
            address: V12,
            abi: ABIS.DAILY_APP,
            functionName: 'mintNFT',
            args: [id],
            value: price
        });
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
