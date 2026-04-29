import React, { useState, useEffect } from 'react';
// import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
// import { db, handleFirestoreError, OperationType } from '../lib/firebase'; // Removed for desktop app
import { getDataService } from '../lib/dataService';
import { useSyncStatus } from '../lib/syncManager';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, Trash2, Phone, Mail, Award, CreditCard, Search, History, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useUserProfile } from '../hooks/useUserProfile';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  points: number;
  debt: number;
  createdAt: any;
}

interface LedgerEntry {
  id: string;
  customerId: string;
  orderId?: string | null;
  type: string;
  amount: number;
  balanceAfter: number;
  note?: string;
  createdAt: string;
}

export default function CustomersPage() {
  const { isAdmin } = useUserProfile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const syncStatus = useSyncStatus();
  const dataService = getDataService();

  useEffect(() => {
    // Load customers using data service
    const loadCustomers = async () => {
      try {
        const custs = await dataService.listCustomers();
        setCustomers(custs);
      } catch (error) {
        console.error('Failed to load customers:', error);
      }
    };

    loadCustomers();

    // Subscribe to real-time updates
    const unsubscribe = dataService.subscribeToCustomers((custs) => {
      setCustomers(custs);
    });

    return unsubscribe;
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this customer record?')) return;
    try {
      await dataService.deleteCustomer(id);
    } catch (error) {
      console.error('Failed to delete customer:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerData = {
        ...formData,
        points: 0,
        debt: 0,
        createdAt: new Date().toISOString(),
      };

      await dataService.createCustomer(customerData);
      setFormData({ name: '', phone: '', email: '' });
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to create customer:', error);
    }
  };

  const clearDebt = async (customerId: string, amount: number) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    try {
      const result = await dataService.recordCustomerPayment(customerId, {
        amount,
        note: 'Customer debt repayment'
      });
      setCustomers(prev => prev.map(item => item.id === customerId ? result.customer : item));
      setLedger(prev => [result.entry, ...prev]);
      setPaymentAmount(0);
    } catch (error) {
      console.error('Failed to update customer debt:', error);
      alert(error instanceof Error ? error.message : 'Failed to update customer debt');
    }
  };

  const selectCustomer = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    try {
      const entries = await dataService.listCustomerLedger(customerId);
      setLedger(entries);
    } catch (error) {
      console.error('Failed to load customer statement:', error);
      setLedger([]);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Customers</h1>
          <p className="text-gray-500 font-medium">Manage loyalty points and credit/debts.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="h-16 px-8 bg-[#141414] text-white font-bold tracking-widest uppercase hover:bg-black transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="panel rounded-[2rem] border border-slate-700/80 p-8 shadow-panel"
          >
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Full Name</label>
                <input required className="w-full bg-slate-950 border border-slate-700/80 p-4 font-bold text-slate-100 outline-none focus:border-cyan-400" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Customer Name" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Phone Number</label>
                <input required className="w-full bg-slate-950 border border-slate-700/80 p-4 font-bold text-slate-100 outline-none focus:border-cyan-400" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="e.g. 07..." />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Email (Optional)</label>
                <input className="w-full bg-slate-950 border border-slate-700/80 p-4 font-bold text-slate-100 outline-none focus:border-cyan-400" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="customer@example.com" />
              </div>
              <div className="md:col-span-3 flex justify-end gap-4">
                <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-4 font-bold tracking-widest uppercase hover:underline">Cancel</button>
                <button type="submit" className="px-12 py-4 bg-[#141414] text-white font-bold tracking-widest uppercase">Register Customer</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="panel-soft rounded-[2rem] border border-slate-700/80 p-4 flex items-center justify-between">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
              <input className="w-full bg-slate-950 border border-slate-700/80 pl-12 pr-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredCustomers.map(c => (
              <div key={c.id} className="panel-soft border border-slate-700/80 p-6 space-y-4 hover:border-cyan-400/60 transition-colors relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg leading-tight uppercase underline decoration-2 decoration-gray-100 group-hover:decoration-black">{c.name}</h3>
                    <p className="text-xs opacity-50 font-mono">{c.phone}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-1.5 py-0.5 bg-yellow-950/30 text-yellow-300 text-[9px] font-bold uppercase tracking-tight flex items-center gap-1">
                      <Award className="w-2 h-2" /> {c.points} Points
                    </span>
                    {c.debt > 0 && (
                      <span className="px-1.5 py-0.5 bg-rose-950/30 text-rose-300 text-[9px] font-bold uppercase tracking-tight">
                        OWES: Ksh {c.debt.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-4">
                    <button 
                      onClick={() => selectCustomer(c.id)}
                      className="flex-1 bg-[#141414] text-white py-3 text-[10px] font-bold tracking-widest uppercase hover:bg-black transition-colors"
                    >
                    Statement / Payment
                    </button>
                  {isAdmin && (
                    <button 
                      onClick={() => handleDelete(c.id)}
                      className="p-3 border border-slate-700/80 text-slate-400 hover:text-rose-400 hover:border-cyan-400/60 transition-all group-hover:bg-rose-950/30 rounded-2xl"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar for Debt Payment */}
        <div className="space-y-6">
          <div className="panel rounded-[2rem] border border-slate-700/80 p-8 space-y-6 shadow-panel">
            <h2 className="font-black text-xl tracking-tighter uppercase mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Repayment
            </h2>
            {selectedCustomerId ? (
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mb-1">Processing Payment for:</p>
                  <p className="font-bold text-lg">{customers.find(c => c.id === selectedCustomerId)?.name}</p>
                  <p className="text-red-600 font-mono font-bold">Total Debt: Ksh {customers.find(c => c.id === selectedCustomerId)?.debt.toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Payment Amount (Ksh)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-950 border border-slate-700/80 p-4 font-mono font-bold text-2xl text-slate-100 outline-none focus:border-cyan-400"
                    value={paymentAmount || ''}
                    onChange={e => setPaymentAmount(parseFloat(e.target.value))}
                  />
                </div>
                <button 
                  onClick={() => clearDebt(selectedCustomerId, paymentAmount)}
                  className="w-full bg-[#141414] text-white py-4 font-bold tracking-widest uppercase hover:bg-black"
                >
                  Confirm Payment
                </button>
                <div className="border-t border-slate-700/80 pt-4 space-y-3">
                  <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Statement</p>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {ledger.length === 0 ? (
                      <p className="text-xs opacity-40 italic">No debt activity recorded.</p>
                    ) : ledger.map(entry => (
                      <div key={entry.id} className="border border-slate-700/80 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest",
                            entry.amount < 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {entry.type.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-xs font-bold">
                            {entry.amount < 0 ? '-' : '+'} Ksh {Math.abs(entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <p className="text-[10px] opacity-50 mt-1">{entry.note || 'Ledger entry'}</p>
                        <div className="flex justify-between text-[10px] font-mono opacity-40 mt-2">
                          <span>{formatDate(entry.createdAt)}</span>
                          <span>Balance: {entry.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => { setSelectedCustomerId(null); setLedger([]); }} className="w-full text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100">Close</button>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 italic">
                <History className="w-12 h-12 mx-auto mb-4 opacity-10" />
                Select a customer with debt to process a repayment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}
