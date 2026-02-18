import { useState, useEffect } from 'react';
import { Trophy, Crown, Sparkles, Medal } from 'lucide-react';
import { useAccount } from 'wagmi';
import { supabase } from '../lib/supabaseClient';

const formatAddress = (addr) => {
  if (!addr) return 'Unknown';
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
};

function LeaderboardRow({ user, rank, isCurrentUser }) {
  const getDisplayAddress = (name, addr) => {
    if (name && name.startsWith('0x') && name.length > 20) {
      return formatAddress(name);
    }
    if (name) return name;
    if (user.username) return user.username;
    return formatAddress(addr);
  };

  const displayName = getDisplayAddress(user.display_name, user.wallet_address);

  // Rank Colors
  const getRankColor = (r) => {
    if (r === 1) return 'text-yellow-500';
    if (r === 2) return 'text-slate-300';
    if (r === 3) return 'text-amber-600';
    return 'text-slate-500';
  };

  return (
    <div className={`flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${isCurrentUser ? 'bg-yellow-500/5' : ''}`}>
      <div className="flex items-center gap-4 min-w-0">
        {/* Rank Number */}
        <div className={`w-6 text-center font-bold ${getRankColor(rank)} text-lg`}>
          {rank}
        </div>

        {/* Avatar */}
        <div className="relative">
          {user.pfp_url ? (
            <img
              src={user.pfp_url}
              alt=""
              className={`w-10 h-10 rounded-full border ${isCurrentUser ? 'border-yellow-500/50' : 'border-white/10'}`}
            />
          ) : (
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center bg-slate-800 ${isCurrentUser ? 'border-yellow-500/50' : 'border-white/10'}`}>
              <span className="text-xs text-slate-500">{displayName?.substring(0, 2).toUpperCase()}</span>
            </div>
          )}
          {rank <= 3 && (
            <div className="absolute -top-1 -right-1">
              <Crown size={12} className={getRankColor(rank)} fill="currentColor" />
            </div>
          )}
        </div>

        {/* Name & Tier */}
        <div className="flex flex-col min-w-0">
          <span className={`font-bold text-[15px] truncate max-w-[120px] sm:max-w-xs ${isCurrentUser ? 'text-white' : 'text-slate-200'}`}>
            {displayName}
          </span>
          <span className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
            {user.rank_name || 'Rookie'} {isCurrentUser && <span className="text-yellow-500 font-bold">(You)</span>}
          </span>
        </div>
      </div>

      {/* XP Stats */}
      <div className="flex flex-col items-end">
        <span className="text-yellow-500 font-bold font-mono">
          {Number(user.total_xp || 0).toLocaleString()}
        </span>
        <span className="text-[10px] text-slate-500 font-medium">XP</span>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const { address } = useAccount();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('v_user_full_profile')
        .select('wallet_address, total_xp, rank_name, display_name, username, pfp_url')
        .order('total_xp', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] pb-24 pt-safe">
      <div className="max-w-screen-md mx-auto">
        {/* Header (Farcaster-Style) */}
        <div className="flex flex-col border-b border-white/10 pb-6 pt-6">
          <div className="flex items-center gap-2 px-4 mb-2">
            <Trophy className="text-yellow-500 w-5 h-5" />
            <h1 className="text-xl font-bold tracking-tight text-white uppercase">Leaderboard</h1>
          </div>
          <p className="px-4 text-slate-400 text-sm leading-snug mb-3">
            Top 50 legendary hunters fighting for glory and XP.
          </p>
          <div className="px-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/5 border border-yellow-500/10">
              <Sparkles size={12} className="text-yellow-500" />
              <span className="text-[10px] text-yellow-500/80 font-black uppercase tracking-widest">
                Data updates every 24h at 07:00 UTC
              </span>
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="bg-[#0B0E14]">
          {loading ? (
            <div className="space-y-0 divide-y divide-white/5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center p-4 gap-4 animate-pulse">
                  <div className="w-6 h-6 bg-slate-800 rounded-full" />
                  <div className="w-10 h-10 bg-slate-800 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-800 rounded w-1/3" />
                    <div className="h-2 bg-slate-800 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center text-slate-500 text-sm">
              No data available.
            </div>
          ) : (
            <div className="divide-y divide-white/5 border-b border-white/5">
              {users.map((user, index) => (
                <LeaderboardRow
                  key={user.wallet_address || index}
                  user={user}
                  rank={index + 1}
                  isCurrentUser={address && user.wallet_address?.toLowerCase() === address.toLowerCase()}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
