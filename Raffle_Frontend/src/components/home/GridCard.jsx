import { motion } from 'framer-motion';

export function GridCard({ children, className = "", delay = 0, onClick }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: delay, duration: 0.5 }}
            whileHover={{ y: -5 }}
            onClick={onClick}
            className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 hover:border-white/20 transition-all duration-300 shadow-xl shadow-black/20 ${className}`}
        >
            {children}
        </motion.div>
    );
}
