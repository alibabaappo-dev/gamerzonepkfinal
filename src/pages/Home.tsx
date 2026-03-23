import { Wallet, Trophy, Zap, DollarSign, Star, MessageSquare, User, X, ChevronRight, ArrowRight, Bell, BarChart2, LogOut, Download, Plus, Phone, Check, Loader2, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { db, messaging } from '../lib/firebase';
import { doc, collection, query, where, onSnapshot, orderBy, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { getToken, deleteToken } from 'firebase/messaging';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingScreen from '../components/LoadingScreen';

const Card = ({ children, className = '' }) => (
  <div className={`bg-[#1C1C1E] p-4 rounded-3xl relative overflow-hidden border border-gray-800 ${className}`}>
    {children}
  </div>
);

const colorVariants = {
  yellow: { border: 'border-yellow-500/50', bg: 'bg-yellow-500/10' },
  green: { border: 'border-green-500/50', bg: 'bg-green-500/10' },
  blue: { border: 'border-blue-500/50', bg: 'bg-blue-500/10' },
  purple: { border: 'border-purple-500/50', bg: 'bg-purple-500/10' }
};

const StatCard = ({ icon, title, value, subtitle, color, trendIcon }) => {
  const variants = colorVariants[color] || colorVariants.yellow;
  return (
    <Card className={variants.border}>
      <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full blur-3xl ${variants.bg}`}></div>
      <div className="flex flex-col justify-between h-full relative z-10">
        <div>
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-800">{icon}</div>
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
  <Card className="border-gray-800 hover:border-gray-600 transition-colors">
    <div className="flex flex-col items-center justify-center aspect-square">
      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-800">{icon}</div>
      <span className="mt-3 text-sm text-center text-white font-medium">{title}</span>
    </div>
  </Card>
);

export default function Home({ user, onLogout }) {
  const [stats, setStats] = useState({ totalWins: 0, activeTournaments: 0, walletBalance: 0, totalEarnings: 0 });
  const [userRank, setUserRank] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [joinedIds, setJoinedIds] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [allTournaments, setAllTournaments] = useState([]);
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

  const handleCopyCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (user?.fcmTokens && user.fcmTokens.length > 0) setIsPushEnabled(true);
    else setIsPushEnabled(false);
  }, [user]);

  const togglePushNotifications = async () => {
    if (!user) return;
    setIsTogglingPush(true);
    try {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const msg = await messaging();
      if (!msg) return;

      if (isPushEnabled) {
        const currentToken = await getToken(msg, { vapidKey });
        if (currentToken) {
          await deleteToken(msg);
          await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayRemove(currentToken) });
        }
        setIsPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(msg, { vapidKey });
          if (token) {
            await updateDoc(doc(db, 'users', user.uid), { fcmTokens: arrayUnion(token) });
            setIsPushEnabled(true);
          }
        }
      }
    } catch (e) { console.error(e); } 
    finally { setIsTogglingPush(false); }
  };

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setStats(prev => ({ ...prev, walletBalance: d.walletBalance || 0, totalWins: d.totalWins || 0 }));
        if (!d.username || !d.phoneNumber) setShowProfileModal(true);
      }
    });

    const unsubTournaments = onSnapshot(collection(db, 'tournaments'), (s) => {
      setAllTournaments(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubRegs = onSnapshot(query(collection(db, 'registrations'), where('userId', '==', user.uid)), (s) => {
      const ids = s.docs.map(d => d.data().tournamentId);
      setJoinedIds(ids);
      setStats(prev => ({ ...prev, activeTournaments: ids.length }));
    });

    const unsubTx = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', user.uid), limit(3)), (s) => {
      setRecentTransactions(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubUser(); unsubTournaments(); unsubRegs(); unsubTx(); };
  }, [user]);

  const joinedTournaments = useMemo(() => {
    return allTournaments.filter(t => joinedIds.includes(t.id) && t.status !== 'Completed');
  }, [allTournaments, joinedIds]);

  if (loading) return <LoadingScreen message="Gamer Zone PK..." />;

  return (
    <div className="bg-[#0D0D0D] text-white min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-yellow-400 uppercase tracking-tighter">Gamer Zone</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Welcome, {user.username}</p>
          </div>
          <div className="hidden lg:flex items-center gap-4 bg-[#1C1C1E] p-2 px-4 rounded-2xl border border-gray-800">
             <div className="text-right">
               <p className="text-[10px] text-gray-500 font-black uppercase">Balance</p>
               <p className="text-sm font-black text-yellow-400">{stats.walletBalance} Coins</p>
             </div>
             <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"><User size={16}/></div>
          </div>
        </div>

        {/* PRIORITY ACTION CARDS (Join & Notification) - Visible on PC and Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* JOIN TOURNAMENT CARD */}
          <Link to="/tournaments" className="block group">
            <div className="h-full bg-gradient-to-br from-blue-600 to-blue-900 p-6 rounded-[2rem] border border-blue-400/30 shadow-xl flex items-center justify-between relative overflow-hidden active:scale-95 transition-all">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={14} className="text-blue-200" />
                  <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Pro Matches</p>
                </div>
                <h2 className="text-white font-black text-2xl uppercase tracking-tight">Join Tournament</h2>
                <p className="text-blue-100/70 text-[10px] font-bold uppercase mt-1">Win real coins every day</p>
              </div>
              <div className="bg-white text-blue-700 p-4 rounded-2xl shadow-lg relative z-10 group-hover:rotate-12 transition-transform">
                <ArrowRight size={24} />
              </div>
            </div>
          </Link>

          {/* NOTIFICATION CONTROL CARD */}
          <div className="bg-[#1C1C1E] p-6 rounded-[2rem] border border-gray-800 shadow-xl flex items-center justify-between relative overflow-hidden">
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Bell size={14} className={isPushEnabled ? "text-green-400" : "text-gray-500"} />
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Alert System</p>
              </div>
              <h2 className="text-white font-black text-xl uppercase tracking-tight">
                {isPushEnabled ? 'Alerts Active' : 'Alerts Off'}
              </h2>
              <button 
                onClick={togglePushNotifications}
                disabled={isTogglingPush}
                className={`mt-3 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  isPushEnabled ? 'bg-gray-800 text-red-500 border border-red-500/20' : 'bg-yellow-400 text-black'
                }`}
              >
                {isTogglingPush ? <Loader2 size={12} className="animate-spin" /> : isPushEnabled ? <X size={12} /> : <Check size={12} />}
                {isPushEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
            <div className={`p-4 rounded-2xl border ${isPushEnabled ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
              <Bell size={24} />
            </div>
          </div>
        </div>
        {/* STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Wallet size={20} className="text-yellow-400" />} title="Wallet" value={stats.walletBalance} subtitle="available coins" color="yellow" />
          <StatCard icon={<Trophy size={20} className="text-green-400" />} title="Wins" value={stats.totalWins} subtitle="total matches" color="green" />
          <StatCard icon={<Zap size={20} className="text-blue-400" />} title="Joined" value={stats.activeTournaments} subtitle="participations" color="blue" />
          <StatCard icon={<DollarSign size={20} className="text-purple-400" />} title="Earnings" value={`+${stats.totalEarnings}`} subtitle="lifetime coins" color="purple" />
        </div>

        {/* QUICK NAVIGATION */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Link to="/tournaments"><NavCard icon={<Trophy size={24} className="text-yellow-400" />} title="Tournaments" /></Link>
          <Link to="/tasks"><NavCard icon={<Star size={24} className="text-orange-400" />} title="Tasks" /></Link>
          <Link to="/wallet"><NavCard icon={<Wallet size={24} className="text-green-400" />} title="Wallet" /></Link>
          <Link to="/support"><NavCard icon={<MessageSquare size={24} className="text-blue-400" />} title="Support" /></Link>
          <Link to="/profile"><NavCard icon={<User size={24} className="text-purple-400" />} title="Profile" /></Link>
          <Link to="/referral"><NavCard icon={<Zap size={24} className="text-pink-400" />} title="Referral" /></Link>
        </div>

        {/* MY TOURNAMENTS SECTION */}
        {joinedTournaments.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
              <Trophy size={18} /> My Active Matches
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {joinedTournaments.map(t => (
                <Link key={t.id} to="/tournaments" className="bg-[#1C1C1E] p-5 rounded-3xl border border-gray-800 flex justify-between items-center hover:border-yellow-400/50 transition-all">
                  <div>
                    <h4 className="font-bold text-white uppercase">{t.name}</h4>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{t.gameType} â€¢ {t.mode}</p>
                  </div>
                  <ChevronRight className="text-gray-600" />
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* PROFILE COMPLETION MODAL */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1C1C1E] w-full max-w-[320px] rounded-[2.5rem] border border-gray-800 p-8 shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-yellow-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-yellow-400/20">
                  <User size={32} className="text-yellow-400" />
                </div>
                <h2 className="text-xl font-black uppercase text-white">Setup Profile</h2>
                <p className="text-gray-500 text-[10px] font-bold uppercase mt-1">Required to play</p>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!profileUsername.trim() || profilePhone.length !== 10) return;
                setIsUpdatingProfile(true);
                try {
                  await updateDoc(doc(db, 'users', user.uid), { username: profileUsername.trim(), phoneNumber: '+92' + profilePhone.trim() });
                  setShowProfileModal(false);
                } catch (err) { console.error(err); } 
                finally { setIsUpdatingProfile(false); }
              }} className="space-y-4">
                <input type="text" required value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm text-white" placeholder="Username" />
                <div className="flex">
                  <span className="bg-gray-800 px-3 flex items-center rounded-l-xl text-xs font-bold border border-gray-700 text-gray-400">+92</span>
                  <input type="tel" required maxLength={10} value={profilePhone} onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, ''))} className="flex-1 bg-black border border-gray-800 rounded-r-xl px-4 py-3 text-sm text-white" placeholder="3001234567" />
                </div>
                <button type="submit" disabled={isUpdatingProfile} className="w-full bg-yellow-400 text-black font-black py-4 rounded-2xl uppercase text-xs flex items-center justify-center gap-2">
                  {isUpdatingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Finish Setup
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
