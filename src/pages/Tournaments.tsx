import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Filter, Users, Calendar, Award, Coins, X, Copy, Check, CheckCircle, AlertCircle, Target, Clock, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { getCachedDocs } from '../lib/firestore-optimized'; // optimized tool
import { collection, doc, updateDoc, getDoc, setDoc, increment, runTransaction, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
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

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleGameTypeChange = (type: string) => { if (type !== gameType) setGameType(type); };
  const handleModeChange = (m: string) => { if (m !== mode) setMode(m); };

  const handleCopy = (text: string, field: string) => {
    if (!text || text === 'Pending' || text === '---') return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  // --- FIXED: Load Data function (NO onSnapshot loop) ---
  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch tournaments using optimization
      const tournamentsData = await getCachedDocs(db, 'tournaments');
      if (tournamentsData) {
        setTournaments([...tournamentsData].sort((a: any, b: any) => 
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        ));
      }

      if (user) {
        // Fetch User balance (One-time fetch)
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserBalance(data.walletBalance || 0);
          setUserData(data);
        }

        // Fetch Joined IDs (One-time fetch)
        const registrationsQuery = query(collection(db, 'registrations'), where('userId', '==', user.uid));
        const regSnap = await getDocs(registrationsQuery);
        setJoinedTournaments(regSnap.docs.map(doc => doc.data().tournamentId));
      }
      setLoading(false);
    } catch (e) {
      console.error("Error loading data:", e);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Form state
  const [freeFireName, setFreeFireName] = useState('');
  const [freeFireId, setFreeFireId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

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
          const tournamentRef = doc(db, 'tournaments', tournament.id);
          const tournamentSnap = await transaction.get(tournamentRef);
          if (!tournamentSnap.exists()) throw new Error("Tournament not found!");
          const tData = tournamentSnap.data();
          if ((tData.participants || 0) >= (tData.totalSlots || 48)) throw new Error("SLOTS_FULL");

          const userRef = doc(db, 'users', user.uid);
          const userSnap = await transaction.get(userRef);
          if ((userSnap.data()?.walletBalance || 0) < tournament.entryFee) throw new Error("INSUFFICIENT_BALANCE");

          transaction.update(userRef, { walletBalance: increment(-tournament.entryFee) });
          const regRef = doc(collection(db, 'registrations'));
          transaction.set(regRef, {
            userId: user.uid,
            username: userData?.username || user.displayName || 'Unknown',
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            joinedAt: serverTimestamp(),
            freeFireName, freeFireId, phoneNumber,
            email: user.email || '',
            won: false, kills: 0
          });
          transaction.update(tournamentRef, { participants: increment(1) });
        });

        showNotification(`Successfully Joined ${tournament.name}!`, "success");
        setActiveModal(null);
        loadData(); // Manually refresh list
      } catch (error: any) {
        let msg = "Failed to join";
        if (error.message === "SLOTS_FULL") msg = "Slots are full!";
        if (error.message === "INSUFFICIENT_BALANCE") msg = "Insufficient coins!";
        showNotification(msg, "error");
      } finally { setIsJoining(false); }
    }
  };

  const filteredTournaments = tournaments.filter(tournament => {
    const isJoined = joinedTournaments.includes(tournament.id);
    const isCompleted = tournament.status === 'Completed' || tournament.status === 'completed';
    const isResultPending = tournament.status === 'Result' || tournament.status === 'result';
    if (isCompleted || isResultPending) return false;
    if (gameType === 'Joined') return isJoined;
    const matchesGameType = gameType === 'All' || (tournament.gameType || 'BR') === gameType;
    const matchesMode = mode === 'All' || (tournament.mode || 'Solo') === mode;
    return matchesGameType && matchesMode;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050B14] flex flex-col items-center justify-center text-white">
        <RefreshCw size={48} className="animate-spin text-yellow-500 mb-4" />
        <p className="text-yellow-400 font-bold uppercase tracking-widest text-xs">Loading tournaments...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050B14] text-white p-4 pb-24 font-sans relative">
      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className={`fixed top-4 left-4 right-4 z-[60] border p-4 rounded-xl shadow-lg flex items-start ${toastType === 'success' ? 'bg-green-900/90 border-green-500' : 'bg-red-900/90 border-red-500'} text-white`}>
            {toastType === 'success' ? <CheckCircle className="mr-3 mt-0.5" size={20} /> : <AlertCircle className="mr-3 mt-0.5" size={20} />}
            <p className="flex-1 text-sm font-medium">{toastMessage}</p>
            <button onClick={() => setShowToast(false)} className="ml-2"><X size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="mb-6">
          <Link to="/" className="flex items-center text-blue-400 text-sm mb-4"><ArrowLeft size={16} className="mr-1" /> Back to Dashboard</Link>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="text-yellow-400" size={28} />
            <h1 className="text-3xl font-bold text-yellow-400">Tournaments</h1>
          </div>
          <p className="text-gray-400 text-sm">Join Gamer Zone tournaments and compete for prizes!</p>
        </div>

        <div className="bg-[#0F172A] border border-gray-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center text-gray-400 text-sm mb-1"><Coins size={16} className="mr-2" /> Your Balance</div>
          <div className="text-2xl font-bold text-yellow-400">{userBalance} coins</div>
        </div>

        <div className="bg-[#0F172A] border border-gray-800 rounded-2xl p-4 mb-6">
          <div className="mb-3">
            <div className="text-gray-400 text-xs font-bold mb-2">Game Type</div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['All', 'BR', 'CS', 'Joined'].map(type => (
                <button key={type} onClick={() => handleGameTypeChange(type)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${gameType === type ? 'bg-yellow-400 text-black' : 'bg-[#1E293B] text-gray-400 hover:bg-gray-700'}`}>{type}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs font-bold mb-2">Mode</div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['All', 'Solo', 'Duo', 'Squad'].map(m => (
                <button key={m} onClick={() => handleModeChange(m)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${mode === m ? 'bg-yellow-400 text-black' : 'bg-[#1E293B] text-gray-400 hover:bg-gray-700'}`}>{m}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map(tournament => {
            const isJoined = joinedTournaments.includes(tournament.id);
            return (
              <div key={tournament.id} className="bg-[#0F172A] border border-gray-800 rounded-3xl p-5 flex flex-col">
                <h2 className="text-xl font-bold text-white uppercase mb-4">{tournament.name}</h2>
                <div className="space-y-2 mb-6 flex-grow">
                  <div className="flex justify-between items-center text-sm"><span className="text-gray-400">Entry Fee</span><span className="text-yellow-400 font-bold">{tournament.entryFee} coins</span></div>
                  <div className="flex justify-between items-center text-sm"><span className="text-gray-400">Prize Pool</span><span className="text-green-400 font-bold">{tournament.prizePool} coins</span></div>
                  <div className="flex justify-between items-center text-sm"><span className="text-gray-400">Participants</span><span className="text-white font-bold">{tournament.participants || 0}/{tournament.totalSlots || 48}</span></div>
                </div>
                <div className="space-y-3">
                  <Link to={`/tournaments/${tournament.id}`} className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-center text-sm transition-colors">View Details</Link>
                  <button onClick={() => setActiveModal({ type: isJoined ? 'details' : 'join', tournament })} className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${isJoined ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-yellow-500 text-black hover:bg-yellow-400'}`}>
                    {isJoined ? 'Room Details' : 'Join Tournament'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="bg-[#0F172A] border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
              <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X /></button>
              <div className="p-6">
                {activeModal.type === 'join' ? (
                  <div className="space-y-5">
                    <h3 className="text-xl font-bold text-yellow-400 uppercase">Join Tournament</h3>
                    <input value={freeFireName} onChange={(e) => setFreeFireName(e.target.value)} placeholder="In-Game Name" className="w-full bg-[#050B14] border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none" />
                    <input value={freeFireId} onChange={(e) => setFreeFireId(e.target.value)} placeholder="UID (Character ID)" className="w-full bg-[#050B14] border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none" />
                    <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="WhatsApp Number" className="w-full bg-[#050B14] border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-yellow-400 outline-none" />
                    <button onClick={handleJoin} disabled={isJoining} className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl shadow-lg hover:bg-yellow-400 transition-all flex items-center justify-center gap-2">
                      {isJoining ? <RefreshCw className="animate-spin" size={20} /> : 'Confirm Registration'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    <h3 className="text-xl font-bold text-yellow-400 uppercase">Room Credentials</h3>
                    <div className="bg-[#050B14] p-6 rounded-2xl border border-white/5 space-y-4">
                      <div><p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Room ID</p><p className="text-2xl font-black tracking-widest">{activeModal.tournament.roomDetails?.id || 'Pending'}</p></div>
                      <div className="h-px bg-gray-800 w-1/2 mx-auto"></div>
                      <div><p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Password</p><p className="text-2xl font-black text-yellow-500 tracking-widest">{activeModal.tournament.roomDetails?.password || '---'}</p></div>
                    </div>
                    <button onClick={() => setActiveModal(null)} className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl hover:bg-gray-700 transition-all">Close</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Refresh Button (Outside all divs) */}
      <button 
        onClick={loadData}
        className="fixed bottom-24 right-6 z-50 bg-yellow-500 p-4 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:scale-110 transition-all active:scale-90"
      >
        <RefreshCw size={24} className={`text-black ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
