import { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, CheckCircle, X, Wallet, History, CreditCard, Coins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, doc, runTransaction, getDoc } from 'firebase/firestore';

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

  useEffect(() => {
    if (!user) return;

    // Fetch User Balance
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setBalance(docSnap.data().walletBalance || 0);
      }
    });

    // Fetch Settings
    const unsubSettings = onSnapshot(doc(db, 'admin', 'transaction_settings'), (doc) => {
      if (doc.exists()) setMinWithdrawal(doc.data().minWithdrawal || 100);
    });

    // Fetch Payment Methods
    const unsubMethods = onSnapshot(collection(db, 'withdrawal_payment_methods'), (snapshot) => {
      const methods = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((m: any) => m.enabled);
      setPaymentMethods(methods);
      if (methods.length > 0) {
        setMethod((methods[0] as any).name);
      }
    });

    // Fetch Requests
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('type', '==', 'Withdrawal'),
      orderBy('createdAt', 'desc')
    );

    const unsubRequests = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => { unsubUser(); unsubSettings(); unsubMethods(); unsubRequests(); };
  }, [user]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const numAmount = parseInt(amount);

    if (!amount || isNaN(numAmount)) return showNotification('Enter valid amount', 'error');
    if (numAmount < minWithdrawal) return showNotification(`Min withdrawal is ${minWithdrawal}`, 'error');
    if (numAmount > 1200) return showNotification('Max withdrawal is 1200', 'error');
    if (numAmount > balance) return showNotification('Insufficient Balance', 'error');
    if (!accountNumber || !accountName) return showNotification('Enter account details', 'error');
    if (!method) return showNotification('Please select a payment method', 'error');

    setIsSubmitting(true);

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
          paymentMethod: method, // Dropdown state used here
          accountNumber,
          accountName,
          status: 'pending',
          date: new Date().toLocaleString(),
          createdAt: serverTimestamp()
        });
      });

      showNotification('Withdrawal request submitted successfully', 'success');
      setAmount(''); setAccountNumber(''); setAccountName('');
    } catch (error: any) {
      showNotification(error.message || 'Failed to submit request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050B14] text-white p-4 font-sans pb-20">
      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-xl border ${toastType === 'success' ? 'bg-green-900 border-green-500' : 'bg-red-900 border-red-500'}`}>
            <p className="text-sm font-bold text-center">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto">
        <Link to="/" className="flex items-center text-blue-400 mb-6 hover:text-white"><ArrowLeft size={20} className="mr-2" /> Back</Link>

        <div className="bg-[#0B1120] rounded-2xl p-6 mb-8 border border-gray-800">
           <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Amount</label>
           <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white mb-4" />
           
           <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Payment Method</label>
           <select 
             value={method} 
             onChange={e => setMethod(e.target.value)} 
             className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white mb-4"
           >
             {paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
           </select>

           <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account Number" className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white mb-4" />
           <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Account Holder Name" className="w-full bg-[#131B2F] border border-gray-700 rounded-xl p-3 text-white mb-4" />
           
           <button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl">
             {isSubmitting ? 'Processing...' : 'Submit Request'}
           </button>
        </div>
      </div>
    </div>
  );
    }
