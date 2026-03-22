import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, Plus, Edit2 } from 'lucide-react';

export default function PaymentMethods({ title = "Payment Methods", collectionName = "payment_methods", showDetails = true }: { title?: string, collectionName?: string, showDetails?: boolean }) {
  const[methods, setMethods] = useState<any[]>([]);
  // 1. Yahan state mein accountName shamil kar diya hai
  const [newMethod, setNewMethod] = useState({ name: '', details: '', accountName: '', enabled: true });
  const [editingMethod, setEditingMethod] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, collectionName), (snapshot) => {
      setMethods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [collectionName]);

  const handleAdd = async () => {
    // Validation: Agar showDetails true hai to details aur accountName dono zaroori hain
    if (!newMethod.name || (showDetails && (!newMethod.details || !newMethod.accountName))) return;
    
    // 2. Firestore mein accountName save ho raha hai yahan
    await addDoc(collection(db, collectionName), { 
      name: newMethod.name,
      enabled: newMethod.enabled,
      details: showDetails ? newMethod.details : 'N/A',
      accountName: showDetails ? newMethod.accountName : 'N/A'
    });
    
    setNewMethod({ name: '', details: '', accountName: '', enabled: true });
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await updateDoc(doc(db, collectionName, id), { enabled: !enabled });
  };

  const handleEdit = async () => {
    if (!editingMethod) return;
    
    // 3. Edit karte waqt bhi accountName Firestore mein update hoga
    await updateDoc(doc(db, collectionName, editingMethod.id), {
      name: editingMethod.name,
      details: showDetails ? editingMethod.details : 'N/A',
      accountName: showDetails ? editingMethod.accountName : 'N/A'
    });
    setEditingMethod(null);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, collectionName, id));
    setDeleteConfirm(null);
  };

  return (
    <div className="p-8 bg-[#0D0D0D] rounded-3xl border border-gray-800 shadow-2xl mb-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">{title}</h2>
        <div className="text-gray-500 text-xs font-bold uppercase tracking-widest">Admin Control</div>
      </div>
      
      <div className="bg-[#1A1A1A] p-6 rounded-2xl border border-gray-800 mb-8">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Add New Method</h3>
        <div className={`grid grid-cols-1 ${showDetails ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-4`}>
          <input 
            placeholder="Method Name (e.g., JazzCash)" 
            className="bg-[#0D0D0D] p-4 rounded-xl text-white border border-gray-700 focus:ring-2 focus:ring-yellow-500 transition-all"
            value={newMethod.name}
            onChange={e => setNewMethod({...newMethod, name: e.target.value})}
          />
          {showDetails && (
            <>
              <input 
                placeholder="Account Number" 
                className="bg-[#0D0D0D] p-4 rounded-xl text-white border border-gray-700 focus:ring-2 focus:ring-yellow-500 transition-all"
                value={newMethod.details}
                onChange={e => setNewMethod({...newMethod, details: e.target.value})}
              />
              {/* Naya input Account Name ke liye */}
              <input 
                placeholder="Account Holder Name" 
                className="bg-[#0D0D0D] p-4 rounded-xl text-white border border-gray-700 focus:ring-2 focus:ring-yellow-500 transition-all"
                value={newMethod.accountName}
                onChange={e => setNewMethod({...newMethod, accountName: e.target.value})}
              />
            </>
          )}
          <button onClick={handleAdd} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest p-4 rounded-xl flex items-center justify-center gap-2 transition-all">
            <Plus size={20} /> Add Method
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {methods.map(method => (
          <div key={method.id} className="bg-[#1A1A1A] p-6 rounded-3xl border border-gray-800 hover:border-gray-700 transition-all flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex justify-between items-start mb-4">
                <p className="text-white font-black text-xl">{method.name}</p>
                <button 
                  onClick={() => handleToggle(method.id, method.enabled)}
                  className={`w-12 h-6 rounded-full p-1 transition-all duration-300 flex items-center ${
                    method.enabled ? 'bg-yellow-500 justify-end' : 'bg-gray-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                </button>
              </div>
              {showDetails && (
                <div className="space-y-2 mb-6">
                  <p className="text-gray-400 text-sm font-mono bg-[#0D0D0D] p-3 rounded-xl">Num: {method.details}</p>
                  <p className="text-gray-400 text-sm font-mono bg-[#0D0D0D] p-3 rounded-xl">Name: {method.accountName || 'N/A'}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingMethod(method)} className="text-gray-600 hover:text-yellow-500 transition-all p-2 rounded-full hover:bg-yellow-500/10">
                <Edit2 size={20} />
              </button>
              <button onClick={() => setDeleteConfirm(method.id)} className="text-gray-600 hover:text-red-500 transition-all p-2 rounded-full hover:bg-red-500/10">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingMethod && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A1A] p-8 rounded-3xl border border-gray-800 w-full max-w-md">
            <h3 className="text-white font-black text-xl mb-6">Edit Method</h3>
            <input 
              className="bg-[#0D0D0D] p-4 rounded-xl text-white border border-gray-700 w-full mb-4"
              placeholder="Method Name"
              value={editingMethod.name}
              onChange={e => setEditingMethod({...editingMethod, name: e.target.value})}
            />
            {showDetails && (
              <>
                <input 
                  className="bg-[#0D0D0D] p-4 rounded-xl text-white border border-gray-700 w-full mb-4"
                  placeholder="Account Number"
                  value={editingMethod.details}
                  onChange={e => setEditingMethod({...editingMethod, details: e.target.value})}
                />
                <input 
                  className="bg-[#0D0D0D] p-4 rounded-xl text-white border border-gray-700 w-full mb-6"
                  placeholder="Account Holder Name"
                  value={editingMethod.accountName || ''}
                  onChange={e => setEditingMethod({...editingMethod, accountName: e.target.value})}
                />
              </>
            )}
            <div className="flex gap-4">
              <button onClick={() => setEditingMethod(null)} className="flex-1 bg-gray-700 text-white font-black p-4 rounded-xl uppercase tracking-widest">Cancel</button>
              <button onClick={handleEdit} className="flex-1 bg-yellow-500 text-black font-black p-4 rounded-xl uppercase tracking-widest">Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1A1A] p-8 rounded-3xl border border-gray-800 w-full max-w-md">
            <h3 className="text-white font-black text-xl mb-4">Delete Method?</h3>
            <p className="text-gray-400 mb-8">Are you sure you want to delete this payment method? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-gray-700 text-white font-black p-4 rounded-xl uppercase tracking-widest">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 bg-red-500 text-white font-black p-4 rounded-xl uppercase tracking-widest">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}