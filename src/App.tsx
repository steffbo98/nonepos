/**
 * NonePOS - Professional Point of Sale Desktop Application
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import POSPage from './pages/POSPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import InventoryPage from './pages/InventoryPage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import ExpensesPage from './pages/ExpensesPage';
import CustomersPage from './pages/CustomersPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import PurchasesPage from './pages/PurchasesPage';
import BillingPage from './pages/BillingPage';
import Navbar from './components/Navbar';
import { startCloudSync } from './lib/syncManager';
import { getDataService } from './lib/dataService';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, UserProfileProvider } from './hooks/useUserProfile';

interface LocalUser {
  uid: string;
  id?: string;
  email: string;
  displayName?: string;
  fullName?: string;
  role?: 'admin' | 'staff';
  active?: boolean;
}

type LicenseStatus = {
  active: boolean;
  plan?: string;
  expiresAt?: string;
  activationUrl?: string;
  licenseKey?: string;
  lastChecked?: string;
} | null;

const SESSION_STORAGE_KEY = 'nonepos.currentUser';

function normalizeUser(nextUser: LocalUser): LocalUser {
  return {
    ...nextUser,
    uid: nextUser.uid || nextUser.id || '',
    displayName: nextUser.displayName || nextUser.fullName || nextUser.email,
    role: nextUser.role || 'staff',
    active: nextUser.active !== false,
  };
}

function isValidSessionUser(value: unknown): value is LocalUser {
  if (!value || typeof value !== 'object') return false;

  const maybeUser = value as Partial<LocalUser>;
  return (
    typeof maybeUser.email === 'string' &&
    maybeUser.email.length > 0 &&
    (typeof maybeUser.uid === 'string' || typeof maybeUser.id === 'string')
  );
}

export default function App() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const dataService = getDataService();

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (isValidSessionUser(parsed)) {
          setUser(normalizeUser(parsed));
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }

      const savedTheme = localStorage.getItem('nonepos.theme');
      setThemeMode(savedTheme === 'light' ? 'light' : 'dark');
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', themeMode === 'light');
    localStorage.setItem('nonepos.theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (user) {
      startCloudSync();
    }
  }, [user]);

  useEffect(() => {
    const loadLicenseStatus = async () => {
      if (!user) {
        setLicenseStatus(null);
        setLicenseLoading(false);
        return;
      }

      setLicenseLoading(true);
      try {
        const billingSetting = await dataService.getSetting('billing');
        const config = billingSetting?.value ? JSON.parse(billingSetting.value) : null;
        setLicenseStatus({
          active: Boolean(config?.active),
          plan: config?.plan,
          expiresAt: config?.expiresAt,
          activationUrl: config?.activationUrl,
          licenseKey: config?.licenseKey,
          lastChecked: config?.lastChecked,
        });
      } catch (error) {
        console.error('Failed to load billing status:', error);
        setLicenseStatus({ active: false });
      } finally {
        setLicenseLoading(false);
      }
    };

    void loadLicenseStatus();
  }, [user, dataService]);

  const handleAuth = (nextUser: LocalUser) => {
    const sessionUser = normalizeUser(nextUser);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
  };

  const refreshBillingStatus = async () => {
    try {
      const billingSetting = await dataService.getSetting('billing');
      const config = billingSetting?.value ? JSON.parse(billingSetting.value) : null;
      setLicenseStatus({
        active: Boolean(config?.active),
        plan: config?.plan,
        expiresAt: config?.expiresAt,
        activationUrl: config?.activationUrl,
        licenseKey: config?.licenseKey,
        lastChecked: config?.lastChecked,
      });
    } catch (error) {
      console.error('Failed to refresh billing status:', error);
      setLicenseStatus({ active: false });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
    setLicenseStatus(null);
  };

  const profile: UserProfile | null = user ? {
    uid: user.uid,
    email: user.email,
    fullName: user.fullName || user.displayName || user.email,
    role: user.role || 'staff',
    active: user.active !== false,
  } : null;

  const adminRoute = (element: React.ReactNode) => {
    if (!user) return <Navigate to="/login" />;
    if (profile?.role !== 'admin') return <Navigate to="/" replace />;
    return element;
  };

  const licenseRoute = (element: React.ReactNode) => {
    if (!user) return <Navigate to="/login" />;
    if (licenseLoading) {
      return (
        <div className="flex items-center justify-center h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_18%),linear-gradient(180deg,#020617,_#07101c)]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 border-4 border-slate-300/20 border-t-transparent rounded-full"
          />
        </div>
      );
    }

    if (!licenseStatus?.active) {
      return <Navigate to="/billing" replace />;
    }

    return element;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_18%),linear-gradient(180deg,#020617,_#07101c)]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-slate-300/20 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <Router>
      <UserProfileProvider user={profile}>
        <div className="app-shell min-h-screen font-sans">
          {user && <Navbar user={user} onLogout={handleLogout} themeMode={themeMode} licenseActive={Boolean(licenseStatus?.active)} />}
          <main className={user ? "pt-20 px-4 md:px-6 lg:px-8 pb-10 max-w-[1700px] mx-auto" : "min-h-screen flex items-center justify-center px-4"}>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/login" element={!user ? <LoginPage onAuth={handleAuth} /> : <Navigate to="/" />} />
                <Route path="/" element={licenseRoute(<POSPage user={user!} />)} />
                <Route path="/dashboard" element={licenseRoute(adminRoute(<AdminAnalyticsPage />))} />
                <Route path="/inventory" element={licenseRoute(<InventoryPage />)} />
                <Route path="/sales" element={licenseRoute(<SalesHistoryPage />)} />
                <Route path="/purchases" element={licenseRoute(adminRoute(<PurchasesPage />))} />
                <Route path="/expenses" element={licenseRoute(<ExpensesPage />)} />
                <Route path="/customers" element={licenseRoute(<CustomersPage />)} />
                <Route path="/chat" element={licenseRoute(<ChatPage />)} />
                <Route path="/settings" element={adminRoute(<SettingsPage themeMode={themeMode} onThemeModeChange={setThemeMode} />)} />
                <Route
                  path="/billing"
                  element={
                    user ? (
                      licenseStatus?.active ? (
                        <Navigate to="/" replace />
                      ) : (
                        <BillingPage billingStatus={licenseStatus} refreshBilling={refreshBillingStatus} />
                      )
                    ) : (
                      <Navigate to="/login" />
                    )
                  }
                />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </UserProfileProvider>
    </Router>
  );
}

