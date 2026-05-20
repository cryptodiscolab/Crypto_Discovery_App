import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useCMS } from '../../../hooks/useCMS';
import { FEATURE_IDS, FEATURE_NAMES } from '../../../shared/constants/cmsFeatures';
import { supabase } from '../../../lib/supabaseClient';
import toast from 'react-hot-toast';
import { isAddress } from 'viem';
import { AlertCircle, CheckCircle, RefreshCw, Shield, UserPlus } from 'lucide-react';

interface WhitelistedUser {
    address: string;
    featureId: string;
    featureName: string;
}

export function WhitelistManagerTab() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { grantPrivilege, revokePrivilege, batchGrantPrivileges, showSuccessToast, refetchAll } = useCMS();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Single grant state
    const [userAddress, setUserAddress] = useState('');
    const [selectedFeature, setSelectedFeature] = useState(FEATURE_IDS.DAILY_CLAIM);

    // Batch grant state
    const [batchAddresses, setBatchAddresses] = useState('');
    const [batchFeature, setBatchFeature] = useState(FEATURE_IDS.DAILY_CLAIM);

    // Whitelisted users (fetched from database)
    const [whitelistedUsers, setWhitelistedUsers] = useState<WhitelistedUser[]>([]);

    // 1. Fetch Existing Whitelist from DB
    useEffect(() => {
        const fetchWhitelist = async () => {
            try {
                const { data, error } = await supabase
                    .from('user_privileges')
                    .select('*')
                    .order('granted_at', { ascending: false });

                if (error) {
                    console.warn('[FetchWhitelist] Table might not exist:', error.message);
                    return;
                }

                if (data) {
                    setWhitelistedUsers(data.map((u: { wallet_address: string; feature_id: string }) => ({
                        address: u.wallet_address,
                        featureId: u.feature_id,
                        featureName: FEATURE_NAMES[u.feature_id] || u.feature_id
                    })));
                }
            } catch (err) {
                console.error('[FetchWhitelist Error]', err);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchWhitelist();
    }, []);

    if (isLoadingData) {
        return (
            <div className="py-20 flex flex-col items-center gap-4">
                <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="label-native text-slate-500">Loading Whitelist...</p>
            </div>
        );
    }

    const handleGrantPrivilege = async () => {
        if (!isAddress(userAddress)) {
            toast.error("Invalid wallet address");
            return;
        }

        setIsSaving(true);
        const tid = toast.loading("Granting privilege on blockchain...");

        try {
            const hash = await grantPrivilege(userAddress, selectedFeature);
            showSuccessToast("Privilege Granted on Blockchain!", hash);

            // 2. Database Sync
            toast.loading("Syncing privilege to database...", { id: tid });
            const timestamp = new Date().toISOString();
            const message = `Grant Privilege\nTarget: ${userAddress.toLowerCase()}\nFeature: ${selectedFeature}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'GRANT_PRIVILEGE',
                    payload: { target_address: userAddress, feature_id: selectedFeature }
                })
            });

            if (!response.ok) {
                toast.error('Blockchain succeeded but DB sync failed. Please retry.');
            }

            toast.success("Privilege Granted & Synced!", { id: tid });

            // Add to local list
            setWhitelistedUsers([{
                address: userAddress,
                featureId: selectedFeature,
                featureName: FEATURE_NAMES[selectedFeature] || selectedFeature
            }, ...whitelistedUsers]);

            setUserAddress('');
            refetchAll();
        } catch (e: unknown) {
            console.error(e);
            const err = e as { shortMessage?: string; message?: string };
            toast.error(err.shortMessage || err.message || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleBatchGrant = async () => {
        const addresses = batchAddresses.split('\n').map(a => a.trim()).filter(a => a);

        if (addresses.length === 0) {
            toast.error("Please enter at least one address");
            return;
        }

        // Validate all addresses
        for (const addr of addresses) {
            if (!isAddress(addr)) {
                toast.error(`Invalid address: ${addr}`);
                return;
            }
        }

        setIsSaving(true);
        const tid = toast.loading(`Granting privileges to ${addresses.length} users...`);

        try {
            const featureIds = addresses.map(() => batchFeature);
            const hash = await batchGrantPrivileges(addresses, featureIds);
            showSuccessToast(`${addresses.length} Privileges Granted on Blockchain!`, hash);

            // 2. Database Sync
            toast.loading("Syncing batch to database...", { id: tid });
            const timestamp = new Date().toISOString();
            const message = `Batch Grant Privilege\nCount: ${addresses.length}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'BATCH_GRANT_PRIVILEGE',
                    payload: { target_addresses: addresses, feature_id: batchFeature }
                })
            });

            if (!response.ok) {
                toast.error('Blockchain succeeded but DB sync failed. Please retry.');
            }

            toast.success("Batch Privileges Granted & Synced!", { id: tid });

            // Add to local list
            const newUsers = addresses.map(addr => ({
                address: addr,
                featureId: batchFeature,
                featureName: FEATURE_NAMES[batchFeature] || batchFeature
            }));
            setWhitelistedUsers([...newUsers, ...whitelistedUsers]);

            setBatchAddresses('');
            refetchAll();
        } catch (e: unknown) {
            console.error(e);
            const err = e as { shortMessage?: string; message?: string };
            toast.error(err.shortMessage || err.message || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRevoke = async (userAddr: string, featureId: string) => {
        setIsSaving(true);
        const tid = toast.loading("Revoking privilege...");

        try {
            const hash = await revokePrivilege(userAddr, featureId);
            showSuccessToast("Privilege Revoked on Blockchain!", hash);

            // 2. Database Sync
            toast.loading("Syncing revocation to database...", { id: tid });
            const timestamp = new Date().toISOString();
            const message = `Revoke Privilege\nTarget: ${userAddr.toLowerCase()}\nFeature: ${featureId}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'REVOKE_PRIVILEGE',
                    payload: { target_address: userAddr, feature_id: featureId }
                })
            });

            if (!response.ok) {
                toast.error('Blockchain succeeded but DB sync failed. Please retry.');
            }

            toast.success("Privilege Revoked & Synced!", { id: tid });

            // Remove from local list
            setWhitelistedUsers(whitelistedUsers.filter(
                u => !(u.address?.toLowerCase() === userAddr?.toLowerCase() && u.featureId === featureId)
            ));

            refetchAll();
        } catch (e: unknown) {
            console.error(e);
            const err = e as { shortMessage?: string; message?: string };
            toast.error(err.shortMessage || err.message || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 text-left">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-indigo-400" />
                <div>
                    <h2 className="text-md font-black uppercase tracking-[0.2em] leading-none text-white">Sponsored Access Whitelist</h2>
                    <p className="label-native text-slate-500 mt-2">Grant free access to premium features for specific users</p>
                </div>
            </div>

            {/* Single Grant */}
            <div className="glass-card p-6 bg-[#121214] border border-white/5 rounded-3xl">
                <h3 className="label-native text-white mb-4 flex items-center gap-2">
                    Grant Single Privilege
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block label-native text-slate-500 mb-2">
                            Wallet Address
                        </label>
                        <input
                            type="text"
                            value={userAddress}
                            onChange={(e) => setUserAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all font-mono value-native"
                        />
                    </div>

                    <div>
                        <label className="block label-native text-slate-500 mb-2">
                            Feature Access
                        </label>
                        <select
                            value={selectedFeature}
                            onChange={(e) => setSelectedFeature(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none cursor-pointer label-native"
                        >
                            {Object.entries(FEATURE_IDS).map(([_key, id]) => (
                                <option key={id} value={id}>{FEATURE_NAMES[id]}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleGrantPrivilege}
                    disabled={isSaving || !userAddress}
                    className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 disabled:bg-slate-800/20 disabled:border-slate-800/30 disabled:text-slate-600 p-3 rounded-xl label-native transition-all"
                >
                    {isSaving ? "Granting..." : "Grant Privilege"}
                </button>
            </div>

            {/* Batch Grant */}
            <div className="glass-card p-6 bg-[#121214] border border-white/5 rounded-3xl">
                <h3 className="label-native text-white mb-4 flex items-center gap-2">
                    Batch Grant (Gas Saver)
                </h3>

                <div className="mb-4">
                    <label className="block label-native text-slate-500 mb-2">
                        Wallet Addresses (one per line)
                    </label>
                    <textarea
                        value={batchAddresses}
                        onChange={(e) => setBatchAddresses(e.target.value)}
                        placeholder="0x...\n0x...\n0x..."
                        rows={5}
                        className="w-full bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all font-mono value-native resize-none"
                    />
                    <p className="label-native text-slate-600 mt-2">
                        💡 Batch grant saves ~68% gas vs individual grants
                    </p>
                </div>

                <div className="mb-4">
                    <label className="block label-native text-slate-500 mb-2">
                        Feature Access (applies to all)
                    </label>
                    <select
                        value={batchFeature}
                        onChange={(e) => setBatchFeature(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none cursor-pointer label-native"
                    >
                        {Object.entries(FEATURE_IDS).map(([_key, id]) => (
                            <option key={id} value={id}>{FEATURE_NAMES[id]}</option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleBatchGrant}
                    disabled={isSaving || !batchAddresses}
                    className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 disabled:bg-slate-800/20 disabled:border-slate-800/30 disabled:text-slate-600 p-3 rounded-xl label-native transition-all"
                >
                    {isSaving ? "Granting..." : `Grant to ${batchAddresses.split('\n').filter(a => a.trim()).length} Users`}
                </button>
            </div>

            {/* Whitelisted Users Table */}
            <div className="glass-card p-6 bg-[#121214] border border-white/5 rounded-3xl overflow-x-hidden w-full max-w-[100vw]">
                <h3 className="label-native text-white mb-4">Whitelisted Users</h3>

                {whitelistedUsers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="label-native text-slate-600">No whitelisted users yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto w-full max-w-full">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left py-3 px-4 label-native text-slate-400">
                                        Address
                                    </th>
                                    <th className="text-left py-3 px-4 label-native text-slate-400">
                                        Feature
                                    </th>
                                    <th className="text-right py-3 px-4 label-native text-slate-400">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {whitelistedUsers.map((user, index) => (
                                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-4">
                                            <code className="value-native text-slate-300 font-mono">
                                                {user.address.slice(0, 6)}...{user.address.slice(-4)}
                                            </code>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full label-native bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                                {user.featureName}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                onClick={() => handleRevoke(user.address, user.featureId)}
                                                disabled={isSaving}
                                                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 disabled:text-slate-600 px-3 py-1.5 rounded-xl label-native transition-all"
                                            >
                                                Revoke
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
