import { TrendingUp, Trash2, ImageIcon, Info } from 'lucide-react';

interface SbtThreshold {
    id: string;
    level: number;
    min_xp: number;
    tier_name: string;
    badge_url: string;
}

interface SbtThresholdsSectionProps {
    thresholds: SbtThreshold[];
    onAddLevel: () => void;
    onRemoveLevel: (_id: string) => void;
    onChange: (_id: string, _field: string, _value: string | number) => void;
    onSave: () => void;
    saving: boolean;
}

const normalizePinataIpfsValue = (value: string): string => {
    const raw = value.trim();
    if (!raw) return '';

    if (raw.startsWith('ipfs://')) {
        return raw;
    }

    const ipfsMatch = raw.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/i);
    if (ipfsMatch?.[1]) {
        return `ipfs://${ipfsMatch[1]}`;
    }

    return raw;
};

const resolvePinataPreviewUrl = (value: string): string => {
    const normalized = normalizePinataIpfsValue(value);
    if (!normalized) return '';

    if (normalized.startsWith('ipfs://')) {
        const cid = normalized.replace('ipfs://', '').replace(/^ipfs\//, '');
        return `https://gateway.pinata.cloud/ipfs/${cid}`;
    }

    return normalized;
};

export function SbtThresholdsSection({ thresholds, onAddLevel, onRemoveLevel, onChange, onSave, saving }: SbtThresholdsSectionProps) {
    return (
        <div className="space-y-4 max-w-[100vw] overflow-x-hidden">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-md font-black text-white uppercase tracking-[0.2em]">Dynamic SBT Levels</h2>
                </div>
                <button onClick={onAddLevel} className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 px-3 py-1.5 rounded-lg label-native transition-all">
                    Add Level
                </button>
            </div>
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                    <div className="space-y-1">
                        <p className="label-native text-indigo-300 mb-0">Pinata IPFS Format</p>
                        <p className="text-[11px] font-medium leading-relaxed text-slate-300">
                            Isi <span className="font-black text-white">badge_url</span> dengan format
                            <span className="mx-1 font-black text-indigo-300">ipfs://CID</span>
                            atau URL Pinata/IPFS. Saat disimpan, preview akan menggunakan Pinata gateway.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {thresholds.map((item) => {
                    const previewUrl = resolvePinataPreviewUrl(item.badge_url);
                    const normalizedBadgeUrl = normalizePinataIpfsValue(item.badge_url);

                    return (
                        <div key={item.id} className="rounded-2xl border border-white/5 bg-[#121214] p-4">
                            <div className="grid gap-4 lg:grid-cols-[80px_120px_minmax(0,1fr)_minmax(0,1.5fr)_auto]">
                                <div>
                                    <p className="label-native text-slate-500 mb-2">Lvl</p>
                                    <input
                                        type="number"
                                        value={item.level}
                                        onChange={(e) => onChange(item.id, 'level', Number(e.target.value))}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-indigo-400 font-black value-native"
                                    />
                                </div>

                                <div>
                                    <p className="label-native text-slate-500 mb-2">Min XP</p>
                                    <input
                                        type="number"
                                        value={item.min_xp}
                                        onChange={(e) => onChange(item.id, 'min_xp', Number(e.target.value))}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono value-native"
                                    />
                                </div>

                                <div>
                                    <p className="label-native text-slate-500 mb-2">Tier Name</p>
                                    <input
                                        type="text"
                                        value={item.tier_name}
                                        onChange={(e) => onChange(item.id, 'tier_name', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 value-native"
                                        placeholder="Tier Name"
                                    />
                                </div>

                                <div>
                                    <p className="label-native text-slate-500 mb-2">Badge URL (IPFS / Pinata)</p>
                                    <input
                                        type="text"
                                        value={normalizedBadgeUrl}
                                        onChange={(e) => onChange(item.id, 'badge_url', normalizePinataIpfsValue(e.target.value))}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-200 value-native"
                                        placeholder="ipfs://bafy.../badge.png"
                                    />
                                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 break-all">
                                        Stored as: {normalizedBadgeUrl || 'EMPTY'}
                                    </p>
                                </div>

                                <div className="flex items-start justify-end">
                                    <button onClick={() => onRemoveLevel(item.id)} className="mt-7 text-red-500/50 hover:text-red-500 p-2 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-white/5 bg-black/20 p-3">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                                    {previewUrl ? (
                                        <img
                                            src={previewUrl}
                                            alt={`${item.tier_name || 'Tier'} preview`}
                                            className="h-full w-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <ImageIcon className="h-5 w-5 text-slate-600" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="label-native text-slate-400 mb-1">Pinata Preview</p>
                                    <p className="text-[11px] font-medium leading-relaxed text-slate-300 break-all">
                                        {previewUrl || 'Badge preview akan muncul di sini setelah URL IPFS/Pinata diisi.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button onClick={onSave} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-3 rounded-xl label-native transition-all shadow-lg active:scale-[0.98] disabled:opacity-30">
                {saving ? 'SAVING...' : 'SYNC SBT THRESHOLDS (OFF-CHAIN)'}
            </button>
        </div>
    );
}
