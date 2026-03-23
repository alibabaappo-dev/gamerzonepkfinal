import { useState, useEffect, createContext, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { auth, db, messaging } from './lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { onMessage, getToken } from 'firebase/messaging';
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
import { VAPID_KEY } from './lib/firebase';

// --- OFFLINE GUARD ---
function OfflineGuard({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const o = () => setIsOnline(true);
    const f = () => setIsOnline(false);
    window.addEventListener('online', o);
    window.addEventListener('offline', f);
    return () => { window.removeEventListener('online', o); window.removeEventListener('offline', f); };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#050B14] flex flex-col items-center justify-center p-6 text-center">
        <WifiOff size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white uppercase">No Internet</h1>
        <p className="text-gray-400 text-sm mb-6">Check your connection to continue.</p>
        <button onClick={() => window.location.reload()} className="bg-yellow-500 text-black font-bold py-3 px-8 rounded-xl uppercase text-xs">Try Again</button>
      </div>
    );
  }
  return <>{children}</>;
}

export const LoaderContext = createContext({ triggerLoader: () => {} });
export const useGlobalLoader = () => useContext(LoaderContext);

function PageTransitionLoader({ children, appUser }: { children: React.ReactNode, appUser: any }) {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const triggerLoader = () => { setLoading(true); setTimeout(() => setLoading(false), 500); };
  useEffect(() => { if (appUser) triggerLoader(); }, [location.pathname]);
  return (
    <LoaderContext.Provider value={{ triggerLoader }}>
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-t-yellow-500 border-transparent rounded-full animate-spin"></div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ display: loading ? 'none' : 'block' }}>{children}</div>
    </LoaderContext.Provider>
  );
}

function AppContent({ appUser, handleLogout, appSettings }: { appUser: any, handleLogout: () => void, appSettings: any }) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  if (appSettings.maintenanceMode && !appUser?.isAdmin && !appUser?.isOwner) {
    return <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white text-center"><div><h1 className="text-3xl font-bold mb-2">Maintenance</h1><p>{appSettings.maintenanceMessage}</p></div></div>;
  }

  if (appUser?.isBanned) {
    return <div className="min-h-screen bg-black flex items-center justify-center p-4 text-center text-white"><div className="bg-[#1C1C1E] p-8 rounded-3xl border border-red-500/20"><ShieldAlert size={48} className="text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-bold mb-2">Banned</h2><p className="text-gray-400 mb-6">{appUser.banReason}</p><button onClick={handleLogout} className="bg-red-500 px-6 py-2 rounded-xl">Logout</button></div></div>;
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

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [appUser, setAppUser] = useState<any>(null);
  const [appSettings, setAppSettings] = useState({ maintenanceMode: false, maintenanceMessage: '', primaryColor: '#eab308' });

  // 1. App Settings Listener
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'app'), (docSnap) => {
      if (docSnap.exists()) setAppSettings(docSnap.data() as any);
    });
    return () => unsub();
  }, []);

  // 2. Messaging & Token Logic
  useEffect(() => {
    if (user) {
      const setup = async () => {
        try {
          const msg = await messaging();
          if (msg) {
            const token = await getToken(msg, { vapidKey: VAPID_KEY });
            if (token) {
              await updateDoc(doc(db, 'users', user.uid), {
                fcmTokens: arrayUnion(token)
              });
            }
            onMessage(msg, (payload) => {
              if (payload.notification) alert(`${payload.notification.title}\n${payload.notification.body}`);
            });
          }
        } catch (e) { console.error('FCM Error:', e); }
      };
      setup();

      const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setAppUser({ uid: user.uid, email: user.email, ...docSnap.data() });
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
