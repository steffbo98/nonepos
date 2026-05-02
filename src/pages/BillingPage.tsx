import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ShieldAlert, Key, Terminal, RefreshCw, Copy, ArrowRight, Check } from 'lucide-react';
import { getDataService } from '../lib/dataService';

type BillingStatus = {
  active: boolean;
  plan?: string;
  expiresAt?: string;
  activationUrl?: string;
  licenseKey?: string;
  lastChecked?: string;
} | null;

const PLANS = [
  { id: 'monthly', label: 'Monthly', duration: '1 Month', price: 'Ksh 1,499', color: 'slate' },
  { id: '3months', label: '3 Months', duration: '3 Months', price: 'Ksh 4,249', color: 'blue' },
  { id: '6months', label: '6 Months', duration: '6 Months', price: 'Ksh 7,999', color: 'purple' },
  { id: '9months', label: '9 Months', duration: '9 Months', price: 'Ksh 11,249', color: 'emerald' },
  { id: '12months', label: '1 Year', duration: '12 Months', price: 'Ksh 14,499', color: 'amber' },
  { id: 'lifetime', label: 'Lifetime', duration: 'Forever', price: 'Ksh 49,999', color: 'sky' },
];

export default function BillingPage({
  billingStatus,
  refreshBilling,
}: {
  billingStatus: BillingStatus;
  refreshBilling: () => Promise<void>;
}) {
  const dataService = getDataService();
  const [licenseKey, setLicenseKey] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [message, setMessage] = useState('Select a plan and enter your activation key from support to unlock the POS.');
  const [working, setWorking] = useState(false);
  const [terminalId, setTerminalId] = useState('');

  const deviceLabel = useMemo(() => {
    return terminalId ? terminalId.slice(0, 8).toUpperCase() : 'Unknown';
  }, [terminalId]);

  useEffect(() => {
    let saved = localStorage.getItem('nonepos.terminalId');
    if (!saved) {
      saved = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? (crypto as Crypto).randomUUID()
        : `TERM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      localStorage.setItem('nonepos.terminalId', saved);
    }
    setTerminalId(saved);
  }, []);

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setMessage('Please enter a valid license key.');
      return;
    }

    if (!selectedPlan) {
      setMessage('Please select a plan duration.');
      return;
    }

    setWorking(true);
    setMessage('Activating license...');

    try {
      await dataService.activateBilling(licenseKey.trim(), terminalId, selectedPlan);
      await refreshBilling();
      setMessage('Activation successful! Your POS features are now unlocked.');
      setLicenseKey('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activation failed. Please try again.');
    } finally {
      setWorking(false);
    }
  };


  const handleRefresh = async () => {
    setWorking(true);
    setMessage('Refreshing license status...');
    try {
      await refreshBilling();
      setMessage('License status refreshed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to refresh billing status.');
    } finally {
      setWorking(false);
    }
  };

  const copyTerminalId = async () => {
    try {
      await navigator.clipboard.writeText(terminalId);
      setMessage('Terminal ID copied to clipboard.');
    } catch {
      setMessage('Unable to copy Terminal ID.');
    }
  };


  const selectedPlanDetails = PLANS.find(p => p.id === selectedPlan);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.35em] text-slate-400">Subscription & Activation</p>
            <h1 className="text-4xl font-black tracking-tight">Billing Dashboard</h1>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/70 px-4 py-2 text-sm font-semibold transition hover:border-slate-500 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
        <p className="text-sm text-slate-300 max-w-2xl">Select a billing plan and activate your license to unlock inventory, sales, reports, and all POS features.</p>
      </header>

      <section className="rounded-[2rem] border border-slate-700/70 bg-slate-950/70 p-8 shadow-xl shadow-slate-950/20">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-100 mb-2">Current License Status</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Status</p>
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold mt-2 ${billingStatus?.active ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'}`}>
                {billingStatus?.active ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                {billingStatus?.active ? 'Active' : 'Inactive'}
              </div>
            </div>
            {billingStatus?.expiresAt && (
              <div className="text-right">
                <p className="text-sm text-slate-400">Expires</p>
                <p className="text-lg font-semibold text-slate-100 mt-1">{new Date(billingStatus.expiresAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-700/70 bg-slate-950/70 p-8 shadow-xl shadow-slate-950/20">
        <h2 className="text-2xl font-black tracking-tight mb-6">Choose Your Plan</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map(planOption => {
            const colorClasses = {
              slate: 'border-slate-600/60 hover:border-slate-400',
              blue: 'border-blue-600/60 hover:border-blue-400',
              purple: 'border-purple-600/60 hover:border-purple-400',
              emerald: 'border-emerald-600/60 hover:border-emerald-400',
              amber: 'border-amber-600/60 hover:border-amber-400',
              sky: 'border-sky-600/60 hover:border-sky-400',
            };

            const bgColorClasses = {
              slate: selectedPlan === planOption.id ? 'bg-slate-800/60' : 'bg-slate-900/40',
              blue: selectedPlan === planOption.id ? 'bg-blue-900/30' : 'bg-slate-900/40',
              purple: selectedPlan === planOption.id ? 'bg-purple-900/30' : 'bg-slate-900/40',
              emerald: selectedPlan === planOption.id ? 'bg-emerald-900/30' : 'bg-slate-900/40',
              amber: selectedPlan === planOption.id ? 'bg-amber-900/30' : 'bg-slate-900/40',
              sky: selectedPlan === planOption.id ? 'bg-sky-900/30' : 'bg-slate-900/40',
            };

            const ringClasses = {
              slate: selectedPlan === planOption.id ? 'ring-2 ring-slate-400/50' : '',
              blue: selectedPlan === planOption.id ? 'ring-2 ring-blue-400/50' : '',
              purple: selectedPlan === planOption.id ? 'ring-2 ring-purple-400/50' : '',
              emerald: selectedPlan === planOption.id ? 'ring-2 ring-emerald-400/50' : '',
              amber: selectedPlan === planOption.id ? 'ring-2 ring-amber-400/50' : '',
              sky: selectedPlan === planOption.id ? 'ring-2 ring-sky-400/50' : '',
            };

            return (
              <button
                key={planOption.id}
                type="button"
                onClick={() => setSelectedPlan(planOption.id)}
                className={`relative rounded-2xl border-2 p-6 text-left transition-all ${colorClasses[planOption.color as keyof typeof colorClasses]} ${bgColorClasses[planOption.color as keyof typeof bgColorClasses]} ${ringClasses[planOption.color as keyof typeof ringClasses]}`}
              >
                {selectedPlan === planOption.id && (
                  <div className="absolute top-3 right-3 inline-flex items-center justify-center w-5 h-5 bg-emerald-500 rounded-full">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <p className="text-sm font-semibold text-slate-300 mb-1">{planOption.duration}</p>
                <p className="text-2xl font-black text-slate-100">{planOption.label}</p>
                <p className="text-lg font-bold text-emerald-400 mt-3">{planOption.price}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-[2rem] border border-slate-700/70 bg-slate-950/70 p-8 shadow-xl shadow-slate-950/20">
          <h3 className="text-lg font-bold text-slate-100 mb-6">Activation Details</h3>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400 mb-3">Terminal ID</label>
              <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-4 text-sm text-slate-200 break-all font-mono">{terminalId}</div>
              <button
                type="button"
                onClick={copyTerminalId}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-xs font-semibold transition hover:border-slate-500"
              >
                <Copy className="w-4 h-4" />
                Copy terminal ID
              </button>
            </div>

            <div>
              <label htmlFor="licenseKey" className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400 mb-3">License Key</label>
              <input
                id="licenseKey"
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value)}
                placeholder="Enter your activation key from support"
                className="w-full rounded-3xl border border-slate-700/60 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-500/80"
              />
            </div>

            <button
              type="button"
              onClick={handleActivate}
              disabled={working || !selectedPlan}
              className="w-full inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-500 px-5 py-4 text-sm font-bold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              <Key className="w-5 h-5" />
              {selectedPlan ? 'Activate License' : 'Select a Plan First'}
            </button>

            <div className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-4 text-sm text-slate-300">
              <p>{message}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-700/70 bg-slate-950/70 p-8 shadow-xl shadow-slate-950/20">
          <h3 className="text-lg font-bold text-slate-100 mb-6">Order Summary</h3>

          {selectedPlanDetails ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-1">Plan</p>
                      <p className="text-xl font-bold text-slate-100">{selectedPlanDetails.label}</p>
                      <p className="text-sm text-slate-400 mt-1">{selectedPlanDetails.duration}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPlan(null)}
                      className="text-xs text-slate-400 hover:text-slate-100 transition"
                    >
                      Change
                    </button>
                  </div>

                  <div className="border-t border-slate-700/60 pt-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-slate-300">Plan cost</span>
                      <span className="font-semibold text-slate-100">{selectedPlanDetails.price}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-slate-400 mb-4">
                      <span>Setup fee</span>
                      <span>Free</span>
                    </div>
                    <div className="border-t border-slate-700/60 pt-4 flex justify-between items-center">
                      <span className="font-semibold text-slate-200">Total due</span>
                      <span className="text-2xl font-black text-emerald-400">{selectedPlanDetails.price}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6">
                <p className="text-sm text-slate-300">
                  Please complete payment through your preferred support channel. After payment, contact support directly to receive your activation key.
                </p>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400 mb-2">After Payment</p>
                  <p className="text-sm text-slate-200">Send your payment proof or reference to support. We will verify your payment and provide your activation key securely.</p>
                </div>
                <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  <p className="font-semibold">Support Notice</p>
                  <p className="mt-2">Do not share sensitive payment details publicly. Contact support through your private channel, and they will respond with the activation key.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/40 p-8 text-center">
              <p className="text-slate-400 text-sm">Select a plan above to view order details and checkout</p>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-[2rem] border border-slate-700/70 bg-slate-950/70 p-8 shadow-xl shadow-slate-950/20">
        <h3 className="text-lg font-bold text-slate-100 mb-6">Plan Features</h3>
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Full access to POS, inventory & sales</span>
          </div>
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Real-time stock tracking & alerts</span>
          </div>
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Email & SMS notifications</span>
          </div>
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Analytics & reports</span>
          </div>
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Customer management</span>
          </div>
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>Multi-user support</span>
          </div>
        </div>
      </section>

      <div className="rounded-[2rem] border border-slate-700/70 bg-slate-950/70 p-8 shadow-xl shadow-slate-950/20">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <ArrowRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
          <p>Once activated, inventory, orders, customers, reporting, and all POS features will become available immediately.</p>
        </div>
      </div>

      <section className="rounded-[2rem] border border-amber-500/30 bg-amber-500/10 p-8 shadow-xl shadow-amber-500/10">
        <h3 className="text-lg font-bold text-amber-200 mb-4">Developer Contact</h3>
        <div className="space-y-3 text-sm text-amber-100">
          <p className="font-semibold">Ezra Bosire</p>
          <p>Company: ConnectfyOne</p>
          <p>Email: <span className="text-cyan-200">ezra@connectfyone.com</span> / <span className="text-cyan-200">ezrabosire1@gmail.com</span></p>
          <p>Phone: <span className="text-cyan-200">+254 703 147 873</span></p>
          <p className="text-slate-300">For activation support, license issues, or product enquiries, contact the developer directly.</p>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-700/50 bg-slate-900/70 p-4">
      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}
