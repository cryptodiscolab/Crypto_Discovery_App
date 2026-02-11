

export function GridCard({ children, className = "", delay = 0, onClick }) {
    return (
        <div
            style={{ animationDelay: `${delay * 1000}ms` }}
            onClick={onClick}
            className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl shadow-black/20 hover:-translate-y-1 animate-slide-up opacity-0 fill-mode-forwards ${className}`}
        >
            {children}
        </div>
    );
}
