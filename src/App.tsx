/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import POSPage from './pages/POSPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import ExpensesPage from './pages/ExpensesPage';
import CustomersPage from './pages/CustomersPage';
import Navbar from './components/Navbar';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#E4E3E0]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-[#141414] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
        {user && <Navbar user={user} />}
        <main className={user ? "pt-16 px-4 md:px-8 pb-8" : ""}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
              <Route path="/" element={user ? <POSPage /> : <Navigate to="/login" />} />
              <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" />} />
              <Route path="/inventory" element={user ? <InventoryPage /> : <Navigate to="/login" />} />
              <Route path="/expenses" element={user ? <ExpensesPage /> : <Navigate to="/login" />} />
              <Route path="/customers" element={user ? <CustomersPage /> : <Navigate to="/login" />} />
              <Route path="/chat" element={user ? <ChatPage /> : <Navigate to="/login" />} />
              <Route path="/settings" element={user ? <SettingsPage /> : <Navigate to="/login" />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </Router>
  );
}

