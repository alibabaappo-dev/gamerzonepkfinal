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
      if (!msg) throw new Error('Messaging not supported');

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
        } else {
          alert('Please allow notification permission in your browser settings.');
        }
      }
    } catch (error) {
      console.error('Push toggle error:', error);
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
      const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a:any, b:any) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setSupportTickets(tickets.slice(0, 2));
    });

    const unsubTransactions = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', user.uid)), (snapshot) => {
      const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a:any, b:any) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setStats(prev => ({ ...prev, totalEarnings: txData.filter(tx => tx.type === 'Winning' || tx.type === 'Kills').reduce((sum, tx) => sum + (tx.amount || 0), 0) }));
      setRecentTransactions(txData.slice(0, 3));
      setLoading(false);
    });

    onSnapshot(query(collection(db, 'users'), orderBy('totalWins', 'desc'), limit(100)), (snapshot) => {
      const rank = snapshot.docs.findIndex(doc => doc.id === user.uid) + 1;
      setUserRank(rank);
    });

    const qUserNotifs = query(collection(db, 'notifications'), where('userId', '==', user.uid));
    const qGlobalNotifs = query(collection(db, 'global_notifications'), orderBy('createdAt', 'desc'));
    onSnapshot(qUserNotifs, (s1) => {
      const n1 = s1.docs.map(d => ({ ...d.data(), id: d.id, isGlobal: false }));
      onSnapshot(qGlobalNotifs, (s2) => {
        const n2 = s2.docs.map(d => ({ ...d.data(), id: d.id, isGlobal: true }));
        const combined = [...n1, ...n2].sort((a:any, b:any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setRecentNotifications(combined.slice(0, 2));
      });
    });

    return () => { unsubUser(); unsubAllTournaments(); unsubRegistrations(); unsubTickets(); unsubTransactions(); };
  }, [user]);

  const joinedTournaments = useMemo(() => {
    return allTournaments.filter(t => joinedIds.includes(t.id) && !['completed', 'Result', 'result'].includes(t.status));
  }, [allTournaments, joinedIds]);

  if (loading) return <LoadingScreen message="Loading dashboard..." />;

  return (
    <div className="bg-[#0D0D0D] text-white min-h-screen">
      
      {/* ------------------- DESKTOP (PC) VIEW ------------------- */}
      <div className="hidden lg:block min-h-screen relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
        <div className="container mx-auto px-8 py-12 relative z-10">
          
          <div className="flex justify-between items-center mb-12">
            <h1 className="text-5xl font-black tracking-tight">Dashboard</h1>
            <div className="flex items-center gap-6 bg-[#1C1C1E]/50 backdrop-blur-md border border-gray-800/50 px-6 py-3 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700"><User size={20} className="text-gray-400" /></div>
                <div className="text-left"><p className="text-sm font-bold">{user.username}</p><p className="text-[10px] text-gray-500">{user.email}</p></div>
              </div>
              <div className="h-8 w-[1px] bg-gray-800/50" />
              <button onClick={onLogout} className="flex items-center gap-2 text-red-500 hover:text-red-400 font-bold text-sm"><LogOut size={18} /> Logout</button>
            </div>
          </div>
          {/* PC PRIORITY BUTTONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Link to="/tournaments" className="block group">
              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-800 p-8 rounded-[2.5rem] border border-blue-400/30 shadow-2xl flex items-center justify-between overflow-hidden relative active:scale-95 transition-transform">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="relative z-10">
                  <h2 className="text-white font-black text-3xl uppercase">Join Tournament</h2>
                  <p className="text-blue-100 text-sm font-bold uppercase tracking-widest mt-2">Browse matches and win coins</p>
                </div>
                <div className="bg-white text-blue-700 p-5 rounded-3xl shadow-xl relative z-10"><Trophy size={40} /></div>
              </div>
            </Link>

            <div className="bg-[#1C1C1E] p-8 rounded-[2.5rem] border border-gray-800 shadow-2xl flex flex-col justify-center relative">
               <div className="flex items-center gap-3 mb-2">
                 <Bell size={18} className={isPushEnabled ? "text-green-400" : "text-gray-500"} />
                 <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Notification Alerts</p>
               </div>
               <h3 className="text-white font-black text-xl uppercase mb-6">{isPushEnabled ? 'Alerts are Active' : 'Alerts are Disabled'}</h3>
               <button onClick={togglePushNotifications} disabled={isTogglingPush} className={`w-full font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg ${isPushEnabled ? 'bg-gray-800 text-red-500 border border-red-500/20' : 'bg-yellow-400 text-black'}`}>
                  {isTogglingPush ? <Loader2 size={16} className="animate-spin" /> : isPushEnabled ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                  {isPushEnabled ? 'Disable Alerts' : 'Enable Notifications'}
                </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6 mb-12">
            <StatCard icon={<Wallet size={28} className="text-yellow-400" />} title="Wallet Balance" value={stats.walletBalance} subtitle="coins" color="yellow" />
            <StatCard icon={<Trophy size={28} className="text-green-400" />} title="Total Wins" value={stats.totalWins} subtitle="matches" color="green" />
            <StatCard icon={<Zap size={28} className="text-blue-400" />} title="Total Joined" value={stats.activeTournaments} subtitle="matches" color="blue" />
            <StatCard icon={<DollarSign size={28} className="text-purple-400" />} title="Total Earnings" value={`+${stats.totalEarnings}`} subtitle="coins" color="purple" />
          </div>

          <div className="grid grid-cols-6 gap-6 mb-12">
            {[
              { icon: <Trophy size={24} className="text-yellow-400" />, label: 'Tournaments', path: '/tournaments' },
              { icon: <Star size={24} className="text-orange-400" />, label: 'Daily Tasks', path: '/tasks' },
              { icon: <Wallet size={24} className="text-green-400" />, label: 'My Wallet', path: '/wallet' },
              { icon: <MessageSquare size={24} className="text-blue-400" />, label: 'Support', path: '/support' },
              { icon: <User size={24} className="text-purple-400" />, label: 'Profile', path: '/profile' },
              { icon: <Zap size={24} className="text-pink-400" />, label: 'Referral', path: '/referral' },
            ].map((item) => (
              <Link key={item.label} to={item.path} className="bg-[#1C1C1E] p-6 rounded-3xl border border-gray-800 flex flex-col items-center justify-center hover:bg-gray-800 transition-all hover:-translate-y-1">
                <div className="mb-4 bg-gray-900 p-4 rounded-2xl">{item.icon}</div>
                <span className="font-bold text-gray-300 text-sm text-center">{item.label}</span>
              </Link>
            ))}
          </div>
          
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-8 space-y-8">
                <div className="bg-[#1C1C1E] rounded-3xl border border-gray-800 overflow-hidden">
                    <div className="p-8 border-b border-gray-800/50 flex justify-between items-center bg-[#1F1F22]/50">
                        <div className="flex items-center gap-4"><Trophy className="text-yellow-400" size={20} /> <h2 className="text-xl font-bold">My Tournaments</h2></div>
                        <Link to="/tournaments" className="text-yellow-400 text-sm font-bold flex items-center hover:underline">View All <ChevronRight size={16} /></Link>
                    </div>
                    <div className="p-6">
                        {joinedTournaments.length > 0 ? (
                            <div className="space-y-4">
                                {joinedTournaments.map(t => (
                                    <div key={t.id} className="bg-[#252528] p-5 rounded-2xl border border-gray-700/50 flex justify-between items-center">
                                        <div><h3 className="text-lg font-bold">{t.name}</h3><p className="text-xs text-gray-500 uppercase mt-1">{t.gameType} â€¢ {t.mode}</p></div>
                                        <div className="text-right flex items-center gap-6">
                                            <div><p className="text-xs text-gray-500 uppercase">Prize Pool</p><p className="text-green-400 font-black">{t.prizePool} Coins</p></div>
                                            <Link to="/tournaments" className="bg-yellow-400 text-black text-xs font-bold px-6 py-3 rounded-xl">View details</Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : ( <p className="text-center text-gray-500 py-8">No joined tournaments</p> )}
                    </div>
                </div>
            </div>
            <div className="col-span-4 space-y-8">
                <Card className="p-8 flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full bg-yellow-400/10 flex items-center justify-center border-2 border-yellow-400 mb-6"><User size={40} className="text-yellow-400" /></div>
                    <h3 className="text-2xl font-black">{user.username}</h3>
                    <p className="text-gray-500 mb-8">{user.email}</p>
                    <div className="w-full bg-[#252528] p-4 rounded-2xl flex items-center justify-between border border-gray-700/50">
                        <div className="text-left"><p className="text-[10px] text-gray-500 uppercase font-black">Referral Code</p><p className="text-lg font-black text-blue-400 font-mono">{user.referralCode || '---'}</p></div>
                        <button onClick={handleCopyCode} className="p-3 bg-gray-800 rounded-xl">{copied ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}</button>
                    </div>
                </Card>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------- MOBILE VIEW ------------------- */}
      <div className="lg:hidden container mx-auto p-4 pb-24">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-yellow-400 uppercase tracking-tight">Gamer Zone</h1>
          <p className="text-gray-400 text-sm font-bold">Welcome back, {user.username}!</p>
        </div>

        {/* MOBILE PRIORITY JOIN BUTTON */}
        <Link to="/tournaments" className="block mb-6 group">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-5 rounded-[2rem] border border-blue-400/30 shadow-xl flex items-center justify-between overflow-hidden relative active:scale-95 transition-transform">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="relative z-10">
              <h2 className="text-white font-black text-xl uppercase tracking-tight">Join Tournament</h2>
              <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">Play matches and win coins</p>
            </div>
            <div className="bg-white text-blue-700 p-3 rounded-2xl shadow-lg relative z-10">
              <Trophy size={24} />
            </div>
          </div>
        </Link>

        {/* MOBILE NOTIFICATION CONTROL */}
        <Card className="mb-8 border-gray-800 bg-[#1C1C1E]">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Bell size={14} className={isPushEnabled ? "text-green-400" : "text-gray-500"} />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Notification Alerts</p>
              </div>
              <h3 className="text-white font-black text-sm uppercase">{isPushEnabled ? 'Alerts are Active' : 'Alerts are Disabled'}</h3>
              <div className="flex gap-2 mt-3">
                <button onClick={togglePushNotifications} disabled={isTogglingPush} className={`flex-1 font-black py-3 px-4 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${isPushEnabled ? 'bg-gray-800 text-red-500 border border-red-500/20' : 'bg-yellow-400 text-black'}`}>
                  {isTogglingPush ? <Loader2 size={12} className="animate-spin" /> : isPushEnabled ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                  {isPushEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard icon={<Wallet size={20} className="text-yellow-400" />} title="Wallet Balance" value={stats.walletBalance} subtitle="coins" color="yellow" />
          <StatCard icon={<Trophy size={20} className="text-green-400" />} title="Total Wins" value={stats.totalWins} subtitle="matches" color="green" />
          <StatCard icon={<Zap size={20} className="text-blue-400" />} title="Total Joined" value={stats.activeTournaments} subtitle="matches" color="blue" />
          <StatCard icon={<DollarSign size={20} className="text-purple-400" />} title="Total Earnings" value={`+${stats.totalEarnings}`} subtitle="coins" color="purple" />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link to="/tournaments"><NavCard icon={<Trophy size={24} className="text-yellow-400" />} title="Browse Tournaments" /></Link>
          <Link to="/tasks"><NavCard icon={<Star size={24} className="text-orange-400" />} title="Daily Tasks" /></Link>
          <Link to="/wallet"><NavCard icon={<Wallet size={24} className="text-green-400" />} title="My Wallet" /></Link>
          <Link to="/support"><NavCard icon={<MessageSquare size={24} className="text-blue-400" />} title="Support" /></Link>
        </div>

        <Card className="mb-6 border-yellow-600/50">
            <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-yellow-400/10 flex items-center justify-center border-2 border-yellow-400 mb-4"><User size={40} className="text-yellow-400"/></div>
                <h3 className="font-bold text-xl">{user.username}</h3>
                <p className="text-gray-400 text-sm">{user.email}</p>
                <div className="flex space-x-8 mt-4">
                    <div><p className="text-2xl font-bold">{stats.activeTournaments}</p><p className="text-xs text-gray-500 uppercase font-black">Joined</p></div>
                    <div><p className="text-2xl font-bold">{stats.totalWins}</p><p className="text-xs text-gray-500 uppercase font-black">Wins</p></div>
                </div>
            </div>
        </Card>
      </div>

      {/* MODALS & PROMPTS (KEPT SAME) */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-6 left-4 right-4 z-[100] lg:left-auto lg:right-6 lg:w-96">
            <div className="bg-gradient-to-r from-[#F27D26] to-[#F7B733] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
              <div className="flex items-start gap-4">
                <div className="bg-black/10 p-2 rounded-xl"><Download size={24} className="text-black" /></div>
                <div className="flex-1">
                  <h3 className="text-black font-extrabold text-lg leading-tight mb-1">Install Gamer Zone</h3>
                  <p className="text-black/80 text-sm font-medium leading-tight mb-4">Add to your home screen for quick access!</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowInstructions(true)} className="flex-1 bg-black text-yellow-400 font-bold py-3 rounded-xl text-sm">Instructions</button>
                    <button onClick={() => setShowInstallPrompt(false)} className="bg-[#E67E22] text-black p-3 rounded-xl"><X size={20} /></button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1C1C1E] w-full max-w-[320px] rounded-[2rem] border border-gray-800 p-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-yellow-400/10 rounded-2xl flex items-center justify-center mb-3 border border-yellow-400/20"><User size={32} className="text-yellow-400" /></div>
                <h2 className="text-xl font-black uppercase">Complete Profile</h2>
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
                <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-500 ml-1">Username</label><input type="text" required value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm" placeholder="Your Name" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black uppercase text-gray-500 ml-1">Phone Number</label><div className="flex"><span className="bg-gray-800 px-3 flex items-center rounded-l-xl text-xs border border-gray-700">+92</span><input type="tel" required maxLength={10} value={profilePhone} onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, ''))} className="flex-1 bg-black border border-gray-800 rounded-r-xl px-4 py-3 text-sm" placeholder="3001234567" /></div></div>
                <button type="submit" disabled={isUpdatingProfile} className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                  {isUpdatingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save Profile
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
