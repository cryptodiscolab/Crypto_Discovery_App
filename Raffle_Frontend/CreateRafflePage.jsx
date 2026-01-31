import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Loader2, Sparkles, Calendar } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useCreateRaffle } from '../hooks/useContract';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export function CreateRafflePage() {
    const { address, isConnected } = useAccount();
    const navigate = useNavigate();
    const { createRaffle, isLoading } = useCreateRaffle();

    const [nftContracts, setNftContracts] = useState(['']);
    const [tokenIds, setTokenIds] = useState(['']);
    const [duration, setDuration] = useState(1); // 1-30 days

    const addNFT = () => {
        if (nftContracts.length >= 50) {
            toast.error('Maximum 50 NFTs per raffle');
            return;
        }
        setNftContracts([...nftContracts, '']);
        setTokenIds([...tokenIds, '']);
    };

    const removeNFT = (index) => {
        if (nftContracts.length <= 10) {
            toast.error('Minimum 10 NFTs required');
            return;
        }
        const newContracts = [...nftContracts];
        const newIds = [...tokenIds];
        newContracts.splice(index, 1);
        newIds.splice(index, 1);
        setNftContracts(newContracts);
        setTokenIds(newIds);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isConnected) {
            toast.error('Please connect your wallet');
            return;
        }

        if (nftContracts.length < 10) {
            toast.error('Minimum 10 NFTs required');
            return;
        }

        const durationInSeconds = duration * 24 * 60 * 60;

        await createRaffle(nftContracts, tokenIds.map(id => BigInt(id)), BigInt(durationInSeconds));

        // Success handling is done in hook via toast
        // If successful, navigate back
        setTimeout(() => {
            navigate('/raffles');
        }, 2000);
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="glass-card p-12 text-center">
                    <Sparkles className="w-16 h-16 mx-auto text-blue-400 mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
                    <p className="text-slate-400">You must be connected to create a raffle</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-12">
            <div className="container mx-auto px-4 max-w-3xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-8"
                >
                    <div className="flex items-center space-x-3 mb-8">
                        <div className="p-3 bg-blue-600 rounded-xl">
                            <Plus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Create New Raffle</h1>
                            <p className="text-slate-400">Host your own provably fair NFT raffle</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">NFT Information</h3>
                                <span className="text-xs text-slate-500 font-mono">Min 10 / Max 50</span>
                            </div>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {nftContracts.map((contract, index) => (
                                    <div key={index} className="flex space-x-2 items-start">
                                        <div className="flex-grow space-y-2">
                                            <input
                                                type="text"
                                                placeholder="NFT Contract Address (0x...)"
                                                className="input-field w-full text-sm"
                                                value={contract}
                                                onChange={(e) => {
                                                    const newContracts = [...nftContracts];
                                                    newContracts[index] = e.target.value;
                                                    setNftContracts(newContracts);
                                                }}
                                                required
                                            />
                                            <input
                                                type="number"
                                                placeholder="Token ID"
                                                className="input-field w-full text-sm"
                                                value={tokenIds[index]}
                                                onChange={(e) => {
                                                    const newIds = [...tokenIds];
                                                    newIds[index] = e.target.value;
                                                    setTokenIds(newIds);
                                                }}
                                                required
                                            />
                                        </div>
                                        {nftContracts.length > 10 && (
                                            <button
                                                type="button"
                                                onClick={() => removeNFT(index)}
                                                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addNFT}
                                className="w-full mt-4 flex items-center justify-center space-x-2 py-3 border-2 border-dashed border-white/10 rounded-xl text-slate-400 hover:border-blue-500/50 hover:text-blue-400 transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Add Another NFT</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                                    <Calendar className="w-4 h-4 mr-2 text-blue-400" />
                                    Raffle Duration (Days)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={duration}
                                    onChange={(e) => setDuration(parseInt(e.target.value))}
                                    className="input-field w-full"
                                    required
                                />
                            </div>
                            <div className="flex flex-col justify-end pb-1">
                                <p className="text-xs text-slate-500 italic">
                                    * Duration must be between 1 and 30 days.
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <div className="mb-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <p className="text-sm text-blue-300">
                                    <Sparkles className="w-4 h-4 inline mr-2" />
                                    You will need to approve this contract to transfer your NFTs before creating the raffle.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary w-full py-4 text-xl flex items-center justify-center space-x-3"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="w-6 h-6" />
                                        <span>Launch Raffle</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
