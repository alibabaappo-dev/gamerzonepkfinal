import { Wallet, Trophy, Zap, DollarSign, Star, MessageSquare, User, X, ChevronRight, ArrowRight, Bell, BarChart2, LogOut, Download, Plus, Phone, Check, Loader2, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { db, messaging } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, onSnapshot, orderBy, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { getToken, deleteToken } from 'firebase/messaging';
import { motion, AnimatePresence } from 'motion/react';

const Card = ({ children, className = '' }) => (
  <div className={`bg-[#2C2C2E] p-4 rounded-3xl relative overflow-hidden border border-gray-700/50 ${className}`}>
    {children}
  </div>
);

const colorVariants = {
  yellow: { border: 'border-yellow-500/50', bg: 'bg-yellow-500/10', shadow: 'shadow-yellow-500/10' },
  green: { border: 'border-green-500/50', bg: 'bg-green-500/10', shadow: 'shadow-green-500/10' },
  blue: { border: 'border-blue-500/50', bg: 'bg-blue-500/10', shadow: 'shadow-blue-500/10' },
  purple: { border: 'border-purple-500/50', bg: 'bg-purple-500/10', shadow: 'shadow-purple-500/10' },
  orange: { border: 'border-orange-500/50', bg: 'bg-orange-500/10', shadow: 'shadow-orange-500/10' },
  pink: { border: 'border-pink-500/50', bg: 'bg-pink-500/10', shadow: 'shadow-pink-500/10' }
};

const StatCard = ({ icon, title, value, subtitle, color, trendIcon }) => {
  const variants = colorVariants[color] || colorVariants.yellow;
  return (
    <Card className={variants.border}>
      <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full blur-3xl ${variants.bg}`}></div>
      <div className="flex flex-col justify-between h-full relative z-10">
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

export default function Home({ user, onLogout }) {
  const [stats, setStats] = useState({ totalWins: 0, activeTournaments: 0, walletBalance: 0, totalEarnings: 0 });
  const [userRank, setUserRank] = useState(0);
  const [userNotifications, setUserNotifications] = useState([]);
  const [globalNotifications, setGlobalNotifications] = useState([]);
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
    if (user?.fcmTokens && user.fcmTokens.length > 0) {
      setIsPushEnabled(true);
    } else {
      setIsPushEnabled(false);
    }
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
    } catch (error) {
      console.error(error);
    } finally {
      setIsTogglingPush(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setStats(prev => ({ ...prev, walletBalance: userData.walletBalance || 0, totalWins: userData.totalWins || 0 }));
        if (!userData.username || (!userData.phoneNumber && !userData.phone)) {
          setShowProfileModal(true);
          setProfileUsername(userData.username || '');
          setProfilePhone(userData.phoneNumber?.replace('+92', '') || '');
        } else {
          setShowProfileModal(false);
        }
      }
    });

    const unsubAllTournaments = onSnapshot(collection(db, 'tournaments'), (snapshot) => {
      setAllTournaments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRegistrations = onSnapshot(query(collection(db, 'registrations'), where('userId', '==', user.uid)), (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().tournamentId);
      setJoinedIds([...new Set(ids)]);
      setStats(prev => ({ ...prev, activeTournaments: [...new Set(ids)].length }));
    });

    const unsubTickets = onSnapshot(query(collection(db, 'support_tickets'), where('userId', '==', user.uid)), (snapshot) => {
      setSupportTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)).slice(0, 2));
    });

    const unsubTransactions = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', user.uid)), (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setStats(prev => ({ ...prev, totalEarnings: txData.filter((tx:any) => tx.type === 'Winning' || tx.type === 'Kills').reduce((sum, tx:any) => sum + (tx.amount || 0), 0) }));
      setRecentTransactions(txData.slice(0, 3));
      setLoading(false);
    });

    onSnapshot(query(collection(db, 'users'), orderBy('totalWins', 'desc'), limit(100)), (snapshot) => {
      const rank = snapshot.docs.findIndex(doc => doc.id === user.uid) + 1;
      setUserRank(rank);
    });

    return () => { unsubUser(); unsubAllTournaments(); unsubRegistrations(); unsubTickets(); unsubTransactions(); };
  }, [user]);

  const joinedTournaments = useMemo(() => {
    return allTournaments.filter(t => joinedIds.includes(t.id) && !['completed', 'Result', 'result'].includes(t.status));
  }, [allTournaments, joinedIds]);

  if (loading) return null;

  return (
    <div className="bg-[#0D0D0D] text-white min-h-screen">
      {/* Desktop Dashboard */}
      <div className="hidden lg:block min-h-screen container mx-auto px-8 py-12">
        <div className="flex justify-between items-end mb-12">
          <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-6 bg-[#1C1C1E]/50 border border-gray-800/50 px-6 py-2.5 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700"><User size={20} className="text-gray-400" /></div>
              <div className="text-left"><p className="text-sm font-bold">{user.username}</p><p className="text-[10px] text-gray-500">{user.email}</p></div>
            </div>
            <button onClick={onLogout} className="text-red-500 font-bold text-sm">Logout</button>
          </div>
        </div>
        {/* Desktop Priority Buttons */}
        <div className="grid grid-cols-2 gap-6 mb-8">
            <Link to="/tournaments" className="bg-blue-600 hover:bg-blue-500 p-6 rounded-3xl flex items-center justify-between transition-all active:scale-95 shadow-xl">
                <div>
                    <h2 className="text-2xl font-black uppercase">Join Tournament</h2>
                    <p className="text-blue-100 text-sm opacity-80">Play matches and win prizes</p>
                </div>
                <Trophy size={40} className="text-white opacity-20" />
            </Link>
            <div className="bg-[#1C1C1E] border border-gray-700 p-6 rounded-3xl flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Push Notifications</p>
                    <button onClick={togglePushNotifications} disabled={isTogglingPush} className={`${isPushEnabled ? 'bg-gray-700 text-red-500' : 'bg-yellow-400 text-black'} font-bold py-2 px-6 rounded-xl text-sm flex items-center gap-2`}>
                        {isTogglingPush ? <Loader2 size={14} className="animate-spin" /> : isPushEnabled ? <X size={14} /> : <Check size={14} />}
                        {isPushEnabled ? 'Disable Notifications' : 'Enable Notifications'}
                    </button>
                </div>
                <Bell className={isPushEnabled ? "text-green-400" : "text-gray-500"} size={40} />
            </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-12">
          <StatCard icon={<Wallet size={28} className="text-yellow-400" />} title="Wallet Balance" value={stats.walletBalance} subtitle="coins" color="yellow" />
          <StatCard icon={<Trophy size={28} className="text-green-400" />} title="Total Wins" value={stats.totalWins} subtitle="matches" color="green" />
          <StatCard icon={<Zap size={28} className="text-blue-400" />} title="Total Joined" value={stats.activeTournaments} subtitle="matches" color="blue" />
          <StatCard icon={<DollarSign size={28} className="text-purple-400" />} title="Total Earnings" value={`+${stats.totalEarnings}`} subtitle="coins" color="purple" />
        </div>

        <div className="grid grid-cols-6 gap-6 mb-12">
          <Link to="/tournaments"><NavCard icon={<Trophy size={24} className="text-yellow-400" />} title="Browse Tournaments" /></Link>
          <Link to="/tasks"><NavCard icon={<Star size={24} className="text-orange-400" />} title="Daily Tasks" /></Link>
          <Link to="/wallet"><NavCard icon={<Wallet size={24} className="text-green-400" />} title="My Wallet" /></Link>
          <Link to="/support"><NavCard icon={<MessageSquare size={24} className="text-blue-400" />} title="Support" /></Link>
          <Link to="/profile"><NavCard icon={<User size={24} className="text-purple-400" />} title="Profile" /></Link>
          <Link to="/referral"><NavCard icon={<Zap size={24} className="text-pink-400" />} title="Referral" /></Link>
        </div>
      </div>

      {/* Mobile Dashboard */}
      <div className="lg:hidden container mx-auto p-4 pb-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-yellow-400">Welcome back, {user.username}!</h1>
          <p className="text-gray-400">Track your progress and manage your gaming journey</p>
        </div>

        {/* MOBILE JOIN BUTTON */}
        <Link to="/tournaments" className="block mb-4">
            <div className="bg-blue-600 p-5 rounded-3xl flex justify-between items-center shadow-lg active:scale-95 transition-transform">
                <div>
                    <h2 className="text-white font-black text-xl uppercase">Join Tournament</h2>
                    <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">Win coins every day</p>
                </div>
                <Trophy size={28} className="text-white opacity-40" />
            </div>
        </Link>

        {/* MOBILE NOTIFICATION BUTTON */}
        <Card className="mb-8 flex justify-between items-center border-yellow-500/50">
          <div className="flex-1">
            <p className="text-sm text-gray-300">Notification Alerts</p>
            <button onClick={togglePushNotifications} disabled={isTogglingPush} className={`${isPushEnabled ? 'bg-gray-700 text-red-500' : 'bg-yellow-400 text-black'} font-bold py-2 px-5 rounded-xl mt-2 text-xs flex items-center justify-center gap-2`}>
              {isTogglingPush ? <Loader2 size={12} className="animate-spin" /> : isPushEnabled ? <X size={12} /> : <Check size={12} />}
              {isPushEnabled ? 'Disable' : 'Enable Notifications'}
            </button>
          </div>
          <Bell className={isPushEnabled ? "text-green-400" : "text-gray-400"} size={24} />
        </Card>

        <div className="grid grid-cols-2 gap-4 mb-8 pl-2 pr-2">
          <StatCard icon={<Wallet size={20} className="text-yellow-400" />} title="Wallet Balance" value={stats.walletBalance} subtitle="coins" color="yellow" trendIcon={<BarChart2 size={16} className="text-green-400" />} />
          <StatCard icon={<Trophy size={20} className="text-green-400" />} title="Total Wins" value={stats.totalWins} subtitle="matches" color="green" trendIcon={<BarChart2 size={16} className="text-gray-500" />} />
          <StatCard icon={<Zap size={20} className="text-blue-400" />} title="Total Joined" value={stats.activeTournaments} subtitle="matches" color="blue" trendIcon={<Zap size={16} className="text-blue-400" />} />
          <StatCard icon={<DollarSign size={20} className="text-purple-400" />} title="Total Earnings" value={`+${stats.totalEarnings}`} subtitle="coins" color="purple" trendIcon={<BarChart2 size={16} className="text-green-400" />} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8 pl-2 pr-2">
          <Link to="/tournaments"><NavCard icon={<Trophy size={24} className="text-yellow-400" />} title="Browse Tournaments" /></Link>
          <Link to="/tasks"><NavCard icon={<Star size={24} className="text-orange-400" />} title="Daily Tasks" /></Link>
          <Link to="/wallet"><NavCard icon={<Wallet size={24} className="text-green-400" />} title="My Wallet" /></Link>
          <Link to="/support"><NavCard icon={<MessageSquare size={24} className="text-blue-400" />} title="Support" /></Link>
          <Link to="/profile"><NavCard icon={<User size={24} className="text-purple-400" />} title="Profile" /></Link>
          <Link to="/referral"><NavCard icon={<Zap size={24} className="text-pink-400" />} title="Referral" /></Link>
        </div>

        {/* My Tournaments */}
        {joinedTournaments.length > 0 && (
          <Card className="mb-6 border-yellow-400/80">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-3"><Trophy size={20} className="text-yellow-400" /><h2 className="font-bold text-lg">My Tournaments</h2></div>
              <Link to="/tournaments" className="text-yellow-400 text-sm font-semibold flex items-center">View All <ChevronRight size={16} /></Link>
            </div>
            <div className="space-y-4">
              {joinedTournaments.map((tournament) => (
                <div key={tournament.id} className="bg-[#1C1C1E] p-4 rounded-xl border border-gray-700">
                  <div className="flex justify-between items-start mb-2"><h3 className="font-bold text-white text-sm">{tournament.name}</h3><span className="text-green-400 text-xs font-bold">Prize {tournament.prizePool} coins</span></div>
                  <Link to="/tournaments" className="block w-full bg-yellow-400 text-black text-center text-xs font-bold py-2 rounded-lg">View Tournament</Link>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1C1C1E] w-full max-w-[320px] rounded-[2rem] border border-gray-800 p-6 shadow-2xl">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-yellow-400/10 rounded-2xl flex items-center justify-center mb-3 border border-yellow-400/20"><User size={32} className="text-yellow-400" /></div>
                <h2 className="text-xl font-black uppercase text-white">Setup Profile</h2>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!profileUsername.trim() || profilePhone.length !== 10) return;
                setIsUpdatingProfile(true);
                try {
                  await updateDoc(doc(db, 'users', user.uid), { username: profileUsername.trim(), phoneNumber: '+92' + profilePhone.trim() });
                  setShowProfileModal(false);
                } catch (err) { console.error(err); } finally { setIsUpdatingProfile(false); }
              }} className="space-y-4">
                <input type="text" required value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm text-white" placeholder="Username" />
                <div className="flex">
                  <span className="bg-gray-800 px-3 flex items-center rounded-l-xl text-xs font-bold border border-gray-700 text-gray-400">+92</span>
                  <input type="tel" required maxLength={10} value={profilePhone} onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, ''))} className="flex-1 bg-black border border-gray-800 rounded-r-xl px-4 py-3 text-sm text-white" placeholder="3001234567" />
                </div>
                <button type="submit" disabled={isUpdatingProfile} className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2">
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
