/**
 * NonePOS - Professional Point of Sale Desktop Application
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import POSPage from './pages/POSPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import ExpensesPage from './pages/ExpensesPage';
import CustomersPage from './pages/CustomersPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import PurchasesPage from './pages/PurchasesPage';
import Navbar from './components/Navbar';
import { startCloudSync } from './lib/syncManager';
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
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');

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

  const handleAuth = (nextUser: LocalUser) => {
    const sessionUser = normalizeUser(nextUser);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUser(null);
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
          {user && <Navbar user={user} onLogout={handleLogout} />}
          <main className={user ? "pt-20 px-4 md:px-6 lg:px-8 pb-10 max-w-[1700px] mx-auto" : "min-h-screen flex items-center justify-center px-4"}>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/login" element={!user ? <LoginPage onAuth={handleAuth} /> : <Navigate to="/" />} />
                <Route path="/" element={user ? <POSPage user={user} /> : <Navigate to="/login" />} />
                <Route path="/dashboard" element={adminRoute(<DashboardPage />)} />
                <Route path="/inventory" element={user ? <InventoryPage /> : <Navigate to="/login" />} />
                <Route path="/sales" element={user ? <SalesHistoryPage /> : <Navigate to="/login" />} />
                <Route path="/purchases" element={adminRoute(<PurchasesPage />)} />
                <Route path="/expenses" element={user ? <ExpensesPage /> : <Navigate to="/login" />} />
                <Route path="/customers" element={user ? <CustomersPage /> : <Navigate to="/login" />} />
                <Route path="/chat" element={user ? <ChatPage /> : <Navigate to="/login" />} />
                <Route path="/settings" element={adminRoute(<SettingsPage themeMode={themeMode} onThemeModeChange={setThemeMode} />)} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </UserProfileProvider>
    </Router>
  );
}

