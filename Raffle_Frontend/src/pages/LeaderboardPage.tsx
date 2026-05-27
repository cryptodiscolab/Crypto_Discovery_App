import { useCallback, useEffect, useState } from 'react';
import { Trophy, Crown, Sparkles, Medal, Users, Shield } from 'lucide-react';
import { useAccount } from 'wagmi';
import { supabase } from '../lib/supabaseClient';

interface LeaderboardUser {
  wallet_address: string;
  display_name?: string;
  username?: string;
  pfp_url?: string;
  rank_name?: string;
  total_xp?: number | string;
  streak_count?: number;
  raffle_wins?: number;
}

const formatAddress = (addr: string) => {
  if (!addr) return 'Unknown';
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
};

function LeaderboardRow({ user, rank, isCurrentUser }: { user: LeaderboardUser, rank: number, isCurrentUser: boolean | string | undefined }) {
  const getDisplayAddress = (name: string, addr: string) => {
    if (name && name.startsWith('0x') && name.length > 20) {
      return formatAddress(name);
    }
    if (name) return name;
    if (user.username) return user.username;
    return formatAddress(addr);
  };

  const displayName = getDisplayAddress(user.display_name || '', user.wallet_address || '');
  const streakCount = user.streak_count || 0;
  const raffleWins = user.raffle_wins || 0;

  const getRankColor = (r: number) => {
    if (r === 1) return 'text-yellow-500';
    if (r === 2) return 'text-slate-300';
    if (r === 3) return 'text-amber-600';
    return 'text-slate-500';
  };

  return (
    <div className={`flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${isCurrentUser ? 'bg-blue-500/5' : ''}`}>
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-6 text-center font-bold ${getRankColor(rank)} text-lg`}>{rank}</div>
        <div className="relative">
          {user.pfp_url ? (
            <img src={user.pfp_url} alt="" className={`w-10 h-10 rounded-full border ${isCurrentUser ? 'border-yellow-500/50' : 'border-white/10'}`} />
          ) : (
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center bg-slate-800 ${isCurrentUser ? 'border-blue-500/50' : 'border-white/10'}`}>
              <span className="text-[11px] text-slate-500">{displayName?.substring(0, 2).toUpperCase()}</span>
            </div>
          )}
          {rank <= 3 && (
            <div className="absolute -top-1 -right-1">
              <Crown size={12} className={getRankColor(rank)} fill="currentColor" />
            </div>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className={`text-[11px] font-black uppercase tracking-widest truncate max-w-[120px] sm:max-w-xs ${isCurrentUser ? 'text-white' : 'text-slate-200'}`}>{displayName}</span>
          <span className="text-[11px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
            {user.rank_name || 'ROOKIE'}
            {isCurrentUser && <span className="text-blue-500 font-black">(YOU)</span>}
            {streakCount > 0 && (
              <span className="flex items-center gap-0.5 text-orange-500 font-black italic text-[11px] uppercase tracking-widest">
                <Sparkles size={10} className="fill-current" />{streakCount}D
              </span>
            )}
            {raffleWins > 0 && (
              <span className="flex items-center gap-0.5 text-purple-400 font-black text-[11px] uppercase tracking-widest">🏆 {raffleWins}W</span>
            )}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-blue-500 font-black font-mono">{Number(user.total_xp || 0).toLocaleString()}</span>
        <span className="text-[11px] text-slate-500 font-black uppercase tracking-widest">XP</span>
      </div>
    </div>
  );
}

export function LeaderboardPage() {
  const { address } = useAccount();
  const [allUsers, setAllUsers] = useState<LeaderboardUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('All');

  const tabs = [
    { id: 'All', label: 'All', icon: Trophy, color: 'text-indigo-400' },
    { id: 'Diamond', label: 'Diamond', icon: Crown, color: 'text-blue-400' },
    { id: 'Platinum', label: 'Platinum', icon: Sparkles, color: 'text-purple-400' },
    { id: 'Gold', label: 'Gold', icon: Shield, color: 'text-yellow-500' },
    { id: 'Silver', label: 'Silver', icon: Medal, color: 'text-slate-300' },
    { id: 'Bronze', label: 'Bronze', icon: Users, color: 'text-amber-700' },
    { id: 'Rookie', label: 'Rookie', icon: Trophy, color: 'text-slate-500' },
  ];

  const fetchLeaderboard = useCallback(async (signal?: AbortSignal) => {
    setFetchError(null);
    try {
      const response = await fetch(`/api/leaderboard?limit=100`, { signal });
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      const data = await response.json();
      const users = (data || []) as LeaderboardUser[];
      setAllUsers(users);
      setFilteredUsers(users);
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === 'AbortError') return;
      console.error("Error fetching leaderboard:", err);
      setFetchError('Failed to load leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeaderboard(controller.signal);
    return () => controller.abort();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-live-user-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => { void fetchLeaderboard(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (activeTab === 'All') {
      setFilteredUsers(allUsers);
    } else {
      setFilteredUsers(allUsers.filter((u) => u.rank_name === activeTab));
    }
  }, [activeTab, allUsers]);

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden pb-safe md:pb-8">
      <div className="max-w-screen-lg mx-auto">
        {/* Midnight Cyber Header */}
        <div className="card-title-row mb-6">
          <h2 className="text-xl text-white" style={{ fontFamily: 'var(--typography-family-heading)' }}>Leaderboard</h2>
          <input type="text" className="input-cyber" placeholder="Search Wallet..." style={{ padding: '8px 12px', fontSize: '12px', width: '200px' }} />
        </div>

        {/* Season Info */}
        <div className="px-4">
          <p className="label-native text-slate-500 mb-4">SEASON 1: THE GACHA AWAKENING</p>
        </div>

        {/* Sliding Tabs */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 ${
                activeTab === tab.id
                  ? 'bg-white/10 border-white/20 text-white shadow-lg'
                  : 'bg-transparent border-white/5 text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon size={12} className={activeTab === tab.id ? tab.color : ''} />
              {tab.label}
              {activeTab === tab.id && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/10 text-[11px] font-black">{filteredUsers.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Info Banner */}
        <div className="px-4 mb-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
            <Sparkles size={14} className="text-indigo-400 animate-pulse" />
            <span className="text-[11px] text-indigo-300 font-black uppercase tracking-widest leading-none">
              {activeTab === 'All' ? 'SHOWING TOP 100 GLOBAL HUNTERS' : `SHOWING USERS IN ${activeTab.toUpperCase()} LEAGUE`}
            </span>
          </div>
        </div>

        {/* List Content */}
        <div>
          {fetchError && !loading ? (
            <div className="py-20 flex flex-col items-center gap-4 text-center px-8">
              <div className="p-4 bg-red-900/20 rounded-full text-red-500"><Trophy size={48} /></div>
              <h3 className="text-[11px] font-black text-red-400 uppercase tracking-widest">{fetchError}</h3>
              <button onClick={() => fetchLeaderboard()} className="mt-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all">RETRY</button>
            </div>
          ) : loading ? (
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
              <div className="p-4 bg-slate-900/50 rounded-full text-slate-700"><Trophy size={48} /></div>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">LEAGUE VACANT</h3>
              <p className="text-[11px] text-slate-600 max-w-[200px] font-black uppercase tracking-widest">BE THE FIRST TO REACH THIS RANK AND LEAD THE BOARD!</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 border-b border-white/5">
              {filteredUsers.map((user, index) => (
                <LeaderboardRow key={user.wallet_address || index} user={user} rank={index + 1} isCurrentUser={address && user.wallet_address?.toLowerCase() === address.toLowerCase()} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}