import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
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

    const refetchClaims = useCallback(() => {
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

    useEffect(() => {
        refetchClaims();
    }, [refetchClaims]);

    // Fetch active UGC campaigns + their sub-tasks
    const [ugcCampaigns, setUgcCampaigns] = useState<UGCCampaign[]>([]);
    const [isLoadingUgc, setIsLoadingUgc] = useState(false);

    const fetchUgcCampaigns = useCallback(async () => {
        setIsLoadingUgc(true);
        try {
            const { data: campaigns } = await supabase
                .from('campaigns')
                .select('id, title, platform_code, reward_amount_per_user, reward_symbol, is_active, is_verified_payment')
                .eq('is_active', true)
                .eq('is_verified_payment', true)
                .order('created_at', { ascending: false });

            if (!campaigns || campaigns.length === 0) {
                setUgcCampaigns([]);
                return;
            }

            type CampaignRow = { id: string | number; title?: string; platform_code?: string; reward_amount_per_user?: number; reward_symbol?: string; is_active?: boolean; is_verified_payment?: boolean };
            const typedCampaigns = campaigns as CampaignRow[];
            const campaignIds = typedCampaigns.map((c) => String(c.id));

            const { data: subTasks } = await supabase
                .from('daily_tasks')
                .select('id, title, action_type, platform, link, target_id, is_base_social_required')
                .in('target_id', campaignIds)
                .eq('task_type', 'ugc')
                .eq('is_active', true);

            const tasksByCampaign: Record<string, Task[]> = {};
            (subTasks as DailyTask[] | null || []).forEach((t) => {
                if (!t.target_id) return;
                const campaignId = String(t.target_id);
                if (!tasksByCampaign[campaignId]) tasksByCampaign[campaignId] = [];
                tasksByCampaign[campaignId].push({
                    id: t.id,
                    title: t.title || t.description || '',
                    link: t.link || '',
                    baseReward: Number(t.xp_reward || 0),
                    isActive: true,
                    cooldown: 0,
                    minTier: 0,
                    requiresVerification: true,
                    sponsorshipId: 0,
                    platform: t.platform || undefined,
                    action_type: t.action_type || undefined,
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
    }, []);

    useEffect(() => {
        fetchUgcCampaigns();
    }, [fetchUgcCampaigns]);

    useEffect(() => {
        const refreshUgc = () => {
            void fetchUgcCampaigns();
            refetchClaims();
        };

        const channel = supabase
            .channel('tasks-page-ugc-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, refreshUgc)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_tasks' }, refreshUgc)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_task_claims' }, refreshUgc)
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [fetchUgcCampaigns, refetchClaims]);

    const { profileData, syncUser, isLoading: isSyncing } = useFarcaster();
    useEffect(() => {
        if (isConnected && address && !profileData && !isSyncing) {
            syncUser(address);
        }
    }, [isConnected, address, profileData, isSyncing, syncUser]);

    return (
        <div className="w-full max-w-[100vw] overflow-x-hidden">
            <div className="max-w-screen-lg mx-auto pb-28 md:pb-8">
                {/* Midnight Cyber Header */}
                <div className="card-title-row px-1 mb-6">
                    <h2 className="text-xl text-white" style={{ fontFamily: 'var(--typography-family-heading)' }}>Quest Board</h2>
                    <span className="badge-cyber badge-cyber-blue">Disappearing Tasks Mode Active</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <button
                            onClick={() => navigate('/create-mission')}
                            className="btn-cyber-native-action"
                        >
                            <i className="fa-solid fa-plus"></i>
                            <span>Sponsor Mission</span>
                        </button>
                    </div>

                    {isConnected && (
                        <div className="flex items-center gap-6 glass-card p-4" style={{ margin: 0 }}>
                            <div>
                                <p className="label-native text-slate-500 mb-0.5">YOUR XP</p>
                                <p className="value-native text-lg text-white">{String(userPoints)}</p>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <div>
                                <p className="label-native text-slate-500 mb-0.5">CURRENT RANK</p>
                                <div className="flex items-center gap-1.5">
                                    <i className="fa-solid fa-award text-indigo-400"></i>
                                    <p className="value-native text-indigo-400">{rankName || `LVL ${userTier}`}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Midnight Cyber Tabs */}
                <div className="tabs-cyber">
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`tab-cyber-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                    >
                        Daily Tasks
                    </button>
                    <button
                        onClick={() => setActiveTab('offers')}
                        className={`tab-cyber-btn ${activeTab === 'offers' ? 'active' : ''}`}
                    >
                        Partner Offers
                    </button>
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
