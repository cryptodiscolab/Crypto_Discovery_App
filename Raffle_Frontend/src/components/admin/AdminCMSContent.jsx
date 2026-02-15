import React, { useState, useEffect } from 'react';
import { Database, Eye, EyeOff, CheckCircle, Edit3, AlertTriangle, Save, RefreshCw, XCircle } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useCMS } from '../../hooks/useCMS';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';
import { Upload, ImageIcon, Trash2 } from 'lucide-react';

export default function AdminCMSContent() {
    const { featureCards, updateFeatureCards, refetchAll } = useCMS();
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [cards, setCards] = useState([]);

    const emptyForm = {
        id: Date.now(),
        title: '',
        description: '',
        icon: 'Shield',
        color: 'indigo',
        link: '/',
        linkText: 'Learn More',
        visible: true
    };

    // Card Form State
    const [cardForm, setCardForm] = useState(emptyForm);
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

        setCardForm({ ...emptyForm, id: Date.now() });
    };

    const handleEditCard = (card) => {
        setCardForm(card);
        setEditingCardId(card.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClearForm = () => {
        setCardForm({ ...emptyForm, id: Date.now() });
        setEditingCardId(null);
        toast.success("Form cleared");
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

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error("Format file tidak didukung! (Gunakan JPG, PNG, atau WEBP)");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error("File terlalu besar! Maksimal 2MB.");
            return;
        }

        setIsUploading(true);
        const toastId = toast.loading("Uploading image...");

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `cms/feature-cards/${fileName}`;

            // Upload to Supabase Storage (Assumes 'assets' bucket exists)
            const { data, error: uploadError } = await supabase.storage
                .from('assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('assets')
                .getPublicUrl(filePath);

            setCardForm(prev => ({ ...prev, icon: publicUrl }));
            toast.success("Image uploaded successfully!", { id: toastId });
        } catch (err) {
            console.error('[Upload Error]', err);
            toast.error("Upload failed: " + err.message, { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };

    // Helper to render icon preview
    const renderIconPreview = (iconName) => {
        if (iconName && iconName.startsWith('http')) {
            return (
                <div className="w-5 h-5 rounded overflow-hidden">
                    <img src={iconName} alt="Preview" className="w-full h-full object-cover" />
                </div>
            );
        }
        const IconComponent = Icons[iconName] || Icons.HelpCircle;
        return <IconComponent className="w-5 h-5 text-indigo-400" />;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Form Section */}
            <div className="bg-[#121214] border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Database className="w-4 h-4 text-indigo-500" />
                        {editingCardId ? 'Edit Feature Card' : 'Add Feature Card'}
                    </h3>
                    {(editingCardId || cardForm.title || cardForm.description) && (
                        <button
                            onClick={handleClearForm}
                            className="text-[8px] font-black text-slate-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                        >
                            <XCircle className="w-3 h-3" /> Clear Form
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Title</label>
                        <input
                            value={cardForm.title}
                            onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm focus:border-indigo-500/50 outline-none"
                            placeholder="e.g. Hot Campaign"
                        />
                    </div>
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Card Icon
                            <span className="text-[7px] text-slate-600 ml-2">(Max 2MB | JPG, PNG, WEBP)</span>
                        </label>
                        <div className="space-y-3">
                            {/* Icon Name Input */}
                            <div className="relative">
                                <input
                                    value={cardForm.icon && cardForm.icon.startsWith('http') ? 'Custom Image Uploaded' : cardForm.icon}
                                    onChange={(e) => setCardForm({ ...cardForm, icon: e.target.value })}
                                    className="w-full bg-[#0a0a0c] border border-white/5 p-3 pl-12 rounded-xl text-white text-sm focus:border-indigo-500/50 outline-none"
                                    placeholder="Enter Lucide name (e.g. Shield) or upload below"
                                    disabled={cardForm.icon && cardForm.icon.startsWith('http')}
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                    {renderIconPreview(cardForm.icon)}
                                </div>
                            </div>

                            {/* Image Upload Button */}
                            <div className="flex gap-2">
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${isUploading ? 'bg-slate-900 border-slate-800 text-slate-700 pointer-events-none' : 'bg-[#0a0a0c] border-white/10 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400'}`}>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleImageUpload}
                                        disabled={isUploading}
                                    />
                                    {isUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                    {isUploading ? 'Uploading...' : 'Upload Image'}
                                </label>
                                {cardForm.icon && cardForm.icon.startsWith('http') && (
                                    <button
                                        onClick={() => setCardForm({ ...cardForm, icon: 'Shield' })}
                                        className="p-3 bg-red-600/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-600/20 transition-all"
                                        title="Remove Image"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</label>
                        <textarea
                            value={cardForm.description}
                            onChange={(e) => setCardForm({ ...cardForm, description: e.target.value })}
                            rows={2}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm focus:border-indigo-500/50 outline-none resize-none"
                            placeholder="Brief target audience motivation..."
                        />
                    </div>
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Target URL <span className="text-[7px] text-slate-600 ml-2">(Internal: /tasks | External: https://...)</span>
                        </label>
                        <input
                            value={cardForm.link}
                            onChange={(e) => setCardForm({ ...cardForm, link: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Button Label</label>
                        <input
                            value={cardForm.linkText}
                            onChange={(e) => setCardForm({ ...cardForm, linkText: e.target.value })}
                            className="w-full bg-[#0a0a0c] border border-white/5 p-3 rounded-xl text-white text-sm focus:border-indigo-500/50 outline-none"
                            placeholder="e.g. Learn More"
                        />
                    </div>
                    <div>
                        <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Theme Color</label>
                        <div className="flex flex-wrap gap-2 p-3 bg-[#0a0a0c] border border-white/5 rounded-xl">
                            {['indigo', 'purple', 'blue', 'emerald', 'yellow', 'pink', 'red'].map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setCardForm({ ...cardForm, color })}
                                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${color === 'indigo' ? 'bg-indigo-500' :
                                        color === 'purple' ? 'bg-purple-500' :
                                            color === 'blue' ? 'bg-blue-500' :
                                                color === 'emerald' ? 'bg-emerald-500' :
                                                    color === 'yellow' ? 'bg-yellow-500' :
                                                        color === 'pink' ? 'bg-pink-500' :
                                                            'bg-red-500'
                                        } ${cardForm.color === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:border-white/20'
                                        }`}
                                    title={color.charAt(0).toUpperCase() + color.slice(1)}
                                >
                                    {cardForm.color === color && <Icons.Check className="w-4 h-4 text-white" />}
                                </button>
                            ))}
                        </div>
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
                                        {renderIconPreview(card.icon)}
                                    </div>
                                    <div className="max-w-[150px] overflow-hidden">
                                        <h4 className="text-white font-black text-[11px] uppercase tracking-tighter truncate">{String(card.title || '')}</h4>
                                        <p className={`text-[8px] font-black uppercase tracking-widest ${card.visible ? 'text-green-500/51' : 'text-red-500/50'}`}>
                                            {card.visible ? 'Active' : 'Hidden'} • {card.link.startsWith('http') ? 'External' : 'Internal'}
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
