import { useState, useEffect } from 'react';
import { Award, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useUserV12Stats } from '../hooks/useContract';
import { TaskList } from '../components/tasks/TaskList';
import { OffersList } from '../components/tasks/OffersList';
import { UGCCampaignCard } from '../components/UGCCampaignCard';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useFarcaster } from '../hooks/useFarcaster';
import { usePoints } from '../shared/context/PointsContext';

import { Task, UGCCampaign } from '../types/tasks';
import { Database } from '../types/database.types';

type DailyTask = Database['public']['Tables']['daily_tasks']['Row'];

export function TasksPage() {
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const { userPoints, userTier, rankName } = usePoints();
    const { refetch } = useUserV12Stats(address);
    const [activeTab, setActiveTab] = useState<'tasks' | 'offers'>('tasks');
    const [offChainClaims, setOffChainClaims] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (address) {
            supabase
                .from('user_task_claims')
                .select('task_id')
                .eq('wallet_address', address.toLowerCase())
                .then(({ data, error }) => {
                    if (data && !error) {
                        setOffChainClaims(new Set((data as Array<{ task_id: string | number }>).map((d) => String(d.task_id).toLowerCase())));
                    }
                });
        } else {
            setOffChainClaims(new Set());
        }
    }, [address]);

    const refetchClaims = () => {
        if (address) {
            supabase
                .from('user_task_claims')
                .select('task_id')
                .eq('wallet_address', address.toLowerCase())
                .then(({ data, error }) => {
                    if (data && !error) {
                        setOffChainClaims(new Set((data as Array<{ task_id: string | number }>).map((d) => String(d.task_id).toLowerCase())));
                    }
                });
        }
    };

    // Fetch active UGC campaigns + their sub-tasks
    const [ugcCampaigns, setUgcCampaigns] = useState<UGCCampaign[]>([]);
    const [isLoadingUgc, setIsLoadingUgc] = useState(false);
    useEffect(() => {
        const fetchUgcCampaigns = async () => {
            setIsLoadingUgc(true);
            try {
                const { data: campaigns } = await supabase
                    .from('campaigns')
                    .select('id, title, platform_code, reward_amount_per_user, reward_symbol, is_active, is_verified_payment')
                    .eq('is_active', true)
                    .eq('is_verified_payment', true)
                    .order('created_at', { ascending: false });

                if (!campaigns || campaigns.length === 0) { setUgcCampaigns([]); return; }

                type CampaignRow = { id: string | number; title?: string; platform_code?: string; reward_amount_per_user?: number; reward_symbol?: string; is_active?: boolean; is_verified_payment?: boolean };
                const typedCampaigns = campaigns as CampaignRow[];

                const campaignIds = typedCampaigns.map((c) => c.id);
                const { data: subTasks } = await supabase
                    .from('daily_tasks')
                    .select('id, title, action_type, platform, link, onchain_id, is_base_social_required')
                    .in('onchain_id', campaignIds)
                    .eq('task_type', 'ugc')
                    .eq('is_active', true);

                const tasksByCampaign: Record<string, Task[]> = {};
                (subTasks as DailyTask[] | null || []).forEach((t) => {
                    if (t.onchain_id === null || t.onchain_id === undefined) return;
                    const onchainIdStr = String(t.onchain_id);
                    if (!tasksByCampaign[onchainIdStr]) tasksByCampaign[onchainIdStr] = [];
                    tasksByCampaign[onchainIdStr].push({
                        id: t.id,
                        title: t.title || '',
                        link: t.link || '',
                        baseReward: 0,
                        isActive: true,
                        cooldown: 0,
                        minTier: 0,
                        requiresVerification: true,
                        sponsorshipId: 0,
                        platform: t.platform || undefined,
                        isBaseSocialRequired: !!t.is_base_social_required
                    });
                });

                setUgcCampaigns(typedCampaigns.map((c) => ({
                    id: String(c.id),
                    title: c.title || '',
                    platform_code: c.platform_code || '',
                    reward_amount_per_user: Number(c.reward_amount_per_user || 0),
                    reward_symbol: c.reward_symbol || 'USDC',
                    is_active: !!c.is_active,
                    is_verified_payment: !!c.is_verified_payment,
                    subTasks: tasksByCampaign[String(c.id)] || []
                })));
            } catch (e) {
                console.error('[UGC Fetch]', e);
            } finally {
                setIsLoadingUgc(false);
            }
        };
        fetchUgcCampaigns();
    }, []);

    const { profileData, syncUser, isLoading: isSyncing } = useFarcaster();
    useEffect(() => {
        if (isConnected && address && !profileData && !isSyncing) {
            syncUser(address);
        }
    }, [isConnected, address, profileData, isSyncing, syncUser]);

    return (
        <div className="w-full max-w-[100vw] overflow-x-hidden bg-[#050505] min-h-screen">
            <div className="max-w-screen-lg mx-auto pb-28 md:pb-8">
                <div className="px-4 py-8 border-b border-white/5">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-1 uppercase tracking-tighter italic">EARN REWARDS</h1>
                                <p className="label-native text-slate-500">COMPLETE MISSIONS AND LEVEL UP YOUR STATUS.</p>
                            </div>
                            <button
                                onClick={() => navigate('/create-mission')}
                                className="px-5 py-2.5 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 rounded-xl text-indigo-400 hover:text-white label-native transition-all flex items-center justify-center w-fit"
                            >
                                Sponsor Mission
                            </button>
                        </div>

                        {isConnected && (
                            <div className="flex items-center gap-8 bg-white/5 border border-white/5 p-4 rounded-2xl">
                                <div>
                                    <p className="label-native text-slate-500 mb-0.5">YOUR XP</p>
                                    <p className="text-xl font-mono font-black text-white">{String(userPoints)}</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div>
                                    <p className="label-native text-slate-500 mb-0.5">CURRENT RANK</p>
                                    <div className="flex items-center gap-1.5">
                                        <Award className="w-4 h-4 text-indigo-400" />
                                        <p className="text-xl font-black text-indigo-400 uppercase tracking-tighter">{rankName || `LVL ${userTier}`}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 mt-8 p-1 bg-[#080808] border border-white/5 rounded-xl w-full max-w-sm mx-auto md:mx-0 shadow-lg">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`flex-1 py-3 rounded-xl label-native transition-all flex items-center justify-center ${activeTab === 'tasks' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                        >
                            Daily Tasks
                        </button>
                        <button
                            onClick={() => setActiveTab('offers')}
                            className={`flex-1 py-3 rounded-xl label-native transition-all flex items-center justify-center ${activeTab === 'offers' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                        >
                            Partner Offers
                        </button>
                    </div>
                </div>

                {activeTab === 'tasks' ? (
                    <div className="px-4 mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
                        {isLoadingUgc && (
                            <div className="py-6 text-center">
                                <Loader2 className="w-6 h-6 text-indigo-500 mx-auto animate-spin" />
                            </div>
                        )}
                        {ugcCampaigns.length > 0 && (
                            <div className="space-y-4">
                                <p className="label-native text-slate-600 px-1">SPONSORED MISSIONS</p>
                                {ugcCampaigns.map(campaign => (
                                    <UGCCampaignCard
                                        key={campaign.id}
                                        campaign={campaign}
                                        subTasks={(campaign.subTasks || []) as unknown as Parameters<typeof UGCCampaignCard>[0]['subTasks']}
                                        userClaimedTaskIds={offChainClaims}
                                        refetchStats={() => { refetch(); refetchClaims(); }}
                                    />
                                ))}
                            </div>
                        )}

                        <TaskList />
                    </div>
                ) : (
                    <div className="px-4 mt-6">
                        <OffersList />
                    </div>
                )}
            </div>
        </div>
    );
}
