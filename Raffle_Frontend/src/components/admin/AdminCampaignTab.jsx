import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Trash2, Edit2, Loader2, Megaphone, CheckCircle, XCircle, Save } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import toast from 'react-hot-toast';

export default function AdminCampaignTab() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        banner_url: '',
        sponsor_address: '',
        duration_days: 7,
        reward_amount_per_user: '0.001',
        total_reward_pool: '0.1',
        max_participants: 100,
        status: 'active',
        platform_code: 'farcaster'
    });

    useEffect(() => {
        fetchCampaigns();
    }, []);

    async function fetchCampaigns() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('campaigns')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCampaigns(data || []);
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Failed to load campaigns');
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e) {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        const tid = toast.loading('Requesting signature for Campaign creation...');

        try {
            const payload = {
                ...formData,
                reward_amount_per_user: (parseFloat(formData.reward_amount_per_user) * 1e18).toString(),
                total_reward_pool: (parseFloat(formData.total_reward_pool) * 1e18).toString(),
                current_participants: 0,
                created_at: new Date().toISOString()
            };

            // 1. Prepare and Sign Message
            const timestamp = new Date().toISOString();
            const message = `Create Campaign: ${formData.title}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            // 2. Send to Secure API
            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'CREATE_CAMPAIGN',
                    payload: payload
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to create campaign");

            toast.success('Campaign created via secure API!', { id: tid });
            setShowForm(false);
            fetchCampaigns();
            // Reset form
            setFormData({
                title: '',
                description: '',
                banner_url: '',
                sponsor_address: '',
                duration_days: 7,
                reward_amount_per_user: '0.001',
                total_reward_pool: '0.1',
                max_participants: 100,
                status: 'active',
                platform_code: 'farcaster'
            });
        } catch (error) {
            toast.error('Failed to create campaign: ' + error.message, { id: tid });
        } finally {
            setSaving(false);
        }
    }

    async function toggleStatus(id, currentStatus) {
        if (saving) return;
        const newStatus = currentStatus === 'active' ? 'ended' : 'active';
        if (!confirm(`Switch campaign to ${newStatus.toUpperCase()}?`)) return;

        setSaving(true);
        const tid = toast.loading(`Requesting signature to ${newStatus} campaign...`);

        try {
            // 1. Prepare and Sign Message
            const timestamp = new Date().toISOString();
            const message = `${newStatus.toUpperCase()} Campaign: ${id}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            // 2. Send to Secure API
            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'UPDATE_CAMPAIGN_STATUS',
                    payload: { id, status: newStatus }
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to update campaign status");

            toast.success(`Campaign marked as ${newStatus}!`, { id: tid });
            fetchCampaigns();
        } catch (error) {
            toast.error('Update failed: ' + error.message, { id: tid });
        } finally {
            setSaving(false);
        }
    }

    async function deleteCampaign(id) {
        if (saving) return;
        if (!confirm('Are you sure you want to delete this campaign permanently?')) return;

        setSaving(true);
        const tid = toast.loading('Requesting signature for deletion...');

        try {
            // 1. Prepare and Sign Message
            const timestamp = new Date().toISOString();
            const message = `Delete Campaign: ${id}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            // 2. Send to Secure API
            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'DELETE_CAMPAIGN',
                    payload: { id }
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to delete campaign");

            toast.success('Campaign deleted permanently!', { id: tid });
            fetchCampaigns();
        } catch (error) {
            toast.error('Delete failed: ' + error.message, { id: tid });
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-indigo-400" />
                    Campaign Management
                </h2>
                <button
                    onClick={() => setShowForm(!showForm)}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                >
                    {showForm ? 'Cancel' : <><Plus className="w-4 h-4" /> New Campaign</>}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleCreate} className="glass-card p-6 bg-slate-900/50 border-white/10 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Title</label>
                            <input
                                required
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Platform Code</label>
                            <input
                                type="text"
                                value={formData.platform_code}
                                onChange={e => setFormData({ ...formData, platform_code: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white h-20 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reward per User (ETH)</label>
                            <input
                                type="number" step="0.0001"
                                value={formData.reward_amount_per_user}
                                onChange={e => setFormData({ ...formData, reward_amount_per_user: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Max Participants</label>
                            <input
                                type="number"
                                value={formData.max_participants}
                                onChange={e => setFormData({ ...formData, max_participants: parseInt(e.target.value) })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {saving ? 'Processing...' : 'Create Secure Reward Campaign'}
                    </button>
                </form>
            )}

            <div className="space-y-3">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
                ) : campaigns.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-sm">No campaigns found.</div>
                ) : (
                    campaigns.map(c => (
                        <div key={c.id} className="glass-card p-4 bg-slate-900/40 border-white/5 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${c.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                    <Megaphone className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white mb-1">{c.title}</h4>
                                    <p className="text-[10px] text-slate-500">
                                        {c.current_participants || 0} / {c.max_participants} joined • {Number(c.reward_amount_per_user) / 1e18} ETH reward
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={() => toggleStatus(c.id, c.status)}
                                    disabled={saving}
                                    className={`p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-all ${c.status === 'active' ? 'text-yellow-500' : 'text-green-500'} disabled:opacity-50`}
                                    title={c.status === 'active' ? 'End Campaign' : 'Activate Campaign'}
                                >
                                    {c.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => deleteCampaign(c.id)}
                                    disabled={saving}
                                    className="p-2 rounded-lg border border-white/10 text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                    title="Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
