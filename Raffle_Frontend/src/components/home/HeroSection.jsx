import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

export function HeroSection() {
    return (
        <section className="relative pt-32 pb-20 px-4 overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[100px] mix-blend-screen" />
            </div>

            <div className="container mx-auto max-w-7xl relative z-10 text-center">
                <div
                    className="animate-slide-up"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium text-slate-300">Powered by API3 QRNG on Base</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
                        Crypto Disco
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                            Daily Tasks & Quantum Raffle
                        </span>
                    </h1>

                    <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        The fairest raffle platform on Base. Complete social tasks to earn free tickets,
                        or boost your chances with premium entries. Truly random, fully transparent.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/raffles">
                            <button className="px-8 py-4 bg-white text-slate-950 rounded-full font-bold text-lg hover:bg-slate-200 transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                Start Winning
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </Link>
                        <Link to="/tasks">
                            <button className="px-8 py-4 bg-white/5 text-white border border-white/10 rounded-full font-bold text-lg hover:bg-white/10 transition-all backdrop-blur-sm">
                                Earn Free Tickets
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
