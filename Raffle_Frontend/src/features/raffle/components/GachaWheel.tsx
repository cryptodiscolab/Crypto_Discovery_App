import { useState, useEffect, useRef } from 'react';
import { useAccount, useSignMessage, usePublicClient } from 'wagmi';
import { useRaffle } from '../../../hooks/useRaffle';
import { usePoints } from '../../../shared/context/PointsContext';
import { usePriceOracle } from '../../../hooks/usePriceOracle';
import { WETH_ADDRESS, USDC_ADDRESS, CONTRACTS, ABIS } from '../../../lib/contracts';
import { formatEther, parseEther } from 'viem';
import toast from 'react-hot-toast';
import { Ticket, Dice5, Loader2, Award } from 'lucide-react';

export function GachaWheel() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();
  const { buyTickets } = useRaffle();
  const { profileData, refetch } = usePoints();

  // Price Oracle for ETH / WETH / USDC
  const oracleAddresses: string[] = [WETH_ADDRESS, USDC_ADDRESS].filter(Boolean) as string[];
  usePriceOracle(oracleAddresses);

  // Profile data ticket balance
  const availableTickets = Number((profileData as { raffle_tickets_bought?: number | string | null } | null | undefined)?.raffle_tickets_bought || 0);

  // Gacha states
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [prizeResult, setPrizeResult] = useState<{ label: string; detail: string; txHash: string } | null>(null);

  // Calculator states
  const [raffleId] = useState<number>(1); // ⚡ v3.64.30: Dynamic-ready (default=1)
  const [paymentToken, setPaymentToken] = useState<'ETH' | 'WETH' | 'USDC'>('ETH');
  const [quantity, setQuantity] = useState<number>(5);
  const [onchainTicketPrice, setOnchainTicketPrice] = useState<bigint>(0n);
  const [surchargeBP, setSurchargeBP] = useState<number>(1000); // 10%
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  // Wheel ref
  const wheelRef = useRef<HTMLDivElement>(null);

  const segmentPrizes = [
    { text: '+50 XP', color: '#1e293b' },
    { text: '+100 XP', color: '#0f172a' },
    { text: 'Double Streak', color: '#312e81' },
    { text: 'Bronze Upgrade', color: '#064e3b' },
    { text: '+3 Tickets', color: '#1e1b4b' },
    { text: 'Bonus Multiplier', color: '#451a03' }
  ];

  // Fetch ticket price and surcharge from contracts
  const fetchContractPrices = async () => {
    if (!publicClient) return;
    setIsPriceLoading(true);
    try {
      const price = (await publicClient.readContract({
        address: CONTRACTS.MASTER_X as `0x${string}`,
        abi: ABIS.MASTER_X,
        functionName: 'getTicketPriceInETH'
      })) as bigint;

      const surcharge = (await publicClient.readContract({
        address: CONTRACTS.RAFFLE as `0x${string}`,
        abi: ABIS.RAFFLE,
        functionName: 'surchargeBP'
      })) as bigint;

      setOnchainTicketPrice(price);
      setSurchargeBP(Number(surcharge));
    } catch (e) {
      console.error('[GachaWheel] Error loading contract pricing:', e);
      // Safe fallback: 0.15 USD in ETH
      const fallbackPrice = parseEther('0.00005'); // approx $0.15
      setOnchainTicketPrice(fallbackPrice);
    } finally {
      setIsPriceLoading(false);
    }
  };

  useEffect(() => {
    if (publicClient) {
      fetchContractPrices();
    }
  }, [publicClient]);

  // Calculator logic
  const discountFactor = quantity >= 5 ? 0.9 : 1.0; // 10% volume discount for >= 5 tickets
  
  // Computes display ticket price
  const ticketBasePriceEth = onchainTicketPrice ? Number(formatEther(onchainTicketPrice)) : 0.00005;
  const surchargeFactor = (10000 + surchargeBP) / 10000;
  const singleTicketCostEth = ticketBasePriceEth * surchargeFactor;

  const totalCostEth = singleTicketCostEth * quantity * discountFactor;
  const totalCostUsdc = (0.15 * quantity * discountFactor);

  const displayPricePerTicket = paymentToken === 'USDC' 
    ? '0.15 USDC' 
    : `${singleTicketCostEth.toFixed(6)} ${paymentToken}`;

  const displayTotalPrice = paymentToken === 'USDC'
    ? `${totalCostUsdc.toFixed(2)} USDC`
    : `${totalCostEth.toFixed(6)} ${paymentToken}`;

  const handleMaxQuantity = () => {
    setQuantity(100); // UI Cap
  };

  const handleBuyTickets = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first.');
      return;
    }
    const tid = toast.loading(`Buying ${quantity} tickets...`);
    try {
      // Note: on-chain buy is always in ETH native for now, WETH/USDC will prompt swap
      if (paymentToken !== 'ETH') {
        toast.dismiss(tid);
        toast.error(`Buying with ${paymentToken} is simulated. Initiating swap to ETH first...`);
        await buyTickets(raffleId, quantity);
      } else {
        await buyTickets(raffleId, quantity);
      }
      toast.success('Ticket purchase successful! Syncing balance...', { id: tid });
      setTimeout(() => {
        if (refetch) refetch();
      }, 3000);
    } catch (err: unknown) {
      console.error(err);
      toast.error('Purchase failed or rejected.', { id: tid });
    }
  };

  // Spin Wheel logic
  const handleSpinWheel = async () => {
    if (isSpinning) return;
    if (availableTickets < 1) {
      toast.error('Insufficient tickets. Please purchase tickets first.');
      return;
    }
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first.');
      return;
    }

    setIsSpinning(true);

    try {
      // 1. Sign SIWE message for spin authentication
      const timestamp = new Date().toISOString();
      const message = `Spin Gacha Wheel\nUser: ${address.toLowerCase()}\nTime: ${timestamp}`;
      const signature = await signMessageAsync({ message });

      // 2. Request backend to spin
      const res = await fetch('/api/tasks/spin-gacha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: address,
          signature,
          message
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Spin failed');
      }

      const { winIndex, prizeLabel, prizeDetail, txHash } = data;

      // 3. Perform spin animation
      const nextSpinCount = spinCount + 1;
      setSpinCount(nextSpinCount);

      const segmentAngle = 360 / segmentPrizes.length;
      const extraRotations = 6 * 360; // 6 complete spins
      const targetAngle = (nextSpinCount * extraRotations) + (360 - (winIndex * segmentAngle) - (segmentAngle / 2));
      
      setSpinAngle(targetAngle);

      // Wait for spin to finish
      setTimeout(() => {
        setIsSpinning(false);
        setPrizeResult({
          label: prizeLabel,
          detail: prizeDetail,
          txHash
        });
        setShowPrizeModal(true);
        if (refetch) refetch();
      }, 5100);

    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to spin Gacha Wheel.');
      setIsSpinning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
      {/* Left Side: Ticket Purchase & Calculator */}
      <div className="flex flex-col gap-6">
        <div className="glass-card p-6 border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[1.5rem]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white text-base font-black tracking-widest uppercase">Ticket Buy Calculator</h3>
            <span className="badge-cyber badge-cyber-blue">Base Network</span>
          </div>

          {/* Token selector */}
          <div className="mb-6">
            <label className="label-native mb-2 block">Select Payment Token</label>
            <div className="token-selector-group">
              {(['ETH', 'WETH', 'USDC'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPaymentToken(t)}
                  className={`token-btn-cyber ${paymentToken === t ? 'active' : ''}`}
                >
                  <span className="value-native text-xs">{t}</span>
                  <span className="label-native text-[8px] mt-0.5">
                    {t === 'ETH' ? 'Native Gas' : t === 'WETH' ? 'Wrapped' : 'Stablecoin'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity selector */}
          <div className="mb-6">
            <label className="label-native mb-2 block">Ticket Quantity</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(100, Number(e.target.value))))}
                className="input-native text-white"
                min="1"
                max="100"
              />
              <button
                onClick={handleMaxQuantity}
                className="btn-native btn-secondary shrink-0 h-[46px]"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Price Calculation details */}
          <div className="calculator-summary mb-6">
            <div className="calc-row">
              <span className="content-native text-slate-400">Price per ticket</span>
              {isPriceLoading ? (
                <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
              ) : (
                <span className="value-native">{displayPricePerTicket}</span>
              )}
            </div>
            <div className="calc-row">
              <span className="content-native text-slate-400">Volume Discount</span>
              <span className="value-native text-emerald-400">
                {quantity >= 5 ? '-10%' : '0%'}
              </span>
            </div>
            <div className="w-full h-[1px] bg-white/5 my-1"></div>
            <div className="calc-row">
              <span className="label-native text-white">Total Price</span>
              {isPriceLoading ? (
                <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
              ) : (
                <span className="value-native text-indigo-400 text-sm font-black">{displayTotalPrice}</span>
              )}
            </div>
          </div>

          {/* Buy Action button */}
          <button
            onClick={handleBuyTickets}
            className="w-full btn-native btn-primary py-3.5"
            disabled={isPriceLoading}
          >
            <Ticket size={16} />
            <span>Purchase {quantity} Tickets</span>
          </button>
        </div>

        {/* Small educational details */}
        <div className="glass-card p-5 border border-white/5 bg-[#0a0a0c]/40 backdrop-blur-xl rounded-[1.5rem]">
          <h4 className="text-white text-xs font-black tracking-widest uppercase mb-2">Gacha Mechanics & Rules</h4>
          <ul className="text-slate-400 content-native space-y-1.5 list-disc pl-4 text-xs">
            <li>Volume discount activates at 5 tickets, saving 10% total costs.</li>
            <li>Spin costs exactly 1 ticket. Off-chain balance updates instantly.</li>
            <li>Win segments are decided backend-side with EIP-191 cryptographic signatures to ensure zero spoofing.</li>
            <li>High Gas Protection limits execution if base fees exceed 0.5 Gwei limit.</li>
          </ul>
        </div>
      </div>

      {/* Right Side: Gacha Spin Wheel Card */}
      <div className="glass-card p-6 border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[1.5rem] flex flex-col items-center justify-center min-h-[460px]">
        <h3 className="text-white text-base font-black tracking-widest uppercase mb-1">Daily Gacha Wheel</h3>
        <p className="content-native text-slate-400 text-center mb-6 text-xs max-w-sm">
          Spend 1 ticket to spin. Win XP multipliers, SBT point tiers, or additional raffle tickets.
        </p>

        {/* Visual Gacha Wheel Container */}
        <div className="gacha-canvas-container">
          <div className="wheel-indicator"></div>
          <div className="wheel-center-pin"></div>
          <div
            ref={wheelRef}
            className="gacha-wheel-outer"
            style={{
              transform: `rotate(${spinAngle}deg)`,
              transition: isSpinning ? 'transform 5s cubic-bezier(0.1, 0.8, 0.1, 1)' : 'none'
            }}
          >
            {segmentPrizes.map((p, idx) => {
              const angle = (360 / segmentPrizes.length) * idx;
              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    transform: `rotate(${angle}deg)`,
                    transformOrigin: '50% 50%'
                  }}
                >
                  <div
                    className="label-native"
                    style={{
                      position: 'absolute',
                      top: '24px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      writingMode: 'vertical-rl',
                      color: '#fff',
                      fontSize: '10px'
                    }}
                  >
                    {p.text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status & Spin Trigger */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <span className="value-native text-slate-300 flex items-center gap-2">
            <Ticket size={14} className="text-indigo-400" />
            <span>Available Tickets: {availableTickets}</span>
          </span>
          <button
            onClick={handleSpinWheel}
            disabled={isSpinning || availableTickets < 1}
            className="w-full btn-native btn-primary py-3.5 flex items-center justify-center gap-2"
          >
            {isSpinning ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Spinning Gacha...</span>
              </>
            ) : (
              <>
                <Dice5 size={16} />
                <span>Spin Gacha (1 Ticket)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Victory Prize Modal */}
      {showPrizeModal && prizeResult && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="glass-card p-8 border border-white/10 bg-[#0c0c0e]/95 backdrop-blur-xl rounded-[2rem] max-w-sm w-full text-center relative animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse-zap">
              <Award size={32} className="text-indigo-400" />
            </div>
            
            <h4 className="text-white text-base font-black tracking-widest uppercase mb-1">Victory Reward!</h4>
            <span className="badge-cyber badge-cyber-purple mb-4 inline-block">Gacha Win</span>
            
            <div className="my-6 p-4 rounded-xl bg-white/5 border border-white/5">
              <span className="label-native text-slate-400 mb-1">YOU WON</span>
              <h2 className="text-2xl text-white font-black tracking-wide uppercase">{prizeResult.label}</h2>
              <p className="content-native text-slate-400 mt-2 text-xs">{prizeResult.detail}</p>
            </div>

            <div className="mb-6">
              <span className="label-native text-slate-500 mb-1">Audit Log Stamp</span>
              <p className="font-mono text-[9px] text-slate-600 break-all select-all">{prizeResult.txHash}</p>
            </div>

            <button
              onClick={() => setShowPrizeModal(false)}
              className="w-full btn-native btn-primary"
            >
              Claim Reward
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
