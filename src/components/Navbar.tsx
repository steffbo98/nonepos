import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Box, MessageSquare, Settings, LogOut, Package2, Wallet, Users, ReceiptText, Truck } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { getDataService } from '../lib/dataService';

type DemoUser = {
  uid: string;
  email: string;
  displayName?: string;
  fullName?: string;
};

export default function Navbar({ user, onLogout }: { user: DemoUser; onLogout: () => void }) {
  const location = useLocation();
  const { isAdmin } = useUserProfile();
  const dataService = getDataService();

  const [businessName, setBusinessName] = useState('NonePOS');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadBusiness = async () => {
      try {
        const setting = await dataService.getSetting('business');
        if (!setting) return;

        const data = JSON.parse(setting.value) as {
          name?: string;
          logoUrl?: string;
        };

        if (cancelled) return;
        setBusinessName(data.name || 'OmniSync POS');
        setLogoUrl(data.logoUrl || '');
      } catch (err) {
        // Desktop mode can run without the backend/Firestore; keep UI usable.
        // eslint-disable-next-line no-console
        console.warn('Failed to load business settings:', err);
      }
    };

    loadBusiness();

    return () => {
      cancelled = true;
    };
  }, [dataService]);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl text-slate-100 shadow-panel no-print">
      <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-200/10 border border-white/10 text-cyan-300 shadow-sm">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl" />
            ) : (
              <Package2 className="w-5 h-5" />
            )}
          </div>
          <div className="truncate">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{businessName ? 'Dashboard' : 'NonePOS'}</p>
            <p className="truncate text-base font-semibold text-slate-100">{businessName || 'NonePOS'}</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <NavLink to="/" icon={<ShoppingCart className="w-4 h-4" />} label="POS" active={location.pathname === '/'} />
          {isAdmin && <NavLink to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Analytics" active={location.pathname === '/dashboard'} />}
          <NavLink to="/inventory" icon={<Box className="w-4 h-4" />} label="Inventory" active={location.pathname === '/inventory'} />
          <NavLink to="/sales" icon={<ReceiptText className="w-4 h-4" />} label="Sales" active={location.pathname === '/sales'} />
          {isAdmin && <NavLink to="/purchases" icon={<Truck className="w-4 h-4" />} label="Purchases" active={location.pathname === '/purchases'} />}
          <NavLink to="/expenses" icon={<Wallet className="w-4 h-4" />} label="Expenses" active={location.pathname === '/expenses'} />
          <NavLink to="/customers" icon={<Users className="w-4 h-4" />} label="Customers" active={location.pathname === '/customers'} />
          <NavLink to="/chat" icon={<MessageSquare className="w-4 h-4" />} label="Support" active={location.pathname === '/chat'} />
          {isAdmin && <NavLink to="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" active={location.pathname === '/settings'} />}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Signed in as</span>
            <span className="text-sm font-semibold text-slate-100 truncate max-w-[160px]">{user.email}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/80 text-slate-100 transition hover:bg-slate-100/10"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
        active
          ? 'bg-cyan-400/10 text-cyan-200 shadow-sm shadow-cyan-500/10'
          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-200/5'
      }`}
    >
      {icon}
      <span className="tracking-wide text-[12px]">{label}</span>
    </Link>
  );
}
