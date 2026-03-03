import React, { useState, useEffect } from 'react';
import { Newspaper, Edit3, CheckCircle, AlertTriangle, Save } from 'lucide-react';
import { useCMS } from '../../../hooks/useCMS';
import toast from 'react-hot-toast';

export function NewsTab() {
    const { news, updateNews, showSuccessToast, refetchAll } = useCMS();
    const [isSaving, setIsSaving] = useState(false);
    const [newsItems, setNewsItems] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        id: Date.now(),
        title: '',
        message: '',
        date: new Date().toISOString().split('T')[0],
        type: 'info'
    });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        if (news && Array.isArray(news)) {
            setNewsItems(news);
        }
    }, [news]);

    const handleAddItem = () => {
        if (!formData.title || !formData.message) {
            toast.error("Title and Message are required");
            return;
        }

        if (editingId !== null) {
            setNewsItems(newsItems.map(item => item.id === editingId ? { ...formData, id: editingId } : item));
            setEditingId(null);
            toast.success("Item updated in list");
        } else {
            setNewsItems([...newsItems, { ...formData, id: Date.now() }]);
            toast.success("Item added to list");
        }

        // Reset local form
        setFormData({
            id: Date.now(),
            title: '',
            message: '',
            date: new Date().toISOString().split('T')[0],
            type: 'info'
        });
    };

    const handleEditItem = (item) => {
        setFormData(item);
        setEditingId(item.id);
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    const handleDeleteItem = (id) => {
        setNewsItems(newsItems.filter(item => item.id !== id));
        toast.success("Item removed from list");
    };

    const handleSave = async () => {
        if (newsItems.length === 0) {
            if (!window.confirm("Save empty news list?")) return;
        }

        setIsSaving(true);
        const tid = toast.loading("Saving news to blockchain...");
        try {
            // Auto-JSON Generation
            const hash = await updateNews(newsItems);
            showSuccessToast("News Updated!", hash);
            toast.dismiss(tid);
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Form Section */}
            <div className="glass-card p-8 bg-green-950/10 border border-green-500/10 rounded-2xl">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Newspaper className="w-6 h-6 text-green-500" /> {editingId ? 'Edit News Item' : 'Add News Item'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                        <input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., Massive Airdrop Coming!"
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-green-500/50 outline-none transition-all"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label>
                        <textarea
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            placeholder="Detail message..."
                            rows={3}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-green-500/50 outline-none transition-all resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-green-500/50 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-green-500/50 outline-none cursor-pointer"
                        >
                            <option value="info">Info</option>
                            <option value="success">Success</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleAddItem}
                        className="flex-1 bg-green-600 hover:bg-green-500 p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                        {editingId ? <CheckCircle className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                        {editingId ? 'Update Item' : 'Add to List'}
                    </button>
                    {editingId && (
                        <button
                            onClick={() => {
                                setEditingId(null);
                                setFormData({ id: Date.now(), title: '', message: '', date: new Date().toISOString().split('T')[0], type: 'info' });
                            }}
                            className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-bold transition-all"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* List Management Section */}
            <div className="glass-card p-8 bg-slate-900/40 rounded-2xl">
                <h3 className="text-xl font-bold text-white mb-6">Manage News List ({newsItems.length})</h3>

                <div className="space-y-3">
                    {newsItems.length === 0 ? (
                        <p className="text-slate-500 italic text-center py-4">No news items in list.</p>
                    ) : (
                        newsItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-white/5">
                                <div className="flex-1 min-w-0 pr-4">
                                    <h4 className="text-white font-bold truncate">{item.title}</h4>
                                    <p className="text-slate-500 text-xs flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${item.type === 'info' ? 'bg-blue-500' :
                                            item.type === 'success' ? 'bg-green-500' :
                                                item.type === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                            }`} />
                                        {item.date} • {item.type}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditItem(item)}
                                        className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-xl font-black shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                >
                    <Save className="w-5 h-5" />
                    {isSaving ? "Syncing to Blockchain..." : "Push Entire List to CMS"}
                </button>
            </div>
        </div>
    );
}
