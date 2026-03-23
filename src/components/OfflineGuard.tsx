import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineGuard({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      // Ye Google ya kisi bhi fast API ko ping karega check karne ke liye ke net sach mein chal raha hai ya nahi
      const response = await fetch("https://8.8.8.8", { mode: 'no-cors', cache: 'no-store' });
      setIsOnline(true);
    } catch (error) {
      setIsOnline(false);
    } finally {
      setTimeout(() => setIsChecking(false), 1000);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#050B14] flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full"></div>
              <div className="relative w-24 h-24 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center">
                <WifiOff size={48} className="text-red-500" />
              </div>
            </div>

            <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
              Connection Lost
            </h1>
            <p className="text-gray-400 text-sm max-w-xs mb-8 leading-relaxed">
              Oops! It looks like your internet is not working. Please check your connection to continue playing.
            </p>

            <button
              onClick={checkConnection}
              disabled={isChecking}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 px-8 rounded-2xl flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-yellow-500/20 uppercase text-xs tracking-widest"
            >
              {isChecking ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )}
              {isChecking ? 'Checking...' : 'Try Again'}
            </button>

            <p className="absolute bottom-10 text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">
              Gamer Zone PK • Offline Mode
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
