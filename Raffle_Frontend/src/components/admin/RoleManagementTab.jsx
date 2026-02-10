import { useState } from 'react';
import { Shield, UserPlus, UserX, Crown, Wrench, AlertCircle } from 'lucide-react';
import { useCMS } from '../../hooks/useCMS';
import toast from 'react-hot-toast';
import { isAddress } from 'viem';

export function RoleManagementTab() {
    const { grantOperator, revokeOperator, showSuccessToast, refetchAll, isAdmin } = useCMS();
    const [isSaving, setIsSaving] = useState(false);
    const [operatorAddress, setOperatorAddress] = useState('');

    // Mock operators list (in production, read from events or backend)
    const [operators, setOperators] = useState([
        { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', role: 'Admin' },
    ]);

    const handleGrantOperator = async () => {
        if (!isAddress(operatorAddress)) {
            toast.error("Invalid wallet address");
            return;
        }

        setIsSaving(true);
        const tid = toast.loading("Granting operator role...");

        try {
            const hash = await grantOperator(operatorAddress);
            showSuccessToast("Operator Role Granted!", hash);
            toast.dismiss(tid);

            // Add to local list
            setOperators([...operators, { address: operatorAddress, role: 'Operator' }]);
            setOperatorAddress('');
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRevokeOperator = async (addr) => {
        setIsSaving(true);
        const tid = toast.loading("Revoking operator role...");

        try {
            const hash = await revokeOperator(addr);
            showSuccessToast("Operator Role Revoked!", hash);
            toast.dismiss(tid);

            // Remove from local list
            setOperators(operators.filter(op => op.address !== addr));
            refetchAll();
        } catch (e) {
            console.error(e);
            toast.error(e.shortMessage || "Transaction failed", { id: tid });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="glass-card p-8 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Admin Access Required</h3>
                <p className="text-slate-400">Only admins can manage operator roles.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-yellow-500" />
                <div>
                    <h2 className="text-2xl font-bold text-white">Role Management</h2>
                    <p className="text-slate-400 text-sm">Grant or revoke operator access to trusted users</p>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-4 bg-yellow-950/10 border border-yellow-500/10">
                    <div className="flex items-center gap-3 mb-2">
                        <Crown className="w-5 h-5 text-yellow-400" />
                        <h4 className="font-bold text-white">Admin Role</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                        Full control: Manage roles, edit content, grant privileges, withdraw funds
                    </p>
                </div>

                <div className="glass-card p-4 bg-indigo-950/10 border border-indigo-500/10">
                    <div className="flex items-center gap-3 mb-2">
                        <Wrench className="w-5 h-5 text-indigo-400" />
                        <h4 className="font-bold text-white">Operator Role</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                        Limited access: Edit content, grant privileges (cannot manage roles or funds)
                    </p>
                </div>
            </div>

            {/* Grant Operator */}
            <div className="glass-card p-6 bg-indigo-950/10 border border-indigo-500/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-400" /> Grant Operator Role
                </h3>

                <div className="flex gap-3">
                    <input
                        type="text"
                        value={operatorAddress}
                        onChange={(e) => setOperatorAddress(e.target.value)}
                        placeholder="0x... (wallet address)"
                        className="flex-1 bg-slate-900 border border-white/5 p-3 rounded-xl text-white focus:border-indigo-500/50 outline-none transition-all font-mono text-sm"
                    />
                    <button
                        onClick={handleGrantOperator}
                        disabled={isSaving || !operatorAddress}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        <UserPlus className="w-5 h-5" />
                        Grant
                    </button>
                </div>
            </div>

            {/* Operators List */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-bold text-white mb-4">Current Operators</h3>

                {operators.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No operators assigned yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {operators.map((operator, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {operator.role === 'Admin' ? (
                                        <Crown className="w-5 h-5 text-yellow-400" />
                                    ) : (
                                        <Wrench className="w-5 h-5 text-indigo-400" />
                                    )}
                                    <div>
                                        <code className="text-sm text-white font-mono">
                                            {operator.address.slice(0, 6)}...{operator.address.slice(-4)}
                                        </code>
                                        <span className={`ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${operator.role === 'Admin'
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-indigo-500/20 text-indigo-400'
                                            }`}>
                                            {operator.role}
                                        </span>
                                    </div>
                                </div>

                                {operator.role !== 'Admin' && (
                                    <button
                                        onClick={() => handleRevokeOperator(operator.address)}
                                        disabled={isSaving}
                                        className="text-red-400 hover:text-red-300 disabled:text-slate-600 transition-colors flex items-center gap-2"
                                    >
                                        <UserX className="w-5 h-5" />
                                        <span className="text-sm font-medium">Revoke</span>
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
