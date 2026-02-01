import { useState } from 'react';
import { motion } from 'framer-motion';
import { Ticket, Timer, Trophy, Search, Filter } from 'lucide-react'; // <--- INI KUNCINYA!
import { Link } from 'react-router-dom';

export function RafflesPage() {
  const [filter, setFilter] = useState('all');

  // Dummy Data Raffles
  const raffles = [
    {
      id: 1,
      title: "Bored Ape Yacht Club #1234",
      ticketPrice: "0.01 ETH",
      ticketsSold: 450,
      totalTickets: 1000,
      timeLeft: "2h 15m",
      image: "https://via.placeholder.com/400x300/4f46e5/ffffff?text=BAYC+Raffle",
      status: 'active'
    },
    {
      id: 2,
      title: "Azuki #9999",
      ticketPrice: "0.02 ETH",
      ticketsSold: 890,
      totalTickets: 1000,
      timeLeft: "5h 30m",
      image: "https://via.placeholder.com/400x300/ec4899/ffffff?text=Azuki+Raffle",
      status: 'ending-soon'
    },
    {
      id: 3,
      title: "Doodles #555",
      ticketPrice: "0.005 ETH",
      ticketsSold: 120,
      totalTickets: 500,
      timeLeft: "1d 12h",
      image: "https://via.placeholder.com/400x300/f59e0b/ffffff?text=Doodles+Raffle",
      status: 'active'
    }
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Active Raffles</h1>
            <p className="text-slate-400">Join raffles and win exclusive NFTs</p>
          </div>

          <div className="flex gap-2 bg-slate-900/50 p-1 rounded-xl border border-white/10">
            {['all', 'active', 'ending-soon'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Raffles */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {raffles.map((raffle, index) => (
            <motion.div
              key={raffle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card overflow-hidden group hover:border-blue-500/30 transition-all duration-300"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={raffle.image}
                  alt={raffle.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10 flex items-center gap-1">
                  <Timer className="w-3 h-3 text-yellow-400" />
                  {raffle.timeLeft}
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-xl font-bold text-white mb-4">{raffle.title}</h3>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-2">
                      <Ticket className="w-4 h-4" /> Tickets Sold
                    </span>
                    <span className="text-white font-medium">
                      {raffle.ticketsSold} / {raffle.totalTickets}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      style={{ width: `${(raffle.ticketsSold / raffle.totalTickets) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                  <div className="text-sm">
                    <p className="text-slate-400">Price</p>
                    <p className="text-lg font-bold text-blue-400">{raffle.ticketPrice}</p>
                  </div>
                  <button className="btn-primary px-6 py-2 text-sm">
                    Buy Ticket
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
