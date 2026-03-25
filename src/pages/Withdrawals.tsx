import { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, CheckCircle, X, Wallet, History, CreditCard, Coins, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, doc, runTransaction, updateDoc } from 'firebase/firestore';

// Helper function to format remaining time (hours, minutes, seconds)
const formatRemainingTime = (targetTime: number) => {
  const diff = targetTime - Date.now();
  if (diff <= 0) return "Ready";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const format = (num: number) => num.toString().padStart(2, '0');

  return `${format(hours)}h ${format(minutes)}m ${format(seconds)}s`;
};

export default function Withdrawals() {
  const [user] = useAuthState(auth);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  const [requests, setRequests] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [withdrawalCooldown, setWithdrawalCooldown] = useState<number | null>(null);
  // ADDED: A dummy state to force re-renders for the timer display
  const [timeTick, setTimeTick] = useState(0); 

  useEffect(() => {
    if (!user) return;

    // Fetch user balance and withdrawal cooldown status (Real-time listener)
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBalance(data.walletBalance || 0);

        // Withdrawal Cooldown Check (1 request per 24 hours)
        if (data.lastWithdrawalRequestAt) {
          const lastReq = data.lastWithdrawalRequestAt.toDate ? data.lastWithdrawalRequestAt.toDate().getTime() : new Date(data.lastWithdrawalRequestAt).getTime();
          const nextAvailable = lastReq + (24 * 60 * 60 * 1000); // 24 hours cooldown
          if (Date.now() < nextAvailable) {
            setWithdrawalCooldown(nextAvailable);
          } else {
            setWithdrawalCooldown(null);
          }
        } else {
          setWithdrawalCooldown(null); // No previous request, so no cooldown
        }
      }
    });

    // Fetch transaction settings
    const unsubSettings = onSnapshot(doc(db, 'admin', 'transaction_settings'), (doc) => {
      if (doc.exists()) {
        setMinWithdrawal(doc.data().minWithdrawal || 100);
      }
    });

    // Fetch payment methods
    const unsubMethods = onSnapshot(collection(db, 'withdrawal_payment_methods'), (snapshot) => {
      const methods = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((m: any) => m.enabled);
      setPaymentMethods(methods);
      if (methods.length > 0) {
        setMethod((methods[0] as any).name);
      }
    });

    // Fetch withdrawal requests (all of them, as there is no limit here yet)
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('type', '==', 'Withdrawal'),
      orderBy('createdAt', 'desc')
    );

    const unsubRequests = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setRequests(reqs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching withdrawal requests:", error);
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubSettings();
      unsubMethods();
      unsubRequests();
    };
  }, [user]);

  // CHANGED: Timer to update cooldown display live every second (for running seconds)
  // This useEffect now runs once and sets up a continuous timer.
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(prev => prev + 1); // Increment a dummy state to trigger re-renders

      // Check if withdrawalCooldown has passed. Access the latest state via functional update
      setWithdrawalCooldown(prevCooldown => {
        if (prevCooldown !== null && Date.now() >= prevCooldown) {
          return null; // Cooldown expired, clear it
        }
        return prevCooldown; // Still active
      });
    }, 1000); // Update every second for seconds display
    return () => clearInterval(timer);
  }, []); // DEPENDENCY CHANGED TO EMPTY ARRAY - Runs once on mount

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Cooldown check before submission
    if (withdrawalCooldown) {
      showNotification(`Withdrawal limit reached! Try again in ${formatRemainingTime(withdrawalCooldown)}`, 'error');
      return;
    }

    const numAmount = parseInt(amount);

    if (!amount) {
      showNotification('Please enter an amount', 'error');
      return;
    }

    if (isNaN(numAmount)) {
      showNotification('Please enter a valid number', 'error');
      return;
    }

    if (numAmount < minWithdrawal) {
      showNotification(`Minimum withdrawal is ${minWithdrawal} coins`, 'error');
      return;
    }

    if (numAmount > 1200) {
      showNotification('Maximum withdrawal is 1200 coins', 'error');
      return;
    }

    if (numAmount > balance) {
      showNotification('Insufficient Balance', 'error');
      return;
    }

    if (!accountNumber) {
      showNotification('Please enter account number', 'error');
      return;
    }
     if (!accountName) {
      showNotification('Please enter account holder name', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User does not exist!");
        }
        
        const currentBalance = userDoc.data().walletBalance || 0;
        if (currentBalance < numAmount) {
          throw new Error("Insufficient Balance");
        }

        // Update user's balance AND store last withdrawal request time for cooldown
        transaction.update(userRef, { 
          walletBalance: currentBalance - numAmount,
          lastWithdrawalRequestAt: serverTimestamp() // Store timestamp for cooldown
        });
        
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId: user.uid,
          userEmail: user.email,
          amount: numAmount,
          type: 'Withdrawal',
          paymentMethod: method,
          accountNumber,
          accountName: accountName || 'N/A',
          status: 'pending',
          date: new Date().toLocaleString(),
          createdAt: serverTimestamp()
        });
      });

      showNotification('Withdrawal request submitted successfully', 'success');
      setAmount('');
      setAccountNumber('');
      setAccountName('');
    } catch (error: any) {
      console.error("Error submitting withdrawal:", error);
      showNotification(error.message || 'Failed to submit withdrawal request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050B14] text-white p-4 font-sans relative">
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 left-4 right-4 z-50 border p-4 rounded-xl shadow-lg flex items-start ${
              toastType === 'success' 
                ? 'bg-green-900/90 border-green-500 text-white' 
                : 'bg-red-900/90 border-red-500 text-white'
            }`}
          >
            {toastType === 'success' ? (
              <CheckCircle className="text-green-400 mr-3 mt-0.5 flex-shrink-0" size={20} />
            ) : (
              <AlertCircle className="text-red-400 mr-3 mt-0.5 flex-shrink-0" size={20} />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">{toastMessage}</p>
            </div>
            <button onClick={() => setShowToast(false)} className={`ml-2 ${toastType === 'success' ? 'text-green-200 hover:text-white' : 'text-red-200 hover:text-white'}`}>
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto">
        <Link to="/" className="flex items-center text-gray-400 mb-6 hover:text-white transition-colors">
          <ArrowLeft size={20} className="mr-2" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400 mb-1">Withdrawals</h1>
            <p className="text-gray-400 text-sm">Manage your earnings</p>
          </div>
          <div className="bg-[#131B2F] px-4 py-2 rounded-xl border border-gray-800 text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Balance</p>
            <p className="text-yellow-400 font-bold text-xl flex items-center justify-end gap-1">
              <Coins size={16} />
              {balance} <span className="text-xs text-yellow-500/70">coins</span>
            </p>
          </div>
        </div>

        {/* Request Withdrawal Card */}
        <div className="bg-[#0B1120] rounded-2xl p-6 mb-8 border border-gray-800 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
          
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Wallet className="text-blue-400" size={20} />
            </div>
            <h2 className="text-xl font-bold text-white">Request Withdrawal</h2>
          </div>

          <div className="space-y-4 relative z-10">
            {/* Cooldown display at the top of the form */}
            {withdrawalCooldown ? (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-center mb-4">
                <Clock className="mx-auto text-red-400 mb-2" size={24} />
                <h3 className="text-red-400 font-bold text-sm mb-1">Withdrawal Limit Reached</h3>
                <p className="text-gray-400 text-xs">You can submit another request in:</p>
                <p className="text-lg font-mono text-white mt-1">{formatRemainingTime(withdrawalCooldown)}</p>
              </div>
            ) : null}

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Amount (coins)</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  disabled={isSubmitting || withdrawalCooldown !== null}
                  className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 pl-4 text-white focus:outline-none focus:border-yellow-500 transition-colors placeholder-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="absolute right-4 top-3.5 text-xs text-yellow-500 font-bold">COINS</span>
              </div>
              <p className="text-gray-500 text-[10px] mt-1.5 flex justify-between">
                <span>Min: {minWithdrawal} coins</span>
                <span>Max: 1200 coins</span>
              </p>
            </div>

            <div>
              <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Select Payment Method</label>
              <div className="relative">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  disabled={isSubmitting || paymentMethods.length === 0 || withdrawalCooldown !== null}
                  className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-yellow-500 appearance-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {paymentMethods.length === 0 ? (
                    <option value="">No payment methods available</option>
                  ) : (
                    paymentMethods.map(pm => (
                      <option key={pm.id} value={pm.name}>{pm.name}</option>
                    ))
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <CreditCard size={16} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Account Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="03001234567 or IBAN"
                  disabled={isSubmitting || withdrawalCooldown !== null}
                  className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-yellow-500 placeholder-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
             <div>
                <label className="block text-gray-400 text-xs font-bold uppercase mb-2">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account Name"
                  required
                  disabled={isSubmitting || withdrawalCooldown !== null}
                  className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-yellow-500 placeholder-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || withdrawalCooldown !== null}
              className={`w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-yellow-900/20 mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${withdrawalCooldown ? 'from-gray-700 to-gray-800 hover:from-gray-700 hover:to-gray-800' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : withdrawalCooldown ? (
                <>
                  <Clock size={18} className="mr-1" />
                  Limit Reached ({formatRemainingTime(withdrawalCooldown)})
                </>
              ) : (
                <>
                  Submit Request <ArrowLeft className="rotate-180" size={18} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* My Withdrawal Requests Card */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <History className="text-gray-400" size={18} />
            <h2 className="text-lg font-bold text-white">Transaction History</h2>
          </div>
          
          {loading ? (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center mb-4 w-14 h-14 md:w-16 md:h-16">
                <div className="absolute inset-0 border-[2px] border-yellow-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-[3px] md:border-[4px] border-transparent border-t-yellow-500 rounded-full animate-spin shadow-[0_0_15px_rgba(234,179,8,0.4)]"></div>
                <div className="absolute inset-2.5 md:inset-3 border-[2px] border-transparent border-b-yellow-500/50 rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
                <div className="absolute inset-0 m-auto w-2 h-2 md:w-2.5 md:h-2.5 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.8)] animate-pulse"></div>
              </div>
              <p className="text-yellow-400 font-bold animate-pulse uppercase tracking-widest text-xs md:text-sm drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]">Loading history...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-[#0B1120] rounded-2xl p-8 border border-gray-800 text-center">
              <div className="w-12 h-12 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <History className="text-gray-600" size={24} />
              </div>
              <p className="text-gray-400 font-medium">No transaction yet in withdrawal.</p>
              <p className="text-gray-600 text-xs mt-1">Your transaction history will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="bg-[#0B1120] border border-gray-800 p-5 rounded-2xl flex flex-col gap-4 hover:border-gray-700 transition-colors shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xl font-bold text-white mb-1 flex items-baseline gap-1">
                        {req.amount} <span className="text-xs text-gray-500 font-normal">coins</span>
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{req.date}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${
                      req.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                      req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-gray-800/50">
                    <p className="text-xs text-gray-500 flex justify-between sm:justify-start sm:gap-2">
                      <span>Method:</span> <span className="text-gray-300 font-bold">{req.paymentMethod}</span>
                    </p>
                    <p className="text-xs text-gray-500 flex justify-between sm:justify-start sm:gap-2">
                      <span>Account No:</span> <span className="text-gray-300 font-mono">{req.accountNumber}</span>
                    </p>
                    {req.accountName && req.accountName !== 'N/A' && (
                      <p className="text-xs text-gray-500 flex justify-between sm:justify-start sm:gap-2">
                        <span>Holder:</span> <span className="text-gray-300 font-medium">{req.accountName}</span>
                      </p>
                    )}
                    
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
