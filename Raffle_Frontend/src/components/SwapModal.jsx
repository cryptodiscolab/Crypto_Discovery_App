import { useState, useEffect, useRef } from 'react';
import { X, ArrowDown, ExternalLink, Loader2, AlertCircle, RefreshCw, Settings2 } from 'lucide-react';
import { useAccount, useWalletClient, useConfig } from 'wagmi';
import { createConfig, getQuote, executeRoute } from '@lifi/sdk';
import { parseUnits, formatUnits } from 'viem';
import toast from 'react-hot-toast';

const NETWORKS = [
  { id: 8453, name: 'Base Mainnet' },
  { id: 84532, name: 'Base Sepolia' }
];

const TOKENS = {
  8453: [
    { address: '0x0000000000000000000000000000000000000000', decimals: 18, symbol: 'ETH', logo: 'Ξ' },
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, symbol: 'USDC', logo: '$' },
    { address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, symbol: 'DEGEN', logo: '🎩' },
    { address: '0xcbB7C0000aB88B473b1f5aFd9ef80C444f71d1D4', decimals: 8, symbol: 'cbBTC', logo: '₿' }
  ],
  84532: [
    { address: '0x0000000000000000000000000000000000000000', decimals: 18, symbol: 'ETH', logo: 'Ξ' },
    { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6, symbol: 'USDC', logo: '$' }
  ]
};

// Li.Fi SDK init flag
let _lifiConfigured = false;

export function SwapModal({ isOpen, onClose }) {
  const { address, chainId: activeChainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const wagmiConfig = useConfig();
  
  // States
  const [selectedChainId, setSelectedChainId] = useState(import.meta.env.VITE_CHAIN_ID ? parseInt(import.meta.env.VITE_CHAIN_ID) : 8453);
  const [fromToken, setFromToken] = useState(TOKENS[selectedChainId]?.[0] || TOKENS[8453][0]);
  const [toToken, setToToken] = useState(TOKENS[selectedChainId]?.[1] || TOKENS[8453][1]);
  
  const [amountIn, setAmountIn] = useState('');
  const [quote, setQuote] = useState(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const configuredRef = useRef(false);

  // Sync token selection when chain changes
  useEffect(() => {
    const available = TOKENS[selectedChainId];
    if (available) {
      setFromToken(available[0]);
      setToToken(available[1] || available[0]);
    }
    setQuote(null);
    setAmountIn('');
  }, [selectedChainId]);

  // Init LiFi
  useEffect(() => {
    if (configuredRef.current) return;
    try {
      createConfig({
        integrator: 'crypto-disco-app',
        wagmi: wagmiConfig
      });
      configuredRef.current = true;
    } catch (e) {
      console.warn('[SwapModal] Li.Fi SDK init failed:', e.message);
      configuredRef.current = true;
    }
  }, [wagmiConfig]);

  useEffect(() => {
    const fetchQuote = async () => {
      setQuoteError(null);
      if (!amountIn || isNaN(amountIn) || parseFloat(amountIn) <= 0 || !address) {
        setQuote(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        const amountWei = parseUnits(amountIn, fromToken.decimals).toString();
        const result = await getQuote({
          fromChain: selectedChainId,
          toChain: selectedChainId,
          fromToken: fromToken.address,
          toToken: toToken.address,
          fromAmount: amountWei,
          fromAddress: address,
          toAddress: address,
          feeConfig: { fee: 0.005, integrator: 'crypto-disco-app' }
        });
        setQuote(result);
      } catch (error) {
        console.error("Quote Error:", error);
        setQuote(null);
        const errMsg = error?.message || '';
        if (errMsg.includes('No route found') || errMsg.includes('no route')) {
          setQuoteError('No swap route found for this pair/amount.');
        } else if (errMsg.includes('amount') || errMsg.includes('too small')) {
          setQuoteError('Amount too small. Try a larger amount.');
        } else {
          setQuoteError('Quote unavailable. Try Jumper Exchange.');
        }
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const delay = setTimeout(fetchQuote, 600);
    return () => clearTimeout(delay);
  }, [amountIn, fromToken, toToken, selectedChainId, address]);

  const handleSwap = async () => {
    if (!quote || !walletClient) return;
    
    setIsSwapping(true);
    const tid = toast.loading("Executing Swap via Li.Fi...");
    
    try {
      await executeRoute(quote, {
        updateRouteHook: (route) => {
          console.log('Route updated:', route);
        },
      });
      toast.success("Swap Successful!", { id: tid });
      setAmountIn('');
      setQuote(null);
      onClose();
    } catch (error) {
      console.error("Swap Error:", error);
      toast.error(error?.message || "Swap failed", { id: tid });
    } finally {
      setIsSwapping(false);
    }
  };

  const handleJumperFallback = () => {
    const jumperUrl = `https://jumper.exchange/?integrator=crypto-disco-app&fromChain=${selectedChainId}&toChain=${selectedChainId}&fromToken=${fromToken.address}&toToken=${toToken.address}`;
    window.open(jumperUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleToggleDirection = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setAmountIn('');
    setQuote(null);
    setQuoteError(null);
  };

  if (!isOpen) return null;

  const estimatedOut = quote
    ? formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)
    : null;

  const rateDisplay = estimatedOut && amountIn && parseFloat(amountIn) > 0
    ? (parseFloat(estimatedOut) / parseFloat(amountIn)).toFixed(6)
    : null;

  const activeNetworkName = NETWORKS.find(n => n.id === selectedChainId)?.name || 'Unknown';

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-[400px] bg-[#0B0E14] border border-white/10 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl shadow-indigo-500/10 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-white/5 bg-black/20 shrink-0">
          <h2 className="text-[12px] font-black text-white italic tracking-tighter flex items-center gap-2">
            DISCO <span className="text-indigo-500">QUICK SWAP</span>
          </h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Network Selector */}
          <div className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <div className="flex items-center gap-2 text-indigo-400">
              <Settings2 size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Network</span>
            </div>
            <select
              value={selectedChainId}
              onChange={(e) => setSelectedChainId(Number(e.target.value))}
              className="bg-transparent text-[11px] font-black text-white uppercase tracking-widest outline-none cursor-pointer"
            >
              {NETWORKS.map(net => (
                <option key={net.id} value={net.id} className="bg-[#0B0E14]">{net.name}</option>
              ))}
            </select>
          </div>

          {/* FROM */}
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 relative">
            <div className="text-[10px] text-slate-500 font-bold tracking-widest mb-2 uppercase">You Pay</div>
            <div className="flex items-center justify-between gap-2">
              <input 
                type="number"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.001"
                className="bg-transparent text-2xl font-black text-white outline-none w-full placeholder:text-white/20"
              />
              <select
                value={fromToken.address}
                onChange={(e) => {
                  const token = TOKENS[selectedChainId].find(t => t.address === e.target.value);
                  setFromToken(token);
                }}
                className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 text-[11px] font-black tracking-widest text-white outline-none cursor-pointer hover:bg-white/10 transition-colors shrink-0 max-w-[120px]"
              >
                {TOKENS[selectedChainId].map(t => (
                  <option key={t.address} value={t.address} className="bg-[#0B0E14]">
                    {t.logo} {t.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TOGGLE */}
          <div className="relative flex justify-center -my-2 z-10">
            <button 
              onClick={handleToggleDirection}
              className="p-2.5 bg-[#161B22] rounded-xl border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-colors text-slate-400 hover:text-indigo-400"
            >
              <ArrowDown size={16} />
            </button>
          </div>

          {/* TO */}
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 relative">
            <div className="text-[10px] text-slate-500 font-bold tracking-widest mb-2 uppercase">You Receive</div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-2xl font-black text-white/50 w-full truncate">
                {isLoadingQuote ? (
                  <Loader2 size={24} className="animate-spin text-indigo-500 mt-1" />
                ) : estimatedOut ? (
                  parseFloat(estimatedOut).toFixed(6)
                ) : '0.0'}
              </div>
              <select
                value={toToken.address}
                onChange={(e) => {
                  const token = TOKENS[selectedChainId].find(t => t.address === e.target.value);
                  setToToken(token);
                }}
                className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 text-[11px] font-black tracking-widest text-white outline-none cursor-pointer hover:bg-white/10 transition-colors shrink-0 max-w-[120px]"
              >
                {TOKENS[selectedChainId].map(t => (
                  <option key={t.address} value={t.address} className="bg-[#0B0E14]">
                    {t.logo} {t.symbol}
                  </option>
                ))}
              </select>
            </div>
            {rateDisplay && (
              <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-mono tracking-wider flex items-center gap-2">
                <RefreshCw size={12} />
                FINAL RATE: 1 {fromToken.symbol} ≈ {rateDisplay} {toToken.symbol}
              </div>
            )}
          </div>

          {/* Fee & Network Info */}
          <div className="px-1 space-y-1.5">
             <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
               <span>Network</span>
               <span className="text-indigo-400">{activeNetworkName}</span>
             </div>
             <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
               <span>Provider Fee</span>
               <span className="text-slate-400">0.5% + Gas</span>
             </div>
             {quote?.estimate?.gasCosts && (
               <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                 <span>Est. Gas</span>
                 <span className="text-amber-400">
                   {formatUnits(BigInt(quote.estimate.gasCosts[0].amount), 18).slice(0, 8)} ETH
                 </span>
               </div>
             )}
          </div>

          {/* Quote Error Banner */}
          {quoteError && amountIn && !isLoadingQuote && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wide leading-snug">{quoteError}</p>
            </div>
          )}

          <button
            onClick={handleSwap}
            disabled={!quote || isSwapping || isLoadingQuote || fromToken.address === toToken.address}
            className={`w-full py-4 mt-2 rounded-xl text-[12px] font-black tracking-widest uppercase transition-all shrink-0
              ${(!quote || fromToken.address === toToken.address) ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                       : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'}
            `}
          >
            {fromToken.address === toToken.address 
              ? "SAME TOKEN SELECTED" 
              : isSwapping 
                ? "SWAPPING..." 
                : !amountIn 
                  ? "ENTER AMOUNT" 
                  : isLoadingQuote 
                    ? "FETCHING QUOTE..." 
                    : !quote 
                      ? "NO ROUTE FOUND" 
                      : "SWAP NOW"}
          </button>

          {/* Jumper Fallback / Bridge */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5">
            <a 
              href="https://jumper.exchange/?integrator=crypto-disco-app" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[9px] text-indigo-400/70 hover:text-indigo-400 uppercase tracking-widest font-black transition-colors"
            >
              Bridge from other chains <ExternalLink size={10} />
            </a>
            {(quoteError || (!quote && amountIn && !isLoadingQuote)) && (
              <button
                onClick={handleJumperFallback}
                className="flex items-center gap-1 text-[9px] text-emerald-400/70 hover:text-emerald-400 uppercase tracking-widest font-black transition-colors"
              >
                <ExternalLink size={10} /> Swap on Jumper
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
