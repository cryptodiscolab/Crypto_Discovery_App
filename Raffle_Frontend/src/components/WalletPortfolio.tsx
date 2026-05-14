import { Wallet, ExternalLink, RefreshCw, Coins } from 'lucide-react';
import { useTokenBalances } from '../hooks/useTokenBalances';
import { formatUnits } from 'viem';

export const WalletPortfolio = ({ highlightSymbol }: { highlightSymbol?: string }) => {
    const { balances, isLoading, refetch } = useTokenBalances();

    return (
        <div className="glass-card p-6 border-white/5 bg-slate-900/20 rounded-[2.5rem] space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                        <Wallet className="text-indigo-400" size={20} />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">WALLET ASSETS</h4>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Base Network</p>
                    </div>
                </div>
                <button 
                    onClick={() => refetch()}
                    disabled={isLoading}
                    className="p-2 hover:bg-white/5 rounded-xl transition-all active:scale-95 text-slate-500 hover:text-indigo-400"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {balances.map((token: any, i: number) => {
                    const isHighlighted = token.symbol === highlightSymbol;
                    return (
                        <div 
                            key={token.symbol || i}
                            className={`group flex items-center justify-between p-4 bg-black/40 border rounded-[1.5rem] transition-all ${isHighlighted ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'border-white/5 hover:border-indigo-500/30'}`}
                        >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 group-hover:scale-110 transition-transform">
                                {token.icon ? (
                                    <img src={token.icon} alt={token.symbol} className="w-6 h-6 object-contain" />
                                ) : (
                                    <Coins className="text-slate-500" size={20} />
                                )}
                            </div>
                            <div>
                                <h5 className="text-[11px] font-black text-white uppercase tracking-widest">{token.symbol}</h5>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{token.name}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black text-white font-mono tracking-tighter">
                                {token.balance ? Number(formatUnits(token.balance.value, token.balance.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0.00'}
                            </p>
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a 
                                    href={token.address ? `https://basescan.org/token/${token.address}` : 'https://basescan.org'} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[8px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1 hover:underline"
                                >
                                    SCAN <ExternalLink size={8} />
                                </a>
                            </div>
                        </div>
                    </div>
                );
            })}
            </div>
            
            {isLoading && (
                <div className="flex items-center justify-center py-4">
                    <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
};
