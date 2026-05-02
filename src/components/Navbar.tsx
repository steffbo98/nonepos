import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Box, MessageSquare, Settings, LogOut, Package2, Wallet, Users, ReceiptText, Truck, CreditCard } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { getDataService } from '../lib/dataService';

type DemoUser = {
  uid: string;
  email: string;
  displayName?: string;
  fullName?: string;
};

export default function Navbar({ user, onLogout, themeMode = 'dark', licenseActive = false }: { user: DemoUser; onLogout: () => void; themeMode?: 'light' | 'dark'; licenseActive?: boolean }) {
  const location = useLocation();
  const { isAdmin } = useUserProfile();
  const dataService = getDataService();
  const isDark = themeMode === 'dark';

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
    <nav className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl shadow-lg no-print ${
      isDark
        ? 'border-white/10 bg-gradient-to-r from-slate-950 via-blue-950/40 to-slate-950 text-slate-100 shadow-blue-500/10'
        : 'border-slate-200 bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 text-slate-900 shadow-blue-400/10'
    }`}>
      <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border shadow-lg ${
            isDark
              ? 'bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border-cyan-400/30 text-cyan-300 shadow-cyan-500/20'
              : 'bg-gradient-to-br from-cyan-100 to-blue-100 border-cyan-400/50 text-cyan-700 shadow-cyan-500/10'
          }`}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl" />
            ) : (
              <Package2 className="w-5 h-5" />
            )}
          </div>
          <div className="truncate">
            <p className={`text-xs uppercase tracking-[0.24em] ${isDark ? 'text-cyan-200' : 'text-cyan-700'}`}>{businessName ? 'Dashboard' : 'NonePOS'}</p>
            <p className={`truncate text-base font-semibold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>{businessName || 'NonePOS'}</p>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <NavLink to="/" icon={<ShoppingCart className="w-4 h-4" />} label="POS" active={location.pathname === '/'} color="blue" isDark={isDark} />
          {isAdmin && <NavLink to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Analytics" active={location.pathname === '/dashboard'} color="purple" isDark={isDark} />}
          <NavLink to="/inventory" icon={<Box className="w-4 h-4" />} label="Inventory" active={location.pathname === '/inventory'} color="emerald" isDark={isDark} />
          <NavLink to="/sales" icon={<ReceiptText className="w-4 h-4" />} label="Sales" active={location.pathname === '/sales'} color="amber" isDark={isDark} />
          {isAdmin && <NavLink to="/purchases" icon={<Truck className="w-4 h-4" />} label="Purchases" active={location.pathname === '/purchases'} color="orange" isDark={isDark} />}
          <NavLink to="/expenses" icon={<Wallet className="w-4 h-4" />} label="Expenses" active={location.pathname === '/expenses'} color="red" isDark={isDark} />
          <NavLink to="/customers" icon={<Users className="w-4 h-4" />} label="Customers" active={location.pathname === '/customers'} color="pink" isDark={isDark} />
          <NavLink to="/chat" icon={<MessageSquare className="w-4 h-4" />} label="Support" active={location.pathname === '/chat'} color="cyan" isDark={isDark} />
          {isAdmin && <NavLink to="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" active={location.pathname === '/settings'} color="gray" isDark={isDark} />}
          {isAdmin && !licenseActive && <NavLink to="/billing" icon={<CreditCard className="w-4 h-4" />} label="Billing" active={location.pathname === '/billing'} color="amber" isDark={isDark} />}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className={`text-[11px] uppercase tracking-[0.22em] ${isDark ? 'text-cyan-200' : 'text-cyan-700'}`}>Signed in as</span>
            <span className={`text-sm font-semibold truncate max-w-[160px] ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>{user.email}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
              isDark
                ? 'border-red-400/30 bg-gradient-to-br from-red-900/20 to-red-800/10 text-red-300 hover:bg-red-500/20 hover:shadow-lg hover:shadow-red-500/20'
                : 'border-red-300/50 bg-gradient-to-br from-red-100 to-red-50 text-red-700 hover:bg-red-200/40 hover:shadow-lg hover:shadow-red-400/20'
            }`}
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
  color,
  isDark,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  color: 'blue' | 'purple' | 'emerald' | 'amber' | 'orange' | 'red' | 'pink' | 'cyan' | 'gray';
  isDark: boolean;
}) {
  const darkColorMap = {
    blue: {
      active: 'bg-blue-500/20 text-slate-100 font-semibold shadow-lg shadow-blue-500/30 border border-blue-300/60',
      inactive: 'text-slate-400 hover:text-slate-100 hover:bg-blue-400/10 border border-transparent hover:border-blue-300/30',
    },
    purple: {
      active: 'bg-purple-500/20 text-slate-100 font-semibold shadow-lg shadow-purple-500/30 border border-purple-300/60',
      inactive: 'text-slate-400 hover:text-slate-100 hover:bg-purple-400/10 border border-transparent hover:border-purple-300/30',
    },
    emerald: {
      active: 'bg-emerald-500/20 text-slate-100 font-semibold shadow-lg shadow-emerald-500/30 border border-emerald-300/60',
      inactive: 'text-slate-400 hover:text-slate-100 hover:bg-emerald-400/10 border border-transparent hover:border-emerald-300/30',
    },
    amber: {
      active: 'bg-amber-400/20 text-slate-950 font-semibold shadow-lg shadow-amber-500/30 border border-amber-300/60',
      inactive: 'text-slate-400 hover:text-slate-100 hover:bg-amber-400/10 border border-transparent hover:border-amber-300/30',
    },
    orange: {
      active: 'bg-orange-400/20 text-slate-950 font-semibold shadow-lg shadow-orange-500/30 border border-orange-300/60',
      inactive: 'text-slate-400 hover:text-slate-100 hover:bg-orange-400/10 border border-transparent hover:border-orange-300/30',
    },
    red: {
      active: 'bg-red-500/20 text-slate-100 font-semibold shadow-lg shadow-red-500/30 border border-red-300/60',
      inactive: 'text-slate-400 hover:text-slate-100 hover:bg-red-400/10 border border-transparent hover:border-red-300/30',
    },
    pink: {
      active: 'bg-pink-500/20 text-slate-100 font-semibold shadow-lg shadow-pink-500/30 border border-pink-300/60',
      inactive: 'text-slate-400 hover:text-slate-100 hover:bg-pink-400/10 border border-transparent hover:border-pink-300/30',
    },
    cyan: {
      active: 'bg-cyan-500/20 text-slate-100 font-semibold shadow-lg shadow-cyan-500/30 border border-cyan-300/60',
      inactive: 'text-slate-400 hover:text-slate-100 hover:bg-cyan-400/10 border border-transparent hover:border-cyan-300/30',
    },
    gray: {
      active: 'bg-slate-200/10 text-slate-100 font-semibold shadow-lg shadow-slate-500/20 border border-slate-300/50',
      inactive: 'text-slate-400 hover:text-slate-100 hover:bg-slate-400/10 border border-transparent hover:border-slate-300/30',
    },
  };

  const lightColorMap = {
    blue: {
      active: 'bg-blue-100 text-blue-700 font-semibold shadow-lg shadow-blue-300/30 border border-blue-300',
      inactive: 'text-slate-600 hover:text-slate-900 hover:bg-blue-50 border border-transparent hover:border-blue-200',
    },
    purple: {
      active: 'bg-purple-100 text-purple-700 font-semibold shadow-lg shadow-purple-300/30 border border-purple-300',
      inactive: 'text-slate-600 hover:text-slate-900 hover:bg-purple-50 border border-transparent hover:border-purple-200',
    },
    emerald: {
      active: 'bg-emerald-100 text-emerald-700 font-semibold shadow-lg shadow-emerald-300/30 border border-emerald-300',
      inactive: 'text-slate-600 hover:text-slate-900 hover:bg-emerald-50 border border-transparent hover:border-emerald-200',
    },
    amber: {
      active: 'bg-amber-100 text-amber-700 font-semibold shadow-lg shadow-amber-300/30 border border-amber-300',
      inactive: 'text-slate-600 hover:text-slate-900 hover:bg-amber-50 border border-transparent hover:border-amber-200',
    },
    orange: {
      active: 'bg-orange-100 text-orange-700 font-semibold shadow-lg shadow-orange-300/30 border border-orange-300',
      inactive: 'text-slate-600 hover:text-slate-900 hover:bg-orange-50 border border-transparent hover:border-orange-200',
    },
    red: {
      active: 'bg-red-100 text-red-700 font-semibold shadow-lg shadow-red-300/30 border border-red-300',
      inactive: 'text-slate-600 hover:text-slate-900 hover:bg-red-50 border border-transparent hover:border-red-200',
    },
    pink: {
      active: 'bg-pink-100 text-pink-700 font-semibold shadow-lg shadow-pink-300/30 border border-pink-300',
      inactive: 'text-slate-600 hover:text-slate-900 hover:bg-pink-50 border border-transparent hover:border-pink-200',
    },
    cyan: {
      active: 'bg-cyan-100 text-cyan-700 font-semibold shadow-lg shadow-cyan-300/30 border border-cyan-300',
      inactive: 'text-slate-600 hover:text-slate-900 hover:bg-cyan-50 border border-transparent hover:border-cyan-200',
    },
    gray: {
      active: 'bg-gray-100 text-gray-700 font-semibold shadow-lg shadow-gray-300/30 border border-gray-300',
      inactive: 'text-slate-600 hover:text-slate-900 hover:bg-gray-50 border border-transparent hover:border-gray-200',
    },
  };

  const colorMap = isDark ? darkColorMap : lightColorMap;
  const styles = colorMap[color];

  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
        active ? styles.active : styles.inactive
      }`}
    >
      {icon}
      <span className="tracking-wide text-[12px]">{label}</span>
    </Link>
  );
}
