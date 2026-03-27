import { useState, useEffect } from 'react';
import { Plus, MessageSquare, X, ChevronDown, AlertCircle, CheckCircle, ArrowLeft, User, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, updateDoc, doc } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'admin';
  timestamp: string;
}

interface Ticket {
  id: string;
  userId: string;
  subject: string;
  lastMessage: string;
  category: string;
  status: 'Open' | 'Closed' | 'Pending' | 'Solved';
  messageCount: number;
  date: string;
  createdAt: any;
  priority: 'Low' | 'Medium' | 'High';
  messages: Message[];
  userUnreadCount?: number;
}

interface SupportProps {
  user: {
    uid: string;
    username: string;
    email: string;
  };
}

export default function Support({ user }: SupportProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    category: '',
    priority: 'Medium',
    message: ''
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'support_tickets'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      
      // Client-side sort: Latest first for cooldown check
      ticketsData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setTickets(ticketsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const categories = [
    'Payment Issues',
    'Tournament Issues',
    'Technical Support',
    'Account Issues',
    'Other'
  ];

  const handleCreateRequest = async () => {
    if (!formData.subject || !formData.category || !formData.message) {
      setToastType('error');
      setToastMessage('Please fill in all required fields');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    // --- 24 HOUR COOLDOWN LOGIC ---
    const latestTicket = tickets[0];
    if (latestTicket && latestTicket.createdAt) {
      const lastTime = latestTicket.createdAt.toMillis();
      const currentTime = Date.now();
      const diffInHours = (currentTime - lastTime) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        const remaining = Math.ceil(24 - diffInHours);
        setToastType('error');
        setToastMessage(`Wait ${remaining}h more before sending another request.`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const now = new Date();
      const ticketData = {
        userId: user.uid,
        subject: formData.subject,
        lastMessage: formData.message,
        category: formData.category,
        status: 'Pending',
        messageCount: 1,
        date: now.toLocaleString(),
        createdAt: serverTimestamp(),
        priority: formData.priority,
        userUnreadCount: 0,
        messages: [
          { 
            id: Date.now().toString(), 
            text: formData.message, 
            sender: 'user', 
            timestamp: now.toLocaleTimeString() 
          }
        ]
      };

      await addDoc(collection(db, 'support_tickets'), ticketData);

      setIsModalOpen(false);
      setFormData({ subject: '', category: '', priority: 'Medium', message: '' });
      
      setToastType('success');
      setToastMessage('Support request created successfully');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error("Error creating ticket:", error);
      setToastType('error');
      setToastMessage('Failed to create support request');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
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
              toastType === 'success' ? 'bg-green-900/90 border-green-500' : 'bg-red-900/90 border-red-500'
            }`}
          >
            {toastType === 'success' ? <CheckCircle className="text-green-400 mr-3 mt-0.5" size={20} /> : <AlertCircle className="text-red-400 mr-3 mt-0.5" size={20} />}
            <div className="flex-1">
              <p className="font-medium text-sm">{toastMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <MessageSquare className="text-yellow-400 mr-2" size={24} />
            <h1 className="text-2xl font-bold text-yellow-400">Support</h1>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-4 rounded-lg flex items-center text-sm transition-colors"
          >
            <Plus size={16} className="mr-1" /> New
          </button>
        </div>

        {/* Ticket List */}
        <div className="space-y-3 mb-8">
          {loading ? (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <div className="relative flex items-center justify-center mb-4 w-16 h-16">
                <div className="absolute inset-0 border-[2px] border-yellow-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-[4px] border-transparent border-t-yellow-500 rounded-full animate-spin"></div>
              </div>
              <p className="text-yellow-400 font-bold uppercase tracking-widest text-sm">Loading...</p>
            </div>
          ) : tickets.length > 0 ? (
            tickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className="bg-[#131B2F] rounded-2xl p-4 border border-gray-800 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-white text-base">{ticket.subject}</h3>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                    ticket.status === 'Open' ? 'bg-green-500/20 text-green-400' : 
                    ticket.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' : 
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {ticket.status}
                  </span>
                </div>

                <p className="text-sm mb-3 text-gray-400 italic font-medium">
                  "{ticket.lastMessage}"
                </p>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/20 uppercase">
                      {ticket.priority}
                    </span>
                    <span className="text-[10px] text-gray-500">{ticket.category}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono">{ticket.date}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-[65vh] text-center bg-[#131B2F] rounded-2xl border border-gray-800 p-8">
              <MessageSquare size={32} className="text-gray-600 mb-4" />
              <h3 className="text-white font-bold text-lg mb-2">No Support Tickets</h3>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-yellow-500 text-black font-bold py-2.5 px-6 rounded-xl text-sm mt-4 shadow-lg shadow-yellow-900/20"
              >
                Create Request
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Request Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0B1120] w-full max-w-sm rounded-2xl border border-gray-800 shadow-2xl overflow-hidden"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-yellow-400 leading-tight">New Support<br />Request</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-white text-xs font-medium mb-1">Subject *</label>
                    <input 
                      type="text" 
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      placeholder="Issue title"
                      className="w-full bg-[#131B2F] border border-gray-700 rounded-lg p-2 text-sm text-white outline-none focus:border-yellow-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white text-xs font-medium mb-1">Category *</label>
                    <div className="relative">
                      <select 
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-[#131B2F] border border-gray-700 rounded-lg p-2 text-sm text-white outline-none focus:border-yellow-500 appearance-none"
                      >
                        <option value="" disabled>Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={14} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white text-xs font-medium mb-1">Message *</label>
                    <textarea 
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      placeholder="Issue description..."
                      rows={3}
                      className="w-full bg-[#131B2F] border border-gray-700 rounded-lg p-2 text-sm text-white outline-none focus:border-yellow-500 resize-none"
                    />
                  </div>

                  <div className="pt-2 space-y-2">
                    <button 
                      onClick={handleCreateRequest}
                      disabled={isSubmitting}
                      className="w-full bg-yellow-500 text-black font-bold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Request'}
                    </button>
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="w-full bg-[#1C2536] text-white font-medium py-2.5 rounded-lg text-sm border border-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
