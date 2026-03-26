import { Wallet, Trophy, Zap, DollarSign, Star, MessageSquare, User, X, ChevronRight, ArrowRight, Bell, BarChart2, LogOut, Download, Plus, Phone, Check, Loader2, Copy, CheckCircle2, XCircle, Save, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { db, messaging } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, onSnapshot, orderBy, updateDoc, arrayUnion, arrayRemove, limit, documentId } from 'firebase/firestore';
import { getToken, deleteToken } from 'firebase/messaging';
import { motion, AnimatePresence } from 'framer-motion';

// --- UI Components (NO CHANGES HERE) ---
const Card = ({ children, className = '' }) => (
  <div className={`bg-[#2C2C2E] p-4 rounded-3xl relative overflow-hidden border border-gray-700/50 ${className}`}>
    {children}
  </div>
);

const colorVariants = {
  yellow: { border: 'border-yellow-500/50', bg: 'bg-yellow-500/10' },
  green: { border: 'border-green-500/50', bg: 'bg-green-500/10' },
  blue: { border: 'border-blue-500/50', bg: 'bg-blue-500/10' },
  purple: { border: 'border-purple-500/50', bg: 'bg-purple-500/10' },
};

const StatCard = ({ icon, title, value, subtitle, color, trendIcon }) => {
  const variants = colorVariants[color] || colorVariants.yellow;
  return (
    <Card className={variants.border}>
      <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full blur-3xl ${variants.bg}`}></div>
      <div className="flex flex-col justify-between h-full">
        <div>
          <div className="flex justify-between items-start">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gray-800`}>{icon}</div>
            {trendIcon}
          </div>
          <p className="text-gray-400 text-sm mt-4">{title}</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
    </Card>
  );
};

const NavCard = ({ icon, title }) => (
  <Card className={`border-gray-700/50`}>
    <div className="flex flex-col items-center justify-center aspect-square">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-gray-800`}>{icon}</div>
      <span className="mt-3 text-sm text-center text-white font-medium">{title}</span>
    </div>
  </Card>
);

const EmojiModal = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-[#0D0D0D] border-2 border-orange-500/20 w-full max-w-[340px] rounded-[2rem] overflow-hidden relative shadow-[0_0_50px_rgba(242,125,38,0.15)]"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
            <X size={20} />
          </button>
          <div className="p-8 pt-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 border border-orange-500/20">
               <span className="text-3xl">🔔</span>
            </div>
            <h2 className="text-sm font-black text-center text-yellow-600 uppercase tracking-tight mb-6">
              {title}
            </h2>
            <div className="w-full space-y-4 mb-8 text-left px-2">
              {children}
            </div>
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-orange-500/20"
            >
              OK, Got it
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default function Home({ user, onLogout }) {
  const [stats, setStats] = useState({ totalWins: 0, activeTournaments: 0, walletBalance: 0, totalEarnings: 0 });
  const [userRank, setUserRank] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [joinedTournaments, setJoinedTournaments] = useState([]); 
  const [supportTickets, setSupportTickets] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pop-up states (Once per session)
  const [activePopup, setActivePopup] = useState(0); 

  // OPTIMIZATION: Critical lock to stop 191M read loop
  const fetchLock = useRef(false);

  useEffect(() => {
    const hasShown = sessionStorage.getItem('gamerZonePopupsShown');
    if (!hasShown) {
      setActivePopup(1);
      sessionStorage.setItem('gamerZonePopupsShown', 'true');
    }
  }, []);

  const handleNextPopup = () => {
    if (activePopup === 1) setActivePopup(2);      
    else if (activePopup === 2) setActivePopup(3); 
    else setActivePopup(0);                        
  };

  const handleCopyCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // 1. LIGHTWEIGHT SNAPSHOT (WALLET & WINS ONLY)
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setStats(prev => ({ ...prev, walletBalance: userData.walletBalance || 0, totalWins: userData.totalWins || 0 }));
        setIsPushEnabled(userData.fcmTokens?.length > 0);
        if (!userData.username || !userData.phoneNumber) {
          setShowProfileModal(true);
          setProfileUsername(userData.username || '');
          setProfilePhone(userData.phoneNumber?.replace('+92', '') || '');
        }
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // 2. OPTIMIZED HEAVY FETCH (FIXES 191M READS)
  useEffect(() => {
    if (!user || fetchLock.current) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [regSnap, tktSnap, txSnap, leaderSnap, userNotifsSnap, globNotifsSnap] = await Promise.all([
          getDocs(query(collection(db, 'registrations'), where('userId', '==', user.uid), limit(10))),
          getDocs(query(collection(db, 'support_tickets'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(2))),
          getDocs(query(collection(db, 'transactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(3))),
          getDocs(query(collection(db, 'users'), orderBy('totalWins', 'desc'), limit(100))),
          getDocs(query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(1))),
          getDocs(query(collection(db, 'global_notifications'), orderBy('createdAt', 'desc'), limit(1)))
        ]);

        const txData = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const earnings = txData.filter(tx => tx.type === 'Winning' || tx.type === 'Kills').reduce((sum, tx) => sum + (tx.amount || 0), 0);
        
        setRecentTransactions(txData);
        setStats(prev => ({ ...prev, totalEarnings: earnings, activeTournaments: regSnap.size }));
        setSupportTickets(tktSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        // Notifications processing
        const combinedNotifs = [...userNotifsSnap.docs.map(d => d.data()), ...globNotifsSnap.docs.map(d => d.data())].sort((a,b) => b.createdAt - a.createdAt);
        setRecentNotifications(combinedNotifs.slice(0, 2));

        // Leaderboard Rank
        const topUsers = leaderSnap.docs.map(doc => doc.id);
        setUserRank(topUsers.indexOf(user.uid) + 1 || 0);

        // Fetch Joined Tournament details
        const tIds = regSnap.docs.map(doc => doc.data().tournamentId);
        if (tIds.length > 0) {
          const tSnap = await getDocs(query(collection(db, 'tournaments'), where(documentId(), 'in', tIds.slice(0, 10))));
          setJoinedTournaments(tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(t => t.status !== 'completed'));
        }

        fetchLock.current = true;
      } catch (err) {
        console.error("Dashboard Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user?.uid]);

  const togglePushNotifications = async () => {
    if (!user) return;
    setIsTogglingPush(true);
    try {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const msg = await messaging();
      if (isPushEnabled) {
        const currentToken = await getToken(msg, { vapidKey });
        if (currentToken) {
          await deleteToken(msg);
          await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayRemove(currentToken) });
        }
        setIsPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Permission denied.');
        const token = await getToken(msg, { vapidKey });
        if (token) {
          await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayUnion(token) });
          setIsPushEnabled(true);
          alert('Notifications enabled!');
        }
      }
    } catch (error) { console.error(error); } finally { setIsTogglingPush(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center text-white">
      <div className="relative flex items-center justify-center mb-4 w-16 h-16">
        <div className="absolute inset-0 border-[2px] border-yellow-500/10 rounded-full"></div>
        <div className="absolute inset-0 border-[4px] border-transparent border-t-yellow-500 rounded-full animate-spin"></div>
      </div>
      <p className="text-yellow-400 font-bold animate-pulse uppercase tracking-widest text-sm">Loading GAMER ZONE...</p>
    </div>
  );

  return (
    <div className="bg-[#0D0D0D] text-white min-h-screen">
      {/* Desktop Dashboard (UI REMAINS UNTOUCHED) */}
      <div className="hidden lg:block min-h-screen bg-[#0D0D0D] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-24 w-72 h-72 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-8 py-12 relative z-10">
          <div className="flex justify-between items-end mb-12">
            <div><h1 className="text-5xl font-black text-white mb-2 tracking-tight">Dashboard</h1></div>
            <div className="flex items-center gap-4">
              <Link to="/tournaments" className="block">
                <div className="bg-[#1C1C1E]/80 backdrop-blur-md border border-gray-800 p-2 pr-4 rounded-2xl flex items-center gap-4 shadow-xl hover:bg-[#252528] transition-all cursor-pointer group">
                  <div className="bg-blue-600/10 p-3 rounded-xl group-hover:bg-blue-600/20 transition-colors"><Trophy className="text-blue-500" size={20} /></div>
                  <div><p className="text-[10px] text-gray-400 font-black mb-1.5 uppercase tracking-widest">Tournaments</p><div className="bg-blue-600 text-white text-[10px] font-black px-5 py-1.5 rounded-lg hover:bg-blue-500 transition-colors flex items-center justify-center">Join Now</div></div>
                </div>
              </Link>
              <div className="bg-[#1C1C1E]/80 backdrop-blur-md border border-gray-800 p-2 pr-4 rounded-2xl flex items-center gap-4 shadow-xl">
                <div className="bg-gray-800/50 p-3 rounded-xl"><Bell className={isPushEnabled ? "text-green-400" : "text-gray-400"} size={20} /></div>
                <div><p className="text-[10px] text-gray-400 font-medium mb-1.5 uppercase tracking-wider">Push Notifications</p><button onClick={togglePushNotifications} disabled={isTogglingPush} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-2 w-full ${isPushEnabled ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-yellow-400 text-black hover:bg-yellow-500'}`}>{isTogglingPush && <Loader2 size={12} className="animate-spin" />}{isPushEnabled ? 'Disable' : 'Enable'}</button></div>
              </div>
              <div className="flex items-center gap-6 bg-[#1C1C1E]/50 backdrop-blur-md border border-gray-800/50 px-6 py-2.5 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700 shadow-inner"><User size={20} className="text-gray-400" /></div><div className="text-left"><p className="text-sm font-bold text-white leading-tight">{user.username}</p><p className="text-[10px] text-gray-500 font-medium">{user.email}</p></div></div>
                <div className="h-8 w-[1px] bg-gray-800/50" /><button onClick={onLogout} className="flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors group"><LogOut size={18} /><span className="text-sm font-bold">Logout</span></button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6 mb-12">
            <motion.div whileHover={{ y: -5 }} className="bg-[#1C1C1E] p-6 rounded-3xl border border-gray-800 relative overflow-hidden shadow-2xl"><div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-2xl group-hover:bg-yellow-400/10 transition-colors"></div><div className="flex justify-between items-start mb-8 relative z-10"><div className="bg-yellow-400/10 p-3.5 rounded-2xl"><Wallet className="text-yellow-400" size={28} /></div><BarChart2 className="text-yellow-400" size={14} /></div><div className="relative z-10"><p className="text-gray-400 text-sm font-medium mb-1">Wallet Balance</p><div className="flex items-baseline gap-2"><span className="text-4xl font-black text-white tracking-tight">{stats.walletBalance}</span><span className="text-gray-500 text-xs font-bold uppercase tracking-wider">coins</span></div></div></motion.div>
            <motion.div whileHover={{ y: -5 }} className="bg-[#1C1C1E] p-6 rounded-3xl border border-gray-800 relative overflow-hidden shadow-2xl"><div className="absolute top-0 right-0 w-32 h-32 bg-green-400/5 rounded-full blur-2xl"></div><div className="flex justify-between items-start mb-8 relative z-10"><div className="bg-green-400/10 p-3.5 rounded-2xl"><Trophy className="text-green-400" size={28} /></div><Star className="text-green-400" size={14} /></div><div className="relative z-10"><p className="text-gray-400 text-sm font-medium mb-1">Total Wins</p><div className="flex items-baseline gap-2"><span className="text-4xl font-black text-white tracking-tight">{stats.totalWins}</span><span className="text-gray-500 text-xs font-bold uppercase tracking-wider">matches</span></div></div></motion.div>
            <motion.div whileHover={{ y: -5 }} className="bg-[#1C1C1E] p-6 rounded-3xl border border-gray-800 relative overflow-hidden shadow-2xl"><div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/5 rounded-full blur-2xl"></div><div className="flex justify-between items-start mb-8 relative z-10"><div className="bg-blue-400/10 p-3.5 rounded-2xl"><Zap className="text-blue-400" size={28} /></div><Zap className="text-blue-400" size={14} /></div><div className="relative z-10"><p className="text-gray-400 text-sm font-medium mb-1">Total Joined</p><div className="flex items-baseline gap-2"><span className="text-4xl font-black text-white tracking-tight">{stats.activeTournaments}</span><span className="text-gray-500 text-xs font-bold uppercase tracking-wider">matches</span></div></div></motion.div>
            <motion.div whileHover={{ y: -5 }} className="bg-[#1C1C1E] p-6 rounded-3xl border border-gray-800 relative overflow-hidden shadow-2xl"><div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/5 rounded-full blur-2xl"></div><div className="flex justify-between items-start mb-8 relative z-10"><div className="bg-purple-400/10 p-3.5 rounded-2xl"><DollarSign className="text-purple-400" size={28} /></div><BarChart2 className="text-purple-400" size={14} /></div><div className="relative z-10"><p className="text-gray-400 text-sm font-medium mb-1">Total Earnings</p><div className="flex items-baseline gap-2"><span className="text-4xl font-black text-white tracking-tight">+{stats.totalEarnings}</span><span className="text-gray-500 text-xs font-bold uppercase tracking-wider">coins</span></div></div></motion.div>
          </div>

          <div className="grid grid-cols-6 gap-6 mb-12">
            {[
              { icon: <Trophy size={24} className="text-yellow-400" />, label: 'Tournaments', path: '/tournaments', color: 'yellow' },
              { icon: <Star size={24} className="text-orange-400" />, label: 'Daily Tasks', path: '/tasks', color: 'orange' },
              { icon: <Wallet size={24} className="text-green-400" />, label: 'My Wallet', path: '/wallet', color: 'green' },
              { icon: <MessageSquare size={24} className="text-blue-400" />, label: 'Support', path: '/support', color: 'blue' },
              { icon: <User size={24} className="text-purple-400" />, label: 'Profile', path: '/profile', color: 'purple' },
              { icon: <Zap size={24} className="text-pink-400" />, label: 'Referral', path: '/referral', color: 'pink' },
            ].map((item) => (<Link key={item.label} to={item.path}><motion.div whileHover={{ y: -5, scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-[#1C1C1E] h-full p-6 rounded-3xl border border-gray-800 flex flex-col items-center justify-center group hover:bg-gray-800/50 transition-all shadow-xl hover:shadow-2xl"><div className="mb-4 bg-gray-900/80 p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-lg">{item.icon}</div><span className="font-bold text-gray-300 group-hover:text-white transition-colors">{item.label}</span></motion.div></Link>))}
          </div>

          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-8 space-y-8">
              <div className="bg-[#1C1C1E] rounded-3xl border border-gray-800 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-gray-800/50 flex justify-between items-center bg-[#1F1F22]/50">
                  <div className="flex items-center space-x-4"><div className="bg-yellow-400/10 p-2 rounded-xl"><Trophy className="text-yellow-400" size={20} /></div><div><h2 className="text-xl font-bold text-white">My Tournaments</h2><p className="text-xs text-gray-500 font-medium mt-0.5">Upcoming matches</p></div></div>
                  <Link to="/tournaments" className="text-yellow-400 text-sm font-bold flex items-center hover:text-yellow-300 transition-colors bg-yellow-400/10 px-4 py-2 rounded-xl">View All <ChevronRight size={16} className="ml-1" /></Link>
                </div>
                <div className="p-6">
                  {joinedTournaments.length > 0 ? (<div className="space-y-4">{joinedTournaments.map((tournament) => (<motion.div key={tournament.id} whileHover={{ scale: 1.01 }} className="bg-[#252528] p-5 rounded-2xl border border-gray-700/50 flex justify-between items-center group hover:border-yellow-400/30 transition-all"><div className="flex items-center gap-4"><div><h3 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">{tournament.name}</h3><div className="flex gap-2 mt-1.5"><span className="text-[10px] bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide border border-blue-500/20">{tournament.gameType || 'BR'}</span><span className="text-[10px] bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide border border-purple-500/20">{tournament.mode || 'Solo'}</span></div></div></div><div className="text-right flex items-center gap-6"><div><p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Prize Pool</p><div className="text-green-400 font-black text-lg">{tournament.prizePool} <span className="text-xs font-bold text-gray-500">coins</span></div></div><Link to="/tournaments" className="bg-yellow-400 text-black text-xs font-bold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-400/20 hover:shadow-yellow-400/40 hover:-translate-y-0.5">View Tournament</Link></div></motion.div>))}</div>) : (<div className="text-center py-12 bg-[#252528]/50 rounded-2xl border border-dashed border-gray-800"><div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4"><Trophy className="text-gray-600" size={32} /></div><p className="text-gray-400 font-medium mb-4">You haven't joined any tournaments yet</p><Link to="/tournaments" className="inline-block bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl hover:bg-yellow-300 transition-colors">Browse Tournaments</Link></div>)}
                </div>
              </div>
            </div>
            <div className="col-span-4 space-y-8">
              <div className="bg-[#1C1C1E] rounded-3xl border border-gray-800 p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-yellow-400/10 to-transparent pointer-events-none" />
                <div className="flex flex-col items-center text-center relative z-10">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 p-1 mb-6 shadow-2xl shadow-yellow-500/20"><div className="w-full h-full bg-[#1C1C1E] rounded-full flex items-center justify-center overflow-hidden"><User size={48} className="text-yellow-400" /></div></div>
                  <h3 className="text-2xl font-black text-white mb-1 tracking-tight">{user.username}</h3>
                  <p className="text-gray-500 mb-8 font-medium text-sm bg-gray-800/50 px-4 py-1 rounded-full">{user.email}</p>
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="bg-[#252528] p-5 rounded-2xl border border-gray-700/50 hover:border-yellow-400/30 transition-colors group"><p className="text-3xl font-black text-white group-hover:text-yellow-400 transition-colors">{stats.activeTournaments}</p><p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Tournaments</p></div>
                    <div className="bg-[#252528] p-5 rounded-2xl border border-gray-700/50 hover:border-green-400/30 transition-colors group"><p className="text-3xl font-black text-white group-hover:text-green-400 transition-colors">{stats.totalWins}</p><p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">Wins</p></div>
                  </div>
                  <div className="w-full mt-6 bg-[#252528] rounded-2xl border border-gray-700/50 p-4 flex items-center justify-between group hover:border-blue-500/30 transition-all">
                    <div className="text-left"><p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Referral Code</p><p className="text-lg font-black text-blue-400 font-mono tracking-widest">{user.referralCode || 'N/A'}</p></div>
                    <button onClick={handleCopyCode} className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all text-gray-400 hover:text-white active:scale-95" title="Copy Referral Code">{copied ? <CheckCircle2 size={20} className="text-green-500" /> : <Copy size={20} />}</button>
                  </div>
                  <Link to="/profile" className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors text-sm">Edit Profile</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Dashboard (UI REMAINS UNTOUCHED) */}
      <div className="lg:hidden container mx-auto p-4 pb-24">
        <div className="mb-8"><h1 className="text-3xl font-bold text-yellow-400">Welcome back, {user.username}!</h1><p className="text-gray-400">Track your progress and manage your gaming journey</p></div>
        <Link to="/tournaments" className="block mb-4"><Card className="flex justify-between items-center border-blue-500/50"><div><p className="text-sm text-gray-300">Join Tournament</p><div className="bg-blue-600 text-white font-bold py-2 px-5 rounded-lg mt-2 text-sm flex items-center justify-center">Join Tournament click here</div></div><button className="bg-gray-700 p-3 rounded-lg"><ArrowRight className="h-5 w-5 text-gray-300" /></button></Card></Link>
        <Card className="mb-8 flex justify-between items-center border-yellow-500/50"><div><p className="text-sm text-gray-300">Enable Notification</p><button onClick={togglePushNotifications} disabled={isTogglingPush} className={`${isPushEnabled ? 'bg-gray-700 text-white' : 'bg-yellow-400 text-black'} font-bold py-2 px-5 rounded-lg mt-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2`}>{isTogglingPush && <Loader2 size={14} className="animate-spin" />}{isPushEnabled ? 'Disable' : 'Enable Notifications'}</button></div><button className="bg-gray-700 p-3 rounded-lg"><ArrowRight className="h-5 w-5 text-gray-300" /></button></Card>
        <div className="grid grid-cols-2 gap-4 mb-8 pl-2 pr-2">
          <StatCard icon={<Wallet size={20} className="text-yellow-400" />} title="Wallet Balance" value={stats.walletBalance} subtitle="coins" color="yellow" trendIcon={<BarChart2 size={16} className="text-green-400" />} />
          <StatCard icon={<Trophy size={20} className="text-green-400" />} title="Total Wins" value={stats.totalWins} subtitle="macthes" color="green" trendIcon={<BarChart2 size={16} className="text-gray-500" />} />
          <StatCard icon={<Zap size={20} className="text-blue-400" />} title="Total Joined" value={stats.activeTournaments} subtitle="matches" color="blue" trendIcon={<Zap size={16} className="text-blue-400" />} />
          <StatCard icon={<DollarSign size={20} className="text-purple-400" />} title="Total Earnings" value={`+${stats.totalEarnings}`} subtitle="coins" color="purple" trendIcon={<BarChart2 size={16} className="text-green-400" />} />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-8 pl-2 pr-2">
          <Link to="/tournaments"><NavCard icon={<Trophy size={24} className="text-yellow-400" />} title="Browse Tournaments" /></Link>
          <NavCard icon={<Star size={24} className="text-orange-400" />} title="Daily Tasks" />
          <Link to="/wallet"><NavCard icon={<Wallet size={24} className="text-green-400" />} title="My Wallet" /></Link>
          <Link to="/support"><NavCard icon={<MessageSquare size={24} className="text-blue-400" />} title="Support" /></Link>
          <Link to="/profile"><NavCard icon={<User size={24} className="text-purple-400" />} title="Profile" /></Link>
          <Link to="/referral"><NavCard icon={<Zap size={24} className="text-pink-400" />} title="Referral" /></Link>
        </div>
        {joinedTournaments.length > 0 && (<Card className="mb-6 border-yellow-400/80"><div className="flex justify-between items-center mb-4"><div className="flex items-center space-x-3"><Trophy size={20} className="text-yellow-400" /><h2 className="font-bold text-lg">My Tournaments</h2></div><Link to="/tournaments" className="text-yellow-400 text-sm font-semibold flex items-center">View All <ChevronRight size={16} /></Link></div><div className="space-y-4">{joinedTournaments.map((tournament) => (<div key={tournament.id} className="bg-[#1C1C1E] p-4 rounded-xl border border-gray-700"><div className="flex justify-between items-start mb-2"><h3 className="font-bold text-white text-sm">{tournament.name}</h3><span className="text-green-400 text-xs font-bold">Prize {tournament.prizePool} coins</span></div><div className="flex gap-2 mb-3"><span className="text-[10px] bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded">{tournament.gameType || 'BR'}</span><span className="text-[10px] bg-purple-900/40 text-purple-400 px-2 py-0.5 rounded">{tournament.mode || 'Solo'}</span></div><Link to="/tournaments" className="block w-full bg-yellow-400 text-black text-center text-xs font-bold py-2 rounded-lg hover:bg-yellow-300 transition-colors">View Tournament</Link></div>))}</div></Card>)}
      </div>

     {/* SEQUENTIAL EMOJI POPUPS (SESSION BASED) */}
      
      <EmojiModal isOpen={activePopup === 1} onClose={handleNextPopup} title="⚡ NEW MATCHES ADDED ✅">
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-200">🔥 BR SURVIVAL — LOW ENTRY NOW LIVE!</p>
          <p className="text-xs font-bold text-gray-200">🔥 Check New Tournaments Now!</p>
          <div className="pt-4 border-t border-gray-800"><p className="text-[11px] font-bold text-gray-400 leading-relaxed">💪 Ab Kam Entry Me Zyada Prize !<br />⚡ Kuch Slots Rehte Hai Join Now !</p><p className="text-[10px] mt-4 text-yellow-400 font-black uppercase tracking-tight">GAMER ZONE — JOIN NOW ⚔️🔥</p></div>
        </div>
      </EmojiModal>

      <EmojiModal isOpen={activePopup === 2} onClose={handleNextPopup} title="WATCH FULL VIDEO">
        <div className="space-y-4">
          <p className="text-[10px] font-bold text-gray-200 px-1 leading-relaxed">🚀 Watch Gamer Zone Guide On Youtube, Tiktok & Join WhatsApp Group!</p>
          <div className="space-y-3 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2 text-[10px] font-black"><img src="https://i.ibb.co/SDfYyXyx/image.png" className="w-5 h-5 object-contain" alt="t" /><a href="https://vt.tiktok.com/ZSuKtFeFe/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">WATCH ON TIKTOK</a></div>
            <div className="flex items-center gap-2 text-[10px] font-black"><img src="https://i.ibb.co/ycKSV4FH/image.png" className="w-5 h-5 object-contain" alt="y" /><a href="https://www.youtube.com/@ZahidFF" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">WATCH ON YOUTUBE</a></div>
            <div className="flex items-center gap-2 text-[10px] font-black"><img src="https://i.ibb.co/7tdCbQLq/image.png" className="w-6 h-6 object-contain" alt="w" /><a href="https://chat.whatsapp.com/YOUR_GROUP" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">JOIN GROUP</a></div>
          </div>
        </div>
      </EmojiModal>

      <EmojiModal isOpen={activePopup === 3} onClose={handleNextPopup} title="🚨 BAN ALERT 🚨">
        <div className="space-y-3 text-xs font-bold text-red-500">
          <p>⚠️ FAKE DEPOSIT REQUEST = BAN!</p>
          <p>⚠️ SPAM TICKETS = DEVICE BAN!</p>
          <div className="pt-4 border-t border-gray-800"><p className="text-[11px] font-bold text-gray-400 leading-relaxed">⚡ Avoid fake screenshots & spamming!<br />🚨 Repeat offenders will be device banned!</p><p className="text-[10px] mt-4 text-yellow-400 font-black uppercase tracking-tight">🚨 NO SECOND CHANCES 🚨</p></div>
        </div>
      </EmojiModal>

      {/* Mandatory Profile Completion Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1C1C1E] p-8 rounded-[2.5rem] w-full max-w-sm border border-gray-800 text-center">
                <h2 className="text-2xl font-black mb-6">Complete Profile</h2>
                <form onSubmit={async (e) => {
                   e.preventDefault();
                   if (profilePhone.length !== 10) return;
                   setIsUpdatingProfile(true);
                   await updateDoc(doc(db, 'users', user.uid), { username: profileUsername, phoneNumber: '+92' + profilePhone });
                   setShowProfileModal(false);
                   setIsUpdatingProfile(false);
                }} className="space-y-4">
                  <input className="w-full bg-black border border-gray-800 p-4 rounded-2xl font-bold" placeholder="Username" value={profileUsername} onChange={e => setProfileUsername(e.target.value)} required />
                  <input className="w-full bg-black border border-gray-800 p-4 rounded-2xl font-bold" placeholder="Phone 3001234567" maxLength={10} value={profilePhone} onChange={e => setProfilePhone(e.target.value)} required />
                  <button type="submit" disabled={isUpdatingProfile} className="w-full bg-yellow-500 text-black font-black py-4 rounded-2xl shadow-lg">{isUpdatingProfile ? 'Saving...' : 'Save & Continue'}</button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
