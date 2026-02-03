import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Users, Megaphone, Gift, Plus, RefreshCw, Trash2, Edit, Save, X } from 'lucide-react';
import { usePoints } from '../shared/context/PointsContext';
import { useRaffle } from '../hooks/useRaffle';
import toast from 'react-hot-toast';

export function AdminPage() {
    const navigate = useNavigate();
    const { isAdmin, isConnected } = usePoints();
    const { rerollWinner } = useRaffle();
    const [activeTab, setActiveTab] = useState('tasks');
    const [isLoading, setIsLoading] = useState(true);

    // Route protection
    useEffect(() => {
        if (!isConnected) {
            toast.error('Please connect your wallet');
            navigate('/');
            return;
        }

        // Wait a bit for admin check to complete
        const timer = setTimeout(() => {
            if (!isAdmin) {
                toast.error('Access denied: Admin only');
                navigate('/');
            } else {
                setIsLoading(false);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [isAdmin, isConnected, navigate]);

    // Tab configuration - easily extensible
    const tabs = [
        { id: 'tasks', label: 'Task Sponsor', icon: Gift, color: 'blue' },
        { id: 'raffles', label: 'Raffle Monitor', icon: RefreshCw, color: 'purple' },
        { id: 'users', label: 'User Management', icon: Users, color: 'green' },
        { id: 'announcements', label: 'Announcements', icon: Megaphone, color: 'orange' },
    ];

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Shield className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
                    <p className="text-slate-400">Verifying admin access...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4">
            <div className="container mx-auto max-w-7xl">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl shadow-lg shadow-yellow-500/20">
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
                            <p className="text-slate-400">Manage platform settings and content</p>
                        </div>
                    </div>
                </motion.div>

                {/* Tab Navigation */}
                <div className="glass-card p-2 mb-6 flex gap-2 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/30`
                                        : 'text-slate-400 hover:bg-white/5'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'tasks' && <TaskSponsorTab />}
                        {activeTab === 'raffles' && <RaffleMonitorTab rerollWinner={rerollWinner} />}
                        {activeTab === 'users' && <UserManagementTab />}
                        {activeTab === 'announcements' && <AnnouncementsTab />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// ==================== TAB 1: Task Sponsor ====================
function TaskSponsorTab() {
    const [taskForm, setTaskForm] = useState({
        title: '',
        description: '',
        link: '',
        reward: '',
        cooldown: '24',
        requiresVerification: false,
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        toast.loading('Creating sponsored task...', { id: 'task-create' });

        // Simulate API call
        setTimeout(() => {
            toast.success('Task created successfully!', { id: 'task-create' });
            setTaskForm({
                title: '',
                description: '',
                link: '',
                reward: '',
                cooldown: '24',
                requiresVerification: false,
            });
        }, 1500);
    };

    return (
        <div className="glass-card p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-400" />
                Create Sponsored Task
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Task Title</label>
                    <input
                        type="text"
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Follow us on Twitter"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                    <textarea
                        value={taskForm.description}
                        onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Follow our Twitter account and retweet our pinned post"
                        rows={3}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Task Link</label>
                        <input
                            type="url"
                            value={taskForm.link}
                            onChange={(e) => setTaskForm({ ...taskForm, link: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                            placeholder="https://twitter.com/..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Reward Points</label>
                        <input
                            type="number"
                            value={taskForm.reward}
                            onChange={(e) => setTaskForm({ ...taskForm, reward: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                            placeholder="100"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Cooldown (hours)</label>
                        <input
                            type="number"
                            value={taskForm.cooldown}
                            onChange={(e) => setTaskForm({ ...taskForm, cooldown: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:border-blue-500 focus:outline-none"
                            placeholder="24"
                            required
                        />
                    </div>

                    <div className="flex items-center">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={taskForm.requiresVerification}
                                onChange={(e) => setTaskForm({ ...taskForm, requiresVerification: e.target.checked })}
                                className="w-5 h-5 rounded border-white/10 bg-slate-900/50 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-slate-300">Requires Verification</span>
                        </label>
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full btn-primary bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 py-3 flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Create Task
                </button>
            </form>
        </div>
    );
}

// ==================== TAB 2: Raffle Monitor ====================
function RaffleMonitorTab({ rerollWinner }) {
    // Mock raffle data
    const [raffles] = useState([
        { id: 1, title: 'BAYC #1234', winner: '0x1234...5678', deadline: Date.now() - 1000, status: 'expired' },
        { id: 2, title: 'Azuki #9999', winner: '0xabcd...efgh', deadline: Date.now() + 3600000, status: 'active' },
    ]);

    const handleReroll = (raffleId) => {
        rerollWinner(raffleId);
    };

    return (
        <div className="glass-card p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-purple-400" />
                Active Raffles
            </h2>

            <div className="space-y-4">
                {raffles.map((raffle) => (
                    <div key={raffle.id} className="bg-slate-900/50 p-4 rounded-xl border border-white/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-white">{raffle.title}</h3>
                                <p className="text-sm text-slate-400">Winner: {raffle.winner}</p>
                                <p className="text-xs text-slate-500">
                                    Status: <span className={raffle.status === 'expired' ? 'text-red-400' : 'text-green-400'}>{raffle.status}</span>
                                </p>
                            </div>

                            {raffle.status === 'expired' && (
                                <button
                                    onClick={() => handleReroll(raffle.id)}
                                    className="px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-all flex items-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Reroll
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ==================== TAB 3: User Management ====================
function UserManagementTab() {
    // Mock user data
    const [users] = useState([
        { address: '0x1234...5678', points: 1250, tier: 3, tasks: 15 },
        { address: '0xabcd...efgh', points: 890, tier: 2, tasks: 10 },
        { address: '0x9876...4321', points: 450, tier: 1, tasks: 5 },
    ]);

    return (
        <div className="glass-card p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-400" />
                User Statistics
            </h2>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-slate-400 font-medium">Address</th>
                            <th className="text-left py-3 px-4 text-slate-400 font-medium">Points</th>
                            <th className="text-left py-3 px-4 text-slate-400 font-medium">Tier</th>
                            <th className="text-left py-3 px-4 text-slate-400 font-medium">Tasks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user, index) => (
                            <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-3 px-4 text-white font-mono">{user.address}</td>
                                <td className="py-3 px-4 text-blue-400 font-bold">{user.points}</td>
                                <td className="py-3 px-4 text-indigo-400">Level {user.tier}</td>
                                <td className="py-3 px-4 text-slate-300">{user.tasks}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ==================== TAB 4: Announcements (NEW) ====================
function AnnouncementsTab() {
    const [announcements, setAnnouncements] = useState([
        { id: 1, title: 'Platform Maintenance', message: 'Scheduled maintenance on Feb 5th', type: 'info', active: true },
        { id: 2, title: 'New Feature: Raffle Reroll', message: 'Winners now have 8 hours to claim prizes', type: 'success', active: true },
    ]);

    const [newAnnouncement, setNewAnnouncement] = useState({
        title: '',
        message: '',
        type: 'info',
    });

    const [editingId, setEditingId] = useState(null);

    const handleCreate = () => {
        if (!newAnnouncement.title || !newAnnouncement.message) {
            toast.error('Please fill in all fields');
            return;
        }

        const announcement = {
            id: Date.now(),
            ...newAnnouncement,
            active: true,
        };

        setAnnouncements([announcement, ...announcements]);
        setNewAnnouncement({ title: '', message: '', type: 'info' });
        toast.success('Announcement created!');
    };

    const handleDelete = (id) => {
        setAnnouncements(announcements.filter(a => a.id !== id));
        toast.success('Announcement deleted');
    };

    const handleToggle = (id) => {
        setAnnouncements(announcements.map(a =>
            a.id === id ? { ...a, active: !a.active } : a
        ));
    };

    const typeColors = {
        info: 'blue',
        success: 'green',
        warning: 'yellow',
        error: 'red',
    };

    return (
        <div className="space-y-6">
            {/* Create New Announcement */}
            <div className="glass-card p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-orange-400" />
                    Create Announcement
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                        <input
                            type="text"
                            value={newAnnouncement.title}
                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                            placeholder="Important Update"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
                        <textarea
                            value={newAnnouncement.message}
                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                            placeholder="Announcement details..."
                            rows={3}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                        <select
                            value={newAnnouncement.type}
                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:border-orange-500 focus:outline-none"
                        >
                            <option value="info">Info</option>
                            <option value="success">Success</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                        </select>
                    </div>

                    <button
                        onClick={handleCreate}
                        className="w-full btn-primary bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 py-3 flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Publish Announcement
                    </button>
                </div>
            </div>

            {/* Announcements List */}
            <div className="glass-card p-6">
                <h2 className="text-xl font-bold text-white mb-6">Active Announcements</h2>

                <div className="space-y-3">
                    {announcements.map((announcement) => (
                        <div
                            key={announcement.id}
                            className={`p-4 rounded-xl border ${announcement.active
                                    ? `border-${typeColors[announcement.type]}-500/30 bg-${typeColors[announcement.type]}-500/10`
                                    : 'border-white/10 bg-slate-900/30 opacity-50'
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-white">{announcement.title}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full bg-${typeColors[announcement.type]}-500/20 text-${typeColors[announcement.type]}-400`}>
                                            {announcement.type}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-300">{announcement.message}</p>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        onClick={() => handleToggle(announcement.id)}
                                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${announcement.active
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-slate-700 text-slate-400 border border-slate-600'
                                            }`}
                                    >
                                        {announcement.active ? 'Active' : 'Hidden'}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(announcement.id)}
                                        className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
