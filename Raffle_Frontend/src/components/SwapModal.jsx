import { useState, useEffect } from 'react';
import { X, ArrowDown, ExternalLink, Loader2 } from 'lucide-react';
import { useAccount, useWalletClient, useConfig } from 'wagmi';
import { createConfig, getQuote, executeRoute } from '@lifi/sdk';
import { parseUnits, formatUnits } from 'viem';
import toast from 'react-hot-toast';

const TOKENS = {
  ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, symbol: 'ETH' },
  USDC: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6, symbol: 'USDC' }
};

export function SwapModal({ isOpen, onClose }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const wagmiConfig = useConfig();
  const [amountIn, setAmountIn] = useState('');
  const [quote, setQuote] = useState(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [direction, setDirection] = useState('ETH_TO_USDC'); // or USDC_TO_ETH

  const fromToken = direction === 'ETH_TO_USDC' ? TOKENS.ETH : TOKENS.USDC;
  const toToken = direction === 'ETH_TO_USDC' ? TOKENS.USDC : TOKENS.ETH;

  // Initialize Li.Fi SDK with wagmi config
  useEffect(() => {
    createConfig({
      integrator: 'crypto-disco-app',
      wagmi: wagmiConfig
    });
  }, [wagmiConfig]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!amountIn || isNaN(amountIn) || parseFloat(amountIn) <= 0 || !address) {
        setQuote(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        const amountWei = parseUnits(amountIn, fromToken.decimals).toString();
        const result = await getQuote({
          fromChain: 8453,
          toChain: 8453,
          fromToken: fromToken.address,
          toToken: toToken.address,
          fromAmount: amountWei,
          fromAddress: address,
          feeConfig: { fee: 0.005, integrator: 'crypto-disco-app' } // 0.5% fee
        });
        setQuote(result);
      } catch (error) {
        console.error("Quote Error:", error);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const delay = setTimeout(fetchQuote, 500);
    return () => clearTimeout(delay);
  }, [amountIn, direction, address, fromToken, toToken]);

  const handleSwap = async () => {
    if (!quote || !walletClient) return;
    
    setIsSwapping(true);
    const tid = toast.loading("Executing Swap via Li.Fi...");
    
    try {
      // Execute route using the SDK
      await executeRoute(quote, {
        updateRouteHook: (route) => {
          console.log('Route updated:', route);
        },
      });
      toast.success("Swap Successful!", { id: tid });
      setAmountIn('');
      onClose();
    } catch (error) {
      console.error("Swap Error:", error);
      toast.error(error?.message || "Swap failed", { id: tid });
    } finally {
      setIsSwapping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-[380px] bg-[#0B0E14] border border-white/10 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl shadow-indigo-500/10">
        <div className="flex justify-between items-center p-5 border-b border-white/5 bg-black/20">
          <h2 className="text-[12px] font-black text-white italic tracking-tighter">
            DISCO <span className="text-indigo-500">QUICK SWAP</span>
          </h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* FROM */}
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 relative">
            <div className="text-[10px] text-slate-500 font-bold tracking-widest mb-2 uppercase">You Pay</div>
            <div className="flex items-center justify-between gap-4">
              <input 
                type="number"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="0.0"
                className="bg-transparent text-2xl font-black text-white outline-none w-full placeholder:text-white/20"
              />
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full shrink-0 border border-white/10">
                <span className="text-[11px] font-black tracking-widest">{fromToken.symbol}</span>
              </div>
            </div>
          </div>

          {/* TOGGLE */}
          <div className="relative flex justify-center -my-2 z-10">
            <button 
              onClick={() => {
                setDirection(prev => prev === 'ETH_TO_USDC' ? 'USDC_TO_ETH' : 'ETH_TO_USDC');
                setAmountIn('');
              }}
              className="p-2.5 bg-[#161B22] rounded-xl border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-colors text-slate-400 hover:text-indigo-400"
            >
              <ArrowDown size={16} />
            </button>
          </div>

          {/* TO */}
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 relative">
            <div className="text-[10px] text-slate-500 font-bold tracking-widest mb-2 uppercase">You Receive</div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl font-black text-white/50 w-full truncate">
                {isLoadingQuote ? (
                  <Loader2 size={24} className="animate-spin text-indigo-500 mt-1" />
                ) : quote ? (
                  formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)
                ) : '0.0'}
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full shrink-0 border border-white/10">
                <span className="text-[11px] font-black tracking-widest">{toToken.symbol}</span>
              </div>
            </div>
            {quote && (
              <div className="mt-2 text-[9px] text-emerald-400 font-mono tracking-wider">
                1 {fromToken.symbol} = {parseFloat(formatUnits(BigInt(quote.estimate.toAmount), toToken.decimals)) / parseFloat(amountIn || 1)} {toToken.symbol}
              </div>
            )}
          </div>

          <button
            onClick={handleSwap}
            disabled={!quote || isSwapping || isLoadingQuote}
            className={`w-full py-4 mt-2 rounded-xl text-[12px] font-black tracking-widest uppercase transition-all
              ${!quote ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                       : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'}
            `}
          >
            {isSwapping ? "SWAPPING..." : !amountIn ? "ENTER AMOUNT" : "SWAP NOW"}
          </button>
          
          <a 
            href="https://jumper.exchange/?integrator=crypto-disco-app" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 mt-4 text-[9px] text-indigo-400/70 hover:text-indigo-400 uppercase tracking-widest font-black transition-colors"
          >
            Bridge from other chains <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}
