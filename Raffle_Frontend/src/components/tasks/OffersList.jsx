import { useState, useEffect } from 'react';
import { Megaphone, Clock, Gift, ChevronRight, Search, Loader2 } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    active: 'text-green-400 bg-green-400/10 border-green-400/20',
    ended: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
    upcoming: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
};

function CampaignCard({ campaign, onClaim, userAddress }) {
    const now = Date.now();
    const startAt = campaign.start_at ? new Date(campaign.start_at).getTime() : 0;
    const endAt = campaign.end_at ? new Date(campaign.end_at).getTime() : Infinity;

    const status = campaign.status === 'active' && now >= startAt && now <= endAt
        ? 'active'
        : campaign.status === 'active' && now < startAt
            ? 'upcoming'
            : 'ended';

    const rewardFormatted = campaign.reward_amount_per_user
        ? Number(campaign.reward_amount_per_user).toFixed(2)
        : '—';
    const rewardSymbol = campaign.reward_symbol || 'USDC';

    const daysLeft = endAt !== Infinity
        ? Math.max(0, Math.ceil((endAt - now) / 86400000))
        : null;

    return (
        <div className="glass-card bg-slate-900/40 border-white/5 overflow-hidden group hover:border-indigo-500/30 transition-all">
            {campaign.banner_url ? (
                <img src={campaign.banner_url} alt="" className="w-full h-32 object-cover" />
            ) : (
                <div className="w-full h-32 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 flex items-center justify-center">
                    <Megaphone className="w-10 h-10 text-indigo-400/40" />
                </div>
            )}

            <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-black text-[11px] uppercase tracking-widest leading-tight line-clamp-2">{campaign.title}</h3>
                    <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[status]}`}>
                        {status.toUpperCase()}
                    </span>
                </div>

                {campaign.description && (
                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest line-clamp-2">{campaign.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px] font-black uppercase tracking-widest">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Gift className="w-3 h-3 text-indigo-400 font-black uppercase tracking-widest" />
                        <span>{rewardFormatted} {rewardSymbol} / USER</span>
                    </div>
                    {daysLeft !== null && (
                        <div className="flex items-center gap-1.5 text-slate-400 font-black uppercase tracking-widest">
                            <Clock className="w-3 h-3 text-yellow-400" />
                            <span>{status === 'ended' ? 'ENDED' : `${daysLeft}D LEFT`}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    <span>{campaign.current_participants || 0} / {campaign.max_participants || '∞'} JOINED</span>
                </div>

                <button
                    onClick={() => onClaim(campaign)}
                    disabled={status !== 'active' || !userAddress}
                    className={`w-full py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${status === 'active' && userAddress
                        ? 'bg-indigo-600/20 hover:bg-indigo-600 border-indigo-500/30 text-indigo-400 hover:text-white'
                        : 'bg-slate-800 text-slate-500 border-white/5 cursor-not-allowed'
                        }`}
                >
                    {!userAddress
                        ? 'CONNECT WALLET'
                        : status === 'active'
                            ? 'JOIN MISSION'
                            : status === 'upcoming'
                                ? 'COMING SOON'
                                : 'MISSION ENDED'}
                </button>
            </div>
        </div>
    );
}

export function OffersList() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('active');
    const [search, setSearch] = useState('');
    const [joiningId, setJoiningId] = useState(null);

    useEffect(() => {
        fetchCampaigns();
    }, [filter]);

    async function fetchCampaigns() {
        setLoading(true);
        try {
            let query = supabase
                .from('campaigns')
                .select('*')
                .order('created_at', { ascending: false });

            if (filter === 'active') {
                query = query.eq('status', 'active');
            }

            const { data, error } = await query;
            if (error) throw error;
            setCampaigns(data || []);
        } catch (err) {
            console.error('[OffersList] fetch error:', err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleClaim(campaign) {
        if (!address) return;
        setJoiningId(campaign.id);
        const tid = toast.loading(`JOINING ${campaign.title.toUpperCase()}...`);
        try {
            const timestamp = new Date().toISOString();
            const message = `Join Campaign: ${campaign.title}\nWallet: ${address}\nTimestamp: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const res = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'join',
                    campaign_id: campaign.id,
                    wallet: address,
                    signature,
                    message
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to join');
            toast.success(`Successfully joined "${campaign.title}"!`, { id: tid });
        } catch (err) {
            console.error(err);
            toast.error(err.shortMessage || err.message, { id: tid });
        } finally {
            setJoiningId(null);
        }
    }

    const filtered = campaigns.filter(c =>
        !search || c.title?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="SEARCH PARTNER OFFERS..."
                            className="w-full pl-9 pr-3 py-3 bg-slate-900 border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                        />
                    </div>
                    <div className="flex rounded-xl border border-white/10 overflow-hidden text-[11px] font-black uppercase tracking-widest shrink-0">
                        {['active', 'all'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 uppercase tracking-widest transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-[11px] font-black uppercase tracking-widest">LOADING OFFERS...</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-4 glass-card border-dashed">
                    <Megaphone className="w-12 h-12 opacity-10" />
                    <div className="text-center">
                        <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">NO ACTIVE OFFERS</p>
                        <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-widest">CHECK BACK LATER FOR REWARDS.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-8">
                    {filtered.map(c => (
                        <CampaignCard
                            key={c.id}
                            campaign={c}
                            onClaim={handleClaim}
                            userAddress={address}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
