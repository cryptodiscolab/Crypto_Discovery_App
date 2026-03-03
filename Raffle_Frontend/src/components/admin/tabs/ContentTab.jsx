import React, { useState, useEffect } from 'react';
import { Database, Edit3, CheckCircle, Eye, EyeOff, Save, AlertTriangle } from 'lucide-react';
import { useCMS } from '../../../hooks/useCMS';
import toast from 'react-hot-toast';

export function ContentTab() {
    const { featureCards, announcement, updateFeatureCards, updateAnnouncement, refetchAll } = useCMS();
    const [isSaving, setIsSaving] = useState(false);
    const [cards, setCards] = useState([]);

    // Card Form State
    const [cardForm, setCardForm] = useState({
        id: Date.now(),
        title: '',
        description: '',
        icon: 'Shield',
        color: 'indigo',
        link: '/',
        linkText: 'Learn More',
        visible: true
    });
    const [editingCardId, setEditingCardId] = useState(null);

    useEffect(() => {
        if (featureCards && Array.isArray(featureCards)) {
            setCards(featureCards);
        }
    }, [featureCards]);

    const handleAddCard = () => {
        if (!cardForm.title || !cardForm.description) {
            toast.error("Title and Description are required");
            return;
        }

        if (editingCardId !== null) {
            setCards(cards.map(c => c.id === editingCardId ? { ...cardForm, id: editingCardId } : c));
            setEditingCardId(null);
            toast.success("Card updated in list");
        } else {
            setCards([...cards, { ...cardForm, id: Date.now() }]);
            toast.success("Card added to list");
        }

        setCardForm({
            id: Date.now(),
            title: '',
            description: '',
            icon: 'Shield',
            color: 'indigo',
            link: '/',
            linkText: 'Learn More',
            visible: true
        });
    };

    const handleEditCard = (card) => {
        setCardForm(card);
        setEditingCardId(card.id);
        window.scrollTo({ top: 400, behavior: 'smooth' });
    };

    const handleDeleteCard = (id) => {
        setCards(cards.filter(c => c.id !== id));
        toast.success("Card removed from list");
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        const tid = toast.loading("Saving feature cards to blockchain...");
        try {
            // Auto-JSON Generation
            const hash = await updateFeatureCards(cards);
            toast.success(
                `Feature Cards Updated! View on BaseScan: https://sepolia.basescan.org/tx/${hash}`,
                { id: tid, duration: 6000 }
            );
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Form Section */}
            <div className="glass-card p-8 bg-indigo-950/10 border border-indigo-500/10 rounded-2xl">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Database className="w-6 h-6 text-indigo-500" /> {editingCardId ? 'Edit Feature Card' : 'Add Feature Card'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                        <input
                            value={cardForm.title}
                            onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Icon (Lucide Name)</label>
                        <input
                            value={cardForm.icon}
                            onChange={(e) => setCardForm({ ...cardForm, icon: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                        <textarea
                            value={cardForm.description}
                            onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })}
                            rows={2}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Link Path</label>
                        <input
                            value={cardForm.link}
                            onChange={(e) => setCardForm({ ...cardForm, link: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Link Text</label>
                        <input
                            value={cardForm.linkText}
                            onChange={(e) => setCardForm({ ...cardForm, linkText: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Theme Color</label>
                        <select
                            value={cardForm.color}
                            onChange={(e) => setCardForm({ ...cardForm, color: e.target.value })}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white outline-none cursor-pointer"
                        >
                            <option value="indigo">Indigo</option>
                            <option value="purple">Purple</option>
                            <option value="blue">Blue</option>
                            <option value="emerald">Emerald</option>
                            <option value="yellow">Yellow</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setCardForm({ ...cardForm, visible: !cardForm.visible })}
                            className={`w-full p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${cardForm.visible ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-500'
                                }`}
                        >
                            {cardForm.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            {cardForm.visible ? 'Visible' : 'Hidden'}
                        </button>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleAddCard}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-white"
                    >
                        {editingCardId ? <CheckCircle className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                        {editingCardId ? 'Update Card' : 'Add to List'}
                    </button>
                    {editingCardId && (
                        <button
                            onClick={() => {
                                setEditingCardId(null);
                                setCardForm({ id: Date.now(), title: '', description: '', icon: 'Shield', color: 'indigo', link: '/', linkText: 'Learn More', visible: true });
                            }}
                            className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-bold transition-all"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* List Management Section */}
            <div className="glass-card p-8 bg-slate-900/40 rounded-2xl border border-white/5">
                <h3 className="text-xl font-bold text-white mb-6">Manage Feature Cards ({cards.length})</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cards.length === 0 ? (
                        <p className="col-span-2 text-slate-500 italic text-center py-4">No cards in list.</p>
                    ) : (
                        cards.map((card) => (
                            <div key={card.id} className="p-4 bg-slate-900 rounded-2xl border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-indigo-500/10`}>
                                        <Database className={`w-5 h-5 text-indigo-400`} />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm">{String(card.title || '')}</h4>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{card.visible ? 'Visible' : 'Hidden'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditCard(card)}
                                        className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-all"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCard(card.id)}
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
                    onClick={handleSaveAll}
                    disabled={isSaving}
                    className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 p-4 rounded-xl font-black shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 text-white"
                >
                    <Save className="w-5 h-5" />
                    {isSaving ? "Syncing to Blockchain..." : "Push All Cards to CMS"}
                </button>
            </div>
        </div>
    );
}
