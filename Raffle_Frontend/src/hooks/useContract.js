import { useAccount } from 'wagmi';

// Ini hook sementara (Mock) biar build Vercel LULUS dulu.
// Nanti kita sambungin ke Smart Contract asli kalau UI udah muncul.

export function useUserInfo(address) {
    const { isConnected } = useAccount();

    // Kalau gak connect, return null
    if (!address || !isConnected) return null;

    // Mock Data (Pura-pura ada data dari blockchain)
    return {
        userInfo: {
            freeTicketsAvailable: 1, // Kasih 1 tiket gratis buat testing UI
            totalTickets: 0,
            isActive: true
        },
        isLoading: false,
        isError: false
    };
}

// Jaga-jaga kalau ada halaman lain yang butuh stats
export function useV12Stats() {
    return {
        totalUsers: 120,
        totalTransactions: 4500,
        totalSponsors: 8
    };
}

// Tambahan untuk TasksPage
export function useUserV12Stats(address) {
    return {
        stats: {
            points: 450,
            currentTier: 2,
            totalTasksCompleted: 12
        },
        isLoading: false,
        isError: false
    };
}

export function useAllTasks() {
    return {
        totalTasks: 3,
        isLoading: false
    };
}

export function useTaskInfo(taskId) {
    const tasks = {
        0: { id: 0, title: "Follow us on Twitter", link: "https://twitter.com", baseReward: 100, cooldown: 86400, requiresVerification: true, isActive: true },
        1: { id: 1, title: "Join Discord", link: "https://discord.com", baseReward: 150, cooldown: 86400, requiresVerification: true, isActive: true },
        2: { id: 2, title: "Daily Check-in", link: "#", baseReward: 50, cooldown: 86400, requiresVerification: false, isActive: true },
    };
    return {
        task: tasks[taskId],
        isLoading: false
    };
}

export function useDoTask() {
    return {
        doTask: async (taskId) => { console.log("Task done:", taskId); },
        isLoading: false
    };
}
