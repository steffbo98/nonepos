import React, { useEffect, useState } from 'react';
import { getDataService } from '../lib/dataService';
import { getSalesInsights, getInventoryForecast } from '../services/aiService';
import { TrendingUp, AlertTriangle, DollarSign, ShoppingCart, Grid3X3 } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminAnalyticsPage() {
  const dataService = getDataService();

  const [hotProducts, setHotProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [financialPosition, setFinancialPosition] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [aiSalesSummary, setAiSalesSummary] = useState<string>('Generating AI sales summary...');
  const [aiInventorySummary, setAiInventorySummary] = useState<string>('Generating AI inventory summary...');
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(30);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [hot, cats, financial, low, ordersData, inventoryData] = await Promise.all([
        dataService.getHotProducts(daysBack, 15),
        dataService.getProductsByCategory(),
        dataService.getFinancialPosition(daysBack),
        dataService.getLowStockProducts(10),
        dataService.listOrders({ limit: 100 }),
        dataService.listProducts(),
      ]);

      setHotProducts(hot);
      setCategories(cats);
      setFinancialPosition(financial);
      setLowStock(low);
      setOrders(ordersData);
      setInventoryItems(inventoryData);

      const salesInsightInput = ordersData.map((order: any) => ({
        total: order.totalAmount ?? order.total,
        date: order.createdAt || order.date,
      }));

      const [salesSummary, inventorySummary] = await Promise.all([
        getSalesInsights(salesInsightInput),
        getInventoryForecast(inventoryData),
      ]);

      setAiSalesSummary(salesSummary);
      setAiInventorySummary(inventorySummary);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setAiSalesSummary('Unable to generate AI sales summary at the moment.');
      setAiInventorySummary('Unable to generate AI inventory summary at the moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [daysBack]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-4 border-slate-200/20 border-t-slate-100 rounded-full"
        />
      </div>
    );
  }

  const profit = (financialPosition?.sales || 0) - (financialPosition?.expenses || 0);
  const profitMargin = financialPosition?.sales ? ((profit / financialPosition.sales) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Business Analytics</h1>
          <p className="text-[11px] font-mono text-slate-300 tracking-widest mt-1">Hot sellers, financials, inventory insights & AI-generated summaries</p>
        </div>
        <div className="flex gap-2">
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="rounded-3xl bg-slate-950/80 border border-slate-700/80 px-4 py-2 text-xs font-bold text-slate-100 outline-none focus:border-cyan-400"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => void loadAnalytics()}
            className="rounded-3xl bg-slate-900/80 border border-slate-700/80 px-4 py-2 text-xs font-bold text-slate-100 hover:bg-slate-900 transition-all"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* AI Insights Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[2rem] border border-slate-700/50 bg-slate-950/60 p-8 shadow-panel">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 border border-slate-700">
              <TrendingUp className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">AI Sales Summary</h2>
              <p className="text-[11px] font-mono text-slate-400">Actionable observations from recent orders.</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-slate-300">{aiSalesSummary}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-700/50 bg-slate-950/60 p-8 shadow-panel">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 border border-slate-700">
              <ShoppingCart className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">AI Inventory Forecast</h2>
              <p className="text-[11px] font-mono text-slate-400">Inventory health and restock recommendations.</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-slate-300">{aiInventorySummary}</p>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Sales"
          value={`Ksh ${(financialPosition?.sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext={`${financialPosition?.transactionCount || 0} transactions`}
          color="emerald"
        />
        <SummaryCard
          icon={<ShoppingCart className="w-5 h-5" />}
          label="Expenses"
          value={`Ksh ${(financialPosition?.expenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext={`${profitMargin.toFixed(1)}% margin`}
          color="amber"
        />
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Net Profit"
          value={`Ksh ${profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtext={profit >= 0 ? '↗ Positive' : '↘ Negative'}
          color={profit >= 0 ? 'emerald' : 'red'}
        />
      </div>

      {/* Hot Products Section */}
      <div className="rounded-[2rem] border border-slate-700/50 bg-slate-950/60 p-8 shadow-panel">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 border border-slate-700">
            <TrendingUp className="w-5 h-5 text-cyan-300" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">Top Selling Products</h2>
          <span className="ml-auto text-[10px] font-mono text-slate-400">Last {daysBack} days</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left py-3 px-4 font-bold text-[11px] text-slate-400">Product</th>
                <th className="text-right py-3 px-4 font-bold text-[11px] text-slate-400">Sold</th>
                <th className="text-right py-3 px-4 font-bold text-[11px] text-slate-400">Revenue</th>
                <th className="text-right py-3 px-4 font-bold text-[11px] text-slate-400">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {hotProducts.map((product, idx) => (
                <tr key={product.id} className={idx % 2 === 0 ? 'bg-slate-900/30' : ''}>
                  <td className="py-3 px-4">{product.name}</td>
                  <td className="text-right py-3 px-4 font-bold text-emerald-400">{product.totalSold}</td>
                  <td className="text-right py-3 px-4">Ksh {(product.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-right py-3 px-4 text-slate-400">{product.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Categories & Low Stock Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Categories */}
        <div className="rounded-[2rem] border border-slate-700/50 bg-slate-950/60 p-8 shadow-panel">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 border border-slate-700">
              <Grid3X3 className="w-5 h-5 text-cyan-300" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Product Categories</h2>
          </div>
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                <div>
                  <p className="font-bold text-sm">{cat.category}</p>
                  <p className="text-[10px] font-mono text-slate-400">{cat.productCount} products</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-emerald-400">{cat.totalStock}</p>
                  <p className="text-[10px] font-mono text-slate-400">units in stock</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="rounded-[2rem] border border-slate-700/50 bg-slate-950/60 p-8 shadow-panel">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-950 border border-red-700/50">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Low Stock Alert</h2>
            <span className="ml-auto text-[10px] font-bold text-red-400 bg-red-950/30 px-3 py-1 rounded-full">
              {lowStock.length} items
            </span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {lowStock.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-8">All products have healthy stock levels</p>
            ) : (
              lowStock.map((product) => (
                <div key={product.id} className="p-3 bg-red-950/20 border border-red-700/30 rounded-lg">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-sm">{product.name}</p>
                    <span className="text-[10px] font-bold text-red-400 bg-red-950/50 px-2 py-0.5 rounded">
                      {product.stock} left
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400">{product.sku}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  subtext,
  color = 'slate',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-950/30 border-emerald-700/50 text-emerald-400',
    amber: 'bg-amber-950/30 border-amber-700/50 text-amber-400',
    red: 'bg-red-950/30 border-red-700/50 text-red-400',
    slate: 'bg-slate-900/30 border-slate-700/50 text-slate-400',
  };

  return (
    <div className={`rounded-2xl border p-6 ${colorMap[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest uppercase opacity-60">{label}</p>
          <p className="text-2xl font-black mt-2">{value}</p>
          {subtext && <p className="text-[10px] font-mono mt-2 opacity-50">{subtext}</p>}
        </div>
        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-900/50 border border-slate-700/50">
          {icon}
        </div>
      </div>
    </div>
  );
}
