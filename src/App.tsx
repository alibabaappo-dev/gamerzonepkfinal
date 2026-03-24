import { useState, useEffect, createContext, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { auth, db, messaging } from './lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, WifiOff } from 'lucide-react';
import LoadingScreen from './components/LoadingScreen';
import Navbar from './components/Navbar';
import { AnimatePresence, motion } from 'framer-motion';

// Import all pages here
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

function PageTransitionLoader({ children, appUser }: { children: React.ReactNode, appUser: any }) {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  useEffect(() => { 
    if (appUser) { 
        setLoading(true); 
        setTimeout(() => setLoading(false), 500); 
    } 
  }, [location.pathname]);
  return (
    <>
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-t-yellow-500 border-transparent rounded-full animate-spin"></div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ display: loading ? 'none' : 'block' }}>{children}</div>
    </>
  );
}

function AppContent({ appUser, handleLogout, appSettings }: { appUser: any, handleLogout: () => void, appSettings: any }) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  if (appSettings.maintenanceMode && !appUser?.isAdmin && !appUser?.isOwner) {
    return <div className="min-h-screen bg-black flex items-center justify-center p-4 text-white text-center"><div><h1 className="text-3xl font-bold mb-2">Maintenance</h1><p>{appSettings.maintenanceMessage}</p></div></div>;
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

  // Initial Data Fetch (Replaces continuous onSnapshot)
  useEffect(() => {
    const fetchInitialData = async () => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setAppUser({ uid: user.uid, email: user.email, ...data });

          try {
            const msg = await messaging();
            if (msg) {
              const token = await getToken(msg, { vapidKey: VAPID_KEY });
              if (token && (!data.fcmTokens || !data.fcmTokens.includes(token))) {
                await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
              }
            }
          } catch (e) { console.error('FCM Error:', e); }
        }
      } else {
        setAppUser(null);
      }
    };
    fetchInitialData();
  }, [user]);

  useEffect(() => {
    const fetchSettings = async () => {
      const snap = await getDoc(doc(db, 'settings', 'app'));
      if (snap.exists()) setAppSettings(snap.data() as any);
    };
    fetchSettings();
  }, []);

  if (loading) return <LoadingScreen message="Gamer Zone PK..." />;

  return (
    <Router>
      <OfflineGuard>
        <AppContent appUser={appUser} handleLogout={() => signOut(auth)} appSettings={appSettings} />
      </OfflineGuard>
    </Router>
  );
            }
