import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { useUserProfile } from '../hooks/useUserProfile';
import { ShieldAlert } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Users, DollarSign, Package, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getSalesInsights } from '../services/geminiService';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function DashboardPage() {
  const { isAdmin, loading: roleLoading } = useUserProfile();
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [insights, setInsights] = useState<string>('Generating AI insights...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    const qOrders = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
      if (data.length > 0) {
        generateInsights(data);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubOrders();
      unsubProducts();
      unsubExpenses();
    };
  }, []);

  const generateInsights = async (orderData: any[]) => {
    const simplifiedData = orderData.slice(0, 10).map(o => ({ total: o.totalAmount, date: o.createdAt?.toDate?.()?.toLocaleDateString() }));
    const aiResp = await getSalesInsights(simplifiedData);
    setInsights(aiResp);
  };

  const totalSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  
  // Calculate Profit (Revenue - Cost of Goods Sold)
  const totalCogs = orders.reduce((sum, order) => {
    return sum + (order.items?.reduce((itemSum: number, item: any) => {
      const product = products.find(p => p.id === item.id);
      const cost = product?.costPrice || 0;
      return itemSum + (cost * item.quantity);
    }, 0) || 0);
  }, 0);

  const estimatedProfit = totalSales - totalCogs;
  const netEarnings = estimatedProfit - totalExpenses;
  
  const lowStock = products.filter(p => p.stock < 10).length;

  // Chart Data preparation
  const salesByDay = orders.reduce((acc: any, o) => {
    const date = o.createdAt?.toDate?.()?.toLocaleDateString('en-KE') || 'N/A';
    acc[date] = (acc[date] || 0) + (o.totalAmount || 0);
    return acc;
  }, {});

  const chartData = Object.entries(salesByDay).map(([date, amount]) => ({ date, amount })).reverse();

  const salesByCategory = orders.flatMap(o => o.items || []).reduce((acc: any, item: any) => {
    acc[item.category] = (acc[item.category] || 0) + (item.price * item.quantity);
    return acc;
  }, {});

  const pieData = Object.entries(salesByCategory).map(([name, value]) => ({ name, value }));
  const COLORS = ['#141414', '#eab308', '#059669', '#2563eb', '#dc2626'];

  if (!roleLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white border-2 border-dashed border-[#141414] text-center">
        <ShieldAlert className="w-16 h-16 mb-6 opacity-20" />
        <h2 className="text-2xl font-black tracking-tighter uppercase mb-2">Restricted Access</h2>
        <p className="text-sm font-mono opacity-50 max-w-sm">This module contains sensitive business intelligence reserved for administrative personnel only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Business Intelligence</h1>
          <p className="text-[11px] font-mono opacity-50 tracking-widest mt-1">Nairobi Center Performance Metrics</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-[10px] font-mono opacity-40">Region</p>
            <p className="text-xs font-bold tracking-widest">Kenya (East Africa)</p>
          </div>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<DollarSign />} label="Total Sales" value={`Ksh ${totalSales.toLocaleString()}`} trend="Revenue" positive />
        <StatCard icon={<ArrowDownRight className="text-red-500" />} label="Expenses" value={`Ksh ${totalExpenses.toLocaleString()}`} trend="Cost" positive={false} />
        <StatCard icon={<Sparkles className="text-amber-500" />} label="Gross Profit" value={`Ksh ${estimatedProfit.toLocaleString()}`} trend="Estimated" positive />
        <StatCard icon={<TrendingUp className="text-emerald-500" />} label="Net Earnings" value={`Ksh ${netEarnings.toLocaleString()}`} trend="Actual" positive={netEarnings > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Sales Chart */}
        <div className="lg:col-span-2 bg-white border border-[#141414] p-8 relative">
           <div className="absolute top-0 left-0 w-full h-1 bg-[#141414]" />
           <header className="flex justify-between items-center mb-8">
             <h3 className="font-bold uppercase text-sm tracking-widest flex items-center gap-2">
               <TrendingUp className="w-4 h-4" /> Revenue Over Time
             </h3>
             <div className="text-[10px] font-mono opacity-40 uppercase">Daily aggregation</div>
           </header>
           <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                 <defs>
                   <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                     <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                 <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', fontSize: '12px' }}
                   itemStyle={{ color: '#E4E3E0' }}
                 />
                 <Area type="monotone" dataKey="amount" stroke="#141414" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={2} />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* AI Insights Card */}
        <div className="bg-[#141414] text-[#E4E3E0] p-8 flex flex-col justify-between">
           <div>
             <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-black tracking-tighter text-xl">AI Insights</h3>
             </div>
             <p className="text-sm font-mono leading-relaxed opacity-80 whitespace-pre-line lowercase first-letter:uppercase italic">
               {insights}
             </p>
           </div>
           <div className="mt-12 pt-8 border-t border-white/10">
              <button className="w-full border border-white/20 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-white hover:text-[#141414] transition-all">
                Download Report
              </button>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white border border-gray-100 p-8">
            <h3 className="font-bold text-sm tracking-widest mb-8">Sales by Category</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white border border-gray-100 p-8 overflow-hidden">
            <h3 className="font-bold text-sm tracking-widest mb-8">Recent Transactions</h3>
            <div className="space-y-4">
               {orders.slice(0, 5).map(order => (
                 <div key={order.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-gray-50 flex items-center justify-center font-mono text-[10px] group-hover:bg-[#141414] group-hover:text-white transition-colors">
                          {order.id.slice(0, 2).toUpperCase()}
                       </div>
                       <div>
                          <p className="text-xs font-bold">{order.items?.[0]?.name || 'Multiple Items'} {order.items?.length > 1 ? `+${order.items.length - 1}` : ''}</p>
                          <p className="text-[10px] font-mono opacity-40">{order.createdAt?.toDate?.()?.toLocaleString()}</p>
                       </div>
                    </div>
                    <p className="font-mono text-sm font-bold text-right">${order.totalAmount?.toFixed(2)}</p>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend, positive }: any) {
  return (
    <div className="bg-white border border-gray-100 p-6 group hover:border-[#141414] transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-gray-50 group-hover:bg-[#141414] group-hover:text-[#E4E3E0] transition-colors">
          {icon}
        </div>
        <div className={cn(
          "flex items-center gap-1 text-[10px] font-bold",
          positive ? "text-emerald-600" : "text-amber-600"
        )}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-mono opacity-40 tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black tracking-tighter text-[#141414]">{value}</p>
      </div>
    </div>
  );
}
