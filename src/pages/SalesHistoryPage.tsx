import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Printer, ReceiptText, RotateCcw, Search, ShieldAlert, X } from 'lucide-react';
import { getDataService } from '../lib/dataService';
import { useUserProfile } from '../hooks/useUserProfile';

type OrderStatus = 'completed' | 'voided' | 'refunded';

type Order = {
  id: string;
  staffId: string;
  customerId?: string | null;
  items: Array<{ id: string; name: string; price: number; quantity: number; category?: string }>;
  subtotal?: number;
  vat?: number;
  totalAmount: number;
  cashPaid?: number;
  mpesaPaid?: number;
  mpesaRef?: string;
  isCredit?: boolean | number;
  paymentMethod?: string;
  amountPaid?: number;
  changeDue?: number;
  creditAmount?: number;
  paymentStatus: string;
  orderStatus: OrderStatus;
  createdAt: string;
};

export default function SalesHistoryPage() {
  const dataService = getDataService();
  const { isAdmin } = useUserProfile();
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSales = async () => {
    try {
      const [orderData, userData, customerData] = await Promise.all([
        dataService.listOrders({ limit: 250 }),
        dataService.listUsers(),
        dataService.listCustomers(),
      ]);

      setOrders(orderData);
      setUsers(userData);
      setCustomers(customerData);
    } catch (error) {
      console.error('Failed to load sales history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.toLowerCase();

    return orders.filter(order => {
      const matchesStatus = status === 'all' || order.orderStatus === status;
      const matchesSearch =
        order.id.toLowerCase().includes(term) ||
        order.items?.some(item => item.name.toLowerCase().includes(term)) ||
        getCustomerName(customers, order.customerId).toLowerCase().includes(term) ||
        getStaffName(users, order.staffId).toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [orders, search, status, users, customers]);

  const updateOrderStatus = async (order: Order, nextStatus: OrderStatus) => {
    if (!isAdmin) return;

    const label = nextStatus === 'voided' ? 'void' : 'refund';
    if (!window.confirm(`Are you sure you want to ${label} this sale?`)) return;

    try {
      const updated = await dataService.updateOrder(order.id, {
        orderStatus: nextStatus,
        paymentStatus: nextStatus,
      });
      setOrders(prev => prev.map(item => item.id === order.id ? updated : item));
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(updated);
      }
    } catch (error) {
      console.error('Failed to update sale:', error);
      alert(error instanceof Error ? error.message : 'Failed to update sale');
    }
  };

  const totals = filteredOrders.reduce(
    (acc, order) => {
      if (order.orderStatus === 'completed') {
        acc.sales += Number(order.totalAmount || 0);
      }
      if (order.orderStatus === 'refunded') {
        acc.refunds += Number(order.totalAmount || 0);
      }
      return acc;
    },
    { sales: 0, refunds: 0 }
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Sales History</h1>
          <p className="text-gray-500 font-medium">Review, reprint, void, and refund recorded transactions.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Summary label="Completed" value={`Ksh ${totals.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <Summary label="Refunded" value={`Ksh ${totals.refunds.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
        </div>
      </header>

      <div className="bg-slate-950/95 border border-white/10 shadow-panel rounded-[2rem] overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row gap-4 md:items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              className="w-full rounded-3xl bg-slate-900/90 border border-slate-700/80 pl-12 pr-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
              placeholder="Search receipt, product, cashier, customer..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <select
            value={status}
            onChange={event => setStatus(event.target.value as typeof status)}
            className="rounded-3xl bg-slate-900/90 border border-slate-700/80 px-4 py-3 text-xs font-bold text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-slate-100">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-700">
                <Th>Receipt</Th>
                <Th>Date</Th>
                <Th>Cashier</Th>
                <Th>Customer</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
                <Th align="right">Total</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">Loading sales...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">No sales found.</td>
                </tr>
              ) : filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-900/70 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-200">{order.id.slice(0, 10).toUpperCase()}</td>
                  <td className="px-6 py-4 text-xs text-slate-400 font-mono">{formatDateTime(order.createdAt)}</td>
                  <td className="px-6 py-4 text-sm text-slate-100">{getStaffName(users, order.staffId)}</td>
                  <td className="px-6 py-4 text-sm text-slate-100">{getCustomerName(customers, order.customerId)}</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-200">{formatPayment(order)}</td>
                  <td className="px-6 py-4"><StatusPill status={order.orderStatus} /></td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-100">
                    Ksh {Number(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setSelectedOrder(order)} className="p-2 rounded-full hover:bg-slate-800 transition-colors" title="View receipt">
                        <Eye className="w-4 h-4 text-slate-100" />
                      </button>
                      {isAdmin && order.orderStatus === 'completed' && (
                        <>
                          <button onClick={() => updateOrderStatus(order, 'voided')} className="p-2 rounded-full hover:bg-slate-800 transition-colors text-amber-400" title="Void sale">
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                          <button onClick={() => updateOrderStatus(order, 'refunded')} className="p-2 rounded-full hover:bg-slate-800 transition-colors text-rose-400" title="Refund sale">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <ReceiptModal
            order={selectedOrder}
            cashier={getStaffName(users, selectedOrder.staffId)}
            customer={getCustomerName(customers, selectedOrder.customerId)}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReceiptModal({
  order,
  cashier,
  customer,
  onClose,
}: {
  order: Order;
  cashier: string;
  customer: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 no-print">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-sm p-8 shadow-2xl relative border border-[#141414]"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>

        <div id="receipt-content" className="font-mono text-xs tracking-tight text-[#141414]">
          <div className="text-center mb-6">
            <ReceiptText className="w-8 h-8 mx-auto mb-2" />
            <h2 className="font-black text-lg">NonePOS</h2>
            <p className="opacity-50">Receipt #{order.id.slice(0, 10).toUpperCase()}</p>
            <p className="opacity-50">{formatDateTime(order.createdAt)}</p>
          </div>

          <div className="space-y-1 border-y border-dashed border-gray-300 py-3 mb-4">
            <div className="flex justify-between"><span>Cashier</span><span>{cashier}</span></div>
            <div className="flex justify-between"><span>Customer</span><span>{customer}</span></div>
            <div className="flex justify-between"><span>Payment</span><span>{formatPayment(order)}</span></div>
            <div className="flex justify-between"><span>Status</span><span>{order.orderStatus}</span></div>
            {order.mpesaRef && <div className="flex justify-between"><span>M-Pesa Ref</span><span>{order.mpesaRef}</span></div>}
          </div>

          <div className="space-y-3 mb-4">
            {order.items?.map(item => (
              <div key={`${item.id}-${item.name}`} className="flex justify-between gap-4">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="opacity-50">{item.quantity} x {Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <p className="font-bold">{(Number(item.price) * Number(item.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1 border-t border-dashed border-gray-300 pt-3">
            <div className="flex justify-between"><span>Subtotal</span><span>{Number(order.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span>VAT</span><span>{Number(order.vat || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            <div className="flex justify-between"><span>Paid</span><span>{Number(order.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            {Number(order.changeDue || 0) > 0 && (
              <div className="flex justify-between"><span>Change</span><span>{Number(order.changeDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            )}
            {Number(order.creditAmount || 0) > 0 && (
              <div className="flex justify-between"><span>Credit Due</span><span>{Number(order.creditAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            )}
            <div className="flex justify-between text-base font-black pt-2 border-t border-[#141414]">
              <span>Total</span>
              <span>Ksh {Number(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="mt-8 w-full bg-[#141414] text-white py-3 font-bold text-xs tracking-widest flex items-center justify-center gap-2 no-print"
        >
          <Printer className="w-4 h-4" /> Reprint Receipt
        </button>
      </motion.div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-xl font-mono font-bold leading-none mt-1 text-slate-100">{value}</p>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-6 py-4 ${align === 'right' ? 'text-right' : 'text-left'} text-[10px] font-bold uppercase tracking-widest text-slate-400`}> 
      {children}
    </th>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const styles = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    voided: 'bg-amber-50 text-amber-700 border-amber-100',
    refunded: 'bg-red-50 text-red-700 border-red-100',
  };

  return (
    <span className={`px-2 py-1 border text-[10px] font-black uppercase tracking-widest ${styles[status] || styles.completed}`}>
      {status}
    </span>
  );
}

function formatPayment(order: Order) {
  if (order.paymentMethod) return order.paymentMethod;
  if (order.isCredit) return 'Credit';
  if (Number(order.cashPaid || 0) > 0 && Number(order.mpesaPaid || 0) > 0) return 'Mixed';
  if (Number(order.mpesaPaid || 0) > 0) return `M-Pesa${order.mpesaRef ? ` (${order.mpesaRef})` : ''}`;
  return 'Cash';
}

function getStaffName(users: any[], staffId: string) {
  const user = users.find(item => item.id === staffId || item.uid === staffId);
  return user?.fullName || user?.email || staffId || 'Unknown';
}

function getCustomerName(customers: any[], customerId?: string | null) {
  if (!customerId) return 'Walk-in';
  const customer = customers.find(item => item.id === customerId);
  return customer?.name || 'Member';
}

function formatDateTime(value: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString('en-KE');
}
