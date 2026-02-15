import { useState, useEffect } from 'react';
import { Trophy, Crown, Sparkles } from 'lucide-react';
import { useAccount } from 'wagmi';
import { supabase } from '../lib/supabaseClient';

// Tier Logic Helper
const getTier = (xp) => {
  if (xp >= 10000) return { name: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
  if (xp >= 5000) return { name: 'Silver', color: 'text-slate-300', bg: 'bg-slate-300/20' };
  if (xp >= 1000) return { name: 'Bronze', color: 'text-amber-600', bg: 'bg-amber-600/20' };
  return { name: 'Rookie', color: 'text-slate-500', bg: 'bg-slate-800/50' };
};

const formatAddress = (addr) => {
  if (!addr) return 'Unknown';
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
};

function LeaderboardRow({ user, rank, isCurrentUser }) {
  const tierStyles = {
    'Gold': { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    'Silver': { color: 'text-slate-300', bg: 'bg-slate-300/20' },
    'Bronze': { color: 'text-amber-600', bg: 'bg-amber-600/20' },
    'Rookie': { color: 'text-slate-500', bg: 'bg-slate-800/50' }
  };

  const style = tierStyles[user.rank_name] || { color: 'text-blue-400', bg: 'bg-blue-500/10' };
  const displayName = user.display_name || user.username || formatAddress(user.wallet_address);

  return (
    <div
      className={`relative glass-card p-4 flex items-center justify-between border transition-all animate-slide-up
        ${isCurrentUser ? 'border-yellow-500/50 bg-yellow-500/5 shadow-[0_0_30px_-5px_rgba(234,179,8,0.3)]' : 'border-white/5 hover:border-white/10'}
      `}
    >
      {isCurrentUser && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-12 bg-yellow-500 rounded-r-full shadow-[0_0_10px_rgba(234,179,8,0.8)]" />
      )}

      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 min-w-[3rem] flex items-center justify-center font-black text-lg rounded-xl shadow-lg border border-white/10
          ${rank === 1 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-black shadow-yellow-500/20' :
            rank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-black shadow-slate-300/20' :
              rank === 3 ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-amber-600/20' :
                'bg-slate-800 text-slate-400'}`}>
          {rank === 1 ? <Crown className="w-6 h-6" /> : rank}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 px-1 min-w-0 flex-1">
          {user.pfp_url && (
            <img src={user.pfp_url} alt="" className="w-10 h-10 rounded-full border border-white/10 shadow-sm shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${style.bg} ${style.color} shrink-0`}>
                {user.rank_name || 'Rookie'}
              </span>
              {isCurrentUser && <span className="text-[10px] font-bold text-yellow-500 shrink-0">(YOU)</span>}
            </div>
            <span className={`font-mono text-base truncate block ${isCurrentUser ? 'text-white font-bold' : 'text-slate-300'}`}>
              {displayName}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end">
        <div className="flex items-center gap-2 text-yellow-400 font-black">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          <span className="text-xl tracking-tighter">{Number(user.xp || 0).toLocaleString()}</span>
        </div>
        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">XP</p>
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
        .select('wallet_address, xp, rank_name, display_name, username, pfp_url')
        .order('xp', { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching leaderboard detail:", JSON.stringify(error, null, 2));
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
    <div className="min-h-screen pt-24 pb-12 px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-40 left-10 w-72 h-72 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto max-w-3xl relative z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-gradient-to-r from-yellow-500/10 to-purple-500/10 border border-white/10 mb-6 backdrop-blur-sm">
            <Trophy className="w-8 h-8 text-yellow-400 mr-3" />
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-200 to-white tracking-tight">
              LEADERBOARD
            </h1>
            <Trophy className="w-8 h-8 text-yellow-400 ml-3 transform scale-x-[-1]" />
          </div>
          <p className="text-slate-400 font-medium max-w-lg mx-auto text-lg">
            Top 50 legendary hunters fighting for glory and XP.
          </p>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-800/30 rounded-xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20 glass-card border-dashed">
              <p className="text-slate-500 font-bold">No data available yet.</p>
            </div>
          ) : (
            users.map((user, index) => (
              <LeaderboardRow
                key={user.wallet_address}
                user={user}
                rank={index + 1}
                isCurrentUser={address && user.wallet_address?.toLowerCase() === address.toLowerCase()}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
