import { useState } from 'react';
import { Shield, UserPlus, UserMinus, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { useCMS, FEATURE_IDS, FEATURE_NAMES } from '../../hooks/useCMS';
import toast from 'react-hot-toast';
import { isAddress } from 'ethers';

export function WhitelistManagerTab() {
    const { grantPrivilege, revokePrivilege, batchGrantPrivileges, showSuccessToast, refetchAll } = useCMS();
    const [isSaving, setIsSaving] = useState(false);

    // Single grant state
    const [userAddress, setUserAddress] = useState('');
    const [selectedFeature, setSelectedFeature] = useState(FEATURE_IDS.FREE_DAILY_TASK);

    // Batch grant state
    const [batchAddresses, setBatchAddresses] = useState('');
    const [batchFeature, setBatchFeature] = useState(FEATURE_IDS.FREE_DAILY_TASK);

    // Whitelisted users (mock data for now - in production, read from events or backend)
    const [whitelistedUsers, setWhitelistedUsers] = useState([
        { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', featureId: 1, featureName: 'Free Daily Task' },
        { address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', featureId: 2, featureName: 'Free Raffle Ticket' },
    ]);

    const handleGrantPrivilege = async () => {
        if (!isAddress(userAddress)) {
            toast.error("Invalid wallet address");
            return;
        }

        setIsSaving(true);
        const tid = toast.loading("Granting privilege on blockchain...");

        try {
            const hash = await grantPrivilege(userAddress, selectedFeature);
            showSuccessToast("Privilege Granted!", hash);
            toast.dismiss(tid);

            // Add to local list
            setWhitelistedUsers([...whitelistedUsers, {
                address: userAddress,
                featureId: selectedFeature,
                featureName: FEATURE_NAMES[selectedFeature]
            }]);

            setUserAddress('');
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
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
            showSuccessToast(`${addresses.length} Privileges Granted!`, hash);
            toast.dismiss(tid);

            // Add to local list
            const newUsers = addresses.map(addr => ({
                address: addr,
                featureId: batchFeature,
                featureName: FEATURE_NAMES[batchFeature]
            }));
            setWhitelistedUsers([...whitelistedUsers, ...newUsers]);

            setBatchAddresses('');
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRevoke = async (userAddr, featureId) => {
        setIsSaving(true);
        const tid = toast.loading("Revoking privilege...");

        try {
            const hash = await revokePrivilege(userAddr, featureId);
            showSuccessToast("Privilege Revoked!", hash);
            toast.dismiss(tid);

            // Remove from local list
            setWhitelistedUsers(whitelistedUsers.filter(
                u => !(u.address === userAddr && u.featureId === featureId)
            ));

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
            {/* Header */}
            <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-purple-500" />
                <div>
                    <h2 className="text-2xl font-bold text-white">Sponsored Access Whitelist</h2>
                    <p className="text-slate-400 text-sm">Grant free access to premium features for specific users</p>
                </div>
            </div>

            {/* Single Grant */}
            <div className="glass-card p-6 bg-purple-950/10 border border-purple-500/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-purple-400" /> Grant Single Privilege
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Wallet Address
                        </label>
                        <input
                            type="text"
                            value={userAddress}
                            onChange={(e) => setUserAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-purple-500/50 outline-none transition-all font-mono text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Feature Access
                        </label>
                        <select
                            value={selectedFeature}
                            onChange={(e) => setSelectedFeature(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-purple-500/50 outline-none cursor-pointer"
                        >
                            <option value={FEATURE_IDS.FREE_DAILY_TASK}>Free Daily Task</option>
                            <option value={FEATURE_IDS.FREE_RAFFLE_TICKET}>Free Raffle Ticket</option>
                            <option value={FEATURE_IDS.PREMIUM_ACCESS}>Premium Access</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleGrantPrivilege}
                    disabled={isSaving || !userAddress}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                    <UserPlus className="w-5 h-5" />
                    {isSaving ? "Granting..." : "Grant Privilege"}
                </button>
            </div>

            {/* Batch Grant */}
            <div className="glass-card p-6 bg-indigo-950/10 border border-indigo-500/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-indigo-400" /> Batch Grant (Gas Saver!)
                </h3>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Wallet Addresses (one per line)
                    </label>
                    <textarea
                        value={batchAddresses}
                        onChange={(e) => setBatchAddresses(e.target.value)}
                        placeholder="0x...\n0x...\n0x..."
                        rows={5}
                        className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all font-mono text-sm resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                        💡 Batch grant saves ~68% gas vs individual grants
                    </p>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Feature Access (applies to all)
                    </label>
                    <select
                        value={batchFeature}
                        onChange={(e) => setBatchFeature(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none cursor-pointer"
                    >
                        <option value={FEATURE_IDS.FREE_DAILY_TASK}>Free Daily Task</option>
                        <option value={FEATURE_IDS.FREE_RAFFLE_TICKET}>Free Raffle Ticket</option>
                        <option value={FEATURE_IDS.PREMIUM_ACCESS}>Premium Access</option>
                    </select>
                </div>

                <button
                    onClick={handleBatchGrant}
                    disabled={isSaving || !batchAddresses}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                    <CheckCircle className="w-5 h-5" />
                    {isSaving ? "Granting..." : `Grant to ${batchAddresses.split('\n').filter(a => a.trim()).length} Users`}
                </button>
            </div>

            {/* Whitelisted Users Table */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-white mb-4">Whitelisted Users</h3>

                {whitelistedUsers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No whitelisted users yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Address
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Feature
                                    </th>
                                    <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {whitelistedUsers.map((user, index) => (
                                    <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-4">
                                            <code className="text-sm text-slate-300 font-mono">
                                                {user.address.slice(0, 6)}...{user.address.slice(-4)}
                                            </code>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400">
                                                {user.featureName}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                onClick={() => handleRevoke(user.address, user.featureId)}
                                                disabled={isSaving}
                                                className="text-red-400 hover:text-red-300 disabled:text-slate-600 transition-colors"
                                            >
                                                <UserMinus className="w-5 h-5" />
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
