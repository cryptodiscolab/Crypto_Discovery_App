import React, { useState, useEffect } from 'react';
import { Edit3, Eye, EyeOff, Save } from 'lucide-react';
import { useCMS } from '../../../hooks/useCMS';
import toast from 'react-hot-toast';

export function AnnouncementTab() {
    const { announcement, updateAnnouncement, showSuccessToast, refetchAll } = useCMS();
    const [isSaving, setIsSaving] = useState(false);
    const [editedAnnouncement, setEditedAnnouncement] = useState(announcement || {});

    useEffect(() => {
        if (announcement) setEditedAnnouncement(announcement);
    }, [announcement]);

    const handleSave = async () => {
        setIsSaving(true);
        const tid = toast.loading("Saving announcement to blockchain...");
        try {
            const hash = await updateAnnouncement(editedAnnouncement);
            showSuccessToast("Announcement Updated!", hash);
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
            <div className="glass-card p-8 bg-blue-950/10 border border-blue-500/10 rounded-2xl">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Edit3 className="w-6 h-6 text-blue-500" /> Announcement Editor
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                        <input
                            value={editedAnnouncement.title || ''}
                            onChange={(e) => setEditedAnnouncement({ ...editedAnnouncement, title: e.target.value })}
                            placeholder="Welcome to Disco Gacha!"
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-blue-500/50 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label>
                        <textarea
                            value={editedAnnouncement.message || ''}
                            onChange={(e) => setEditedAnnouncement({ ...editedAnnouncement, message: e.target.value })}
                            placeholder="Check out our new features..."
                            rows={3}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-blue-500/50 outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Type</label>
                            <select
                                value={editedAnnouncement.type || 'info'}
                                onChange={(e) => setEditedAnnouncement({ ...editedAnnouncement, type: e.target.value })}
                                className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-blue-500/50 outline-none cursor-pointer"
                            >
                                <option value="info">Info (Blue)</option>
                                <option value="warning">Warning (Yellow)</option>
                                <option value="success">Success (Green)</option>
                                <option value="error">Error (Red)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Visibility</label>
                            <button
                                onClick={() => setEditedAnnouncement({ ...editedAnnouncement, visible: !editedAnnouncement.visible })}
                                className={`w-full p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${editedAnnouncement.visible
                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                                    }`}
                            >
                                {editedAnnouncement.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                {editedAnnouncement.visible ? 'Visible' : 'Hidden'}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-xl font-bold shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-2"
                    >
                        <Save className="w-5 h-5" />
                        {isSaving ? "Saving to Blockchain..." : "Save Announcement"}
                    </button>
                </div>
            </div>
        </div>
    );
}
