import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Filter, Users, Calendar, Award, Coins, X, Copy, Check, CheckCircle, AlertCircle, Target, Clock, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { getCachedDocs } from '../lib/firestore-optimized';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, getDoc, setDoc, increment, onSnapshot, runTransaction, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'framer-motion';

export default function Tournaments() {
  const [user] = useAuthState(auth);
  const [gameType, setGameType] = useState('All');
  const [mode, setMode] = useState('All');
  const [activeModal, setActiveModal] = useState<{ type: 'join' | 'details', tournament: any } | null>(null);

  const [joinedTournaments, setJoinedTournaments] = useState<string[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [userData, setUserData] = useState<any>(null);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  // --- OPTIMIZED DATA LOAD (Anti-Loop) ---
  const loadData = async () => {
    try {
      setLoading(true);
      const tournamentsData = await getCachedDocs(db, 'tournaments');
      if (tournamentsData) {
        setTournaments([...tournamentsData].sort((a: any, b: any) => 
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        ));
      }

      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserBalance(data.walletBalance || 0);
          setUserData(data);
        }

        const regSnap = await getDocs(query(collection(db, 'registrations'), where('userId', '==', user.uid)));
        setJoinedTournaments(regSnap.docs.map(doc => doc.data().tournamentId));
      }
      setLoading(false);
    } catch (e) {
      console.error("Error:", e);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [user]);

  // Form states
  const [freeFireName, setFreeFireName] = useState('');
  const [freeFireId, setFreeFireId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleJoin = async () => {
    if (activeModal && activeModal.type === 'join' && user) {
      const tournament = activeModal.tournament;
      if (!freeFireName || !freeFireId || !phoneNumber) {
        showNotification("Please fill in all required fields", "error");
        return;
      }
      setIsJoining(true);
      try {
        await runTransaction(db, async (transaction) => {
          const tRef = doc(db, 'tournaments', tournament.id);
          const tSnap = await transaction.get(tRef);
          const tData = tSnap.data();
          if ((tData.participants || 0) >= (tData.totalSlots || 48)) throw new Error("SLOTS_FULL");

          const userRef = doc(db, 'users', user.uid);
          const uSnap = await transaction.get(userRef);
          if ((uSnap.data()?.walletBalance || 0) < tournament.entryFee) throw new Error("INSUFFICIENT_BALANCE");

          transaction.update(userRef, { walletBalance: increment(-tournament.entryFee) });
          const regRef = doc(collection(db, 'registrations'));
          transaction.set(regRef, {
            userId: user.uid,
            username: userData?.username || 'Unknown',
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            joinedAt: serverTimestamp(),
            freeFireName, freeFireId, phoneNumber,
            email: user.email, won: false
          });
          transaction.update(tRef, { participants: increment(1) });
        });
        showNotification(`Joined ${tournament.name}!`, "success");
        setActiveModal(null);
        loadData();
      } catch (error: any) {
        showNotification(error.message === "SLOTS_FULL" ? "Slots full" : "Failed to join", "error");
      } finally { setIsJoining(false); }
    }
  };
  const filteredTournaments = tournaments.filter(t => {
    const isJoined = joinedTournaments.includes(t.id);
    if (t.status === 'Completed' || t.status === 'Result') return false;
    if (gameType === 'Joined') return isJoined;
    const matchesGameType = gameType === 'All' || (t.gameType || 'BR') === gameType;
    const matchesMode = mode === 'All' || (t.mode || 'Solo') === mode;
    return matchesGameType && matchesMode;
  });

  const parseDate = (d: any) => d?.toDate ? d.toDate() : new Date(d);
  const formatTime12Hour = (d: any) => {
    const date = parseDate(d);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getRemainingTime = (target: any) => {
    const diff = parseDate(target).getTime() - currentTime.getTime();
    if (diff <= 0) return "00:00:00";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-[#050B14] text-white p-4 pb-24 font-sans relative">
      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className={`fixed top-4 left-4 right-4 z-[60] border p-4 rounded-xl shadow-lg flex items-start ${toastType === 'success' ? 'bg-green-900/90 border-green-500' : 'bg-red-900/90 border-red-500'} text-white`}>
            {toastType === 'success' ? <CheckCircle className="mr-3 mt-0.5" size={20} /> : <AlertCircle className="mr-3 mt-0.5" size={20} />}
            <p className="flex-1 text-sm font-medium">{toastMessage}</p>
            <button onClick={() => setShowToast(false)}><X size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="mb-6">
          <Link to="/" className="flex items-center text-blue-400 text-sm mb-4"><ArrowLeft size={16} className="mr-1" /> Back</Link>
          <div className="flex items-center gap-2 mb-1"><Trophy className="text-yellow-400" size={28} /><h1 className="text-3xl font-bold text-yellow-400">Tournaments</h1></div>
        </div>

        {/* Balance Card */}
        <div className="bg-[#0F172A] border border-gray-800 rounded-2xl p-4 mb-6 shadow-xl">
          <div className="flex items-center text-gray-400 text-sm mb-1"><Coins size={16} className="mr-2" /> Your Balance</div>
          <div className="text-left text-2xl font-bold text-yellow-400">{userBalance} coins</div>
        </div>

        {/* Filter UI - Same as Screenshot */}
        <div className="bg-[#0F172A] border border-gray-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center text-yellow-400 font-bold mb-3"><Filter size={20} className="mr-2" /> Filters</div>
          <div className="mb-3">
            <div className="text-gray-400 text-xs font-bold mb-2 uppercase">Game Type</div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['All', 'BR', 'CS', 'Joined'].map(type => (
                <button key={type} onClick={() => setGameType(type)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${gameType === type ? 'bg-yellow-400 text-black' : 'bg-[#1E293B] text-gray-400'}`}>{type}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs font-bold mb-2 uppercase">Mode</div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['All', 'Solo', 'Duo', 'Squad'].map(m => (
                <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${mode === m ? 'bg-yellow-400 text-black' : 'bg-[#1E293B] text-gray-400'}`}>{m}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Tournament Cards - UI RESTORED TO MATCH IMAGES */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map(tournament => {
            const isJoined = joinedTournaments.includes(tournament.id);
            const openT = parseDate(tournament.registrationOpenTime);
            const closeT = parseDate(tournament.registrationCloseTime);
            const isRegistrationOpen = (!openT || currentTime >= openT) && (!closeT || currentTime <= closeT);
            const isSlotsFull = (tournament.participants || 0) >= (tournament.totalSlots || 48);

            return (
              <div key={tournament.id} className="bg-[#0F172A] border border-gray-800 rounded-[2rem] p-6 flex flex-col shadow-2xl">
                <h2 className="text-2xl font-bold text-white uppercase tracking-tight mb-2">{tournament.name}</h2>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2">
                    <span className="bg-blue-900/40 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded-md border border-blue-500/20 uppercase">{tournament.gameType || 'BR'}</span>
                    <span className="bg-purple-900/40 text-purple-400 text-[10px] font-black px-2.5 py-1 rounded-md border border-purple-500/20 uppercase">{tournament.mode || 'Solo'}</span>
                  </div>
                  <div className="text-yellow-400 font-mono text-xs font-bold">{getRemainingTime(tournament.startTime || tournament.time)}</div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center"><span className="text-gray-400 text-sm flex items-center gap-2"><LinkIcon size={14}/> Entry Fee</span><span className="text-yellow-400 font-bold">{tournament.entryFee} coins/person</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400 text-sm flex items-center gap-2"><Trophy size={14}/> Prize Pool</span><span className="text-yellow-400 font-bold">{tournament.prizePool} coins</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400 text-sm flex items-center gap-2"><Award size={14}/> Prize Type</span><span className="text-yellow-400 font-bold uppercase">{tournament.prizeType || 'Top 10'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400 text-sm flex items-center gap-2"><Users size={14}/> Available Slots</span><span className="text-green-400 font-bold">{(tournament.totalSlots || 48) - (tournament.participants || 0)} slots left</span></div>
                </div>

                <div className="h-px bg-gray-800/50 mb-4"></div>

                {/* Prize Distribution Logic */}
                {tournament.showPrizeDistribution !== false && (
                  <div className="mb-6">
                    <p className="text-gray-500 text-[10px] font-black uppercase mb-3 tracking-widest">Prize Distribution:</p>
                    <div className="grid grid-cols-5 gap-3 text-center">
                      {(tournament.distribution || []).map((dist: any, idx: number) => (
                        <div key={idx}>
                          <div className={`text-[9px] font-black ${dist.color || 'text-yellow-400'} uppercase`}>{dist.rank}</div>
                          <div className="text-white text-xs font-bold">{dist.points}</div>
                          <div className="text-gray-500 text-[8px] font-medium">({dist.percent})</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-xs"><span className="text-gray-400 flex items-center gap-1"><Users size={12}/> Slots</span><span className="text-white font-bold">{tournament.participants || 0}/{tournament.totalSlots || 48}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400 flex items-center gap-1"><Calendar size={12}/> Start Time</span><span className="text-white font-bold">{formatTime12Hour(tournament.startTime || tournament.time)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-400 flex items-center gap-1"><Clock size={12}/> Registration</span><span className={isRegistrationOpen ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{isRegistrationOpen ? "Open" : "Closed"}</span></div>
                </div>

                <div className="space-y-3">
                  <Link to={`/tournaments/${tournament.id}`} className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-center text-sm transition-all uppercase tracking-widest shadow-lg shadow-blue-900/20">View details</Link>
                  
                  {isJoined ? (
                    <button onClick={() => setActiveModal({ type: 'details', tournament })} className="w-full bg-green-600 text-white font-black py-3 rounded-xl text-sm uppercase tracking-widest shadow-lg shadow-green-900/20">Room Details</button>
                  ) : isSlotsFull ? (
                    <button disabled className="w-full bg-red-900/20 border border-red-900/40 text-red-500 font-black py-3 rounded-xl text-sm uppercase tracking-widest">Slots Full</button>
                  ) : !isRegistrationOpen ? (
                    <button disabled className="w-full bg-gray-800 text-gray-500 font-black py-3 rounded-xl text-sm uppercase tracking-widest">Closed</button>
                  ) : userBalance >= tournament.entryFee ? (
                    <button onClick={() => setActiveModal({ type: 'join', tournament })} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl text-sm uppercase tracking-widest shadow-lg shadow-yellow-900/20">Join Tournament ({tournament.entryFee})</button>
                  ) : (
                    <button disabled className="w-full bg-gray-800 text-gray-500 font-black py-3 rounded-xl text-sm uppercase tracking-widest">Need {tournament.entryFee - userBalance} more coins</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Modals Logic */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="bg-[#0F172A] border border-gray-800 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative p-8">
              <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"><X size={24}/></button>
              
              {activeModal.type === 'join' ? (
                <div className="space-y-6">
                  <h3 className="text-2xl font-black text-yellow-400 uppercase tracking-tight">Join Tournament</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">Character Name</label>
                      <input value={freeFireName} onChange={(e) => setFreeFireName(e.target.value)} placeholder="FF Name" className="w-full bg-[#050B14] border border-gray-700 rounded-xl p-3 text-white focus:border-yellow-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">Character ID (UID)</label>
                      <input value={freeFireId} onChange={(e) => setFreeFireId(e.target.value)} placeholder="UID" className="w-full bg-[#050B14] border border-gray-700 rounded-xl p-3 text-white focus:border-yellow-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">WhatsApp Number</label>
                      <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone" className="w-full bg-[#050B14] border border-gray-700 rounded-xl p-3 text-white focus:border-yellow-400 outline-none" />
                    </div>
                    <button onClick={handleJoin} disabled={isJoining} className="w-full bg-yellow-500 text-black font-black py-4 rounded-2xl uppercase tracking-widest shadow-xl shadow-yellow-900/20 active:scale-95 transition-all">
                      {isJoining ? 'Registering...' : `Confirm Join (${activeModal.tournament.entryFee} Coins)`}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-8 py-4">
                  <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto border border-yellow-500/20 shadow-inner">
                    <Shield size={40} className="text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Room Details</h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Confidential Match Access</p>
                  </div>
                  <div className="bg-black/40 p-6 rounded-3xl border border-white/5 space-y-6">
                    <div><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Room ID</p><p className="text-3xl font-black text-white tracking-[0.2em]">{activeModal.tournament.roomDetails?.id || 'Pending'}</p></div>
                    <div className="h-px bg-gray-800/50 w-2/3 mx-auto"></div>
                    <div><p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Password</p><p className="text-3xl font-black text-yellow-500 tracking-[0.2em]">{activeModal.tournament.roomDetails?.password || '---'}</p></div>
                  </div>
                  <button onClick={() => setActiveModal(null)} className="w-full bg-gray-800 text-white font-black py-4 rounded-2xl uppercase tracking-widest hover:bg-gray-700 transition-all shadow-lg">Close Details</button>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Refresh Button (Always on top) */}
      <button 
        onClick={loadData}
        className="fixed bottom-24 right-6 z-50 bg-yellow-500 p-4 rounded-full shadow-[0_0_25px_rgba(234,179,8,0.5)] hover:scale-110 active:scale-95 transition-all border-4 border-[#050B14]"
      >
        <RefreshCw size={28} className={`text-black ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
