import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Wallet, Shield, History, ExternalLink, LogOut, Copy, Check, Users, Ticket, Gift, DollarSign, Loader2, Plus, Trophy, Settings } from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { useNeynarContext } from "@neynar/react";
import { useTotalRaffles, useRaffleInfo, useWithdrawRevenue, useAdminInfo, useWithdrawFees } from '../hooks/useContract';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

function CreatorRaffleCard({ raffleId }) {
  const { raffleInfo, isLoading } = useRaffleInfo(raffleId);
  const { withdrawRevenue, isLoading: isWithdrawing } = useWithdrawRevenue();
  const { address } = useAccount();

  if (isLoading || !raffleInfo) return null;
  if (raffleInfo.creator !== address) return null;

  const handleWithdraw = async () => {
    try {
      await withdrawRevenue(raffleId);
    } catch (error) {
      console.error(error);
    }
  };

  const revenue = Number(raffleInfo.paidTicketsSold) * 0.00015; // Ticket price 0.00015 ETH
  const fee = revenue * 0.05; // 5% fee
  const creatorShare = revenue - fee;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="bg-blue-500/10 p-3 rounded-lg">
          <Ticket className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h4 className="font-semibold text-white">Raffle #{Number(raffleId)}</h4>
          <p className="text-sm text-slate-400">{Number(raffleInfo.nftCount)} NFTs • {Number(raffleInfo.ticketsSold)} Tickets</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="text-sm text-slate-400">Net Revenue</p>
          <p className="font-bold text-green-400">{creatorShare.toFixed(5)} ETH</p>
        </div>
        {raffleInfo.isCompleted ? (
          <button
            onClick={handleWithdraw}
            disabled={isWithdrawing || creatorShare <= 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 px-4 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors"
          >
            {isWithdrawing ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
            <span>Withdraw</span>
          </button>
        ) : (
          <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-xs font-semibold">
            In Progress
          </span>
        )}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { user } = useNeynarContext();
  const { totalRaffles } = useTotalRaffles();
  const { adminAddress, totalFees } = useAdminInfo();
  const { withdrawFees, isLoading: isWithdrawingFees } = useWithdrawFees();
  const [copied, setCopied] = useState(false);

  const isAdmin = address && adminAddress && address.toLowerCase() === adminAddress.toLowerCase();

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Address copied!');
    }
  };

  const raffleIds = Array.from({ length: totalRaffles || 0 }, (_, i) => i);

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-600 blur-3xl opacity-20"></div>
          <div className="relative bg-slate-800 p-6 rounded-3xl border border-white/5">
            <User className="w-16 h-16 text-blue-500" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h2>
        <p className="text-slate-400 max-w-md mx-auto mb-8">
          Please connect your wallet to view your profile, manage your raffles, and see your activity.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sidebar / Profile Card */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-6"
            >
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center overflow-hidden border-2 border-white/10 shadow-2xl">
                    {user?.pfp_url ? (
                      <img src={user.pfp_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <User className="w-10 h-10 text-white/50" />
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-slate-900 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {user?.display_name || 'Anonymous User'}
                </h3>
                {user?.username && (
                  <p className="text-blue-400 text-sm font-medium mb-4">@{user.username}</p>
                )}
                {user?.profile?.bio?.text && (
                  <p className="text-slate-400 text-sm mb-4 italic">"{user.profile.bio.text}"</p>
                )}

                <div className="flex items-center space-x-2 bg-white/5 rounded-lg px-3 py-1.5 mb-6 group cursor-pointer" onClick={copyAddress}>
                  <Wallet className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-mono text-slate-300">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </div>

                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Followers</p>
                    <p className="text-lg font-bold text-white">{user?.follower_count || 0}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Following</p>
                    <p className="text-lg font-bold text-white">{user?.following_count || 0}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-white/5 space-y-1">
                <button
                  onClick={() => disconnect()}
                  className="w-full flex items-center space-x-3 px-4 py-2.5 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium">Disconnect</span>
                </button>
              </div>
            </motion.div>

            {isAdmin && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-6 border-blue-500/30"
              >
                <div className="flex items-center space-x-2 mb-4">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <h4 className="font-bold text-white">Admin Dashboard</h4>
                </div>
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Accumulated Fees</p>
                    <p className="text-xl font-bold text-white">{(Number(totalFees) / 1e18).toFixed(6)} ETH</p>
                  </div>
                  <button
                    onClick={() => withdrawFees()}
                    disabled={isWithdrawingFees || totalFees === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20"
                  >
                    {isWithdrawingFees ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5" />}
                    <span>Withdraw All Fees</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Main Content Areas */}
          <div className="lg:col-span-2 space-y-6">
            {/* Creator Dashboard Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card overflow-hidden"
            >
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-600/20">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Creator Dashboard</h2>
                  </div>
                  <Link to="/create" className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Host New</span>
                  </Link>
                </div>
              </div>
              <div className="p-6">
                {raffleIds.length > 0 ? (
                  <div className="space-y-4">
                    {raffleIds.map(id => (
                      <CreatorRaffleCard key={id} raffleId={id} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Plus className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-slate-400 font-medium">No raffles found</p>
                    <p className="text-sm text-slate-500 mb-6">Start hosting raffles to earn revenue!</p>
                    <Link to="/create" className="btn-primary inline-flex py-2 px-6">
                      Create Your First Raffle
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Participation Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-600/20">
                  <History className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Participation History</h2>
              </div>

              <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                <Ticket className="w-12 h-12 text-white/5 mx-auto mb-3" />
                <p className="text-slate-500">History feature coming soon</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
