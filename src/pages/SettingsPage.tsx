import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { Globe, DollarSign, Bell, Shield, MessageSquare, Save, ExternalLink, Building2, Store, Upload, Image as ImageIcon, X, ShieldAlert, UserPlus, UserCheck, UserX } from 'lucide-react';
import { BUSINESS_TYPES, StorePurpose } from '../constants/businessTypes';
import { useUserProfile } from '../hooks/useUserProfile';
import { onSnapshot, updateDoc } from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function SettingsPage() {
  const { isAdmin, loading: roleLoading } = useUserProfile();
  const [language, setLanguage] = useState('English (KE)');
  const [currency, setCurrency] = useState('KES');
  const [notifications, setNotifications] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Business Profile State
  const [businessName, setBusinessName] = useState('OMNISYNC POS');
  const [businessAddress, setBusinessAddress] = useState('Westlands Commercial Center, Nairobi');
  const [businessPIN, setBusinessPIN] = useState('P051234567Z');
  const [businessPhone, setBusinessPhone] = useState('+254 700 000 000');
  const [businessType, setBusinessType] = useState<StorePurpose>('Retail Shop');
  const [businessLogo, setBusinessLogo] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'staff'>('staff');
  const [newUserName, setNewUserName] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'business');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBusinessName(data.name || 'OMNISYNC POS');
          setBusinessAddress(data.address || 'Westlands Commercial Center, Nairobi');
          setBusinessPIN(data.pin || 'P051234567Z');
          setBusinessPhone(data.phone || '+254 700 000 000');
          setBusinessType(data.type || 'Retail Shop');
          setBusinessLogo(data.logoUrl || '');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/business');
      }
    };
    fetchSettings();

    // Fetch team members
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [isAdmin]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName) return;
    try {
      await addDoc(collection(db, 'users'), {
        fullName: newUserName,
        email: newUserEmail.toLowerCase().trim(),
        role: newUserRole,
        active: true,
        createdAt: serverTimestamp()
      });
      setNewUserEmail('');
      setNewUserName('');
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  const toggleUserStatus = async (user: any) => {
    try {
      await updateDoc(doc(db, 'users', user.id), {
        active: !user.active
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'business'), {
        name: businessName,
        address: businessAddress,
        pin: businessPIN,
        phone: businessPhone,
        type: businessType,
        logoUrl: businessLogo,
        updatedAt: serverTimestamp()
      });
      alert('Settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/business');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `business/logo_${auth.currentUser?.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setBusinessLogo(url);
    } catch (error) {
       console.error("Logo upload failed", error);
       alert("Failed to upload logo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    try {
      await addDoc(collection(db, 'feedback'), {
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        text: feedback,
        createdAt: serverTimestamp()
      });
      setFeedback('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'feedback');
    }
  };

  if (!roleLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white border-2 border-dashed border-[#141414] text-center">
        <ShieldAlert className="w-16 h-16 mb-6 opacity-20" />
        <h2 className="text-2xl font-black tracking-tighter uppercase mb-2">Restricted Access</h2>
        <p className="text-sm font-mono opacity-50 max-w-sm">System configuration is reserved for administrative personnel only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <header>
        <h1 className="text-4xl font-black tracking-tighter">POS Configuration</h1>
        <p className="text-[11px] font-mono opacity-50 tracking-widest mt-1">Regional preferences & payment gateways</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Business Profile */}
        <Section title="Business Profile" icon={<Building2 className="w-5 h-5" />}>
          <div className="space-y-6">
            {/* Logo Section */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono font-bold opacity-40 tracking-widest uppercase">Business Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center relative overflow-hidden group">
                  {businessLogo ? (
                    <>
                      <img src={businessLogo} alt="Logo" className="w-full h-full object-contain" />
                      <button 
                        onClick={() => setBusinessLogo('')}
                        className="absolute top-1 right-1 bg-white p-1 border border-[#141414] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-8 h-8 opacity-10" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full" />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer bg-white border border-[#141414] px-4 py-2 text-[10px] font-bold tracking-widest hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <Upload className="w-3 h-3" />
                  {businessLogo ? 'CHANGE LOGO' : 'UPLOAD LOGO'}
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              </div>
            </div>

            <Input 
              label="Store / Business Name" 
              value={businessName} 
              onChange={setBusinessName} 
            />
            <Select 
              label="Business Type (Store Purpose)" 
              value={businessType} 
              options={Object.keys(BUSINESS_TYPES)} 
              onChange={(v: StorePurpose) => setBusinessType(v)} 
            />
            <Input 
              label="Physical Address" 
              value={businessAddress} 
              onChange={setBusinessAddress} 
            />
            <Input 
              label="KRA PIN Number" 
              value={businessPIN} 
              onChange={setBusinessPIN} 
            />
            <Input 
              label="Business Phone" 
              value={businessPhone} 
              onChange={setBusinessPhone} 
            />
          </div>
        </Section>

        {/* Regional Settings */}
        <Section title="Regional Settings" icon={<Globe className="w-5 h-5" />}>
          <div className="space-y-4">
            <Select 
              label="System Language" 
              value={language} 
              options={['English (KE)', 'Swahili', 'Luo', 'Kikuyu', 'Other']} 
              onChange={setLanguage} 
            />
            <Select 
              label="Base Currency" 
              value={currency} 
              options={['KES', 'USD', 'EUR', 'UGX', 'TZS']} 
              onChange={setCurrency} 
            />
          </div>
        </Section>

        {/* M-PESA API */}
        <Section title="M-Pesa Integration" icon={<MessageSquare className="w-5 h-5" />}>
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded">
               <p className="text-[9px] font-mono text-emerald-800 font-black">Daraja API Status: Connected</p>
            </div>
            <Input label="Shortcode (Paybill/Till)" value="778899" />
            <Input label="Consumer Key" value="********" />
            <Input label="Consumer Secret" value="********" />
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Smart Alerts" icon={<Bell className="w-5 h-5" />}>
          <div className="space-y-6">
            <Toggle label="SMS Customer Receipts" active={notifications} onToggle={() => setNotifications(!notifications)} />
            <Toggle label="Low Stock SMS Alerts" active={true} onToggle={() => {}} />
            <Toggle label="Daily Revenue Email" active={true} onToggle={() => {}} />
          </div>
        </Section>

        {/* Integration */}
        <Section title="Accounting Software" icon={<ExternalLink className="w-5 h-5" />}>
          <div className="space-y-4">
            <p className="text-[10px] font-mono opacity-60 leading-relaxed">Direct sync with regional tax and accounting solutions.</p>
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-100 hover:border-[#141414] transition-all">
              <span className="font-bold text-xs text-emerald-600">iTax KRA Connector</span>
              <span className="text-[9px] font-mono opacity-50">Active</span>
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-100 hover:border-[#141414] transition-all">
              <span className="font-bold text-xs">QuickBooks Online</span>
              <span className="text-[9px] font-mono text-emerald-600 font-bold">Sync</span>
            </button>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Team Management */}
        <Section title="Team Management" icon={<UserPlus className="w-5 h-5" />}>
           <div className="space-y-6">
             <form onSubmit={handleAddUser} className="space-y-4 bg-gray-50 p-4 border border-gray-100">
               <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Add Team Member</p>
               <Input label="Staff Name" value={newUserName} onChange={setNewUserName} />
               <Input label="Email Address" value={newUserEmail} onChange={setNewUserEmail} />
               <Select 
                 label="Assigned Role" 
                 value={newUserRole} 
                 options={['staff', 'admin']} 
                 onChange={setNewUserRole} 
               />
               <button type="submit" className="w-full bg-[#141414] text-white py-3 font-bold text-[10px] tracking-widest uppercase hover:invert transition-all">
                 Authorize User
               </button>
             </form>

             <div className="space-y-3">
               <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Active Team</p>
               {users.map(u => (
                 <div key={u.id} className="flex items-center justify-between p-3 border border-gray-100 group hover:border-[#141414] transition-colors">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-gray-100 flex items-center justify-center font-bold text-xs uppercase">
                       {u.fullName?.charAt(0) || u.email?.charAt(0)}
                     </div>
                     <div>
                       <p className="text-xs font-bold">{u.fullName}</p>
                       <div className="flex items-center gap-2">
                         <span className={cn(
                           "text-[8px] font-bold uppercase px-1 py-0.5",
                           u.role === 'admin' ? "bg-black text-white" : "bg-gray-100 text-gray-600"
                         )}>
                           {u.role}
                         </span>
                         <span className="text-[8px] font-mono opacity-40">{u.email}</span>
                       </div>
                     </div>
                   </div>
                   <button 
                     onClick={() => toggleUserStatus(u)}
                     className={cn(
                       "p-2 transition-colors",
                       u.active ? "text-emerald-600 hover:text-red-600" : "text-red-300 hover:text-emerald-600"
                     )}
                     title={u.active ? "Deactivate User" : "Activate User"}
                   >
                     {u.active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                   </button>
                 </div>
               ))}
             </div>
           </div>
        </Section>

        {/* Feedback Section */}
        <Section title="Submit Feedback" icon={<MessageSquare className="w-5 h-5" />}>
           <form onSubmit={handleFeedback} className="space-y-4">
             <textarea 
               value={feedback}
               onChange={e => setFeedback(e.target.value)}
               placeholder="How can we improve OmniSync?"
               className="w-full min-h-[100px] p-4 bg-gray-50 border border-gray-100 outline-none focus:border-[#141414] text-xs font-medium resize-none"
             />
             <button 
               type="submit" 
               className="w-full bg-[#141414] text-[#E4E3E0] py-3 font-bold tracking-widest text-xs hover:invert transition-all"
             >
               {submitted ? 'Feedback Sent' : 'Send Feedback'}
             </button>
           </form>
        </Section>

        {/* Support Section */}
        <Section title="System Status" icon={<Shield className="w-5 h-5" />}>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs font-bold">
              <span>Database Sync</span>
              <span className="text-emerald-600">Operational</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span>M-Pesa Gateway</span>
              <span className="text-emerald-600">Operational</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span>Cloud Backup</span>
              <span className="text-emerald-600">Syncing...</span>
            </div>
          </div>
        </Section>
      </div>

      <div className="pt-12 border-t border-gray-200">
        <button 
          onClick={saveSettings}
          disabled={saving}
          className="bg-[#141414] text-[#E4E3E0] px-12 py-4 font-black text-sm tracking-widest flex items-center gap-2 hover:invert transition-all disabled:opacity-50"
        >
          {saving ? (
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Save Global Settings
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: any) {
  return (
    <div className="bg-white border border-[#141414] p-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 group-hover:bg-[#141414] transition-colors" />
      <header className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-gray-50">{icon}</div>
        <h3 className="font-bold tracking-widest text-sm">{title}</h3>
      </header>
      {children}
    </div>
  );
}

function Select({ label, value, options, onChange }: any) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-mono font-bold opacity-40 tracking-widest">{label}</label>
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-50 border border-gray-100 px-4 py-3 text-xs font-bold outline-none focus:border-[#141414]"
      >
        {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, active, onToggle }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold tracking-tight">{label}</span>
      <button 
        onClick={onToggle}
        className={`w-12 h-6 border-2 border-[#141414] relative transition-colors ${active ? 'bg-[#141414]' : 'bg-white'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 transition-all ${active ? 'bg-[#E4E3E0] right-0.5' : 'bg-[#141414] left-0.5'}`} />
      </button>
    </div>
  );
}

function Input({ label, type = "text", value, onChange = () => {} }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono font-bold opacity-40 tracking-widest">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 focus:border-[#141414] focus:bg-white outline-none text-xs font-bold transition-all"
      />
    </div>
  );
}
