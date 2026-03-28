import { useState, useEffect } from 'react';
import { ArrowLeft, Wallet as WalletIcon, CreditCard, ArrowRight, Star, Flame, Diamond, ArrowDownUp, History, Plus, Coins, CheckCircle, X, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import BuyCoinsModal from '../components/BuyCoinsModal';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, onSnapshot, updateDoc, increment, addDoc, collection, query, where, orderBy, limit, serverTimestamp, runTransaction } from 'firebase/firestore';
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
  const [method, setMethod] = useState('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  
  const [balance, setBalance] = useState(0);
  const [minDeposit, setMinDeposit] = useState(50);
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [withdrawalPaymentMethods, setWithdrawalPaymentMethods] = useState<PaymentMethod[]>([]);

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
      if (methods.length > 0 && !method) setMethod(methods[0].name);
    });

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setBalance(docSnap.data().walletBalance || 0);
      }
    });
    
    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(3) 
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

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  const handleDepositSubmit = async (amount: number, paymentMethod: string, file: File) => {
    if (!user) return;
    try {
      showNotification('Uploading proof...', 'success');
      const formData = new FormData();
      formData.append('image', file);
      
      const imgbbKey = import.meta.env.VITE_IMGBB_API_KEY || 'YOUR_IMGBB_API_KEY_HERE'; 
      const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method: 'POST', body: formData });
      const imgbbData = await imgbbRes.json();
      if (!imgbbData.success) throw new Error('Failed to upload image');
      
      const proofUrl = imgbbData.data.url;

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userEmail: user.email,
        type: 'Deposit',
        amount: amount,
        paymentMethod: paymentMethod,
        proofUrl: proofUrl,
        status: 'pending',
        date: new Date().toLocaleDateString(),
        createdAt: serverTimestamp()
      });

      showNotification(`Deposit request submitted!`, 'success');
      setIsModalOpen(false); 
    } catch (error) {
      showNotification('Failed to submit deposit', 'error');
    }
  };

  const handleWithdrawalSubmit = async () => {
    if (!user) return;
    const numAmount = parseInt(withdrawalAmount);
    
    if (!withdrawalAmount || isNaN(numAmount)) return showNotification('Enter valid amount', 'error');
    if (numAmount < minWithdrawal) return showNotification(`Min withdrawal is ${minWithdrawal}`, 'error');
    if (numAmount > balance) return showNotification('Insufficient Balance', 'error');
    if (!accountNumber || !accountName) return showNotification('Enter account details', 'error');
    if (!method) return showNotification('Select payment method', 'error');

    setIsSubmittingWithdrawal(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await transaction.get(userRef);
        const currentBalance = userDoc.data()?.walletBalance || 0;
        if (currentBalance < numAmount) throw new Error("Insufficient Balance");
        
        transaction.update(userRef, { walletBalance: currentBalance - numAmount });
        
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          userId: user.uid,
          userEmail: user.email,
          type: 'Withdrawal',
          amount: numAmount,
          paymentMethod: method, // Fixed: Using state
          accountNumber,
          accountName: accountName || 'N/A',
          status: 'pending',
          date: new Date().toLocaleString(),
          createdAt: serverTimestamp()
        });
      });

      showNotification('Withdrawal request submitted!', 'success');
      setWithdrawalAmount(''); setAccountNumber(''); setAccountName('');
    } catch (error: any) {
      showNotification(error.message || 'Failed', 'error');
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-20 font-sans relative">
      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className={`fixed top-4 left-4 right-4 z-50 border p-4 rounded-xl shadow-lg flex items-start ${toastType === 'success' ? 'bg-green-900 border-green-500' : 'bg-red-900 border-red-500'}`}>
            <p className="font-medium text-sm">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto">
        <Link to="/" className="flex items-center text-blue-400 mb-6 hover:text-white"><ArrowLeft size={20} className="mr-2" /> Back</Link>

        <div className="bg-gradient-to-br from-[#1E293B] to-[#2D2416] rounded-2xl p-6 mb-8 border border-yellow-500/20 shadow-xl">
          <div className="text-gray-300 mb-4">Available Balance</div>
          <div className="flex items-center mb-1"><Coins size={40} className="text-yellow-400 mr-3" /> <span className="text-6xl font-bold text-yellow-400">{balance}</span></div>
          <p className="text-gray-400 text-sm mb-6">Coins = {balance} PKR</p>
          <button onClick={() => setIsModalOpen(true)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl">Buy Coins</button>
        </div>

        <div className="bg-[#0B1120] rounded-2xl p-6 mb-8 border border-gray-800">
           <div className="flex items-start mb-6">
            <div className="bg-purple-900/30 p-3 rounded-xl mr-4"><ArrowDownUp size={24} className="text-purple-400" /></div>
            <div><h2 className="text-2xl font-bold mb-1">Withdrawals</h2><p className="text-white text-lg">Balance: {balance} coins</p></div>
           </div>
           
           <input type="number" value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)} placeholder="Amount (Coins)" disabled={isSubmittingWithdrawal} className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white mb-4" />
           
           <select value={method} onChange={e => setMethod(e.target.value)} disabled={isSubmittingWithdrawal} className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white mb-4">
             {withdrawalPaymentMethods.map(pm => <option key={pm.name} value={pm.name}>{pm.name}</option>)}
           </select>

           <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account No" disabled={isSubmittingWithdrawal} className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white mb-4" />
           <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Holder Name" disabled={isSubmittingWithdrawal} className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white mb-4" />
           
           <button onClick={handleWithdrawalSubmit} disabled={isSubmittingWithdrawal} className="w-full bg-purple-600 py-3 rounded-xl font-bold">
             {isSubmittingWithdrawal ? 'Processing...' : 'Submit Request'}
           </button>
        </div>

        <div className="bg-[#0B1120] rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold mb-4">Recent</h2>
          {transactions.map((tx) => (
            <div key={tx.id} className="bg-[#131B2F] p-4 rounded-xl flex justify-between items-center mb-2">
               <div><p className="font-bold">{tx.type}</p><p className="text-xs text-gray-500">{tx.date}</p></div>
               <p className="font-bold">{tx.type === 'Deposit' ? '+' : '-'}{tx.amount} coins</p>
            </div>
          ))}
        </div>
      </div>

      <BuyCoinsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialAmount={initialAmount} onSubmit={handleDepositSubmit} minDeposit={minDeposit} paymentMethods={paymentMethods} />
    </div>
  );
}
