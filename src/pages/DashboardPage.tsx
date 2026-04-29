import React, { useState, useEffect } from 'react';
// import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
// import { db, handleFirestoreError, OperationType } from '../lib/firebase'; // Removed for desktop app
import { getDataService } from '../lib/dataService';
import { useSyncStatus } from '../lib/syncManager';
import { motion } from 'motion/react';
import { useUserProfile } from '../hooks/useUserProfile';
import { ShieldAlert } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { TrendingUp, Users, DollarSign, Package, Sparkles, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getSalesInsights } from '../services/aiService';

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

  const syncStatus = useSyncStatus();
  const dataService = getDataService();

  const [zReportGenerating, setZReportGenerating] = useState(false);
  const [zReportError, setZReportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    // Load orders using data service
    const loadOrders = async () => {
      try {
        const orderData = await dataService.listOrders({ limit: 100 });
        setOrders(orderData);
        if (orderData.length > 0) {
          generateInsights(orderData);
        }
      } catch (error) {
        console.error('Failed to load orders:', error);
      }
    };

    // Load products using data service
    const loadProducts = async () => {
      try {
        const productData = await dataService.listProducts();
        setProducts(productData);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    };

    const loadExpenses = async () => {
      try {
        const expenseData = await dataService.listExpenses({ limit: 100 });
        setExpenses(expenseData);
      } catch (error) {
        console.error('Failed to load expenses:', error);
      }
    };

    loadOrders();
    loadProducts();
    loadExpenses();

    // Subscribe to real-time updates
    const unsubOrders = dataService.subscribeToOrders((orderData) => {
      setOrders(orderData);
      if (orderData.length > 0) {
        generateInsights(orderData);
      }
    });

    const unsubProducts = dataService.subscribeToProducts((productData) => {
      setProducts(productData);
    });

    return () => {
      unsubOrders?.();
      unsubProducts?.();
    };
  }, [isAdmin]);

  const generateInsights = async (orderData: any[]) => {
    const simplifiedData = orderData.slice(0, 10).map(o => ({ total: o.totalAmount, date: formatDate(o.createdAt) }));
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

  const downloadTextFile = (fileName: string, content: string, mime = 'text/csv;charset=utf-8') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    a.remove();
    URL.revokeObjectURL(url);
  };

  const formatLocalDayCsvDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const toZReportCsv = (report: any) => {
    const totals = report?.totals || report?.totalsJson || {};

    const headers = [
      'rangeStart',
      'rangeEnd',
      'orders',
      'completedCount',
      'voidedCount',
      'refundedCount',
      'subtotalSales',
      'vatSales',
      'grossSales',
      'cashPaid',
      'mpesaPaid',
      'refunds',
    ];

    const row = [
      report?.rangeStart || '',
      report?.rangeEnd || '',
      totals?.orders ?? 0,
      totals?.completedCount ?? 0,
      totals?.voidedCount ?? 0,
      totals?.refundedCount ?? 0,
      totals?.subtotalSales ?? 0,
      totals?.vatSales ?? 0,
      totals?.grossSales ?? 0,
      totals?.cashPaid ?? 0,
      totals?.mpesaPaid ?? 0,
      totals?.refunds ?? 0,
    ];

    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    return `${headers.map(escape).join(',')}\n${row.map(escape).join(',')}\n`;
  };

  const handleGenerateAndDownloadZReport = async () => {
    setZReportError(null);

    try {
      setZReportGenerating(true);

      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);

      const end = new Date(now);
      end.setHours(23, 59, 59, 999);

      const report = await dataService.createZReport({
        createdBy: 'admin',
        rangeStart: start.toISOString(),
        rangeEnd: end.toISOString(),
        notes: 'Daily Z-report',
      });

      const day = formatLocalDayCsvDate(now);
      const fileId = String(report?.id || '').slice(-6).toUpperCase();
      const fileName = `ZReport_${day}_${fileId || 'NA'}.csv`;

      const csv = toZReportCsv(report);
      downloadTextFile(fileName, csv);

      const updated = await dataService.listZReports({ limit: 10 });
      void updated;
    } catch (error) {
      console.error('Failed to generate Z-report:', error);
      setZReportError(error instanceof Error ? error.message : 'Failed to generate Z-report');
    } finally {
      setZReportGenerating(false);
    }
  };

  // Chart Data preparation
  const salesByDay = orders.reduce((acc: any, o) => {
    const date = formatDate(o.createdAt);
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
    <div className="space-y-8 max-w-7xl mx-auto pb-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.34em] text-cyan-300/70">Business Intelligence</p>
          <h1 className="text-4xl font-black tracking-tighter text-slate-50">Performance Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">A clear view of revenue, orders, and stock performance, tailored for your point of sale operation.</p>
        </div>

        <div className="flex flex-wrap gap-4 sm:justify-end">
          <div className="glass-card rounded-3xl px-5 py-4 shadow-panel">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Region</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">Kenya (East Africa)</p>
          </div>
          <div className="glass-card rounded-3xl px-5 py-4 shadow-panel">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Status</p>
            <p className="mt-2 text-sm font-semibold text-emerald-300">Live analytics</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard icon={<DollarSign />} label="Total Sales" value={`Ksh ${totalSales.toLocaleString()}`} trend="Revenue" positive />
        <StatCard icon={<ArrowDownRight className="text-rose-400" />} label="Expenses" value={`Ksh ${totalExpenses.toLocaleString()}`} trend="Cost" positive={false} />
        <StatCard icon={<Sparkles className="text-amber-400" />} label="Gross Profit" value={`Ksh ${estimatedProfit.toLocaleString()}`} trend="Estimated" positive />
        <StatCard icon={<TrendingUp className="text-emerald-400" />} label="Net Earnings" value={`Ksh ${netEarnings.toLocaleString()}`} trend="Actual" positive={netEarnings > 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="glass-card shadow-panel rounded-[2rem] border border-white/10 p-8 overflow-hidden">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Revenue Over Time</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-100">Daily sales trend</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">Daily</span>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '16px', color: '#e2e8f0' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#38bdf8" fill="url(#colorAmt)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card shadow-panel rounded-[2rem] border border-white/10 p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <h3 className="text-xl font-semibold text-slate-100">AI Insights</h3>
            </div>
            <p className="text-sm leading-7 text-slate-300">{insights}</p>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <button
              type="button"
              disabled={zReportGenerating}
              onClick={handleGenerateAndDownloadZReport}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {zReportGenerating ? 'Generating Z-report...' : 'Download report'}
            </button>
            {zReportError && (
              <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {zReportError}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="glass-card shadow-panel rounded-[2rem] border border-white/10 p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h3 className="text-sm uppercase tracking-[0.28em] text-slate-400">Sales by Category</h3>
            <span className="inline-flex rounded-full bg-slate-900/70 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">Category mix</span>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={64} outerRadius={108} paddingAngle={6} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '16px', color: '#e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card shadow-panel rounded-[2rem] border border-white/10 p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h3 className="text-sm uppercase tracking-[0.28em] text-slate-400">Recent Transactions</h3>
            <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Latest 5 sales</span>
          </div>
          <div className="space-y-4">
            {orders.slice(0, 5).map(order => (
              <div key={order.id} className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 transition hover:border-cyan-400/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-slate-100">
                    {order.id?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{order.items?.[0]?.name || 'Multiple items'}{order.items?.length > 1 ? ` +${order.items.length - 1}` : ''}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
                  </div>
                </div>
                <p className="text-right text-sm font-semibold text-slate-100">Ksh {Number(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-KE');
}

function formatDateTime(value: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString('en-KE');
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
