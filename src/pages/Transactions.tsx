import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Trophy, UserPlus, Zap, BarChart3, Calendar, Filter, RotateCcw, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
// UPDATED: limit, getDocs, startAfter imports pagination ke liye
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Transaction {
  id: string;
  type: 'Deposit' | 'Withdrawal' | 'Joining' | 'Prize Pool' | 'Winning' | 'Reversal' | 'Referral' | 'Task Reward' | 'Tournament Entry';
  amount: number;
  date: string;
  status: 'Completed' | 'Pending' | 'Rejected' | 'completed' | 'pending' | 'rejected';
  description?: string;
  createdAt?: any;
  ign?: string;
  uid?: string;
  kills?: number;
}

const TRANSACTIONS_PER_PAGE = 10; // ADDED: Pagination limit

export default function Transactions() {
  const [user] = useAuthState(auth);
  const[transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'All' | 'Income' | 'Expenses'>('All');

  // ADDED: States for pagination
  const [lastVisible, setLastVisible] = useState<any>(null); // Last fetched document for next query
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true); // To check if there are more transactions to load

  const handleTabChange = (tab: 'All' | 'Income' | 'Expenses') => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      // ADDED: Reset pagination when tab changes
      setTransactions([]);
      setLastVisible(null);
      setHasMore(true);
      setLoading(true); // Re-fetch data for new tab
    }
  };

  // ADDED: Initial fetch and on tab change fetch logic
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(TRANSACTIONS_PER_PAGE) // OPTIMIZATION: Initial limit
        );

        const documentSnapshots = await getDocs(q); // Use getDocs for initial fetch
        const txData = documentSnapshots.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        
        setTransactions(txData);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        setHasMore(txData.length === TRANSACTIONS_PER_PAGE);
      } catch (error) {
        console.error("Error fetching initial transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();

    // OPTIMIZATION: onSnapshot is only needed for real-time updates.
    // For transactions history, getDocs + pagination is more efficient to reduce reads.
    // If you need real-time updates for the visible 10 transactions, you can re-enable onSnapshot
    // but it would require a more complex setup to handle real-time pagination efficiently.
    // For now, it's a one-time fetch per tab/load more.
    // const unsubscribe = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(TRANSACTIONS_PER_PAGE)), (snapshot) => {
    //   const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
    //   setTransactions(txData);
    //   setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
    //   setHasMore(txData.length === TRANSACTIONS_PER_PAGE);
    //   setLoading(false);
    // });
    // return () => unsubscribe();

  }, [user, activeTab]); // Re-fetch when user or activeTab changes

  // ADDED: Function to load more transactions
  const loadMoreTransactions = async () => {
    if (!lastVisible || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user?.uid),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible), // Start after the last document seen
        limit(TRANSACTIONS_PER_PAGE) // Fetch next 10
      );

      const documentSnapshots = await getDocs(q);
      const newTransactions = documentSnapshots.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];

      setTransactions(prev => [...prev, ...newTransactions]);
      setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
      setHasMore(newTransactions.length === TRANSACTIONS_PER_PAGE);
    } catch (error) {
      console.error("Error loading more transactions:", error);
    } finally {
      setLoadingMore(false);
    }
  };


  // Check if transaction is positive (Income)
  const isIncome = (type: string) => {
    return['Deposit', 'Prize Pool', 'Winning', 'Referral', 'Task Reward'].includes(type);
  };

  // Get raw Lucide icons without inline colors (Color will be inherited from the parent div)
  const getIcon = (type: string) => {
    switch (type) {
      case 'Deposit': return <ArrowDownLeft size={20} />;
      case 'Withdrawal': return <ArrowUpRight size={20} />;
      case 'Prize Pool':
      case 'Winning': return <Trophy size={20} />;
      case 'Joining':
      case 'Tournament Entry': return <UserPlus size={20} />;
      case 'Reversal': return <RotateCcw size={20} />;
      case 'Referral':
      case 'Task Reward': return <Gift size={20} />;
      default: return <BarChart3 size={20} />;
    }
  };

  // Dedicated function to style Icon Backgrounds & Colors
  const getIconStyles = (type: string) => {
    switch (type) {
      case 'Deposit': return 'text-green-400 bg-green-400/10';
      case 'Withdrawal': return 'text-red-400 bg-red-400/10';
      case 'Prize Pool':
      case 'Winning': return 'text-yellow-400 bg-yellow-400/10';
      case 'Joining':
      case 'Tournament Entry': return 'text-blue-400 bg-blue-400/10';
      case 'Reversal': return 'text-orange-400 bg-orange-400/10';
      case 'Referral':
      case 'Task Reward': return 'text-emerald-400 bg-emerald-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  // Dedicated function to style Amount text colors
  const getAmountColor = (type: string) => {
    if (type === 'Winning') return 'text-yellow-400';
    if (isIncome(type)) return 'text-green-400';
    return 'text-red-400';
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'Completed':
      case 'completed':
        return 'bg-green-400/10 text-green-400 border-green-400/20';
      case 'Pending':
      case 'pending':
        return 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
      case 'Rejected':
      case 'rejected':
        return 'bg-red-400/10 text-red-400 border-red-400/20';
      default:
        return 'bg-gray-400/10 text-gray-400 border-gray-400/20';
    }
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '';
    // Handle Firestore Timestamp objects
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(date.getTime())) {
      // Fallback for non-Date-like strings if necessary
      return String(dateValue).replace('T', ' ');
    }
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const filteredTransactions = transactions.filter(tx => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Income') return isIncome(tx.type);
    if (activeTab === 'Expenses') return !isIncome(tx.type);
    return true;
  });

  const totalIncome = transactions
    .filter(tx => isIncome(tx.type) && (tx.status === 'Completed' || tx.status === 'completed'))
    .reduce((acc, tx) => acc + tx.amount, 0);

  const totalExpenses = transactions
    .filter(tx => !isIncome(tx.type) && (tx.status === 'Completed' || tx.status === 'completed'))
    .reduce((acc, tx) => acc + tx.amount, 0);

  const chartData =[
    { name: 'Income', value: totalIncome, color: '#4ADE80' },
    { name: 'Expenses', value: totalExpenses, color: '#F87171' },
  ];

  return (
    <div className="min-h-screen bg-[#050B14] text-white p-4 font-sans pb-20">
      <div className="max-w-md mx-auto">
        <Link to="/" className="flex items-center text-blue-400 mb-6 hover:text-blue-300 transition-colors group">
          <ArrowLeft size={20} className="mr-2 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold">Back to Dashboard</span>
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-black text-yellow-400 tracking-tight">Activity</h1>
          <div className="bg-yellow-400/10 p-2 rounded-xl border border-yellow-400/20">
            <BarChart3 size={20} className="text-yellow-400" />
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-[#0B1120] p-6 rounded-3xl border border-gray-800 mb-8 shadow-xl">
          <h3 className="text-sm font-bold text-gray-400 mb-6 flex items-center gap-2">
            <BarChart3 size={16} />
            Financial Overview
          </h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 'bold' }} 
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#1C1C1E', border: '1px solid #374151', borderRadius: '12px' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gradient-to-br from-[#0B1120] to-[#111827] p-5 rounded-2xl border border-gray-800 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-green-400/10 p-1.5 rounded-lg">
                <ArrowDownLeft size={14} className="text-green-400" />
              </div>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Income</p>
            </div>
            <p className="text-2xl font-black text-green-400">+{totalIncome}</p>
            <p className="text-[10px] text-gray-500 mt-1">Total coins earned</p>
          </div>
          <div className="bg-gradient-to-br from-[#0B1120] to-[#111827] p-5 rounded-2xl border border-gray-800 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-red-400/10 p-1.5 rounded-lg">
                <ArrowUpRight size={14} className="text-red-400" />
              </div>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Expenses</p>
            </div>
            <p className="text-2xl font-black text-red-400">-{totalExpenses}</p>
            <p className="text-[10px] text-gray-500 mt-1">Total coins spent</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1.5 bg-[#0B1120] rounded-2xl border border-gray-800 mb-6 shadow-inner">
          {(['All', 'Income', 'Expenses'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-300 uppercase tracking-wider ${
                activeTab === tab 
                  ? 'bg-yellow-400 text-black shadow-xl scale-[1.02]' 
                  : 'text-gray-500 hover:text-white hover:bg-gray-800/30'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-bold text-gray-400 flex items-center gap-2">
            <Calendar size={14} />
            Recent History
          </h2>
          <button className="text-gray-500 hover:text-white transition-colors">
            <Filter size={14} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center mb-4 w-16 h-16">
              <div className="absolute inset-0 border-[2px] border-yellow-500/10 rounded-full"></div>
              <div className="absolute inset-0 border-[4px] border-transparent border-t-yellow-500 rounded-full animate-spin shadow-[0_0_15px_rgba(234,179,8,0.4)]"></div>
              <div className="absolute inset-3 border-[2px] border-transparent border-b-yellow-500/50 rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
              <div className="absolute inset-0 m-auto w-2.5 h-2.5 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.8)] animate-pulse"></div>
            </div>
            <p className="text-yellow-400 font-bold animate-pulse uppercase tracking-widest text-sm drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]">Loading history...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <div key={tx.id} className="bg-[#0B1120] rounded-2xl p-4 border border-gray-800 flex items-center justify-between shadow-sm hover:border-gray-700 transition-all duration-300 hover:scale-[1.01] group">
                <div className="flex items-center space-x-4">
                  {/* Dynamic Icon Style Applied Here */}
                  <div className={`p-3 rounded-xl transition-transform group-hover:scale-110 flex items-center justify-center ${getIconStyles(tx.type)}`}>
                    {getIcon(tx.type)}
                  </div>
                  <div>
                    <p className="font-bold text-white leading-tight text-sm">{tx.type}</p>
                    <p className="text-[10px] text-gray-500 mt-1 font-medium">{formatDate(tx.date)}</p>
                    {tx.description && <p className="text-[11px] text-gray-400 mt-1.5 line-clamp-1 italic">{tx.description}</p>}
                    {(tx.ign || tx.uid || tx.kills !== undefined) && (
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {tx.ign && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">IGN: {tx.ign}</span>}
                        {tx.uid && <span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">UID: {tx.uid}</span>}
                        {tx.kills !== undefined && <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">Kills: {tx.kills}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {/* Dynamic Amount Color Applied Here */}
                  <p className={`font-black text-lg tracking-tighter ${getAmountColor(tx.type)}`}>
                    {isIncome(tx.type) ? '+' : '-'}{tx.amount}
                  </p>
                  <span className={`inline-block mt-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider ${getStatusStyles(tx.status)}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}

            {filteredTransactions.length === 0 && (
              <div className="text-center py-16 bg-[#0B1120] rounded-3xl border border-dashed border-gray-800">
                <div className="bg-gray-800/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No transactions found in this category.</p>
              </div>
            )}
            
            {/* ADDED: Load More Button */}
            {hasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={loadMoreTransactions}
                  disabled={loadingMore}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
                >
                  {loadingMore ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
