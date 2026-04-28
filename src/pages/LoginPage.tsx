import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { LogIn, Package2 } from 'lucide-react';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#E4E3E0]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-[#141414] p-12 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-[#141414]" />
        
        <div className="flex flex-col items-center gap-6 mb-12">
          <div className="w-16 h-16 bg-[#141414] flex items-center justify-center">
            <Package2 className="w-8 h-8 text-[#E4E3E0]" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter text-[#141414]">OmniSync</h1>
            <p className="text-[11px] font-mono tracking-[0.2em] text-[#141414] opacity-50">Enterprise Hybrid POS</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-mono">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-[#141414] text-[#E4E3E0] py-4 px-6 font-bold tracking-widest text-sm hover:invert transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {loading ? (
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-[#E4E3E0] border-t-transparent rounded-full"
            />
          ) : (
            <>
              <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              Sign in with Google
            </>
          )}
        </button>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col gap-4">
          {!navigator.onLine && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono leading-tight">
              <strong>OFFLINE MODE:</strong> New logins require internet, but returning users can continue their session offline.
            </div>
          )}
          <div className="flex justify-between items-center text-[10px] font-mono opacity-40">
            <span>Terminal ID: POS-8829</span>
            <span>V 1.0.0</span>
          </div>
          <p className="text-[10px] text-center opacity-30 leading-relaxed">
            This system is for authorized personnel only. All transactions are logged and encrypted.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
