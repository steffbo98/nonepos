import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, LogIn, Package2, UserPlus, Key, Fingerprint, ShieldCheck } from 'lucide-react';
import { getDataService } from '../lib/dataService';
import { FormInput, FormButton, Alert } from '../components/FormComponents';

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
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [terminalId, setTerminalId] = useState<string>('');

  const formatAuthError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('invalid email or password')) {
      return 'Wrong email or password. Please try again.';
    }
    if (message.toLowerCase().includes('already exists') || message.toLowerCase().includes('already registered')) {
      return 'This email is already registered. Please log in or use a different address.';
    }
    if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('unable to reach backend api')) {
      return 'Unable to connect to the authentication service. Please check your network and try again.';
    }
    return message || fallback;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'register' && !isOnline) {
        throw new Error('Online connection is required to create a new account.');
      }

      const response = mode === 'login'
        ? await dataService.loginUser({ email, password })
        : await dataService.registerUser({ fullName, email, password });

      const user = response.user;
      onAuth({
        ...user,
        uid: user.id,
      });
    } catch (err: any) {
      setError(formatAuthError(err, 'Authentication failed'));
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

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storageKey = 'nonepos-terminal-id';
    let savedId = window.localStorage.getItem(storageKey);

    if (!savedId) {
      const uniquePart = typeof window.crypto !== 'undefined' && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID().slice(0, 8).toUpperCase()
        : Math.random().toString(36).slice(2, 10).toUpperCase();
      savedId = `POS-${uniquePart}`;
      window.localStorage.setItem(storageKey, savedId);
    }

    setTerminalId(savedId);
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
      if (!isOnline) {
        throw new Error('Password reset requires an active internet connection.');
      }

      await dataService.requestPasswordReset(email);
      setMode('confirmReset');
      setMessage('Reset code emailed. Check your inbox and enter the code below.');
    } catch (err: any) {
      setError(formatAuthError(err, 'Unable to generate reset code'));
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
      setError(formatAuthError(err, 'Unable to reset password'));
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
      setError(formatAuthError(err, 'Fingerprint registration failed'));
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
      setError(formatAuthError(err, 'Fingerprint login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_18%),linear-gradient(180deg,#020617,_#07101c)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-slate-200/50 p-8 relative overflow-hidden shadow-2xl"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-emerald-600" />

        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="w-16 h-16 bg-slate-900 flex items-center justify-center rounded-2xl shadow-lg">
            <Package2 className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900">NonePOS</h1>
            <p className="text-sm font-medium tracking-wide text-slate-600 mt-1">
              Professional Point of Sale
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 border border-slate-200 mb-6 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-3 text-sm font-semibold transition-colors ${
              mode === 'login'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`py-3 text-sm font-semibold border-l border-slate-200 transition-colors ${
              mode === 'register'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <Alert type="error" message={error} />
        )}

        <form onSubmit={mode === 'confirmReset' ? handleConfirmReset : submit} className="space-y-5">
          {mode === 'register' && (
            <FormInput
              label="Full Name"
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter your full name"
            />
          )}

          <FormInput
            label="Email Address"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@nonepos.local"
          />

          {(mode === 'login' || mode === 'register') && (
            <FormInput
              label="Password"
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          )}

          {mode === 'confirmReset' && (
            <>
              <FormInput
                label="Reset Code"
                required
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
                placeholder="Paste reset code here"
              />

              <FormInput
                label="New Password"
                required
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter your new password"
              />
            </>
          )}

          {message && (
            <Alert type="success" message={message} />
          )}

          {biometricStatus && (
            <Alert type="info" message={biometricStatus} />
          )}

          {mode === 'requestReset' ? (
            <FormButton type="button" loading={loading} onClick={handleResetRequest}>
              <Key className="w-5 h-5" />
              Generate Reset Code
            </FormButton>
          ) : (
            <FormButton type="submit" loading={loading}>
              {mode === 'login' ? (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              ) : mode === 'register' ? (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              ) : (
                <>
                  <Key className="w-5 h-5" />
                  Reset Password
                </>
              )}
            </FormButton>
          )}
        </form>

        {(mode === 'login' || mode === 'register') && (
          <div className="mt-6 flex justify-between items-center text-sm text-slate-600 gap-3">
            <button
              type="button"
              onClick={() => switchMode('requestReset')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Forgot password?
            </button>
            {mode === 'login' && isBiometricSupported && (
              <div className="grid grid-cols-2 gap-3 w-full">
                <FormButton
                  type="button"
                  variant="primary"
                  disabled={loading}
                  onClick={handleFingerprintLogin}
                  className="px-4 py-2 text-xs"
                >
                  <Fingerprint className="w-4 h-4 mr-2" />
                  Fingerprint
                </FormButton>
                <FormButton
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={handleRegisterFingerprint}
                  className="px-4 py-2 text-xs"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Register
                </FormButton>
              </div>
            )}
          </div>
        )}

        {mode === 'requestReset' && (
          <div className="mt-6 text-sm text-slate-600">
            Enter the email address for the account you want to reset. A reset code will be emailed to you.
          </div>
        )}

        {mode === 'confirmReset' && (
          <div className="mt-6 text-sm text-slate-600">
            Enter the reset code from your email and a new password to update your account.
          </div>
        )}

        <div className="mt-4 text-xs font-medium text-slate-500">
          {isOnline ? 'Online connection is available.' : 'Offline mode detected — registration and password reset require internet access.'}
        </div>

        {mode !== 'confirmReset' && mode !== 'requestReset' && (
          <div className="mt-6 text-sm text-slate-600">
            No internet required for local authentication. Fingerprint login uses your device's WebAuthn support.
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="w-3 h-3" />
            <span>Accounts are stored securely in the local SQLite database.</span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Terminal ID: {terminalId || 'Generating...'}</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
