import { HeroSection } from '../components/home/HeroSection';
import { TaskCard } from '../components/home/TaskCard';
import { RaffleCard } from '../components/home/RaffleCard';
import { AnalyticsCard } from '../components/home/AnalyticsCard';

export function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">

      {/* Hero Section */}
      <HeroSection />

      {/* Main Grid Layout - Overlapping Hero */}
      <div className="container mx-auto px-4 pb-20 -mt-10 relative z-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TaskCard />
          <RaffleCard />
          <AnalyticsCard />
        </div>
      </div>

      {/* Footer / Trust Badge area can go here if needed later */}
    </div>
  );
}

