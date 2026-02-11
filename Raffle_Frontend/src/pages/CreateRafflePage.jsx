import { useState } from 'react';
import { Upload, Calendar, DollarSign, Gift, Ticket, AlertCircle } from 'lucide-react'; // <--- TICKET WAJIB ADA DISINI
import { useAccount } from 'wagmi';

export function CreateRafflePage() {
    const { isConnected } = useAccount();
    const [formData, setFormData] = useState({
        nftName: '',
        ticketPrice: '',
        totalTickets: '',
        duration: '24h'
    });

    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
                    <p className="text-slate-400">You need to connect your wallet to create a raffle.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4">
            <div className="container mx-auto max-w-2xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Create Raffle</h1>
                    <p className="text-slate-400">Set up a new raffle for your NFT</p>
                </div>

                <div
                    className="glass-card p-8 animate-slide-up"
                >
                    <form className="space-y-6">
                        {/* NFT Details */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">NFT Contract Address</label>
                            <div className="relative">
                                <Gift className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="0x..."
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Ticket Price & Supply */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Ticket Price (ETH)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                    <input
                                        type="number"
                                        placeholder="0.01"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Total Tickets</label>
                                <div className="relative">
                                    <Ticket className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                    <input
                                        type="number"
                                        placeholder="1000"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Duration */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Duration</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                <select className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none">
                                    <option value="24h">24 Hours</option>
                                    <option value="3d">3 Days</option>
                                    <option value="7d">7 Days</option>
                                </select>
                            </div>
                        </div>

                        {/* Upload Image */}
                        <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors cursor-pointer">
                            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm text-slate-400">Click to upload NFT image</p>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3 items-start">
                            <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-200">
                                A 5% platform fee will be deducted from the total raised amount after the raffle ends.
                            </p>
                        </div>

                        <button type="button" className="btn-primary w-full py-4 text-lg font-bold">
                            Create Raffle
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
