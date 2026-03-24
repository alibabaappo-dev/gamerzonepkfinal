import { useState, useEffect, createContext, useContext } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { auth, db, messaging } from './lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'; // onSnapshot hata diya
import { onMessage, getToken } from 'firebase/messaging';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, WifiOff, RefreshCw } from 'lucide-react';
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

// ... OfflineGuard and PageTransitionLoader remain same ...

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

  // Use getDoc instead of onSnapshot to save costs
  useEffect(() => {
    const fetchInitialData = async () => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setAppUser({ uid: user.uid, email: user.email, ...userSnap.data() });
        }

        // Setup FCM only if needed, wrapped in a check
        try {
          const msg = await messaging();
          if (msg) {
            const token = await getToken(msg, { vapidKey: VAPID_KEY });
            // Only update if token is new to avoid unnecessary writes
            if (token && !userSnap.data()?.fcmTokens?.includes(token)) {
              await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
            }
          }
        } catch (e) { console.error('FCM Error:', e); }
      } else {
        setAppUser(null);
      }
    };

    fetchInitialData();
  }, [user]);

  // App Settings - Only fetch once
  useEffect(() => {
    const fetchSettings = async () => {
      const snap = await getDoc(doc(db, 'settings', 'app'));
      if (snap.exists()) setAppSettings(snap.data() as any);
    };
    fetchSettings();
  }, []);

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
