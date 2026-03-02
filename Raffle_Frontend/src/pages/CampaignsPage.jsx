import { useState, useEffect } from 'react';
import { Megaphone, Clock, Gift, ExternalLink, ChevronRight, Search, Loader2 } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { supabase } from '../lib/supabaseClient';

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
        ? (Number(campaign.reward_amount_per_user) / 1e18).toFixed(4)
        : '—';

    const daysLeft = endAt !== Infinity
        ? Math.max(0, Math.ceil((endAt - now) / 86400000))
        : null;

    return (
        <div className="glass-card bg-slate-900/40 border-white/5 overflow-hidden group hover:border-indigo-500/30 transition-all">
            {/* Banner */}
            {campaign.banner_url ? (
                <img src={campaign.banner_url} alt="" className="w-full h-32 object-cover" />
            ) : (
                <div className="w-full h-32 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 flex items-center justify-center">
                    <Megaphone className="w-10 h-10 text-indigo-400/40" />
                </div>
            )}

            <div className="p-4 space-y-3">
                {/* Title + Status */}
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">{campaign.title}</h3>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[status]}`}>
                        {status}
                    </span>
                </div>

                {/* Description */}
                {campaign.description && (
                    <p className="text-slate-400 text-xs line-clamp-2">{campaign.description}</p>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Gift className="w-3 h-3 text-indigo-400" />
                        <span>{rewardFormatted} ETH / user</span>
                    </div>
                    {daysLeft !== null && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <Clock className="w-3 h-3 text-yellow-400" />
                            <span>{status === 'ended' ? 'Ended' : `${daysLeft}d left`}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-400 col-span-2">
                        <span className="text-slate-600">Sponsor:</span>
                        <span className="font-mono text-[9px] truncate">
                            {campaign.sponsor_address
                                ? `${campaign.sponsor_address.slice(0, 6)}...${campaign.sponsor_address.slice(-4)}`
                                : '—'}
                        </span>
                    </div>
                </div>

                {/* Participants */}
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{campaign.current_participants || 0} / {campaign.max_participants || '∞'} joined</span>
                    {campaign.platform_code && (
                        <span className="bg-slate-800 px-2 py-0.5 rounded-full capitalize">{campaign.platform_code}</span>
                    )}
                </div>

                {/* Action Button */}
                <button
                    onClick={() => onClaim(campaign)}
                    disabled={status !== 'active' || !userAddress}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${status === 'active' && userAddress
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent hover:scale-[1.02] active:scale-[0.98] shadow-indigo-500/20 shadow-md'
                        : 'bg-slate-800 text-slate-500 border-white/5 cursor-not-allowed'
                        }`}
                >
                    {!userAddress
                        ? 'Connect Wallet'
                        : status === 'active'
                            ? <>Join Campaign <ChevronRight className="w-3 h-3" /></>
                            : status === 'upcoming'
                                ? 'Coming Soon'
                                : 'Campaign Ended'}
                </button>
            </div>
        </div>
    );
}

export function CampaignsPage() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('active'); // 'active' | 'all'
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
            console.error('[CampaignsPage] fetch error:', err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleClaim(campaign) {
        if (!address) return;
        setJoiningId(campaign.id);
        try {
            // 1. Request Signature for Verification
            const timestamp = new Date().toISOString();
            const message = `Join Campaign: ${campaign.title}\nWallet: ${address}\nTimestamp: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            // 2. Submit to API
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
            alert(`✅ Successfully joined "${campaign.title}"! Reward will be processed after verification.`);
        } catch (err) {
            console.error(err);
            alert(`❌ ${err.shortMessage || err.message}`);
        } finally {
            setJoiningId(null);
        }
    }

    const filtered = campaigns.filter(c =>
        !search || c.title?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#0B0E14] pb-24 pt-safe">
            <div className="max-w-screen-md mx-auto">
                {/* Header */}
                <div className="flex flex-col border-b border-white/10 pb-6 pt-6 px-4 gap-3">
                    <div className="flex items-center gap-2">
                        <Megaphone className="text-indigo-400 w-5 h-5" />
                        <h1 className="text-xl font-bold tracking-tight text-white uppercase">Sponsor Campaigns</h1>
                    </div>
                    <p className="text-slate-400 text-sm">Complete sponsor missions and earn on-chain rewards.</p>

                    {/* Search + Filter */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search campaigns..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                            />
                        </div>
                        <div className="flex rounded-xl border border-white/10 overflow-hidden text-xs font-bold">
                            {['active', 'all'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-2 capitalize transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="px-4 pt-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Loading campaigns...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-500 gap-3">
                            <Megaphone className="w-12 h-12 opacity-20" />
                            <p className="text-sm font-bold">No campaigns found</p>
                            <p className="text-xs text-slate-600">Check back soon for new sponsor missions.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>
        </div>
    );
}

export default CampaignsPage;
