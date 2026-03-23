import { Wallet, Trophy, Zap, DollarSign, Star, MessageSquare, User, X, ChevronRight, ArrowRight, Bell, BarChart2, LogOut, Download, Plus, Phone, Check, Loader2, Copy, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { db, messaging } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc, onSnapshot, orderBy, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { getToken, deleteToken } from 'firebase/messaging';
import { motion, AnimatePresence } from 'framer-motion';

const Card = ({ children, className = '' }) => (
  <div className={`bg-[#2C2C2E] p-4 rounded-3xl relative overflow-hidden border border-gray-700/50 ${className}`}>
    {children}
  </div>
);

const colorVariants = {
  yellow: { border: 'border-yellow-500/50', bg: 'bg-yellow-500/10', shadow: 'shadow-yellow-500/10' },
  green: { border: 'border-green-500/50', bg: 'bg-green-500/10', shadow: 'shadow-green-500/10' },
  blue: { border: 'border-blue-500/50', bg: 'bg-blue-500/10', shadow: 'shadow-blue-500/10' },
  purple: { border: 'border-purple-500/50', bg: 'bg-purple-500/10', shadow: 'shadow-purple-500/10' }
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
    } catch (e) { console.error(e); } finally { setIsTogglingPush(false); }
  };

  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        setStats(prev => ({ ...prev, walletBalance: d.walletBalance || 0, totalWins: d.totalWins || 0 }));
        if (!d.username || !d.phoneNumber) setShowProfileModal(true);
      }
    });
    onSnapshot(collection(db, 'tournaments'), (s) => setAllTournaments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(query(collection(db, 'registrations'), where('userId', '==', user.uid)), (s) => {
      const ids = s.docs.map(d => d.data().tournamentId);
      setJoinedIds(ids);
      setStats(prev => ({ ...prev, activeTournaments: ids.length }));
    });
    onSnapshot(query(collection(db, 'transactions'), where('userId', '==', user.uid), limit(3)), (s) => {
      const txs = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecentTransactions(txs);
      setStats(prev => ({ ...prev, totalEarnings: txs.filter((tx:any) => tx.type === 'Winning' || tx.type === 'Kills').reduce((sum, tx:any) => sum + (tx.amount || 0), 0) }));
      setLoading(false);
    });
    onSnapshot(query(collection(db, 'users'), orderBy('totalWins', 'desc'), limit(100)), (s) => {
      const rank = s.docs.findIndex(doc => doc.id === user.uid) + 1;
      setUserRank(rank);
    });
    const qUserNotifs = query(collection(db, 'notifications'), where('userId', '==', user.uid), limit(2));
    onSnapshot(qUserNotifs, (s) => setRecentNotifications(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    onSnapshot(query(collection(db, 'support_tickets'), where('userId', '==', user.uid), limit(2)), (s) => setSupportTickets(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  const joinedTournaments = useMemo(() => allTournaments.filter(t => joinedIds.includes(t.id) && t.status !== 'Completed'), [allTournaments, joinedIds]);

  if (loading) return null;

  return (
    <div className="bg-[#0D0D0D] text-white min-h-screen">
      
      {/* ------------------- PC VIEW (FULL OLD UI) ------------------- */}
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
          <div className="grid grid-cols-2 gap-6 mb-12">
            <Link to="/tournaments" className="bg-blue-600 hover:bg-blue-500 p-8 rounded-[2.5rem] flex items-center justify-between transition-all active:scale-95 shadow-xl">
                <div><h2 className="text-3xl font-black uppercase">Join Tournament</h2><p className="text-blue-100 opacity-80">Play matches and win prizes</p></div>
                <Trophy size={48} className="text-white opacity-20" />
            </Link>
            <div className="bg-[#1C1C1E] border border-gray-700 p-8 rounded-[2.5rem] flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Notification System</p>
                    <button onClick={togglePushNotifications} disabled={isTogglingPush} className={`${isPushEnabled ? 'bg-gray-700 text-red-500' : 'bg-yellow-400 text-black'} font-black py-3 px-8 rounded-2xl text-xs flex items-center gap-2`}>
                        {isTogglingPush ? <Loader2 size={16} className="animate-spin" /> : isPushEnabled ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                        {isPushEnabled ? 'Disable Notifications' : 'Enable Notifications'}
                    </button>
                </div>
                <Bell className={isPushEnabled ? "text-green-400" : "text-gray-500"} size={48} />
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
                <Card className="p-0 border-gray-800 bg-[#1C1C1E]"><div className="p-8 border-b border-gray-800/50 flex justify-between items-center bg-[#1F1F22]/50"><div className="flex items-center gap-4"><Trophy className="text-yellow-400" size={20} /> <h2 className="text-xl font-bold">My Tournaments</h2></div><Link to="/tournaments" className="text-yellow-400 text-sm font-bold flex items-center hover:underline">View All <ChevronRight size={16} /></Link></div><div className="p-6">{joinedTournaments.length > 0 ? <div className="space-y-4">{joinedTournaments.map(t => <div key={t.id} className="bg-[#252528] p-5 rounded-2xl border border-gray-700/50 flex justify-between items-center"><div><h3 className="text-lg font-bold">{t.name}</h3><p className="text-xs text-gray-500 uppercase mt-1">{t.gameType} â€¢ {t.mode}</p></div><div className="text-right flex items-center gap-6"><div><p className="text-xs text-gray-500 uppercase">Prize Pool</p><p className="text-green-400 font-black">{t.prizePool} Coins</p></div><Link to="/tournaments" className="bg-yellow-400 text-black text-xs font-bold px-6 py-3 rounded-xl shadow-lg">View details</Link></div></div>)}</div> : <p className="text-center text-gray-500 py-8">No active matches found.</p>}</div></Card>
            </div>
            <div className="col-span-4 space-y-8">
                <Card className="p-8 flex flex-col items-center text-center"><div className="w-24 h-24 rounded-full bg-yellow-400/10 flex items-center justify-center border-2 border-yellow-400 mb-6 shadow-xl shadow-yellow-500/10"><User size={40} className="text-yellow-400" /></div><h3 className="text-2xl font-black uppercase tracking-tight">{user.username}</h3><p className="text-gray-500 mb-8">{user.email}</p><div className="w-full bg-[#252528] p-4 rounded-2xl flex items-center justify-between border border-gray-700/50"><div className="text-left"><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Referral Code</p><p className="text-xl font-black text-blue-400 font-mono tracking-widest">{user.referralCode || '---'}</p></div><button onClick={handleCopyCode} className="p-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors">{copied ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}</button></div></Card>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------- MOBILE VIEW (FULL OLD UI) ------------------- */}
      <div className="lg:hidden container mx-auto p-4 pb-24">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-yellow-400 uppercase tracking-tighter">Gamer Zone</h1>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Welcome, {user.username}!</p>
        </div>

        {/* MOBILE PRIORITY JOIN BUTTON */}
        <Link to="/tournaments" className="block mb-4">
            <div className="bg-blue-600 p-5 rounded-3xl flex justify-between items-center shadow-lg active:scale-95 transition-transform border border-blue-400/30">
                <div><h2 className="text-white font-black text-xl uppercase">Join Tournament</h2><p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">Win coins every day</p></div>
                <Trophy size={28} className="text-white opacity-40" />
            </div>
        </Link>

        {/* MOBILE NOTIFICATION BUTTON */}
        <Card className="mb-8 flex justify-between items-center border-yellow-500/50">
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Alert Notifications</p>
            <button onClick={togglePushNotifications} disabled={isTogglingPush} className={`${isPushEnabled ? 'bg-gray-700 text-red-500' : 'bg-yellow-400 text-black'} font-black py-2 px-5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg`}>
              {isTogglingPush ? <Loader2 size={12} className="animate-spin" /> : isPushEnabled ? <X size={12} /> : <Check size={12} />}
              {isPushEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
          <Bell className={isPushEnabled ? "text-green-400" : "text-gray-500"} size={24} />
        </Card>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard icon={<Wallet size={20} className="text-yellow-400" />} title="Wallet Balance" value={stats.walletBalance} subtitle="coins" color="yellow" trendIcon={<BarChart2 size={16} className="text-green-400" />} />
          <StatCard icon={<Trophy size={20} className="text-green-400" />} title="Total Wins" value={stats.totalWins} subtitle="matches" color="green" trendIcon={<BarChart2 size={16} className="text-gray-500" />} />
          <StatCard icon={<Zap size={20} className="text-blue-400" />} title="Total Joined" value={stats.activeTournaments} subtitle="matches" color="blue" trendIcon={<Zap size={16} className="text-blue-400" />} />
          <StatCard icon={<DollarSign size={20} className="text-purple-400" />} title="Total Earnings" value={`+${stats.totalEarnings}`} subtitle="coins" color="purple" trendIcon={<BarChart2 size={16} className="text-green-400" />} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link to="/tournaments"><NavCard icon={<Trophy size={24} className="text-yellow-400" />} title="Tournaments" /></Link>
          <Link to="/tasks"><NavCard icon={<Star size={24} className="text-orange-400" />} title="Daily Tasks" /></Link>
          <Link to="/wallet"><NavCard icon={<Wallet size={24} className="text-green-400" />} title="My Wallet" /></Link>
          <Link to="/support"><NavCard icon={<MessageSquare size={24} className="text-blue-400" />} title="Support" /></Link>
          <Link to="/profile"><NavCard icon={<User size={24} className="text-purple-400" />} title="Profile" /></Link>
          <Link to="/referral"><NavCard icon={<Zap size={24} className="text-pink-400" />} title="Referral" /></Link>
        </div>

        <Card className="mb-6 border-yellow-600/50">
            <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-yellow-400/10 flex items-center justify-center border-2 border-yellow-400 mb-4"><User size={40} className="text-yellow-400"/></div>
                <h3 className="font-bold text-xl uppercase">{user.username}</h3>
                <p className="text-gray-400 text-sm">{user.email}</p>
                <div className="flex space-x-8 mt-4">
                    <div><p className="text-2xl font-black">{stats.activeTournaments}</p><p className="text-[10px] text-gray-500 uppercase font-black">Joined</p></div>
                    <div><p className="text-2xl font-black">{stats.totalWins}</p><p className="text-[10px] text-gray-500 uppercase font-black">Wins</p></div>
                </div>
            </div>
        </Card>
      </div>

      {/* --- ALL MODALS (UNCHANGED) --- */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#1C1C1E] w-full max-w-[320px] rounded-[2.5rem] border border-gray-800 p-8 shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-yellow-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-yellow-400/20"><User size={32} className="text-yellow-400" /></div>
                <h2 className="text-xl font-black uppercase text-white">Setup Profile</h2>
                <p className="text-gray-500 text-[10px] font-bold uppercase mt-1">Details required for play</p>
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
                <input type="text" required value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:border-yellow-400 outline-none" placeholder="Username" />
                <div className="flex">
                  <span className="bg-gray-800 px-3 flex items-center rounded-l-xl text-xs font-bold border border-gray-700 text-gray-400">+92</span>
                  <input type="tel" required maxLength={10} value={profilePhone} onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, ''))} className="flex-1 bg-black border border-gray-800 rounded-r-xl px-4 py-3 text-sm text-white focus:border-yellow-400 outline-none" placeholder="3001234567" />
                </div>
                <button type="submit" disabled={isUpdatingProfile} className="w-full bg-yellow-400 text-black font-black py-4 rounded-xl uppercase text-xs flex items-center justify-center gap-2">
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
