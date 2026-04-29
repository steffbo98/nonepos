import React, { useState, useEffect } from 'react';
// import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
// import { db, handleFirestoreError, OperationType } from '../lib/firebase'; // Removed for desktop app
import { getDataService } from '../lib/dataService';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, Search, Calendar, Tag } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useUserProfile } from '../hooks/useUserProfile';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: any;
  createdAt: any;
}

export default function ExpensesPage() {
  const { isAdmin } = useUserProfile();
  const dataService = getDataService();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ description: '', amount: 0, category: 'Utilities' });
  const [isAdding, setIsAdding] = useState(false);

  const CATEGORIES = ['Utilities', 'Rent', 'Salaries', 'Purchases', 'Transport', 'Marketing', 'Maintenance', 'Tax', 'Other'];

  const loadExpenses = async () => {
    try {
      const data = await dataService.listExpenses();
      setExpenses(data);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await dataService.createExpense({
        ...formData,
        amount: Number(formData.amount),
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      setExpenses(prev => [created, ...prev]);
      setFormData({ description: '', amount: 0, category: 'Utilities' });
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to save expense:', error);
      alert(error instanceof Error ? error.message : 'Failed to save expense');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await dataService.deleteExpense(id);
      setExpenses(prev => prev.filter(expense => expense.id !== id));
    } catch (error) {
      console.error('Failed to delete expense:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete expense');
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const filteredExpenses = expenses.filter(exp => 
    exp.description.toLowerCase().includes(search.toLowerCase()) ||
    exp.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Expenses</h1>
          <p className="text-slate-400 font-medium">Track your business overheads and spending.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="panel-soft rounded-[2rem] border border-slate-700/80 p-4 flex items-center gap-4">
            <Wallet className="w-8 h-8 opacity-20" />
            <div>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Total Outflow</p>
              <p className="text-2xl font-mono font-bold leading-none">Ksh {totalExpenses.toLocaleString()}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="h-16 px-8 bg-[#141414] text-white font-bold tracking-widest uppercase hover:bg-black transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Expense
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="panel rounded-[2rem] border border-slate-700/80 p-8 shadow-panel"
          >
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Description</label>
                <input 
                  required
                  className="w-full bg-slate-950 border border-slate-700/80 p-4 font-bold text-slate-100 outline-none focus:border-cyan-400"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="e.g. Monthly Rent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Category</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700/80 p-4 font-bold text-slate-100 outline-none focus:border-cyan-400"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Amount (Ksh)</label>
                <input 
                  required
                  type="number"
                  className="w-full bg-slate-950 border border-slate-700/80 p-4 font-mono font-bold text-slate-100 outline-none focus:border-cyan-400"
                  value={formData.amount || ''}
                  onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                  placeholder="0.00"
                />
              </div>
              <div className="md:col-span-4 flex justify-end gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-8 py-4 font-bold tracking-widest uppercase hover:underline"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-12 py-4 bg-[#141414] text-white font-bold tracking-widest uppercase"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="panel rounded-[2rem] border border-slate-700/80 overflow-hidden shadow-panel">
        <div className="p-6 border-b border-slate-700/80 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
            <input 
              className="w-full bg-slate-950 border border-slate-700/80 pl-12 pr-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
              placeholder="Search expenses..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-700/80">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest opacity-40">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest opacity-40">Category</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest opacity-40 border-l border-slate-700/80">Description</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest opacity-40 border-l border-slate-700/80">Amount</th>
                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest opacity-40 border-l border-slate-700/80">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/80 font-medium">
              {filteredExpenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-900 transition-colors">
                  <td className="px-6 py-4 text-xs opacity-60 font-mono">
                    {formatDate(exp.date || exp.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-800 text-[10px] font-bold uppercase tracking-tight text-slate-100">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{exp.description}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-red-600">- Ksh {exp.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <button 
                        onClick={() => handleDelete(exp.id)}
                        className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">No expenses found matching your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return 'Pending...';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Pending...' : date.toLocaleDateString();
}
