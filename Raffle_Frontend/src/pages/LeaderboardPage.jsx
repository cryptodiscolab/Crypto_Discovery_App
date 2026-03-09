import { useState, useEffect } from 'react';
import { Trophy, Crown, Sparkles, Medal, Users, Shield } from 'lucide-react';
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
          <span className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2">
            {user.rank_name || 'Rookie'} 
            {isCurrentUser && <span className="text-yellow-500 font-bold">(You)</span>}
            {user.streak_count > 0 && (
              <span className="flex items-center gap-0.5 text-orange-500 font-black italic text-[10px]">
                <Sparkles size={10} className="fill-current" />
                {user.streak_count}d
              </span>
            )}
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
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All'); // 'All', 'Elite', 'Gold', 'Silver', 'Rookie'

  const tabs = [
    { id: 'All', label: 'All', icon: Trophy, color: 'text-indigo-400' },
    { id: 'Diamond', label: 'Diamond', icon: Crown, color: 'text-blue-400' },
    { id: 'Platinum', label: 'Platinum', icon: Sparkles, color: 'text-purple-400' },
    { id: 'Gold', label: 'Gold', icon: Shield, color: 'text-yellow-500' },
    { id: 'Silver', label: 'Silver', icon: Medal, color: 'text-slate-300' },
    { id: 'Bronze', label: 'Bronze', icon: Users, color: 'text-amber-700' },
    { id: 'Rookie', label: 'Rookie', icon: Trophy, color: 'text-slate-500' },
  ];

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'All') {
      setFilteredUsers(allUsers);
    } else {
      setFilteredUsers(allUsers.filter(u => u.rank_name === activeTab));
    }
  }, [activeTab, allUsers]);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`/api/leaderboard?limit=100`);
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      const data = await response.json();
      setAllUsers(data || []);
      setFilteredUsers(data || []);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] pb-24 pt-safe">
      <div className="max-w-screen-md mx-auto">
        {/* Header Section */}
        <div className="flex flex-col border-b border-white/5 pb-0 pt-6 bg-[#0B0E14] sticky top-0 z-20">
          <div className="flex items-center gap-2 px-4 mb-2">
            <Trophy className="text-yellow-500 w-5 h-5" />
            <h1 className="text-xl font-black tracking-tight text-white uppercase italic">Leaderboard</h1>
          </div>
          <p className="px-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">
            Season 1: The Gacha Awakening
          </p>

          {/* Sliding Tabs (Carousel Mode) */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 pb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap active:scale-95
                  ${activeTab === tab.id
                    ? 'bg-white/10 border-white/20 text-white shadow-lg'
                    : 'bg-transparent border-white/5 text-slate-500 hover:text-slate-300'}`}
              >
                <tab.icon size={12} className={activeTab === tab.id ? tab.color : ''} />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/10 text-[8px]">
                    {filteredUsers.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mb-4">
            <Sparkles size={14} className="text-indigo-400 animate-pulse" />
            <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest leading-none">
              {activeTab === 'All' ? 'Showing top 100 global hunters' : `Showing users in ${activeTab} league`}
            </span>
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
          ) : filteredUsers.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-4 text-center px-8">
              <div className="p-4 bg-slate-900/50 rounded-full text-slate-700">
                <Trophy size={48} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-400">Liga Belum Terisi</h3>
                <p className="text-xs text-slate-600 max-w-[200px]">Jadilah yang pertama untuk mencapai rank ini dan pimpin papan peringkat!</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/5 border-b border-white/5">
              {filteredUsers.map((user, index) => (
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
