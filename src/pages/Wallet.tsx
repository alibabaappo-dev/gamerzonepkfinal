import { useState, useEffect } from 'react';
import { ArrowLeft, Wallet as WalletIcon, CreditCard, ArrowRight, Star, Flame, Diamond, ArrowDownUp, History, Plus, Coins, CheckCircle, X, AlertCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import BuyCoinsModal from '../components/BuyCoinsModal';
import { motion, AnimatePresence } from 'motion/react';
// OPTIMIZATION: limit aur getDoc add kiye gaye hain
import { doc, onSnapshot, setDoc, updateDoc, increment, addDoc, collection, query, where, orderBy, limit, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

interface Transaction {
  id: string;
  type: 'Deposit' | 'Withdrawal';
  amount: number;
  date: string;
  status: 'pending' | 'completed' | 'rejected';
  paymentMethod?: string;
  accountNumber?: string;
  proofUrl?: string;
}

interface PaymentMethod {
  name: string;
  enabled: boolean;
  details: string;
  accountName?: string;
  imageUrl?: string;
}

// Helper function to format remaining time for Cooldowns
const formatRemainingTime = (targetTime: number) => {
  const diff = targetTime - Date.now();
  if (diff <= 0) return "Ready";
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${h}h ${m}m`;
};

export default function Wallet() {
  const [user] = useAuthState(auth);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialAmount, setInitialAmount] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  
  const [balance, setBalance] = useState(0);
  const [minDeposit, setMinDeposit] = useState(50);
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [withdrawalPaymentMethods, setWithdrawalPaymentMethods] = useState<PaymentMethod[]>([]);

  // OPTIMIZATION: Cooldown States
  const [withdrawalCooldown, setWithdrawalCooldown] = useState<number | null>(null);
  const [depositCooldown, setDepositCooldown] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const unsubSettings = onSnapshot(doc(db, 'admin', 'transaction_settings'), (doc) => {
      if (doc.exists()) {
        setMinDeposit(doc.data().minDeposit || 50);
        setMinWithdrawal(doc.data().minWithdrawal || 100);
      }
    });

    const unsubPaymentMethods = onSnapshot(collection(db, 'payment_methods'), (snapshot) => {
      const methods = snapshot.docs.map(doc => ({
        name: doc.data().name,
        enabled: doc.data().enabled,
        details: doc.data().details,
        accountName: doc.data().accountName, 
        imageUrl: doc.data().imageUrl
      }));
      setPaymentMethods(methods);
    });

    const unsubWithdrawalPaymentMethods = onSnapshot(collection(db, 'withdrawal_payment_methods'), (snapshot) => {
      const methods = snapshot.docs.map(doc => ({
        name: doc.data().name,
        enabled: doc.data().enabled,
        details: doc.data().details,
        accountName: doc.data().accountName,
        imageUrl: doc.data().imageUrl
      }));
      setWithdrawalPaymentMethods(methods);
    });

    // User Data & Cooldown Check (Real-time)
    const userRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBalance(data.walletBalance || 0);

        // 1. Withdrawal Cooldown Check (1 per 24 hours)
        if (data.lastWithdrawalRequestAt) {
          const lastReq = data.lastWithdrawalRequestAt.toDate ? data.lastWithdrawalRequestAt.toDate().getTime() : new Date(data.lastWithdrawalRequestAt).getTime();
          const nextAvailable = lastReq + (24 * 60 * 60 * 1000);
          if (Date.now() < nextAvailable) setWithdrawalCooldown(nextAvailable);
          else setWithdrawalCooldown(null);
        }

        // 2. EXACT DEPOSIT COOLDOWN LOGIC (2 requests, then wait 3 hours)
        if (data.depositRequests && data.depositRequests.length >= 2) {
          const lastReqTime = data.depositRequests[data.depositRequests.length - 1].toDate ? data.depositRequests[data.depositRequests.length - 1].toDate().getTime() : new Date(data.depositRequests[data.depositRequests.length - 1]).getTime();
          const nextAvailable = lastReqTime + (3 * 60 * 60 * 1000); // 3 hours from the 2nd request
          
          if (Date.now() < nextAvailable) {
            setDepositCooldown(nextAvailable); // Lock the user
          } else {
            setDepositCooldown(null); // Unlock user
          }
        } else {
          setDepositCooldown(null);
        }
      }
    });
    
    // OPTIMIZATION: Sirf 3 latest transactions fetch honge
    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(3) // CHANGED: Ab sirf 3 transactions show hongi
    );

    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txData);
    });

    return () => {
      unsubSettings();
      unsubPaymentMethods();
      unsubWithdrawalPaymentMethods();
      unsubscribeUser();
      unsubscribeTx();
    };
  }, [user]);

  // Timer to update cooldown display live without reloading
  useEffect(() => {
    const timer = setInterval(() => {
      if (withdrawalCooldown) setWithdrawalCooldown(prev => prev && prev > Date.now() ? prev : null);
      if (depositCooldown) setDepositCooldown(prev => prev && prev > Date.now() ? prev : null);
    }, 60000); 
    return () => clearInterval(timer);
  }, [withdrawalCooldown, depositCooldown]);

  const openModal = (amount: string = '') => {
    if (depositCooldown) {
      showNotification(`Deposit limit reached! Try again in ${formatRemainingTime(depositCooldown)}`, 'error');
      return;
    }
    setInitialAmount(amount);
    setIsModalOpen(true);
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  const handleDepositSubmit = async (amount: number, paymentMethod: string, file: File) => {
    if (!user) return;
    if (depositCooldown) {
      showNotification(`Deposit limit reached. Try again later.`, 'error');
      return;
    }

    try {
      showNotification('Uploading proof and submitting request...', 'success');
      
      const formData = new FormData();
      formData.append('image', file);
      
      const imgbbKey = import.meta.env.VITE_IMGBB_API_KEY || 'YOUR_IMGBB_API_KEY_HERE'; 
      const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
        method: 'POST',
        body: formData
      });
      
      const imgbbData = await imgbbRes.json();
      if (!imgbbData.success) {
        throw new Error('Failed to upload image to ImgBB');
      }
      
      const proofUrl = imgbbData.data.url;

      // Check current requests securely before updating
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      let currentRequests = userDoc.data()?.depositRequests || [];

      // Logic: If user already has 2 requests, check if 3 hours passed. If yes, reset to 0.
      if (currentRequests.length >= 2) {
        const lastReqTime = currentRequests[currentRequests.length - 1].toDate ? currentRequests[currentRequests.length - 1].toDate().getTime() : new Date(currentRequests[currentRequests.length - 1]).getTime();
        if (Date.now() >= lastReqTime + (3 * 60 * 60 * 1000)) {
          currentRequests = []; // 3 hours passed! Reset the count.
        } else {
          showNotification(`Deposit limit reached. Try again later.`, 'error');
          return;
        }
      }

      // Add new transaction
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'Deposit',
        amount: amount,
        paymentMethod: paymentMethod,
        proofUrl: proofUrl,
        status: 'pending',
        date: new Date().toLocaleDateString(),
        createdAt: new Date()
      });

      // Update the request array in user doc
      currentRequests.push(new Date());
      await updateDoc(userRef, { depositRequests: currentRequests });

      showNotification(`Deposit request for ${amount} coins submitted! Waiting for admin approval.`, 'success');
      setIsModalOpen(false); 
    } catch (error) {
      console.error("Error submitting deposit:", error);
      showNotification('Failed to submit deposit. Please check your ImgBB API key or try again.', 'error');
    }
  };

  const handleWithdrawalSubmit = async () => {
    if (!user) return;
    
    // Withdrawal Cooldown Blocker
    if (withdrawalCooldown) {
      showNotification(`Withdrawal limit reached! Try again in ${formatRemainingTime(withdrawalCooldown)}`, 'error');
      return;
    }

    const amount = parseInt(withdrawalAmount);
    
    if (!withdrawalAmount || isNaN(amount)) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    if (amount < minWithdrawal) {
      showNotification(`Minimum withdrawal is ${minWithdrawal} coins`, 'error');
      return;
    }

    if (amount > balance) {
      showNotification('Insufficient Balance', 'error');
      return;
    }

    if (!accountNumber) {
      showNotification('Please enter your account number', 'error');
      return;
    }

    setIsSubmittingWithdrawal(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      // Deduct balance AND add cooldown timestamp (1 per 24 hour)
      await updateDoc(userRef, {
        walletBalance: increment(-amount),
        lastWithdrawalRequestAt: new Date() 
      });

      const paymentMethodElement = document.getElementById('withdrawalMethod') as HTMLSelectElement;
      const paymentMethod = paymentMethodElement ? paymentMethodElement.value : 'Unknown';

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'Withdrawal',
        amount: amount,
        paymentMethod: paymentMethod,
        accountNumber: accountNumber,
        accountName: accountName,
        status: 'pending',
        date: new Date().toLocaleDateString(),
        createdAt: new Date()
      });
      
      setWithdrawalAmount('');
      setAccountNumber('');
      setAccountName('');
      
      showNotification('Withdrawal request submitted! Coins deducted.', 'success');

    } catch (error) {
      console.error("Error processing withdrawal:", error);
      showNotification('Failed to process withdrawal. Please try again.', 'error');
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20 font-sans relative">
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
        <Link to="/" className="flex items-center text-blue-400 mb-6 hover:text-blue-300">
          <ArrowLeft size={20} className="mr-2" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="mb-8">
          <div className="flex items-center mb-2">
            <WalletIcon size={32} className="text-yellow-400 mr-3" />
            <h1 className="text-3xl font-bold text-yellow-400">My Wallet</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Manage your coins, purchases, and withdrawals
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#1E293B] to-[#2D2416] rounded-2xl p-6 mb-8 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)] relative overflow-hidden">
          <div className="flex items-center text-gray-300 mb-4">
            <WalletIcon size={20} className="mr-2" />
            <span>Available Balance</span>
          </div>
          <div className="flex items-center mb-1">
            <div className="relative mr-3">
              <Coins size={40} className="text-yellow-400" />
            </div>
            <span className="text-6xl font-bold text-yellow-400">{balance}</span>
          </div>
          <p className="text-gray-400 text-sm mb-6">
            coins â€¢ â‰ˆ {balance} PKR
          </p>
          <button 
            onClick={() => openModal()}
            disabled={depositCooldown !== null}
            className={`w-full font-bold py-3 rounded-xl flex items-center justify-center transition-colors ${depositCooldown ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-400 text-black'}`}
          >
            {depositCooldown ? (
              <><Clock size={20} className="mr-2" /> Limit Reached ({formatRemainingTime(depositCooldown)})</>
            ) : (
              <><Plus size={20} className="mr-2" /> Buy Coins</>
            )}
          </button>
        </div>

        <div className="bg-[#0B1120] rounded-2xl p-6 mb-8 border border-gray-800">
          <div className="flex items-start mb-6">
            <div className="bg-green-500/10 p-3 rounded-xl mr-4">
              <Coins size={24} className="text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Purchase Coins</h2>
              <div className="bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-lg inline-block mt-2">
                <p className="text-green-500 text-xs font-bold uppercase tracking-wider">Min Deposit: {minDeposit} PKR</p>
              </div>
            </div>
          </div>

          <div className="bg-[#131B2F] rounded-xl p-5 border border-blue-900/50 mb-6">
            <div className="flex items-center text-blue-400 font-semibold mb-3">
              <ArrowRight size={18} className="mr-2" />
              Payment Instructions
            </div>
            <p className="text-gray-300 text-sm mb-3">
              <span className="font-bold text-blue-400">Methods:</span> NayaPay, Sadapay, JazzCash, EasyPaisa
            </p>
            <p className="text-gray-300 text-sm mb-5">
              Upload payment screenshot after transfer. Admin verifies within 24 hours.
            </p>
            
            <div className="border-t border-gray-800 pt-4 mb-4">
              <p className="text-blue-400 font-semibold text-sm mb-3">Payment Account Numbers:</p>
              
              <div className="space-y-3">
                {paymentMethods.filter(m => m.enabled).map((method) => (
                  <div key={method.name} className="bg-[#0B1120] p-3 rounded-lg border border-gray-800">
                    <p className="text-gray-400 text-xs mb-1">{method.name}</p>
                    <p className="text-yellow-400 font-bold text-lg tracking-wider">{method.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-[#131B2F] rounded-2xl p-6 border border-gray-800 text-center flex flex-col items-center">
              <Star size={40} className="text-yellow-400 mb-3 fill-yellow-400" />
              <h3 className="text-2xl font-bold mb-1">50 Coins</h3>
              <p className="text-gray-400 text-sm mb-3">Starter</p>
              <p className="text-3xl font-bold text-yellow-400 mb-5">50 PKR</p>
              <button 
                onClick={() => openModal('50')}
                disabled={depositCooldown !== null}
                className="w-full bg-[#1E293B] hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                Buy Now
              </button>
            </div>

            <div className="bg-[#131B2F] rounded-2xl p-6 border border-yellow-500 text-center flex flex-col items-center relative shadow-[0_0_15px_rgba(234,179,8,0.1)]">
              <div className="absolute -top-3 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                POPULAR
              </div>
              <Flame size={40} className="text-orange-500 mb-3 fill-orange-500" />
              <h3 className="text-2xl font-bold mb-1">100 Coins</h3>
              <p className="text-gray-400 text-sm mb-3">Popular</p>
              <p className="text-3xl font-bold text-yellow-400 mb-5">100 PKR</p>
              <button 
                onClick={() => openModal('100')}
                disabled={depositCooldown !== null}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                Buy Now
              </button>
            </div>

            <div className="bg-[#131B2F] rounded-2xl p-6 border border-gray-800 text-center flex flex-col items-center">
              <Diamond size={40} className="text-blue-400 mb-3 fill-blue-400" />
              <h3 className="text-2xl font-bold mb-1">250 Coins</h3>
              <p className="text-gray-400 text-sm mb-3">Best Value</p>
              <p className="text-3xl font-bold text-yellow-400 mb-5">250 PKR</p>
              <button 
                onClick={() => openModal('250')}
                disabled={depositCooldown !== null}
                className="w-full bg-[#1E293B] hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#0B1120] rounded-2xl p-6 mb-8 border border-gray-800">
          <div className="flex items-start mb-6">
            <div className="bg-purple-900/30 p-3 rounded-xl mr-4">
              <ArrowDownUp size={24} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Withdrawals</h2>
              <p className="text-white text-lg">Balance: <span className="text-yellow-400 font-bold">{balance} coins</span></p>
            </div>
          </div>

          <div className="bg-[#2D1A1A] border border-orange-900/50 rounded-xl p-4 mb-6">
            <p className="text-gray-300 text-sm">
              <span className="text-orange-500 font-bold">Limits:</span> Min {minWithdrawal} coins Max 1,200 coins per request
            </p>
          </div>
          {withdrawalCooldown ? (
             <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center mb-4">
               <Clock className="mx-auto text-red-400 mb-3" size={32} />
               <h3 className="text-red-400 font-bold text-lg mb-1">Withdrawal Limit Reached</h3>
               <p className="text-gray-400 text-sm">You can submit another request in:</p>
               <p className="text-2xl font-mono text-white mt-2">{formatRemainingTime(withdrawalCooldown)}</p>
             </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-gray-300 text-sm mb-2">Amount (Coins)</label>
                <input 
                  type="number"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  placeholder="e.g. 500" 
                  disabled={isSubmittingWithdrawal}
                  className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-gray-500 text-xs mt-2">Available: {balance} coins</p>
              </div>

              <div>
                <label className="block font-bold text-gray-300 text-sm mb-2">Select Payment Method</label>
                <select id="withdrawalMethod" disabled={isSubmittingWithdrawal} className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 appearance-none disabled:opacity-50 disabled:cursor-not-allowed">
                  {withdrawalPaymentMethods.filter(m => m.enabled).map((method) => (
                    <option key={method.name} value={method.name}>{method.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-300 text-sm mb-2">Your Account Number / IBAN<br/></label>
                <input 
                  type="text" 
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g., 03001234567" 
                  disabled={isSubmittingWithdrawal}
                  className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-300 text-sm mb-2">Account Holder Name</label>
                <input 
                  type="text" 
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account Name" 
                  disabled={isSubmittingWithdrawal}
                  className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <button 
                onClick={handleWithdrawalSubmit}
                disabled={isSubmittingWithdrawal}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors mt-2 shadow-[0_0_15px_rgba(147,51,234,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingWithdrawal ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  'Submit Withdrawal Request'
                )}
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#0B1120] rounded-2xl p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-blue-900/30 p-2 rounded-lg mr-3">
                <History size={20} className="text-blue-400" />
              </div>
              <h2 className="text-xl font-bold">Recent</h2>
            </div>
            <Link to="/transactions" className="text-blue-400 text-sm hover:text-blue-300 flex items-center">
              View All <ArrowRight size={14} className="ml-1" />
            </Link>
          </div>

          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-[#131B2F] rounded-xl p-4 border border-gray-800 flex justify-between items-center">
                <div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded mb-2 inline-block ${
                    tx.type === 'Deposit' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
                  }`}>
                    {tx.type}
                  </span>
                  <p className={`font-bold text-lg ${tx.type === 'Deposit' ? 'text-yellow-400' : 'text-white'}`}>
                    {tx.type === 'Deposit' ? '+' : '-'}{tx.amount} coins
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-sm mb-2">{tx.date}</p>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                    tx.status === 'completed' 
                      ? 'bg-green-900/40 text-green-500 border-green-700/50' 
                      : tx.status === 'rejected'
                      ? 'bg-red-900/40 text-red-500 border-red-700/50'
                      : 'bg-yellow-900/40 text-yellow-500 border-yellow-700/50'
                  }`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
            
            {transactions.length === 0 && (
              <p className="text-center text-gray-500 py-4">No recent transactions</p>
            )}
          </div>
        </div>

      </div>

      <BuyCoinsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialAmount={initialAmount} 
        onSubmit={handleDepositSubmit}
        minDeposit={minDeposit}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
