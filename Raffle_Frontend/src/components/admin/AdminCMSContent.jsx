import React, { useState, useEffect } from 'react';
import { Database, Eye, EyeOff, CheckCircle, Edit3, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import { useCMS } from '../../hooks/useCMS';
import toast from 'react-hot-toast';

export default function AdminCMSContent() {
    const { featureCards, updateFeatureCards, refetchAll } = useCMS();
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteCard = (id) => {
        if (!window.confirm("Remove this card?")) return;
        setCards(cards.filter(c => c.id !== id));
        toast.success("Card removed from list");
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        const tid = toast.loading("Saving feature cards to blockchain...");
        try {
            const hash = await updateFeatureCards(cards);
            toast.success(
                `Feature Cards Updated! View on BaseScan`,
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Form Section */}
            <div className="bg-[#121214] border border-white/5 p-6 rounded-2xl">
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-500" />
                    {editingCardId ? 'Edit Feature Card' : 'Add Feature Card'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
                        <input
                            value={cardForm.title}
                            onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Icon (Lucide Name)</label>
                        <input
                            value={cardForm.icon}
                            onChange={(e) => setCardForm({ ...cardForm, icon: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</label>
                        <textarea
                            value={cardForm.description}
                            onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })}
                            rows={2}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm focus:border-indigo-500/50 outline-none resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Link Path</label>
                        <input
                            value={cardForm.link}
                            onChange={(e) => setCardForm({ ...cardForm, link: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Link Text</label>
                        <input
                            value={cardForm.linkText}
                            onChange={(e) => setCardForm({ ...cardForm, linkText: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Theme Color</label>
                        <select
                            value={cardForm.color}
                            onChange={(e) => setCardForm({ ...cardForm, color: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm"
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
                            className={`w-full p-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-all ${cardForm.visible ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-[#0a0a0c] text-slate-500 border border-white/5'
                                }`}
                        >
                            {cardForm.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            {cardForm.visible ? 'VISIBLE' : 'HIDDEN'}
                        </button>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleAddCard}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 p-4 rounded-xl font-black text-white text-xs tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20 active:scale-95"
                    >
                        {editingCardId ? <CheckCircle className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        {editingCardId ? 'UPDATE CARD' : 'ADD TO LIST'}
                    </button>
                    {editingCardId && (
                        <button
                            onClick={() => {
                                setEditingCardId(null);
                                setCardForm({ id: Date.now(), title: '', description: '', icon: 'Shield', color: 'indigo', link: '/', linkText: 'Learn More', visible: true });
                            }}
                            className="px-6 bg-[#0a0a0c] hover:bg-white/5 border border-white/5 text-slate-500 rounded-xl font-bold text-xs"
                        >
                            CANCEL
                        </button>
                    )}
                </div>
            </div>

            {/* List Management Section */}
            <div className="bg-[#121214] border border-white/5 p-6 rounded-2xl">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-6">Manage Feature Cards ({cards.length})</h3>

                <div className="grid grid-cols-1 gap-3">
                    {cards.length === 0 ? (
                        <p className="text-slate-700 italic text-[10px] font-black uppercase text-center py-4 tracking-widest">No cards in list.</p>
                    ) : (
                        cards.map((card) => (
                            <div key={card.id} className="p-4 bg-[#0a0a0c] rounded-2xl border border-white/5 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-${card.color}-500/10`}>
                                        <Database className={`w-4 h-4 text-${card.color}-400`} />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-black text-[11px] uppercase tracking-tighter">{String(card.title || '')}</h4>
                                        <p className={`text-[8px] font-black uppercase tracking-widest ${card.visible ? 'text-green-500/50' : 'text-red-500/50'}`}>
                                            {card.visible ? 'Active' : 'Hidden'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEditCard(card)}
                                        className="p-2 bg-[#121214] hover:bg-indigo-600/20 text-slate-600 hover:text-indigo-400 rounded-lg transition-all border border-white/5"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCard(card.id)}
                                        className="p-2 bg-[#121214] hover:bg-red-600/20 text-slate-600 hover:text-red-500 rounded-lg transition-all border border-white/5"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-white/5">
                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 disabled:text-slate-700 p-4 rounded-xl font-black text-white text-[10px] tracking-widest shadow-xl shadow-emerald-500/10 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? "SYNCING TO BLOCKCHAIN..." : "PUSH ALL CARDS TO CMS"}
                    </button>
                    <p className="mt-3 text-[8px] text-slate-700 font-black uppercase tracking-widest text-center">
                        Warning: This updates on-chain data for all users.
                    </p>
                </div>
            </div>
        </div>
    );
}
