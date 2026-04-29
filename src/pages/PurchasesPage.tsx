import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PackagePlus, Plus, Truck } from 'lucide-react';
import { getDataService } from '../lib/dataService';

export default function PurchasesPage() {
  const dataService = getDataService();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [receiveForm, setReceiveForm] = useState({ supplierId: '', productId: '', quantity: 1, unitCost: 0, note: '' });

  const loadData = async () => {
    const [supplierData, productData, purchaseData] = await Promise.all([
      dataService.listSuppliers(),
      dataService.listProducts(),
      dataService.listPurchases({ limit: 100 }),
    ]);

    setSuppliers(supplierData);
    setProducts(productData);
    setPurchases(purchaseData);
  };

  useEffect(() => {
    loadData().catch(error => console.error('Failed to load purchases page:', error));
  }, []);

  const selectedProduct = useMemo(
    () => products.find(product => product.id === receiveForm.productId),
    [products, receiveForm.productId]
  );

  const createSupplier = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const supplier = await dataService.createSupplier(supplierForm);
      setSuppliers(prev => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierForm({ name: '', phone: '', email: '', address: '' });
    } catch (error) {
      console.error('Failed to create supplier:', error);
      alert(error instanceof Error ? error.message : 'Failed to create supplier');
    }
  };

  const receivePurchase = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const purchase = await dataService.receivePurchase(receiveForm);
      setPurchases(prev => [purchase, ...prev]);
      const freshProducts = await dataService.listProducts();
      setProducts(freshProducts);
      setReceiveForm({ supplierId: receiveForm.supplierId, productId: '', quantity: 1, unitCost: 0, note: '' });
    } catch (error) {
      console.error('Failed to receive purchase:', error);
      alert(error instanceof Error ? error.message : 'Failed to receive purchase');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Purchases</h1>
        <p className="text-slate-400 font-medium">Manage suppliers and receive stock into inventory.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="panel rounded-[2rem] border border-slate-700/80 p-8 shadow-panel">
          <h2 className="font-black text-xl tracking-tighter uppercase mb-6 flex items-center gap-2">
            <Truck className="w-5 h-5" /> Register Supplier
          </h2>
          <form onSubmit={createSupplier} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Supplier Name" value={supplierForm.name} onChange={(value: string) => setSupplierForm({ ...supplierForm, name: value })} required />
            <Input label="Phone" value={supplierForm.phone} onChange={(value: string) => setSupplierForm({ ...supplierForm, phone: value })} />
            <Input label="Email" value={supplierForm.email} onChange={(value: string) => setSupplierForm({ ...supplierForm, email: value })} />
            <Input label="Address" value={supplierForm.address} onChange={(value: string) => setSupplierForm({ ...supplierForm, address: value })} />
            <button className="md:col-span-2 bg-[#141414] text-white py-4 font-bold tracking-widest uppercase flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Save Supplier
            </button>
          </form>
        </section>

        <section className="panel rounded-[2rem] border border-slate-700/80 p-8 shadow-panel">
          <h2 className="font-black text-xl tracking-tighter uppercase mb-6 flex items-center gap-2">
            <PackagePlus className="w-5 h-5" /> Receive Stock
          </h2>
          <form onSubmit={receivePurchase} className="space-y-4">
            <Select label="Supplier" value={receiveForm.supplierId} onChange={(value: string) => setReceiveForm({ ...receiveForm, supplierId: value })}>
              <option value="">No supplier selected</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </Select>
            <Select label="Product" value={receiveForm.productId} onChange={(value: string) => {
              const product = products.find(item => item.id === value);
              setReceiveForm({ ...receiveForm, productId: value, unitCost: Number(product?.costPrice || 0) });
            }} required>
              <option value="">Select product</option>
              {products.map(product => <option key={product.id} value={product.id}>{product.name} ({product.sku || 'No SKU'})</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Quantity" type="number" value={receiveForm.quantity} onChange={(value: string) => setReceiveForm({ ...receiveForm, quantity: parseInt(value) || 0 })} required />
              <Input label="Unit Cost" type="number" step="0.01" value={receiveForm.unitCost} onChange={(value: string) => setReceiveForm({ ...receiveForm, unitCost: parseFloat(value) || 0 })} required />
            </div>
            <Input label="Note" value={receiveForm.note} onChange={(value: string) => setReceiveForm({ ...receiveForm, note: value })} />
            {selectedProduct && (
              <p className="text-xs font-mono opacity-50">
                Current stock: {selectedProduct.stock}. New stock: {Number(selectedProduct.stock || 0) + Number(receiveForm.quantity || 0)}.
              </p>
            )}
            <button className="w-full bg-[#141414] text-white py-4 font-bold tracking-widest uppercase">
              Receive Purchase
            </button>
          </form>
        </section>
      </div>

      <section className="panel rounded-[2rem] border border-slate-700/80 overflow-hidden shadow-panel">
        <div className="p-6 border-b border-slate-700/80">
          <h2 className="font-black text-xl tracking-tighter uppercase">Recent Purchases</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-700/80">
                <Th>Date</Th>
                <Th>Supplier</Th>
                <Th>Items</Th>
                <Th align="right">Total Cost</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/80">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400 italic">No purchases received yet.</td>
                </tr>
              ) : purchases.map(purchase => (
                <tr key={purchase.id} className="hover:bg-slate-900">
                  <td className="px-6 py-4 text-xs font-mono opacity-60">{formatDate(purchase.createdAt)}</td>
                  <td className="px-6 py-4 text-sm">{suppliers.find(supplier => supplier.id === purchase.supplierId)?.name || 'Unassigned'}</td>
                  <td className="px-6 py-4 text-sm">{purchase.items?.map((item: any) => `${item.name} x${item.quantity}`).join(', ')}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold">Ksh {Number(purchase.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-emerald-950/30 text-emerald-300 border border-emerald-700/50 text-[10px] font-black uppercase tracking-widest">
                      {purchase.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', step, required = false }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{label}</label>
      <input
        required={required}
        type={type}
        step={step}
        className="w-full bg-slate-950 border border-slate-700/80 p-4 font-bold text-slate-100 outline-none focus:border-cyan-400"
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

function Select({ label, value, onChange, children, required = false }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{label}</label>
      <select
        required={required}
        className="w-full bg-slate-950 border border-slate-700/80 p-4 font-bold text-slate-100 outline-none focus:border-cyan-400"
        value={value}
        onChange={event => onChange(event.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: string; align?: 'left' | 'right' }) {
  return <th className={`px-6 py-4 text-${align} text-[10px] font-bold uppercase tracking-widest opacity-40`}>{children}</th>;
}

function formatDate(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}
