import { motion } from 'framer-motion';
import { Trophy, Medal, Crown, Ticket } from 'lucide-react'; // <--- IMPORT PENTING

export function LeaderboardPage() {
  const leaders = [
    { rank: 1, user: "0x123...456", wins: 15, tickets: 450, prize: "2.5 ETH" },
    { rank: 2, user: "0xabc...def", wins: 12, tickets: 320, prize: "1.8 ETH" },
    { rank: 3, user: "0x789...012", wins: 8, tickets: 210, prize: "1.2 ETH" },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Top Winners</h1>
          <p className="text-slate-400">The most lucky players this month</p>
        </div>

        <div className="space-y-4">
          {leaders.map((player, index) => (
            <motion.div
              key={player.rank}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 flex items-center justify-center font-bold rounded-full 
                  ${player.rank === 1 ? 'bg-yellow-500 text-black' :
                    player.rank === 2 ? 'bg-slate-300 text-black' :
                      player.rank === 3 ? 'bg-amber-600 text-black' : 'bg-slate-800 text-white'}`}>
                  {player.rank}
                </div>
                <span className="font-mono text-white">{player.user}</span>
              </div>

              <div className="flex gap-6 text-sm md:text-base">
                <div className="flex items-center gap-2 text-slate-300">
                  <Ticket className="w-4 h-4 text-blue-400" />
                  {player.tickets}
                </div>
                <div className="flex items-center gap-2 text-yellow-400 font-bold">
                  <Trophy className="w-4 h-4" />
                  {player.wins} Wins
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
