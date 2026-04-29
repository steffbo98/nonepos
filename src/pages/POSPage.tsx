import { useState, useEffect, useRef } from 'react';
// import { collection, onSnapshot, addDoc, updateDoc, serverTimestamp, query, orderBy, doc, getDoc, increment } from 'firebase/firestore';
// import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase'; // Removed for desktop app
import { getDataService } from '../lib/dataService';
// import { useSyncStatus } from '../lib/syncManager'; // Removed for desktop app
import { motion, AnimatePresence } from 'motion/react';
import { Search, ShoppingCart, CreditCard, Trash2, Plus, Minus, Wifi, WifiOff, CheckCircle2, X, MessageCircle, Scan, Package, LayoutGrid, List, Loader2, ChevronRight } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BUSINESS_TYPES, StorePurpose } from '../constants/businessTypes';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  sku: string;
}

interface CartItem extends Product {
  quantity: number;
}

type LocalUser = {
  uid: string;
  email: string;
  displayName?: string;
  fullName?: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  'All': 'bg-[#141414] text-white border-[#141414]',
  'Food': 'bg-amber-100 text-amber-800 border-amber-200 hover:border-amber-400',
  'Beverages': 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:border-emerald-400',
  'Snacks': 'bg-rose-100 text-rose-800 border-rose-200 hover:border-rose-400',
  'Electronics': 'bg-blue-100 text-blue-800 border-blue-200 hover:border-blue-400',
  'Household': 'bg-purple-100 text-purple-800 border-purple-200 hover:border-purple-400',
  'Hardware': 'bg-orange-100 text-orange-800 border-orange-200 hover:border-orange-400',
  'Tools': 'bg-gray-100 text-gray-800 border-gray-200 hover:border-gray-400',
  'Construction': 'bg-stone-100 text-stone-800 border-stone-200 hover:border-stone-400',
  'Plumbing': 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:border-cyan-400',
  'Electrical': 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:border-yellow-400',
  'Auto': 'bg-red-100 text-red-800 border-red-200 hover:border-red-400',
  'Spare Parts': 'bg-zinc-100 text-zinc-800 border-zinc-200 hover:border-zinc-400',
  'Computing': 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:border-indigo-400',
  'General': 'bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-400',
  'Other': 'bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-400'
};

const CATEGORY_ACCENTS: Record<string, string> = {
  'Food': 'border-t-amber-500',
  'Beverages': 'border-t-emerald-500',
  'Snacks': 'border-t-rose-500',
  'Electronics': 'border-t-blue-500',
  'Household': 'border-t-purple-500',
  'Hardware': 'border-t-orange-500',
  'Tools': 'border-t-gray-500',
  'Plumbing': 'border-t-cyan-500',
  'Electrical': 'border-t-yellow-500',
  'Auto': 'border-t-red-500',
  'Computing': 'border-t-indigo-500',
  'Other': 'border-t-slate-500'
};

const CATEGORY_CHIP_BASE =
  'px-4 py-2 text-[10px] font-bold tracking-widest border transition-colors whitespace-nowrap rounded-full';
const CATEGORY_CHIP_INACTIVE = 'bg-slate-950 text-slate-100 border-slate-700 hover:border-cyan-400 hover:bg-slate-900';

function getCategoryChipClasses(categoryName: string, isActive: boolean) {
  if (!isActive) return CATEGORY_CHIP_INACTIVE;
  if (categoryName === 'All') return `${CATEGORY_CHIP_BASE} bg-[#141414] text-white border-[#141414]`;
  return `${CATEGORY_CHIP_BASE} ${CATEGORY_COLORS[categoryName] ?? 'bg-[#141414] text-white border-[#141414]'}`;
}

const CATEGORY_GRID_BADGE_BASE =
  'px-2 py-0.5 inline-flex items-center rounded-full font-bold tracking-widest mb-2';
const CATEGORY_LIST_BADGE_BASE =
  'px-1.5 py-0.5 inline-flex items-center rounded-full font-bold tracking-tighter uppercase';

function getCategoryGridBadgeClasses(categoryName: string) {
  return cn(
    CATEGORY_GRID_BADGE_BASE,
    'text-[9px]',
    CATEGORY_COLORS[categoryName] ?? 'bg-slate-800 text-slate-300 border-slate-700/60 border'
  );
}

function getCategoryListBadgeClasses(categoryName: string) {
  return cn(
    CATEGORY_LIST_BADGE_BASE,
    'text-[8px]',
    CATEGORY_COLORS[categoryName] ?? 'bg-slate-800 text-slate-300 border-slate-700/60 border'
  );
}

export default function POSPage({ user }: { user: LocalUser }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('omnisync_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [search, setSearch] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [category, setCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [showMpesaInput, setShowMpesaInput] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [settings, setSettings] = useState({
    name: 'OMNISYNC POS',
    address: 'Westlands Commercial Center, Nairobi',
    pin: 'P051234567Z',
    phone: '+254 700 000 000',
    type: 'Retail Shop' as StorePurpose,
    logoUrl: ''
  });
  const [availableCategories, setAvailableCategories] = useState<string[]>(['All', 'General']);
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(0);
  const dataService = getDataService();
  const syncStatus = dataService.getSyncStatus();

  useEffect(() => {
    // Physical Barcode Scanner Listener
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in a text input or if it's too slow (likely manual typing)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const now = Date.now();
      if (now - lastKeyTime.current > 100) {
        barcodeBuffer.current = '';
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 2) {
          const product = products.find(p => p.sku === barcodeBuffer.current);
          if (product) {
            addToCart(product);
            // Quick visual feedback
            const toast = document.createElement('div');
            toast.innerText = `Added: ${product.name}`;
            toast.className = 'fixed bottom-10 left-10 bg-[#141414] text-white px-4 py-2 text-xs font-bold z-[200] opacity-0 transition-opacity';
            document.body.appendChild(toast);
            setTimeout(() => toast.style.opacity = '1', 10);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
          }
          barcodeBuffer.current = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [products]);

  useEffect(() => {
    // Load business settings using data service
    const loadSettings = async () => {
      try {
        const setting = await dataService.getSetting('business');
        if (setting) {
          const data = JSON.parse(setting.value);
          const type = (data.type || 'Retail Shop') as StorePurpose;
          setSettings({
            name: data.name || 'OMNISYNC POS',
            address: data.address || 'Westlands Commercial Center, Nairobi',
            pin: data.pin || 'P051234567Z',
            phone: data.phone || '+254 700 000 000',
            type: type,
            logoUrl: data.logoUrl || ''
          });

          if (BUSINESS_TYPES[type]) {
            setAvailableCategories(['All', ...BUSINESS_TYPES[type]]);
          }
        }
      } catch (error) {
        console.warn('Failed to load business settings:', error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    if (showCameraScanner) {
      const scanner = new Html5QrcodeScanner(
        "pos-scanner",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      
      scanner.render((decodedText) => {
        const product = products.find(p => p.sku === decodedText);
        if (product) {
          addToCart(product);
          setShowCameraScanner(false);
          scanner.clear();
        }
      }, () => {});
      
      return () => {
        scanner.clear().catch(e => console.error(e));
      };
    }
  }, [showCameraScanner, products]);

  // Update online status based on sync manager
  useEffect(() => {
    setIsOnline(syncStatus.isOnline);
    setHasPendingSync(syncStatus.pendingChanges > 0);
  }, [syncStatus]);

  useEffect(() => {
    // Load products using data service
    const loadProducts = async () => {
      try {
        const prods = await dataService.listProducts();
        setProducts(prods);

        // If empty, add some mock data
        if (prods.length === 0) {
          seedMockProducts();
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      }
    };

    loadProducts();

    // Subscribe to real-time updates
    const unsubscribe = dataService.subscribeToProducts((prods) => {
      setProducts(prods);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    localStorage.setItem('omnisync_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const seedMockProducts = async () => {
    const mock = [
      { name: 'Kienyeji Chicken', price: 1250.50, stock: 20, category: 'Food', sku: 'KE-001' },
      { name: 'Ugali Sukuma', price: 250.25, stock: 100, category: 'Food', sku: 'KE-002' },
      { name: 'Dawa Drink', price: 350.75, stock: 50, category: 'Beverages', sku: 'KE-003' },
      { name: 'Nyama Choma (1kg)', price: 1500.00, stock: 15, category: 'Food', sku: 'KE-004' },
      { name: 'Chapati (5pcs)', price: 150.50, stock: 40, category: 'Food', sku: 'KE-005' },
      { name: 'Stoney Tangawizi', price: 100.95, stock: 60, category: 'Beverages', sku: 'KE-006' },
      { name: 'Power Bank 20k', price: 2500.00, stock: 10, category: 'Electronics', sku: 'KE-007' },
      { name: 'USB-C Cable', price: 500.25, stock: 30, category: 'Electronics', sku: 'KE-008' },
      { name: 'Dish Soap', price: 200.50, stock: 25, category: 'Household', sku: 'KE-009' },
      { name: 'Kofia (Cap)', price: 450.00, stock: 15, category: 'Snacks', sku: 'KE-010' },
    ];
    try {
      for (const p of mock) {
        await dataService.createProduct(p);
      }
    } catch (error) {
      console.error('Failed to seed mock products:', error);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const [cashRecv, setCashRecv] = useState('');
  const [mpesaRecv, setMpesaRecv] = useState('');
  const [mpesaRefCode, setMpesaRefCode] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isCreditSale, setIsCreditSale] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCustomers = async () => {
      try {
        const list = await dataService.listCustomers();
        if (!cancelled) {
          setCustomers(list);
        }
      } catch (error) {
        console.error('Failed to load customers:', error);
      }
    };

    loadCustomers();

    return () => {
      cancelled = true;
    };
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const vat = subtotal * 0.16; // 16% VAT for Kenya
  const total = subtotal + vat;
  const totalPaid = Number(((parseFloat(cashRecv) || 0) + (parseFloat(mpesaRecv) || 0)).toFixed(2));

  const getPaymentMethod = () => {
    const cash = parseFloat(cashRecv) || 0;
    const mpesa = parseFloat(mpesaRecv) || 0;

    if (isCreditSale) {
      if (cash > 0 || mpesa > 0) return 'Partial Credit';
      return 'Credit';
    }

    if (cash > 0 && mpesa > 0) return 'Mixed';
    if (mpesa > 0) return 'M-Pesa';
    return 'Cash';
  };

  const handleCheckout = async (methodOverride?: string) => {
    if (cart.length === 0) return;

    // Use toFixed to avoid floating point precision issues during comparison
    const roundedTotal = Number(total.toFixed(2));
    const roundedPaid = Number(totalPaid.toFixed(2));
    const changeDue = !isCreditSale ? Math.max(0, Number((roundedPaid - roundedTotal).toFixed(2))) : 0;
    const creditAmount = isCreditSale ? Math.max(0, Number((roundedTotal - roundedPaid).toFixed(2))) : 0;
    
    if (!isCreditSale && roundedPaid < roundedTotal) {
      alert(`Insufficient payment. Total is Ksh ${roundedTotal.toLocaleString()}. You have entered Ksh ${roundedPaid.toLocaleString()}.`);
      return;
    }

    if (isCreditSale && !selectedCustomerId) {
      alert("Please select a customer for a credit sale.");
      return;
    }

    if (mpesaRecv && parseFloat(mpesaRecv) > 0 && !mpesaRefCode) {
      alert("Please enter the M-Pesa reference code.");
      return;
    }

    setProcessing(true);
    try {
      const orderData = {
        staffId: user.uid,
        items: [...cart],
        subtotal: subtotal,
        vat: vat,
        totalAmount: total,
        paymentMethod: getPaymentMethod(),
        amountPaid: roundedPaid,
        changeDue,
        creditAmount,
        cashPaid: parseFloat(cashRecv) || 0,
        mpesaPaid: parseFloat(mpesaRecv) || 0,
        mpesaRef: mpesaRefCode,
        isCredit: isCreditSale,
        customerId: selectedCustomerId || null,
        paymentStatus: creditAmount > 0 ? 'credit' : 'completed',
        orderStatus: 'completed',
        createdAt: new Date().toISOString()
      };

      // Create order using data service (works offline)
      const createdOrder = await dataService.createOrder(orderData);

      // Update inventory using data service
      for (const item of cart) {
        const currentProduct = products.find(p => p.id === item.id);
        if (currentProduct) {
          const stockAfter = Math.max(0, currentProduct.stock - item.quantity);
          await dataService.updateProduct(item.id, {
            stock: stockAfter
          });
          await dataService.recordStockMovement(item.id, {
            orderId: createdOrder.id,
            type: 'sale',
            quantityChange: -item.quantity,
            stockAfter,
            note: `Sale ${createdOrder.id.slice(0, 8).toUpperCase()}`
          });
        }
      }

      // Update customer data if applicable
      if (selectedCustomerId) {
        const customer = await dataService.getCustomer(selectedCustomerId);
        if (customer) {
          const pointsEarned = Math.floor(total / 100);

          await dataService.updateCustomer(selectedCustomerId, {
            points: (customer.points || 0) + pointsEarned,
            updatedAt: new Date().toISOString()
          });

          if (creditAmount > 0) {
            await dataService.recordCustomerDebt(selectedCustomerId, {
              amount: creditAmount,
              orderId: createdOrder.id,
              note: `Credit sale ${createdOrder.id.slice(0, 8).toUpperCase()}`
            });
          }
        }
      }

      setLastOrder({ id: createdOrder.id, ...orderData, timestamp: new Date() });
      setCart([]);
      setCashRecv('');
      setMpesaRecv('');
      setMpesaRefCode('');
      setIsCreditSale(false);
      setSelectedCustomerId('');
      setOrderSuccess(true);
      setShowReceipt(true);
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (error) {
      console.error('Checkout error:', error);
      const message = error instanceof Error ? error.message : 'A transaction error occurred. Please check the local database and try again.';
      alert(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickAddCustomer = async (e: any) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;
    try {
      const customerData = {
        ...newCustomer,
        debt: 0,
        points: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const createdCustomer = await dataService.createCustomer(customerData);
      setSelectedCustomerId(createdCustomer.id);
      setIsAddingCustomer(false);
      setNewCustomer({ name: '', phone: '' });
    } catch (error) {
      console.error('Failed to create customer:', error);
    }
  };

  const categories = ['All', ...new Set(products.map(p => p.category))];
  const filteredProducts = products.filter(p => 
    (category === 'All' || p.category === category) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-100px)]">
      {/* Quick Add Customer Modal */}
      <AnimatePresence>
        {isAddingCustomer &&
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="panel rounded-[2rem] w-full max-w-sm p-8 shadow-2xl relative border border-slate-700/80"
            >
              <button 
                onClick={() => setIsAddingCustomer(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-800 transition-colors rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="font-black text-xl tracking-tighter mb-6 uppercase">Quick Add Customer</h2>
              <form onSubmit={handleQuickAddCustomer} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Full Name</label>
                  <input 
                    required
                    type="text" 
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-700 outline-none font-bold text-xs text-slate-100"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Phone Number</label>
                  <input 
                    required
                    type="tel" 
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-700 outline-none font-bold text-xs text-slate-100"
                    placeholder="e.g. 07XXXXXXXX"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-[#141414] text-white py-3 font-black tracking-widest text-[10px] hover:invert transition-all mt-4"
                >
                  REGISTER & SELECT
                </button>
              </form>
            </motion.div>
          </div>
        }
      </AnimatePresence>

      {/* Receipt Preview Overlay */}
      <AnimatePresence>
        {showReceipt && lastOrder &&
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print receipt-modal-overlay">
            <motion.div 
              id="receipt-wrapper"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="panel rounded-[2rem] w-full max-w-sm p-8 shadow-2xl relative border border-slate-700/80"
            >
              <button 
                onClick={() => setShowReceipt(false)}
                className="absolute top-4 right-4 p-2 hover:bg-slate-800 transition-colors rounded-full"
              >
                <X className="w-4 h-4" />
              </button>

              <div id="receipt-content" className="font-mono text-xs tracking-tight text-slate-100">
                <div className="text-center mb-6 flex flex-col items-center">
                  {settings.logoUrl && (
                    <div className="w-16 h-16 mb-4 overflow-hidden flex items-center justify-center">
                       <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain grayscale" />
                    </div>
                  )}
                  <h2 className="font-black text-xl tracking-tighter mb-1 uppercase">{settings.name}</h2>
                  <div className="bg-[#141414] text-[#E4E3E0] px-4 py-1 text-[9px] font-bold uppercase tracking-[0.2em] mb-4">
                    {lastOrder.isCredit ? 'Official Invoice' : 'Official Receipt'}
                  </div>
                  <p className="opacity-60 text-[10px]">{settings.address}</p>
                  <p className="opacity-60 text-[10px]">PIN: {settings.pin}</p>
                  <p className="opacity-60 text-[10px]">Tel: {settings.phone}</p>
                </div>

                <div className="border-y border-dashed border-slate-700 py-4 mb-4 space-y-1">
                  <div className="flex justify-between">
                    <span>{lastOrder.isCredit ? 'Invoice' : 'Receipt'} #:</span>
                    <span>{(lastOrder.transactionId || lastOrder.id)?.slice(-6).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{new Date().toLocaleString('en-KE')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{(user.displayName || user.fullName || user.email).split('@')[0]}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {lastOrder.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <p className="font-bold">{item.name}</p>
                        <p className="opacity-50">{item.quantity} x {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <span className="font-bold">{(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-300 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{lastOrder.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (16%)</span>
                    <span>{lastOrder.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black pt-2 border-t border-[#141414]">
                    <span>Total Ksh</span>
                    <span>{lastOrder.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="mt-8 text-center opacity-50 space-y-1">
                  {lastOrder.customerId && (
                    <p className="font-bold border-b border-slate-700 pb-2 mb-2 uppercase tracking-tighter">
                      Customer: {customers.find(c => c.id === lastOrder.customerId)?.name || 'Member'}
                    </p>
                  )}
                  {lastOrder.cashPaid > 0 && <p>Cash: Ksh {lastOrder.cashPaid.toLocaleString()}</p>}
                  {lastOrder.mpesaPaid > 0 && (
                    <div className="flex flex-col">
                      <p>M-Pesa: Ksh {lastOrder.mpesaPaid.toLocaleString()}</p>
                      <p className="text-[8px]">Ref: {lastOrder.mpesaRef}</p>
                    </div>
                  )}
                  {lastOrder.isCredit && (
                    <p className="text-red-500 font-bold uppercase tracking-widest text-[9px]">Credit Sale Balance</p>
                  )}
                  <div className="pt-4">
                    <p className="font-bold tracking-widest text-[10px]">Asante Sana! Karibu Tena</p>
                    <p className="text-[9px]">A software by OmniSync KE</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 no-print">
                <button 
                  onClick={() => setShowReceipt(false)}
                  className="py-3 px-4 rounded-3xl border border-[#141414] font-bold text-[10px] tracking-widest hover:bg-slate-900"
                >
                  Close
                </button>
                <button 
                  onClick={handlePrint}
                  className="py-3 px-4 bg-[#141414] text-[#E4E3E0] font-bold text-[10px] tracking-widest flex items-center justify-center gap-2 hover:invert"
                >
                  Confirm Print
                </button>
              </div>
            </motion.div>
          </div>
        }
      </AnimatePresence>

      {/* Left Column: Product Selection */}
      <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden">
        <header className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-3xl pl-10 pr-4 py-3 panel-input text-slate-100 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10 outline-none text-sm font-mono"
              />
            </div>
            <button 
              onClick={() => setShowCameraScanner(!showCameraScanner)}
              className="p-3 border border-[#141414] hover:bg-slate-900 transition-colors"
              title="Camera Scanner"
            >
              <Scan className="w-5 h-5" />
            </button>
            <div className="flex border border-[#141414] overflow-hidden">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-3 transition-colors",
                  viewMode === 'grid' ? "bg-[#141414] text-white" : "bg-slate-900 text-slate-100 hover:bg-slate-800"
                )}
                title="Grid View"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-3 border-l border-[#141414] transition-colors",
                  viewMode === 'list' ? "bg-[#141414] text-white" : "bg-slate-900 text-slate-100 hover:bg-slate-800"
                )}
                title="List View"
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {availableCategories.map((cat) => {
              const isActive = category === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  aria-pressed={isActive}
                  className={getCategoryChipClasses(cat, isActive)}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </header>

        {/* Local database status */}
        <div className="flex items-center justify-center gap-2 px-3 py-2 panel-soft rounded-full text-xs font-mono max-w-fit border border-slate-700/80">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-300">Local DB Ready</span>
        </div>

        {showCameraScanner && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="panel rounded-[1.5rem] border border-slate-700/70 p-4 mb-4 shadow-panel"
          >
            <div id="pos-scanner"></div>
          </motion.div>
        )}

        <div className={cn(
          "flex-1 overflow-y-auto pr-2 pb-20 sm:pb-0",
          viewMode === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4" 
            : "flex flex-col gap-2"
        )}>
          <AnimatePresence mode="popLayout">
            {filteredProducts.map(p => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => addToCart(p)}
                className={cn(
                  "group relative panel-soft border border-slate-700/70 cursor-pointer hover:border-cyan-400/80 transition-all flex border-t-4 text-slate-100",
                  CATEGORY_ACCENTS[p.category] || "border-t-[#141414]",
                  viewMode === 'grid' 
                    ? "flex-col justify-between p-4" 
                    : "flex-row items-center p-3 gap-4"
                )}
              >
                {viewMode === 'grid' ? (
                  <>
                    <div className="mb-4">
                      <div className="aspect-square bg-slate-900 border border-slate-700 mb-4 flex items-center justify-center overflow-hidden">
                        {p.imageUrl ? (
                          <img 
                            src={p.imageUrl} 
                            alt={p.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package className="w-10 h-10 opacity-20" />
                        )}
                      </div>
                      <span className={getCategoryGridBadgeClasses(p.category)}>
                        {p.category}
                      </span>
                      <h3 className="font-bold text-sm leading-tight group-hover:underline underline-offset-4">{p.name}</h3>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="font-mono font-bold text-sm">Ksh {p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <div className="p-1 border border-slate-700/70 group-hover:border-cyan-400 transition-colors rounded">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                    {p.stock < 10 && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-bold uppercase tracking-tight">
                        Low Stock: {p.stock}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-slate-900 border border-slate-700/70 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {p.imageUrl ? (
                        <img 
                          src={p.imageUrl} 
                          alt={p.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Package className="w-5 h-5 opacity-20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-sm truncate">{p.name}</h3>
                        <span className={getCategoryListBadgeClasses(p.category)}>
                          {p.category}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono opacity-40 uppercase">SKU: {p.sku}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="font-mono font-bold text-sm">Ksh {p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <div className="flex items-center gap-2">
                        {p.stock < 10 && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 border border-amber-100">
                            {p.stock} LEFT
                          </span>
                        )}
                        <div className="p-1 border border-slate-700/70 group-hover:border-cyan-400 transition-colors rounded bg-slate-900">
                          <Plus className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Column: Cart & Checkout */}
      <aside className="lg:col-span-4 flex flex-col panel rounded-[2rem] border border-slate-700/80 relative overflow-hidden shadow-panel">
        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/60" />
        
        <header className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            <h2 className="font-black tracking-tighter text-xl">Current Order</h2>
          </div>
          {true ? (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
              <Wifi className="w-3 h-3" /> Local DB
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
              <WifiOff className="w-3 h-3" /> Offline Mode
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence initial={false}>
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 grayscale">
                <ShoppingCart className="w-12 h-12 mb-4" />
                <p className="font-mono text-xs tracking-widest">Cart is empty</p>
              </div>
            ) : (
              cart.map(item => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex gap-4 group items-center"
                >
                  <div className="w-10 h-10 bg-slate-900 border border-slate-700/70 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-2xl">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package className="w-4 h-4 opacity-20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-bold text-[11px] leading-tight truncate">{item.name}</h4>
                    <p className="text-[10px] font-mono font-bold text-slate-400">Ksh {item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="flex items-center border border-slate-700/70 bg-slate-900 scale-90 rounded-lg overflow-hidden">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-slate-800"><Minus className="w-2.5 h-2.5" /></button>
                      <span className="w-6 text-center text-[10px] font-mono font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 hover:bg-slate-800"><Plus className="w-2.5 h-2.5" /></button>
                    </div>
                    <p className="w-[60px] text-right font-mono text-[11px] font-black tracking-tighter">{(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-rose-400 transition-colors p-1 ml-1 rounded-full hover:bg-slate-900">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <footer className="p-6 border-t-2 border-slate-700 bg-slate-950 flex flex-col gap-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Select Customer (Opt)</label>
                <button 
                  onClick={() => setIsAddingCustomer(true)}
                  className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Quick Add
                </button>
              </div>
              <select 
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-700 outline-none focus:border-cyan-400 text-xs font-bold text-slate-100"
              >
                <option value="">Walk-in Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  checked={isCreditSale}
                  onChange={(e) => setIsCreditSale(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:bg-cyan-400 transition-colors"></div>
                <div className="absolute left-1 top-1 w-3 h-3 bg-slate-100 rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100">Sell on Credit</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Cash Received</label>
              <input 
                type="number" 
                placeholder="0.00"
                value={cashRecv}
                onChange={(e) => setCashRecv(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-700 font-mono text-xs font-bold text-slate-100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">M-Pesa Received</label>
              <input 
                type="number" 
                placeholder="0.00"
                value={mpesaRecv}
                onChange={(e) => setMpesaRecv(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-700 font-mono text-xs font-bold text-slate-100"
              />
            </div>
          </div>

          {(parseFloat(mpesaRecv) > 0) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">M-Pesa Ref Code</label>
              <input 
                type="text" 
                placeholder="REG0000000"
                value={mpesaRefCode}
                onChange={(e) => setMpesaRefCode(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950 border border-slate-700 font-mono text-xs font-bold uppercase text-slate-100"
              />
            </div>
          )}

          <div className="space-y-2 py-4 border-t border-slate-700">
            <div className="flex justify-between text-xs font-mono opacity-60">
              <span>Grand Total</span>
              <span>Ksh {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs font-mono opacity-60">
              <span>Paid So Far</span>
              <span className={cn(totalPaid >= total ? "text-emerald-600 font-bold" : "")}>Ksh {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {!isCreditSale && totalPaid > total && (
              <div className="flex justify-between text-xs font-mono text-blue-300 font-bold bg-slate-900 p-2 border border-slate-700">
                <span>Change Ready</span>
                <span>Ksh {(totalPaid - total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {isCreditSale && totalPaid < total && (
              <div className="flex justify-between text-xs font-mono text-rose-300 font-bold bg-slate-900 p-2 border border-slate-700">
                <span>Credit Amount</span>
                <span>Ksh {(total - totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          <button 
            disabled={cart.length === 0 || processing || (!isCreditSale && Number(totalPaid.toFixed(2)) < Number(total.toFixed(2)))}
            onClick={() => handleCheckout()}
            className="w-full rounded-3xl bg-[#141414] text-[#E4E3E0] py-4 font-black tracking-widest text-xs hover:invert transition-all disabled:opacity-20 flex items-center justify-center gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            {isCreditSale ? 'CONFIRM CREDIT SALE' : 'COMPLETE TRANSACTION'}
          </button>
        </footer>
      </aside>
    </div>
  );
}
