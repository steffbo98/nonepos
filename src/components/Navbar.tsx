import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { LayoutDashboard, ShoppingCart, Box, MessageSquare, Settings, LogOut, Package2, Wallet, Users } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';

export default function Navbar({ user }: { user: User }) {
  const location = useLocation();
  const { isAdmin } = useUserProfile();
  const [businessName, setBusinessName] = useState('OmniSync POS');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const docRef = doc(db, 'settings', 'business');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusinessName(data.name || 'OmniSync POS');
        setLogoUrl(data.logoUrl || '');
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-[#141414] text-[#E4E3E0] flex items-center justify-between px-6 z-50 border-b border-[#141414] no-print">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <div className="w-8 h-8 bg-[#E4E3E0] p-1 rounded overflow-hidden flex items-center justify-center">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
        ) : (
          <Package2 className="w-6 h-6 text-[#E4E3E0]" />
        )}
        <span className="font-bold text-lg tracking-tight truncate max-w-[200px]">{businessName}</span>
      </div>

      <div className="hidden lg:flex items-center gap-8">
        <NavLink to="/" icon={<ShoppingCart className="w-4 h-4" />} label="POS" active={location.pathname === '/'} />
        {isAdmin && <NavLink to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Analytics" active={location.pathname === '/dashboard'} />}
        <NavLink to="/inventory" icon={<Box className="w-4 h-4" />} label="Inventory" active={location.pathname === '/inventory'} />
        <NavLink to="/expenses" icon={<Wallet className="w-4 h-4" />} label="Expenses" active={location.pathname === '/expenses'} />
        <NavLink to="/customers" icon={<Users className="w-4 h-4" />} label="Customers" active={location.pathname === '/customers'} />
        <NavLink to="/chat" icon={<MessageSquare className="w-4 h-4" />} label="Support" active={location.pathname === '/chat'} />
        {isAdmin && <NavLink to="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" active={location.pathname === '/settings'} />}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-mono opacity-60">Signed in as</p>
          <p className="text-sm font-medium">{user.email}</p>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="p-2 hover:bg-[#E4E3E0] hover:text-[#141414] transition-colors rounded-md"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}

function NavLink({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2 text-sm font-medium transition-opacity ${active ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
    >
      {icon}
      <span className="tracking-wide text-[12px]">{label}</span>
    </Link>
  );
}
