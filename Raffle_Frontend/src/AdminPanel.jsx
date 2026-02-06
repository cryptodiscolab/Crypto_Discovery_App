import React, { useState, useEffect } from 'react';
import { supabase } from './dailyAppLogic';
import {
    Database,
    Settings,
    TrendingUp,
    Save,
    RefreshCw,
    ShieldCheck,
    ChevronRight,
    Info
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Objective 3: Admin Panel Component
 * Digunakan untuk mengatur Point Settings dan SBT Thresholds secara dinamis.
 */
export default function AdminPanel() {
    const [pointSettings, setPointSettings] = useState([]);
    const [sbtThresholds, setSbtThresholds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 1. Ambil data dari Supabase saat komponen dibuka
    const fetchData = async () => {
        setLoading(true);
        try {
            const [pointsRes, thresholdsRes] = await Promise.all([
                supabase.from('point_settings').select('*').order('activity_key'),
                supabase.from('sbt_thresholds').select('*').order('level')
            ]);

            if (pointsRes.error) throw pointsRes.error;
            if (thresholdsRes.error) throw thresholdsRes.error;

            setPointSettings(pointsRes.data);
            setSbtThresholds(thresholdsRes.data);
        } catch (error) {
            console.error('Fetch Error:', error);
            toast.error('Gagal mengambil data dari Supabase');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // 2. Handler untuk update state lokal (Point Settings)
    const handlePointChange = (id, newValue) => {
        setPointSettings(prev =>
            prev.map(item => item.id === id ? { ...item, points_value: parseInt(newValue) } : item)
        );
    };

    // 3. Handler untuk update state lokal (SBT Thresholds)
    const handleThresholdChange = (level, field, newValue) => {
        setSbtThresholds(prev =>
            prev.map(item => item.level === level ? {
                ...item,
                [field]: field === 'min_xp' ? parseInt(newValue) : newValue
            } : item)
        );
    };

    // 4. Simpan perubahan Point Settings ke Supabase
    const savePoints = async () => {
        setSaving(true);
        try {
            const { error } = await supabase.from('point_settings').upsert(pointSettings);
            if (error) throw error;
            toast.success('Point Settings berhasil diupdate!');
        } catch (error) {
            toast.error('Gagal menyimpan poin: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // 5. Simpan perubahan SBT Thresholds ke Supabase
    const saveThresholds = async () => {
        setSaving(true);
        try {
            const { error } = await supabase.from('sbt_thresholds').upsert(sbtThresholds);
            if (error) throw error;
            toast.success('Pacing Level berhasil diupdate!');
        } catch (error) {
            toast.error('Gagal menyimpan level: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 bg-black/20 backdrop-blur-md rounded-3xl border border-white/5 shadow-2xl">
            {/* Header Section */}
            <div className="flex items-center justify-between border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                        <ShieldCheck className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Admin Control Center</h1>
                        <p className="text-slate-400 text-sm">Manage configuration & pacing logic</p>
                    </div>
                </div>
                <button
                    onClick={fetchData}
                    className="p-2 hover:bg-white/5 rounded-full transition-all text-slate-400 hover:text-white"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 📋 SECTION 1: POINT SETTINGS */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Settings className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-bold text-white">Point Settings</h2>
                    </div>
                    <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                <tr>
                                    <th className="px-4 py-3">Activity</th>
                                    <th className="px-4 py-3">Points</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {pointSettings.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/[0.02] transition-all">
                                        <td className="px-4 py-4 text-sm font-medium text-slate-300 capitalize">
                                            {item.activity_key.replace('_', ' ')}
                                        </td>
                                        <td className="px-4 py-4">
                                            <input
                                                type="number"
                                                value={item.points_value}
                                                onChange={(e) => handlePointChange(item.id, e.target.value)}
                                                className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        onClick={savePoints}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Points'}
                    </button>
                </div>

                {/* 🚀 SECTION 2: SBT THRESHOLDS */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        <h2 className="text-lg font-bold text-white">SBT Thresholds</h2>
                    </div>
                    <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                <tr>
                                    <th className="px-4 py-3">Lvl</th>
                                    <th className="px-4 py-3">Min XP</th>
                                    <th className="px-4 py-3">Name</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sbtThresholds.map((item) => (
                                    <tr key={item.level} className="hover:bg-white/[0.02] transition-all">
                                        <td className="px-4 py-4 text-sm font-black text-emerald-400">
                                            {item.level}
                                        </td>
                                        <td className="px-4 py-4">
                                            <input
                                                type="number"
                                                value={item.min_xp}
                                                onChange={(e) => handleThresholdChange(item.level, 'min_xp', e.target.value)}
                                                className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-emerald-500 font-mono text-sm"
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <input
                                                type="text"
                                                value={item.level_name}
                                                onChange={(e) => handleThresholdChange(item.level, 'level_name', e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white focus:outline-none focus:border-emerald-500 text-sm"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        onClick={saveThresholds}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Thresholds'}
                    </button>
                </div>
            </div>

            {/* ⚠️ Footer Info */}
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-200/70 leading-relaxed">
                    <strong>Perhatian:</strong> Perubahan angka di sini akan langsung berdampak pada seluruh user.
                    Pastikan <strong>Min XP</strong> untuk level tinggi tidak lebih kecil dari level rendah supaya logic leveling tetap akurat.
                </p>
            </div>
        </div>
    );
}
