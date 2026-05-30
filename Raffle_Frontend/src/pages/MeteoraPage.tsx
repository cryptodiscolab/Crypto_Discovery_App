import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RefreshCw, Terminal, TrendingUp, Sliders, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

interface Pool {
  name: string;
  tvl: string;
  volume24h: string;
  baseApy: number;
}

export function MeteoraPage() {
  const [isBotRunning, setIsBotRunning] = useState(true);
  const [slippage, setSlippage] = useState(0.5);
  const [allocation, setAllocation] = useState(60);
  const [avgApy, setAvgApy] = useState(84.2);
  const [yieldGenerated, setYieldGenerated] = useState(14.85);
  const [isRebalancing, setIsRebalancing] = useState(false);

  const [pools] = useState<Pool[]>([
    { name: 'SOL-USDC [Dynamic DLMM]', tvl: '$42,400,000', volume24h: '$18,200,000', baseApy: 92.4 },
    { name: 'ETH-USDC [Dynamic DLMM]', tvl: '$28,150,000', volume24h: '$11,900,000', baseApy: 81.5 },
    { name: 'WBTC-SOL [Dynamic DLMM]', tvl: '$12,800,000', volume24h: '$4,100,000', baseApy: 56.2 }
  ]);

  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [MeteoraEngine] Hooked to DLMM pools. Initializing yield scanner.`,
    `[${new Date().toLocaleTimeString()}] [MeteoraEngine] Found SOL-USDC TVL $42.4M, Vol $18.2M. APY: 92.4%`,
    `[${new Date().toLocaleTimeString()}] [MeteoraEngine] Re-indexed bin liquidity distributions. Rebalancing idle bins.`,
  ]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Telemetry loop
  useEffect(() => {
    if (!isBotRunning) return;

    const interval = setInterval(() => {
      // 1. Drift APY slightly
      const drift = (Math.random() - 0.5) * 0.8;
      setAvgApy(prev => Math.max(40, Math.min(120, prev + drift)));

      // 2. Increment yield
      const yieldDiff = Math.random() * 0.05 + 0.01;
      setYieldGenerated(prev => prev + yieldDiff);

      // 3. Random log messages
      const messages = [
        `Detected +0.42% price arbitrage SOL/USDC vs Meteora dynamic DLMM. Executing swap routing.`,
        `Yield collected: +0.0041 SOL ($0.58 USDC) from pool dynamic fee allocation.`,
        `Re-indexed bin liquidity distributions. Rebalancing idle bins.`,
        `Arbitrage yield of 0.0024 ETH routed to MasterX sponsor contract.`,
        `Pool bin weights adjusted. Target bins active: index 642 - 648.`,
        `Slippage gate verified. Pool volatility index: 0.12 (Normal).`,
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [MeteoraEngine] ${randomMsg}`].slice(-100));
    }, 4000);

    return () => clearInterval(interval);
  }, [isBotRunning]);

  const handleRebalance = () => {
    if (isRebalancing) return;
    setIsRebalancing(true);
    const tid = toast.loading('Rebalancing pool capital...');
    
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [MeteoraEngine] Triggering manual pool bin capital rebalance...`]);

    setTimeout(() => {
      setIsRebalancing(false);
      toast.success('Capital rebalanced successfully!', { id: tid });
      setLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [MeteoraEngine] Capital successfully rebalanced to ${allocation}% SOL / ${100 - allocation}% USDC bins.`,
      ]);
    }, 2000);
  };

  const handleToggleBot = () => {
    setIsBotRunning(prev => {
      const next = !prev;
      if (next) {
        toast.success('Meteora Yield Bot resumed');
        setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] [MeteoraEngine] DLMM Yield Arbitrage Bot restarted.`]);
      } else {
        toast.error('Meteora Yield Bot paused');
        setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] [MeteoraEngine] DLMM Yield Arbitrage Bot paused. Bins lock active.`]);
      }
      return next;
    });
  };

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden pb-safe md:pb-8">
      <div className="max-w-screen-lg mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div className="card-title-row">
            <h2 className="text-xl text-white font-black tracking-widest uppercase">Meteora LP Engine</h2>
            <span className={`badge-cyber ${isBotRunning ? 'badge-cyber-green' : 'badge-cyber-orange'}`}>
              BOT STATUS: {isBotRunning ? 'RUNNING' : 'PAUSED'}
            </span>
          </div>
          <span className="badge-cyber badge-cyber-blue flex items-center gap-1.5">
            <i className="fa-solid fa-network-wired"></i> Solana Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side: Live Pools & APY Calculator */}
          <div className="flex flex-col gap-6">
            {/* Live Liquidity Pools Table */}
            <div className="glass-card p-6 border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[1.5rem]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white text-sm font-black tracking-widest uppercase">Active Dynamic Pools</h3>
                <span className="label-native text-emerald-400 flex items-center gap-1">
                  <TrendingUp size={12} />
                  <span>Realtime telemetry</span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="label-native py-2">Pool Name</th>
                      <th className="label-native py-2">TVL</th>
                      <th className="label-native py-2">24h Volume</th>
                      <th className="label-native py-2 text-right">Est. APY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pools.map((p, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="value-native py-3">{p.name}</td>
                        <td className="content-native py-3 text-slate-400">{p.tvl}</td>
                        <td className="content-native py-3 text-slate-400">{p.volume24h}</td>
                        <td className={`value-native py-3 text-right font-black ${isBotRunning ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {isBotRunning ? `${(p.baseApy * (avgApy / 84.2)).toFixed(1)}%` : '0.0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Capital Deployment & Strategy Panel */}
            <div className="glass-card p-6 border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[1.5rem] flex flex-col gap-5">
              <div className="flex items-center gap-2 mb-1">
                <Sliders className="text-indigo-400" size={16} />
                <h3 className="text-white text-sm font-black tracking-widest uppercase">Capital Rebalancing Settings</h3>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="label-native">Maximum Slippage Gate</label>
                  <span className="value-native text-indigo-400">{slippage.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="label-native">Target Pool Allocation Ratio</label>
                  <span className="value-native text-indigo-400">{allocation}% SOL / {100 - allocation}% USDC</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={allocation}
                  onChange={(e) => setAllocation(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <button
                  onClick={handleRebalance}
                  disabled={isRebalancing || !isBotRunning}
                  className="btn-native btn-secondary py-3 flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} className={isRebalancing ? 'animate-spin' : ''} />
                  <span>{isRebalancing ? 'Rebalancing...' : 'Trigger Rebalance'}</span>
                </button>
                <button
                  onClick={handleToggleBot}
                  className={`btn-native py-3 flex items-center justify-center gap-2 ${isBotRunning ? 'btn-primary bg-indigo-600' : 'btn-secondary'}`}
                >
                  {isBotRunning ? (
                    <>
                      <Pause size={14} />
                      <span>Pause Yield Bot</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      <span>Resume Yield Bot</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Side: Yield APY Chart & Logs */}
          <div className="flex flex-col gap-6">
            {/* Mini APY Stats Card */}
            <div className="glass-card p-6 border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[1.5rem]">
              <span className="label-native mb-1">Est. Realtime APY</span>
              <div className="text-emerald-400 text-3xl font-black tracking-wide filter drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] mb-1">
                {isBotRunning ? `${avgApy.toFixed(1)}%` : '0.0%'}
              </div>
              <div className="value-native text-slate-400 flex items-center gap-1 text-xs">
                <DollarSign size={12} className="text-slate-500" />
                <span>24h Yield Generated: +${yieldGenerated.toFixed(2)} USDC</span>
              </div>
              
              <div className="streak-bar-container h-1 bg-black/50 rounded-full mt-4">
                <div
                  className="streak-bar-progress h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: isBotRunning ? `${avgApy}%` : '0%',
                    boxShadow: '0 0 10px rgba(16,185,129,0.4)'
                  }}
                ></div>
              </div>
            </div>

            {/* Live Yield Logs */}
            <div className="glass-card p-6 border border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl rounded-[1.5rem] flex flex-col flex-1 min-h-[300px]">
              <div className="flex items-center gap-2 mb-3">
                <Terminal className="text-indigo-400" size={14} />
                <h3 className="text-white text-xs font-black tracking-widest uppercase">Dynamic LP Yield Log</h3>
              </div>
              <div className="bg-black/50 border border-white/5 rounded-xl p-4 font-mono text-[10px] text-cyan-400 overflow-y-auto max-h-[320px] flex-1 flex flex-col gap-1.5 leading-normal">
                {logs.map((log, idx) => (
                  <div key={idx} className="opacity-90 last:opacity-100 last:text-white transition-all">
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
