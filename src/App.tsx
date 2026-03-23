/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { auth, db, messaging } from './lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LogOut, WifiOff, RefreshCw } from 'lucide-react';
import LoadingScreen from './components/LoadingScreen';
import Navbar from './components/Navbar';
import { AnimatePresence, motion } from 'framer-motion';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CreateTournament from './pages/CreateTournament';
import Tournament from './pages/Tournament';
import Tournaments from './pages/Tournaments';
import Wallet from './pages/Wallet';
import Tasks from './pages/Tasks';
import Leaderboard from './pages/Leaderboard';
import Guidelines from './pages/Guidelines';
import Admin from './pages/Admin';
import Landing from './pages/Landing';
import Withdrawals from './pages/Withdrawals';
import Transactions from './pages/Transactions';
import Support from './pages/Support';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Referral from './pages/Referral';
import ResultsHistory from './pages/ResultsHistory';

// --- OFFLINE GUARD ---
function OfflineGuard({ children }: { children: React.ReactNode }) {
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
      await fetch("https://8.8.8.8", { mode: 'no-cors', cache: 'no-store' });
      setIsOnline(true);
    } catch (e) {
      setIsOnline(false);
    } finally {
      setTimeout(() => setIsChecking(false), 1000);
    }
  };

  if (!isOnline) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#050B14] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20">
          <WifiOff size={40} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-white uppercase mb-2">No Internet</h1>
        <p className="text-gray-400 text-sm max-w-xs mb-8">Internet connection lost. Please check your network to continue.</p>
        <button 
          onClick={checkConnection}
          className="bg-yellow-500 text-black font-black py-4 px-10 rounded-2xl flex items-center gap-3 active:scale-95 shadow-lg uppercase text-xs tracking-widest"
        >
          {isChecking ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          {isChecking ? 'Checking...' : 'Try Again'}
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

// --- LOADER ---
export const LoaderContext = createContext({ triggerLoader: () => {} });
export const useGlobalLoader = () => useContext(LoaderContext);

function PageTransitionLoader({ children, appUser }: { children: React.ReactNode, appUser: any }) {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const triggerLoader = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };
  useEffect(() => { if (appUser) triggerLoader(); }, [location.pathname]);

  return (
    <LoaderContext.Provider value={{ triggerLoader }}>
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="relative flex items-center justify-center mb-4 w-16 h-16">
              <div className="absolute inset-0 border-[4px] border-transparent border-t-yellow-500 rounded-full animate-spin"></div>
            </div>
            <p className="text-yellow-400 font-bold animate-pulse uppercase tracking-widest text-sm">Loading...</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ display: loading ? 'none' : 'block' }}>{children}</div>
    </LoaderContext.Provider>
  );
}

// --- MAIN CONTENT ---
function AppContent({ appUser, handleLogout, appSettings }: { appUser: any, handleLogout: () => void, appSettings: any }) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  if (appSettings.maintenanceMode && !appUser?.isAdmin && !appUser?.isOwner) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 text-center">
        <div>
          <h1 className="text-4xl font-black text-white uppercase mb-4">Maintenance</h1>
          <p className="text-gray-400">{appSettings.maintenanceMessage}</p>
        </div>
      </div>
    );
  }

  if (appUser?.isBanned) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-[#1C1C1E] rounded-[2rem] border border-red-500/20 p-8 text-center shadow-2xl">
          <ShieldAlert size={48} className="text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white uppercase mb-2">Banned</h2>
          <p className="text-gray-400 text-sm mb-8">{appUser.banReason || 'Access denied.'}</p>
          <button onClick={handleLogout} className="w-full bg-red-500 text-white font-black py-4 rounded-2xl">Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {appUser && !isAdminPage && <Navbar user={appUser} onLogout={handleLogout} />}
      <main>
        <PageTransitionLoader appUser={appUser}>
          <Routes>
            <Route path="/" element={appUser ? <Home user={appUser} onLogout={handleLogout} /> : <Landing />} />
            <Route path="/login" element={!appUser ? <Login /> : <Navigate to="/" />} />
            <Route path="/register" element={!appUser ? <Register /> : <Navigate to="/" />} />
            <Route path="/tournaments" element={appUser ? <Tournaments /> : <Navigate to="/login" />} />
            <Route path="/tournaments/:id" element={appUser ? <Tournament user={appUser} /> : <Navigate to="/login" />} />
            <Route path="/tournaments/new" element={appUser ? <CreateTournament /> : <Navigate to="/login" />} />
            <Route path="/tasks" element={appUser ? <Tasks /> : <Navigate to="/login" />} />
            <Route path="/leaderboard" element={appUser ? <Leaderboard /> : <Navigate to="/login" />} />
            <Route path="/wallet" element={appUser ? <Wallet /> : <Navigate to="/login" />} />
            <Route path="/withdrawals" element={appUser ? <Withdrawals /> : <Navigate to="/login" />} />
            <Route path="/transactions" element={appUser ? <Transactions /> : <Navigate to="/login" />} />
            <Route path="/support" element={appUser ? <Support user={appUser} /> : <Navigate to="/login" />} />
            <Route path="/notifications" element={appUser ? <Notifications /> : <Navigate to="/login" />} />
            <Route path="/profile" element={appUser ? <Profile user={appUser} /> : <Navigate to="/login" />} />
            <Route path="/referral" element={appUser ? <Referral user={appUser} /> : <Navigate to="/login" />} />
            <Route path="/results-history" element={appUser ? <ResultsHistory /> : <Navigate to="/login" />} />
            <Route path="/guidelines" element={appUser ? <Guidelines /> : <Navigate to="/login" />} />
            <Route path="/admin/*" element={appUser && (appUser.isOwner || appUser.isAdmin) ? <Admin /> : <Navigate to="/" />} />
          </Routes>
        </PageTransitionLoader>
      </main>
    </div>
  );
}

// --- DEFAULT EXPORT ---
export default function App() {
  const [user, loading] = useAuthState(auth);
  const [appUser, setAppUser] = useState<any>(null);
  const [appSettings, setAppSettings] = useState({ maintenanceMode: false, maintenanceMessage: '', primaryColor: '#eab308' });

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'app'), (docSnap) => {
      if (docSnap.exists()) {
        const settings = docSnap.data();
        setAppSettings({
          maintenanceMode: settings.maintenanceMode || false,
          maintenanceMessage: settings.maintenanceMessage || 'Maintenance in progress.',
          primaryColor: settings.primaryColor || '#eab308'
        });
      }
    });
    return () => unsubSettings();
  }, []);

  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAppUser({
            uid: user.uid,
            username: data.username || user.displayName || 'User',
            email: user.email,
            isAdmin: data.isAdmin === true,
            isOwner: data.isOwner === true,
            isBanned: data.isBanned === true,
            banReason: data.banReason || '',
            walletBalance: data.walletBalance || 0
          });
        }
      });
      return () => unsub();
    } else {
      setAppUser(null);
    }
  }, [user]);

  const handleLogout = async () => { await signOut(auth); };

  if (loading) return <LoadingScreen message="Gamer Zone PK..." />;

  return (
    <Router>
      <OfflineGuard>
        <AppContent appUser={appUser} handleLogout={handleLogout} appSettings={appSettings} />
      </OfflineGuard>
    </Router>
  );
}
