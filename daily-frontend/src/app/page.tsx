import { Header } from "@/components/Header";
import { TaskDashboard } from "@/components/TaskDashboard";

export default function Home() {
  return (
    <main className="flex flex-col flex-1 h-screen overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <TaskDashboard />
      </div>

      {/* Footer / Info */}
      <footer className="p-6 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm text-center">
        <p className="text-slate-500 text-sm">
          Powered by <span className="text-indigo-400 font-medium">Base</span> & <span className="text-indigo-400 font-medium">OnchainKit</span>
        </p>
      </footer>
    </main>
  );
}
