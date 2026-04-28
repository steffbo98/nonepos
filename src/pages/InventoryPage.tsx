import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, Search, Filter, Trash2, Edit2, AlertCircle, X, Check, Scan, Image as ImageIcon, Upload, Loader2, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BUSINESS_TYPES, StorePurpose } from '../constants/businessTypes';
import { useUserProfile } from '../hooks/useUserProfile';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function InventoryPage() {
  const { isAdmin } = useUserProfile();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', price: 0, costPrice: 0, stock: 0, category: 'General', sku: '', imageUrl: '' });
  const [showScanner, setShowScanner] = useState(false);
  const [categories, setCategories] = useState<string[]>(['General']);

  useEffect(() => {
    const fetchBizType = async () => {
      try {
        const docRef = doc(db, 'settings', 'business');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const type = docSnap.data().type as StorePurpose;
          if (BUSINESS_TYPES[type]) {
            setCategories(BUSINESS_TYPES[type]);
          }
        }
      } catch (error) {
        console.warn("Failed to fetch business type settings", error);
      }
    };
    fetchBizType();
  }, []);
  const [isUploading, setIsUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      
      scanner.render((decodedText) => {
        // Look if product exists
        const existing = products.find(p => p.sku === decodedText);
        if (existing) {
          startEdit(existing);
        } else {
          setFormData({ name: '', price: 0, costPrice: 0, stock: 0, category: '', sku: decodedText, imageUrl: '' });
          setIsAdding(true);
        }
        setShowScanner(false);
        scanner.clear();
      }, (error) => {
        // Silently ignore scan errors
      });
      
      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Scanner clear error", e));
      }
    };
  }, [showScanner, products]);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        price: Number(formData.price),
        costPrice: Number(formData.costPrice || 0),
        stock: Number(formData.stock),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), data);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'products'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        setIsAdding(false);
      }
      setFormData({ name: '', price: 0, costPrice: 0, stock: 0, category: 'General', sku: '', imageUrl: '' });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, editingId ? `products/${editingId}` : 'products');
    }
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setFormData({ 
      name: p.name, 
      price: p.price, 
      costPrice: p.costPrice || 0,
      stock: p.stock, 
      category: p.category, 
      sku: p.sku, 
      imageUrl: p.imageUrl || '' 
    });
    setIsAdding(true);
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isOnline) {
      alert("Image uploading requires an internet connection. Product details will be saved, but the image must be uploaded when you're back online.");
      return;
    }

    if (!storage) {
      alert("Firebase Storage is not enabled for this project. Please set up a Storage bucket in your Firebase Console at https://console.firebase.google.com/");
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setFormData(prev => ({ ...prev, imageUrl: downloadURL }));
    } catch (error) {
      console.error("Upload error", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Inventory Control</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-[11px] font-mono opacity-50 uppercase tracking-widest">Manage stock levels and product catalog</p>
            {isOnline ? (
              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100">
                <Wifi className="w-3 h-3" /> ONLINE
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 border border-amber-100">
                <WifiOff className="w-3 h-3" /> OFFLINE SYNC ACTIVE
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowScanner(!showScanner)}
            className="border-2 border-[#141414] text-[#141414] px-6 py-3 font-bold tracking-widest text-xs flex items-center gap-2 hover:bg-gray-50 transition-all"
          >
            <Scan className="w-4 h-4" /> {showScanner ? 'Close Scanner' : 'Scan Barcode'}
          </button>
          {isAdmin && (
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-[#141414] text-[#E4E3E0] px-6 py-3 font-bold tracking-widest text-xs flex items-center gap-2 hover:invert transition-all"
            >
              <Plus className="w-4 h-4" /> Add New Item
            </button>
          )}
        </div>
      </header>

      {showScanner && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white border border-[#141414] p-4 mb-8 overflow-hidden"
        >
          <div id="reader" className="mx-auto max-w-md"></div>
          <p className="text-center text-[10px] font-mono mt-4 opacity-50 tracking-widest">Point your camera at a barcode to register or find a product</p>
        </motion.div>
      )}

      <div className="flex gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 focus:border-[#141414] outline-none text-sm font-mono"
          />
        </div>
      </div>

      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white border border-[#141414] p-8 mb-12 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-[#141414]" />
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold tracking-widest text-sm">{editingId ? 'Edit Product' : 'Register New Product'}</h3>
              <button 
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="lg:col-span-1 flex flex-col gap-1.5">
                <label className="text-[10px] font-mono font-bold opacity-40 tracking-widest">Product Image</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-[#141414] transition-colors relative overflow-hidden"
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin opacity-40" />
                      <span className="text-[9px] font-mono opacity-40">Uploading...</span>
                    </div>
                  ) : formData.imageUrl ? (
                    <>
                      <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 opacity-20 mb-2" />
                      <span className="text-[9px] font-mono opacity-40">Click to upload</span>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <div className="lg:col-span-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input label="Name" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} />
                <Input label="SKU" value={formData.sku} onChange={(v: string) => setFormData({...formData, sku: v})} />
                <SearchableSelect label="Category" value={formData.category} options={categories} onChange={(v: string) => setFormData({...formData, category: v})} />
                <Input label="Image URL (Manual)" value={formData.imageUrl} onChange={(v: string) => setFormData({...formData, imageUrl: v})} required={false} />
                <Input label="Price" type="number" step="0.01" value={formData.price} onChange={(v: string) => setFormData({...formData, price: parseFloat(v)})} />
                <Input label="Cost Price" type="number" step="0.01" value={formData.costPrice} onChange={(v: string) => setFormData({...formData, costPrice: parseFloat(v)})} />
                <Input label="Stock" type="number" value={formData.stock} onChange={(v: string) => setFormData({...formData, stock: parseInt(v)})} />
              </div>
              <div className="lg:col-span-6 flex justify-end">
                <button type="submit" className="bg-[#141414] text-[#E4E3E0] px-8 py-3 font-black text-xs tracking-widest hover:invert transition-all">
                  {editingId ? 'Update Record' : 'Save Product'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Value', value: `Ksh ${products.reduce((acc, p) => acc + (p.price * p.stock), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Package },
          { label: 'Unique SKUs', value: products.length, icon: Search },
          { label: 'Low Stock Items', value: products.filter(p => p.stock < 10).length, icon: AlertCircle, alert: products.filter(p => p.stock < 10).length > 0 },
          { label: 'Out of Stock', value: products.filter(p => p.stock === 0).length, icon: X, alert: products.filter(p => p.stock === 0).length > 0 },
        ].map((s, i) => (
          <div key={i} className={cn("bg-white p-6 border border-gray-100 flex items-center justify-between", s.alert && "border-red-100 bg-red-50/30")}>
            <div>
              <p className="text-[10px] font-mono font-bold opacity-40 uppercase tracking-widest">{s.label}</p>
              <p className={cn("text-2xl font-black mt-1", s.alert && "text-red-600")}>{s.value}</p>
            </div>
            <s.icon className={cn("w-8 h-8 opacity-10", s.alert && "opacity-20 text-red-600")} />
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#141414] overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-50 border-b border-[#141414] p-4 text-[10px] font-mono font-bold tracking-widest text-gray-500">
          <div className="col-span-1">#</div>
          <div className="col-span-3">Item Details</div>
          <div className="col-span-2">SKU</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-1 text-right">Price (Ksh)</div>
          <div className="col-span-1 text-right">Margin</div>
          <div className="col-span-1 text-right">Stock</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <div className="divide-y divide-gray-100">
          {filtered.map((p, idx) => (
            <div key={p.id} className="grid grid-cols-12 p-4 items-center hover:bg-gray-50 transition-colors group">
              <div className="col-span-1 font-mono text-[10px] opacity-40">{idx + 1}</div>
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Package className="w-4 h-4 opacity-20" />
                  )}
                </div>
                <div className="font-bold text-sm">{p.name}</div>
              </div>
              <div className="col-span-2 font-mono text-xs opacity-60">{p.sku}</div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold tracking-tighter px-2 py-0.5 bg-gray-100">{p.category}</span>
              </div>
              <div className="col-span-1 text-right font-mono text-xs font-bold">{p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <div className="col-span-1 text-right font-mono text-xs font-bold text-green-600">
                {p.costPrice ? (p.price - p.costPrice).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
              </div>
              <div className={cn(
                "col-span-1 text-right font-mono text-xs font-bold",
                p.stock < 10 ? "text-red-500" : "text-gray-500"
              )}>
                {p.stock}
              </div>
              <div className="col-span-2 flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {isAdmin && (
                  <>
                    <button onClick={() => startEdit(p)} className="p-1 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, required = true, step }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono font-bold opacity-40 tracking-widest">{label}</label>
      <input 
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 focus:border-[#141414] focus:bg-white outline-none text-sm font-bold transition-all"
        required={required}
      />
    </div>
  );
}

function SearchableSelect({ label, value, options, onChange, placeholder = "Select category..." }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt: string) => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
      <label className="text-[10px] font-mono font-bold opacity-40 tracking-widest">{label}</label>
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 focus:border-[#141414] focus:bg-white outline-none text-sm font-bold transition-all flex items-center justify-between cursor-pointer"
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("w-4 h-4 opacity-40 transition-transform flex-shrink-0", isOpen && "rotate-180")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 w-full bg-white border border-[#141414] mt-1 z-50 shadow-2xl max-h-64 flex flex-col"
          >
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Filter categories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-100 outline-none text-[10px] font-mono focus:border-[#141414]"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 font-bold text-[10px] uppercase tracking-widest">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt: string) => (
                  <div 
                    key={opt}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      "px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-2 border-transparent",
                      value === opt && "bg-gray-100 border-[#141414]"
                    )}
                  >
                    {opt}
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center opacity-40 italic font-normal normal-case">No categories found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
