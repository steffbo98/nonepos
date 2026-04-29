import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, LogIn, Package2, UserPlus, Key, Fingerprint, ShieldCheck } from 'lucide-react';
import { getDataService } from '../lib/dataService';

type LocalUser = {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  role: 'admin' | 'staff';
};

export default function LoginPage({ onAuth }: { onAuth: (user: LocalUser) => void }) {
  const dataService = getDataService();
  const [mode, setMode] = useState<'login' | 'register' | 'requestReset' | 'confirmReset'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<string | null>(null);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = mode === 'login'
        ? await dataService.loginUser({ email, password })
        : await dataService.registerUser({ fullName, email, password });

      const user = response.user;
      onAuth({
        ...user,
        uid: user.id,
      });
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsBiometricSupported(
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      typeof navigator.credentials !== 'undefined'
    );
  }, []);

  const switchMode = (nextMode: 'login' | 'register' | 'requestReset' | 'confirmReset') => {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  };

  const bufferToBase64Url = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    const binary = Array.from(bytes).map((b) => String.fromCharCode(b)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const base64UrlToBuffer = (base64Url: string) => {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob(base64 + padding);
    const buffer = new ArrayBuffer(raw.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i);
    }
    return buffer;
  };

  const handleResetRequest = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await dataService.requestPasswordReset(email);
      setResetToken(response.resetToken);
      setMode('confirmReset');
      setMessage('Reset code generated. Enter it below with your new password.');
    } catch (err: any) {
      setError(err.message || 'Unable to generate reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await dataService.resetPassword({ email, token: resetToken, newPassword });
      setMode('login');
      setPassword('');
      setNewPassword('');
      setResetToken('');
      setMessage('Password updated successfully. Please log in.');
    } catch (err: any) {
      setError(err.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterFingerprint = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setBiometricStatus(null);

    try {
      await dataService.loginUser({ email, password });

      if (!window.PublicKeyCredential || !navigator.credentials) {
        throw new Error('Fingerprint login is not supported in this environment');
      }

      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge: window.crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'NonePOS' },
        user: {
          id: new TextEncoder().encode(email.trim().toLowerCase()),
          name: email.trim().toLowerCase(),
          displayName: fullName || email.trim().toLowerCase()
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
          userVerification: 'preferred'
        },
        timeout: 60000,
        attestation: 'direct'
      };

      const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
      if (!credential || !credential.rawId) {
        throw new Error('Unable to create fingerprint credential');
      }

      const credentialId = bufferToBase64Url(credential.rawId);
      await dataService.registerBiometricCredential(email, credentialId);
      setBiometricStatus('Fingerprint login registered successfully. Use it to sign in next time.');
    } catch (err: any) {
      setError(err.message || 'Fingerprint registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFingerprintLogin = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setBiometricStatus(null);

    try {
      const result = await dataService.getBiometricCredential(email);
      const credentialId = result.credentialId;
      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: window.crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [
          {
            id: base64UrlToBuffer(credentialId),
            type: 'public-key'
          }
        ],
        timeout: 60000,
        userVerification: 'preferred'
      };

      const assertion = await navigator.credentials.get({ publicKey }) as PublicKeyCredential;
      if (!assertion || !assertion.rawId) {
        throw new Error('Fingerprint login failed');
      }

      const response = await dataService.loginWithBiometric(email, credentialId);
      onAuth({ ...response.user, uid: response.user.id });
    } catch (err: any) {
      setError(err.message || 'Fingerprint login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#E4E3E0]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-[#141414] p-10 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-[#141414]" />

        <div className="flex flex-col items-center gap-5 mb-8">
          <div className="w-14 h-14 bg-[#141414] flex items-center justify-center">
            <Package2 className="w-7 h-7 text-[#E4E3E0]" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter text-[#141414]">NonePOS</h1>
            <p className="text-[11px] font-mono tracking-[0.2em] text-[#141414] opacity-50">
              Local Desktop Access
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border border-[#141414] mb-6">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-3 text-xs font-black tracking-widest ${mode === 'login' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white text-[#141414]'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`py-3 text-xs font-black tracking-widest border-l border-[#141414] ${mode === 'register' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white text-[#141414]'}`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-mono">
            {error}
          </div>
        )}

        <form onSubmit={mode === 'confirmReset' ? handleConfirmReset : submit} className="space-y-4">
          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Full Name</label>
              <input
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#141414] outline-none text-sm font-bold"
                placeholder="Admin User"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full px-4 py-3 bg-white border border-[#141414] outline-none text-sm font-bold"
              placeholder="admin@nonepos.local"
            />
          </div>

          {(mode === 'login' || mode === 'register') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Password</label>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full px-4 py-3 bg-white border border-[#141414] outline-none text-sm font-bold"
                placeholder="Minimum 6 characters"
              />
            </div>
          )}

          {mode === 'confirmReset' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Reset Code</label>
                <input
                  required
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#141414] outline-none text-sm font-bold"
                  placeholder="Paste reset code here"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">New Password</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full px-4 py-3 bg-white border border-[#141414] outline-none text-sm font-bold"
                  placeholder="Enter your new password"
                />
              </div>
            </>
          )}

          {message && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-mono">
              {message}
            </div>
          )}

          {biometricStatus && (
            <div className="p-4 bg-sky-50 border border-sky-200 text-sky-700 text-sm font-mono">
              {biometricStatus}
            </div>
          )}

          {mode === 'requestReset' ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleResetRequest}
              className="w-full flex items-center justify-center gap-3 bg-[#141414] text-[#E4E3E0] py-4 px-6 font-bold tracking-widest text-sm hover:invert transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-[#E4E3E0] border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Key className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  Generate Reset Code
                </>
              )}
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-[#141414] text-[#E4E3E0] py-4 px-6 font-bold tracking-widest text-sm hover:invert transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-[#E4E3E0] border-t-transparent rounded-full"
                />
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  Login
                </>
              ) : mode === 'register' ? (
                <>
                  <UserPlus className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  Create Account
                </>
              ) : (
                <>
                  <Key className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  Reset Password
                </>
              )}
            </button>
          )}
        </form>

        {(mode === 'login' || mode === 'register') && (
          <div className="mt-4 flex justify-between items-center text-[10px] font-mono opacity-50 gap-3">
            <button
              type="button"
              onClick={() => switchMode('requestReset')}
              className="underline"
            >
              Forgot password?
            </button>
            {mode === 'login' && isBiometricSupported && (
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFingerprintLogin}
                  className="w-full px-4 py-3 bg-[#141414] text-[#E4E3E0] text-xs font-black tracking-widest uppercase"
                >
                  <Fingerprint className="inline w-4 h-4 mr-2" /> Use Fingerprint
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleRegisterFingerprint}
                  className="w-full px-4 py-3 border border-[#141414] bg-white text-[#141414] text-xs font-black tracking-widest uppercase"
                >
                  <ShieldCheck className="inline w-4 h-4 mr-2" /> Register Fingerprint
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'requestReset' && (
          <div className="mt-4 text-[10px] font-mono text-slate-600">
            Enter the email address for the account you want to reset. A reset code will be generated locally.
          </div>
        )}

        {mode === 'confirmReset' && (
          <div className="mt-4 text-[10px] font-mono text-slate-600">
            Enter the reset code and a new password to update your local account.
          </div>
        )}

        {mode !== 'confirmReset' && mode !== 'requestReset' && (
          <div className="mt-4 text-[10px] font-mono text-slate-600">
            No internet is required for local auth. Fingerprint login uses your device's WebAuthn support.
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <Lock className="w-3 h-3" />
            <span>Accounts are stored in the local SQLite database on this computer.</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
            <span>Terminal ID: POS-8829</span>
            <span>V 1.0.0</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
