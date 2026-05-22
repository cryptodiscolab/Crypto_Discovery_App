import { useState, useEffect } from 'react';
import { Shield, Crown, Wrench, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { useCMS } from '../../../hooks/useCMS';
import { supabase } from '../../../lib/supabaseClient';
import toast from 'react-hot-toast';
import { isAddress, keccak256, toBytes } from 'viem';
import { useDailyAppAdmin } from '../../../hooks/useContract';

interface Operator {
    address: string;
    role: 'Operator' | 'Admin';
}

const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'; // gitleaks:allow - OpenZeppelin DEFAULT_ADMIN_ROLE is zero bytes32, not a private key.
const DAILY_APP_ACCESS_ROLES = [
    { label: 'ADMIN_ROLE', value: 'ADMIN_ROLE' },
    { label: 'VERIFIER_ROLE', value: 'VERIFIER_ROLE' },
    { label: 'RAFFLE_ROLE', value: 'RAFFLE_ROLE' },
    { label: 'SOCIAL_ROLE', value: 'SOCIAL_ROLE' },
    { label: 'UGC_ROLE', value: 'UGC_ROLE' },
    { label: 'MOJO_ROLE', value: 'MOJO_ROLE' },
    { label: 'SWAP_ROLE', value: 'SWAP_ROLE' },
    { label: 'PURCHASE_ROLE', value: 'PURCHASE_ROLE' },
    { label: 'DEFAULT_ADMIN_ROLE', value: 'DEFAULT_ADMIN_ROLE' },
] as const;

type DailyAppAccessRole = typeof DAILY_APP_ACCESS_ROLES[number]['value'];
type RoleAction = 'grant' | 'revoke';

const getRoleId = (role: DailyAppAccessRole) => {
    if (role === 'DEFAULT_ADMIN_ROLE') return DEFAULT_ADMIN_ROLE;
    return keccak256(toBytes(role));
};

export function RoleManagementTab() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { grantOperator, revokeOperator, showSuccessToast, refetchAll, isAdmin, isLoading: loadingCMS } = useCMS();
    const { grantRole, revokeRole } = useDailyAppAdmin();
    const [isSaving, setIsSaving] = useState(false);
    const [operatorAddress, setOperatorAddress] = useState('');
    const [verifierAddress, setVerifierAddress] = useState(import.meta.env.VITE_VERIFIER_ADDRESS || '0x52260c30697674a7C837FEB2af21bBf3606795C8');
    const [accessControlAddress, setAccessControlAddress] = useState('');
    const [selectedDailyAppRole, setSelectedDailyAppRole] = useState<DailyAppAccessRole>('UGC_ROLE');
    const [selectedRoleAction, setSelectedRoleAction] = useState<RoleAction>('grant');
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Operators list (fetched from database)
    const [operators, setOperators] = useState<Operator[]>([]);

    // 1. Fetch Existing Operators from DB
    useEffect(() => {
        const fetchOperators = async () => {
            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('wallet_address')
                    .eq('is_admin', true);

                if (error) throw error;
                if (data) {
                    setOperators(data.map((u: { wallet_address: string }) => ({
                        address: u.wallet_address,
                        role: 'Operator'
                    })));
                }
            } catch (err) {
                console.error('[FetchOperators Error]', err);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchOperators();
    }, []);

    if (loadingCMS || isLoadingData) {
        return (
            <div className="py-20 flex flex-col items-center gap-4">
                <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="label-native text-slate-500">Checking Permissions...</p>
            </div>
        );
    }

    const handleGrantOperator = async () => {
        if (!isAddress(operatorAddress)) {
            toast.error("Invalid wallet address");
            return;
        }

        setIsSaving(true);
        const tid = toast.loading("Granting operator role...");

        try {
            // 1. Blockchain Transaction
            const hash = await grantOperator(operatorAddress);
            showSuccessToast("Operator Role Granted on Blockchain!", hash);

            // 2. Database Sync (Zero-Trust API)
            toast.loading("Syncing role to database...", { id: tid });
            const timestamp = new Date().toISOString();
            const message = `Grant Operator Role\nTarget: ${operatorAddress.toLowerCase()}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'GRANT_ROLE',
                    payload: { target_address: operatorAddress }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Database sync failed");
            }

            toast.success("Operator Role Granted & Synced!", { id: tid });

            // Add to local list
            setOperators([...operators, { address: operatorAddress, role: 'Operator' }]);
            setOperatorAddress('');
            refetchAll();
        } catch (e: unknown) {
            console.error(e);
            const err = e as { shortMessage?: string; message?: string };
            toast.error(err.shortMessage || err.message || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRevokeOperator = async (addr: string) => {
        setIsSaving(true);
        const tid = toast.loading("Revoking operator role...");

        try {
            // 1. Blockchain Transaction
            const hash = await revokeOperator(addr);
            showSuccessToast("Operator Role Revoked on Blockchain!", hash);

            // 2. Database Sync (Zero-Trust API)
            toast.loading("Syncing revocation to database...", { id: tid });
            const timestamp = new Date().toISOString();
            const message = `Revoke Operator Role\nTarget: ${addr.toLowerCase()}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            const response = await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'REVOKE_ROLE',
                    payload: { target_address: addr }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Database sync failed");
            }

            toast.success("Operator Role Revoked & Synced!", { id: tid });

            // Remove from local list
            setOperators(operators.filter(op => op.address?.toLowerCase() !== addr?.toLowerCase()));
            refetchAll();
        } catch (e: unknown) {
            console.error(e);
            const err = e as { shortMessage?: string; message?: string };
            toast.error(err.shortMessage || err.message || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleGrantVerifier = async () => {
        if (!isAddress(verifierAddress)) {
            toast.error("Invalid verifier address");
            return;
        }

        setIsSaving(true);
        const tid = toast.loading("Granting verifier role...");

        try {
            const VERIFIER_ROLE = getRoleId('VERIFIER_ROLE');
            const hash = await grantRole(VERIFIER_ROLE, verifierAddress);
            showSuccessToast("Verifier Role Granted on Blockchain!", hash);

            // Database Sync
            const timestamp = new Date().toISOString();
            const message = `Grant Verifier Role\nTarget: ${verifierAddress.toLowerCase()}\nAdmin: ${address?.toLowerCase()}\nTime: ${timestamp}`;
            const signature = await signMessageAsync({ message });

            await fetch('/api/admin/system/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: address,
                    signature,
                    message,
                    action_type: 'GRANT_VERIFIER',
                    payload: { target_address: verifierAddress }
                })
            }).then(async (response) => {
                if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Sync failed'); }
            });

            toast.success("Verifier Role Active!", { id: tid });
            refetchAll();
        } catch (e: unknown) {
            const err = e as { message?: string };
            toast.error(err.message || "Grant verifier failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleApplyDailyAppRole = async () => {
        if (!isAddress(accessControlAddress)) {
            toast.error("Invalid target address");
            return;
        }

        setIsSaving(true);
        const roleId = getRoleId(selectedDailyAppRole);
        const actionLabel = selectedRoleAction === 'grant' ? 'Granting' : 'Revoking';
        const tid = toast.loading(`${actionLabel} ${selectedDailyAppRole}...`);

        try {
            const hash = selectedRoleAction === 'grant'
                ? await grantRole(roleId, accessControlAddress)
                : await revokeRole(roleId, accessControlAddress);

            showSuccessToast(`${selectedDailyAppRole} ${selectedRoleAction === 'grant' ? 'granted' : 'revoked'} on DailyApp!`, hash);
            toast.success("DailyApp AccessControl updated", { id: tid });
            setAccessControlAddress('');
            refetchAll();
        } catch (e: unknown) {
            const err = e as { shortMessage?: string; message?: string };
            toast.error(err.shortMessage || err.message || "Role transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="glass-card p-8 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="value-native text-white mb-2">Admin Access Required</h3>
                <p className="label-native text-slate-500">Only admins can manage operator roles.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 overflow-x-hidden w-full max-w-[100vw]">
            {/* Header */}
            <div className="flex items-center gap-3 text-left">
                <Shield className="w-8 h-8 text-indigo-400" />
                <div>
                    <h2 className="text-md font-black uppercase tracking-[0.2em] leading-none text-white">Role Management</h2>
                    <p className="label-native text-slate-500 mt-2">Grant or revoke operator access to trusted users</p>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="glass-card p-4 bg-indigo-950/10 border border-indigo-500/10 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                        <Crown className="w-5 h-5 text-yellow-400" />
                        <h4 className="label-native text-white">Admin Role</h4>
                    </div>
                    <p className="label-native text-slate-500 leading-relaxed">
                        Full control: Manage roles, edit content, grant privileges, withdraw funds
                    </p>
                </div>

                <div className="glass-card p-4 bg-indigo-950/10 border border-indigo-500/10 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                        <Wrench className="w-5 h-5 text-indigo-400" />
                        <h4 className="label-native text-white">Operator Role</h4>
                    </div>
                    <p className="label-native text-slate-500 leading-relaxed">
                        Limited access: Edit content, grant privileges (cannot manage roles or funds)
                    </p>
                </div>
            </div>

            {/* Grant Operator */}
            <div className="glass-card p-6 bg-[#121214] border border-white/5 rounded-3xl text-left">
                <h3 className="label-native text-white mb-4 flex items-center gap-2">
                    Grant Operator Role
                </h3>

                <div className="flex gap-3">
                    <input
                        type="text"
                        value={operatorAddress}
                        onChange={(e) => setOperatorAddress(e.target.value)}
                        placeholder="0x... (wallet address)"
                        className="flex-1 bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all font-mono value-native"
                    />
                    <button
                        onClick={handleGrantOperator}
                        disabled={isSaving || !operatorAddress}
                        className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 disabled:bg-slate-800/20 disabled:border-slate-800/30 disabled:text-slate-600 px-6 py-3 rounded-xl label-native transition-all"
                    >
                        Grant
                    </button>
                </div>
            </div>

            {/* Verification Service Role */}
            <div className="glass-card p-6 bg-[#121214] border border-white/5 rounded-3xl text-left">
                <h3 className="label-native text-white mb-4 flex items-center gap-2">
                    System: Verification Service
                </h3>
                <p className="label-native text-slate-500 mb-4 leading-relaxed">
                    The Verification Service requires the <code className="text-indigo-400">VERIFIER_ROLE</code> on the DailyApp contract to validate social tasks (Twitter/Farcaster) on-chain.
                </p>

                <div className="flex gap-3">
                    <input
                        type="text"
                        value={verifierAddress}
                        onChange={(e) => setVerifierAddress(e.target.value)}
                        placeholder="0x... (verifier address)"
                        className="flex-1 bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-emerald-500/50 outline-none transition-all font-mono value-native"
                    />
                    <button
                        onClick={handleGrantVerifier}
                        disabled={isSaving || !verifierAddress}
                        className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 disabled:bg-slate-800/20 disabled:border-slate-800/30 disabled:text-slate-600 px-6 py-3 rounded-xl label-native transition-all"
                    >
                        Authorize Verifier
                    </button>
                </div>
            </div>

            {/* DailyApp V16 AccessControl */}
            <div className="glass-card p-6 bg-[#121214] border border-white/5 rounded-3xl text-left">
                <h3 className="label-native text-white mb-4 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    DailyApp V16 AccessControl
                </h3>
                <p className="label-native text-slate-500 mb-4 leading-relaxed">
                    Manage runtime contract permissions using <code className="text-emerald-400">grantRole</code> and <code className="text-red-400">revokeRole</code>.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-[160px_220px_minmax(0,1fr)_140px] gap-3">
                    <select
                        value={selectedRoleAction}
                        onChange={(e) => setSelectedRoleAction(e.target.value as RoleAction)}
                        className="bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-emerald-500/50 outline-none transition-all label-native"
                    >
                        <option value="grant">Grant</option>
                        <option value="revoke">Revoke</option>
                    </select>
                    <select
                        value={selectedDailyAppRole}
                        onChange={(e) => setSelectedDailyAppRole(e.target.value as DailyAppAccessRole)}
                        className="bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-emerald-500/50 outline-none transition-all label-native"
                    >
                        {DAILY_APP_ACCESS_ROLES.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={accessControlAddress}
                        onChange={(e) => setAccessControlAddress(e.target.value)}
                        placeholder="0x... (wallet or contract address)"
                        className="min-w-0 bg-black/40 border border-white/5 p-3 rounded-xl text-white focus:border-emerald-500/50 outline-none transition-all font-mono value-native"
                    />
                    <button
                        onClick={handleApplyDailyAppRole}
                        disabled={isSaving || !accessControlAddress}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 disabled:bg-slate-800/20 disabled:border-slate-800/30 disabled:text-slate-600 px-6 py-3 rounded-xl label-native transition-all"
                    >
                        Apply
                    </button>
                </div>

                <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
                    <p className="label-native text-yellow-200 leading-relaxed">
                        Production handover: grant the role to the new service wallet or multisig first, verify the transaction, then revoke the old deployer role.
                    </p>
                </div>
            </div>

            {/* Operators List */}
            <div className="glass-card p-6 bg-[#121214] border border-white/5 rounded-3xl text-left">
                <h3 className="label-native text-white mb-4">Current Operators</h3>

                {operators.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="label-native text-slate-600">No operators assigned yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {operators.map((operator, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    {operator.role === 'Admin' ? (
                                        <Crown className="w-5 h-5 text-yellow-400" />
                                    ) : (
                                        <Wrench className="w-5 h-5 text-indigo-400" />
                                    )}
                                    <div>
                                        <code className="value-native text-white font-mono">
                                            {operator.address.slice(0, 6)}...{operator.address.slice(-4)}
                                        </code>
                                        <span className={`ml-3 inline-flex items-center px-2 py-1 rounded-full label-native ${operator.role === 'Admin'
                                            ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                                            : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                                            }`}>
                                            {operator.role}
                                        </span>
                                    </div>
                                </div>

                                {operator.role !== 'Admin' && (
                                    <button
                                        onClick={() => handleRevokeOperator(operator.address)}
                                        disabled={isSaving}
                                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 disabled:text-slate-600 px-4 py-2 rounded-xl label-native transition-all"
                                    >
                                        Revoke
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
