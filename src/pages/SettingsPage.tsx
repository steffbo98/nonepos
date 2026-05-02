import React, { useEffect, useState } from 'react';
// import { addDoc, collection, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
// import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// import { db, auth, storage, handleFirestoreError, OperationType } from '../lib/firebase'; // Removed for desktop app
import { getDataService } from '../lib/dataService';
import { motion } from 'motion/react';
import {
  Globe,
  Bell,
  Shield,
  MessageSquare,
  Save,
  ExternalLink,
  Building2,
  Upload,
  Image as ImageIcon,
  X,
  ShieldAlert,
  UserPlus,
  UserCheck,
  UserX,
  RotateCcw,
  HardDrive,
  Mail,
} from 'lucide-react';
import { BUSINESS_TYPES, StorePurpose } from '../constants/businessTypes';
import { useUserProfile } from '../hooks/useUserProfile';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type BackupItem = { id: string; fileName: string; createdAt: string; sizeBytes: number };

export default function SettingsPage({
  themeMode,
  onThemeModeChange,
}: {
  themeMode: 'light' | 'dark';
  onThemeModeChange: (nextTheme: 'light' | 'dark') => void;
}) {
  const { isAdmin, loading: roleLoading } = useUserProfile();
  const dataService = getDataService();

  const [language, setLanguage] = useState('English (KE)');
  const [currency, setCurrency] = useState('KES');
  const [notifications, setNotifications] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailReceiptsEnabled, setEmailReceiptsEnabled] = useState(false);
  const [receiptFromEmail, setReceiptFromEmail] = useState('');
  const [emailTransportMode, setEmailTransportMode] = useState<'smtp' | 'brevo' | 'direct' | 'brevo-api'>('brevo-api');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [brevoTemplateId, setBrevoTemplateId] = useState('');
  const [brevoTemplateHtml, setBrevoTemplateHtml] = useState('');
  const [emailSubject, setEmailSubject] = useState('Your receipt from OmniSync POS');
  const [ownerAlertsEnabled, setOwnerAlertsEnabled] = useState(true);
  const [ownerEmailRecipients, setOwnerEmailRecipients] = useState('');
  const [whatsappAlertsEnabled, setWhatsappAlertsEnabled] = useState(true);
  const [whatsappApiUrl, setWhatsappApiUrl] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [whatsappKeyHeader, setWhatsappKeyHeader] = useState('Authorization');
  const [whatsappSender, setWhatsappSender] = useState('');
  const [whatsappRecipients, setWhatsappRecipients] = useState('');
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(true);
  const [smsApiUrl, setSmsApiUrl] = useState('');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsKeyHeader, setSmsKeyHeader] = useState('Authorization');
  const [smsSender, setSmsSender] = useState('');
  const [smsRecipients, setSmsRecipients] = useState('');
  const [smsPayloadTemplate, setSmsPayloadTemplate] = useState('{"to":"%to%","from":"%from%","body":"%message%"}');
  const [lowStockAlertThreshold, setLowStockAlertThreshold] = useState('10');

  // Backup / Restore State (Admin)
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupCreating, setBackupCreating] = useState(false);
  const [backupRestoringId, setBackupRestoringId] = useState<string | null>(null);
  const [backupUiError, setBackupUiError] = useState<string | null>(null);
  const [backupUiSuccess, setBackupUiSuccess] = useState<string | null>(null);

  // Business Profile State
  const [businessName, setBusinessName] = useState('OMNISYNC POS');
  const [businessAddress, setBusinessAddress] = useState('Westlands Commercial Center, Nairobi');
  const [businessPIN, setBusinessPIN] = useState('P051234567Z');
  const [businessPhone, setBusinessPhone] = useState('+254 700 000 000');
  const [businessType, setBusinessType] = useState<StorePurpose>('Retail Shop');
  const [businessLogo, setBusinessLogo] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'staff'>('staff');
  const [newUserName, setNewUserName] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    const fetchSettings = async () => {
      try {
        const setting = await dataService.getSetting('business');
        if (setting?.value) {
          const data = JSON.parse(setting.value);
          setBusinessName(data.name || 'OMNISYNC POS');
          setBusinessAddress(data.address || 'Westlands Commercial Center, Nairobi');
          setBusinessPIN(data.pin || 'P051234567Z');
          setBusinessPhone(data.phone || '+254 700 000 000');
          setBusinessType(data.type || 'Retail Shop');
          setBusinessLogo(data.logoUrl || '');
        }

        const emailSetting = await dataService.getSetting('emailReceipts');
        if (emailSetting?.value) {
          const emailData = JSON.parse(emailSetting.value);
          setEmailReceiptsEnabled(Boolean(emailData.enabled));
          setReceiptFromEmail(emailData.fromEmail || '');
          setEmailTransportMode(emailData.transportMode || 'brevo-api');
          setSmtpHost(emailData.smtpHost || '');
          setSmtpPort(String(emailData.smtpPort || '587'));
          setSmtpSecure(Boolean(emailData.smtpSecure));
          setSmtpUser(emailData.smtpUser || '');
          setSmtpPass(emailData.smtpPass || '');
          setBrevoApiKey(emailData.brevoApiKey || '');
          setBrevoTemplateId(emailData.brevoTemplateId || '');
          setBrevoTemplateHtml(emailData.brevoTemplateHtml || '');
          setEmailSubject(emailData.subject || 'Your receipt from OmniSync POS');
        }

        const ownerSetting = await dataService.getSetting('ownerNotifications');
        if (ownerSetting?.value) {
          const ownerData = JSON.parse(ownerSetting.value);
          setOwnerAlertsEnabled(Boolean(ownerData.enabled));
          setOwnerEmailRecipients((ownerData.email?.recipients || []).join(', '));
          setWhatsappAlertsEnabled(Boolean(ownerData.whatsapp?.enabled));
          setWhatsappApiUrl(ownerData.whatsapp?.apiUrl || '');
          setWhatsappApiKey(ownerData.whatsapp?.apiKey || '');
          setWhatsappKeyHeader(ownerData.whatsapp?.keyHeaderName || 'Authorization');
          setWhatsappSender(ownerData.whatsapp?.sender || '');
          setWhatsappRecipients((ownerData.whatsapp?.recipients || []).join(', '));
          setSmsAlertsEnabled(Boolean(ownerData.sms?.enabled));
          setSmsApiUrl(ownerData.sms?.apiUrl || '');
          setSmsApiKey(ownerData.sms?.apiKey || '');
          setSmsKeyHeader(ownerData.sms?.keyHeaderName || 'Authorization');
          setSmsSender(ownerData.sms?.sender || '');
          setSmsRecipients((ownerData.sms?.recipients || []).join(', '));
          setSmsPayloadTemplate(ownerData.sms?.payloadTemplate || '{"to":"%to%","from":"%from%","body":"%message%"}');
          setLowStockAlertThreshold(String(ownerData.lowStockThreshold ?? 10));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    const fetchUsers = async () => {
      try {
        const team = await dataService.listUsers();
        setUsers(team);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };

    fetchSettings();
    fetchUsers();
  }, [isAdmin, dataService]);

  const updateThemeMode = (nextTheme: 'light' | 'dark') => {
    onThemeModeChange(nextTheme);
  };

  const refreshBackups = async () => {
    setBackupUiError(null);
    setBackupUiSuccess(null);
    setBackupsLoading(true);
    try {
      const list = await dataService.listBackups();
      setBackups(list);
    } catch (error) {
      console.error('Failed to list backups:', error);
      setBackupUiError(error instanceof Error ? error.message : 'Failed to list backups');
    } finally {
      setBackupsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void refreshBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName || !newUserPassword) return;
    try {
      const response = await dataService.registerUser({
        fullName: newUserName,
        email: newUserEmail.toLowerCase().trim(),
        password: newUserPassword,
      });
      const createdUser = response.user;
      const updatedUser = await dataService.updateUser(createdUser.id, { role: newUserRole });
      setUsers(prev => [updatedUser, ...prev]);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
    } catch (error) {
      console.error('Failed to add user:', error);
      alert(error instanceof Error ? error.message : 'Failed to add user');
    }
  };

  const toggleUserStatus = async (user: any) => {
    try {
      const updated = await dataService.updateUser(user.id, {
        active: !user.active,
      });
      setUsers(prev => prev.map(item => (item.id === user.id ? updated : item)));
    } catch (error) {
      console.error('Failed to update user:', error);
      alert(error instanceof Error ? error.message : 'Failed to update user');
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await dataService.setSetting('business', {
        name: businessName,
        address: businessAddress,
        pin: businessPIN,
        phone: businessPhone,
        type: businessType,
        logoUrl: businessLogo,
      });

      await dataService.setSetting('emailReceipts', {
        enabled: emailReceiptsEnabled,
        fromEmail: receiptFromEmail,
        transportMode: emailTransportMode,
        smtpHost,
        smtpPort: Number(smtpPort || '587'),
        smtpSecure,
        smtpUser,
        smtpPass,
        brevoApiKey,
        brevoTemplateId,
        brevoTemplateHtml,
        subject: emailSubject,
      });

      await dataService.setSetting('ownerNotifications', {
        enabled: ownerAlertsEnabled,
        email: {
          enabled: true,
          recipients: ownerEmailRecipients.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean),
        },
        whatsapp: {
          enabled: whatsappAlertsEnabled,
          apiUrl: whatsappApiUrl,
          apiKey: whatsappApiKey,
          keyHeaderName: whatsappKeyHeader,
          sender: whatsappSender,
          recipients: whatsappRecipients.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean),
          contentType: 'application/json',
          payloadTemplate: '{"to":"%to%","from":"%from%","body":"%message%"}',
        },
        sms: {
          enabled: smsAlertsEnabled,
          apiUrl: smsApiUrl,
          apiKey: smsApiKey,
          keyHeaderName: smsKeyHeader,
          sender: smsSender,
          recipients: smsRecipients.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean),
          contentType: 'application/json',
          payloadTemplate: smsPayloadTemplate,
        },
        lowStockThreshold: Number(lowStockAlertThreshold || '10'),
      });

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setBusinessLogo(dataUrl);
    } catch (error) {
      console.error('Logo upload failed', error);
      alert('Failed to load logo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    try {
      setFeedback('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const handleCreateBackup = async () => {
    if (backupCreating) return;
    setBackupUiError(null);
    setBackupUiSuccess(null);
    setBackupCreating(true);
    try {
      await dataService.createBackup();
      setBackupUiSuccess('Backup created successfully.');
      await refreshBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
      setBackupUiError(error instanceof Error ? error.message : 'Failed to create backup');
    } finally {
      setBackupCreating(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (backupRestoringId) return;
    if (!backupId) return;

    const ok = window.confirm(
      'Restore this backup?\n\nThis will overwrite the current local database on this computer.'
    );
    if (!ok) return;

    setBackupUiError(null);
    setBackupUiSuccess(null);
    setBackupRestoringId(backupId);

    try {
      await dataService.restoreBackup(backupId);
      setBackupUiSuccess('Restore completed. Reloading…');
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error('Failed to restore backup:', error);
      setBackupUiError(error instanceof Error ? error.message : 'Failed to restore backup');
    } finally {
      setBackupRestoringId(null);
    }
  };

  if (!roleLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 panel rounded-[2rem] border border-dashed border-slate-700/80 text-center">
        <ShieldAlert className="w-16 h-16 mb-6 opacity-20" />
        <h2 className="text-2xl font-black tracking-tighter uppercase mb-2">Restricted Access</h2>
        <p className="text-sm font-mono text-slate-300 max-w-sm">System configuration is reserved for administrative personnel only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <header>
        <h1 className="text-4xl font-black tracking-tighter">POS Configuration</h1>
        <p className="text-[11px] font-mono text-slate-300 tracking-widest mt-1">Regional preferences, appearance, and backups</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Business Profile */}
        <Section title="Business Profile" icon={<Building2 className="w-5 h-5" />}>
          <div className="space-y-6">
            {/* Logo Section */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono font-semibold tracking-widest uppercase text-slate-300">Business Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-slate-950 border border-dashed border-slate-700/80 flex items-center justify-center relative overflow-hidden group">
                  {businessLogo ? (
                    <>
                      <img src={businessLogo} alt="Logo" className="w-full h-full object-contain" />
                      <button
                        onClick={() => setBusinessLogo('')}
                        className="absolute top-1 right-1 bg-slate-900 p-1 border border-slate-700/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-8 h-8 opacity-10" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full"
                      />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer bg-slate-950 border border-slate-700/80 px-4 py-2 text-[10px] font-bold tracking-widest hover:bg-slate-900 transition-colors flex items-center gap-2 rounded-3xl">
                  <Upload className="w-3 h-3" />
                  {businessLogo ? 'CHANGE LOGO' : 'UPLOAD LOGO'}
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              </div>
            </div>

            <Input label="Store / Business Name" value={businessName} onChange={setBusinessName} />
            <Select
              label="Business Type (Store Purpose)"
              value={businessType}
              options={Object.keys(BUSINESS_TYPES)}
              onChange={(v: StorePurpose) => setBusinessType(v)}
            />
            <Input label="Physical Address" value={businessAddress} onChange={setBusinessAddress} />
            <Input label="KRA PIN Number" value={businessPIN} onChange={setBusinessPIN} />
            <Input label="Business Phone" value={businessPhone} onChange={setBusinessPhone} />
          </div>
        </Section>

        {/* Regional Settings */}
        <Section title="Regional Settings" icon={<Globe className="w-5 h-5" />}>
          <div className="space-y-4">
            <Select
              label="System Language"
              value={language}
              options={['English (KE)', 'Swahili', 'Luo', 'Kikuyu', 'Other']}
              onChange={setLanguage}
            />
            <Select
              label="Base Currency"
              value={currency}
              options={['KES', 'USD', 'EUR', 'UGX', 'TZS']}
              onChange={setCurrency}
            />
            <div className="rounded-3xl border border-slate-700/50 bg-slate-950/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">App Theme</p>
                  <p className="text-sm text-slate-200">Switch between light and dark mode in the desktop app.</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-900/80 p-1">
                  <button
                    type="button"
                    onClick={() => updateThemeMode('light')}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                      themeMode === 'light'
                        ? 'bg-slate-100 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => updateThemeMode('dark')}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                      themeMode === 'dark'
                        ? 'bg-slate-100/10 text-slate-50 shadow-sm'
                        : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* M-PESA API */}
        <Section title="M-Pesa Integration" icon={<MessageSquare className="w-5 h-5" />}>
          <div className="space-y-4">
            <div className="p-3 bg-emerald-950/30 border border-emerald-700/50 rounded">
              <p className="text-[9px] font-mono text-emerald-800 font-black">Daraja API Status: Connected</p>
            </div>
            <Input label="Shortcode (Paybill/Till)" value="778899" />
            <Input label="Consumer Key" value="********" />
            <Input label="Consumer Secret" value="********" />
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Smart Alerts" icon={<Bell className="w-5 h-5" />}>
          <div className="space-y-6">
            <Toggle label="SMS Customer Receipts" active={notifications} onToggle={() => setNotifications(!notifications)} />
            <Toggle label="Low Stock SMS Alerts" active={true} onToggle={() => {}} />
            <Toggle label="Daily Revenue Email" active={true} onToggle={() => {}} />
          </div>
        </Section>

        <Section title="Owner Alerts" icon={<Shield className="w-5 h-5" />}>
          <div className="space-y-4">
            <Toggle
              label="Enable owner email + WhatsApp alerts"
              active={ownerAlertsEnabled}
              onToggle={() => setOwnerAlertsEnabled(prev => !prev)}
            />
            <Input
              label="Owner email recipients"
              value={ownerEmailRecipients}
              onChange={setOwnerEmailRecipients}
              placeholder="owner@example.com, manager@example.com"
            />
            <div className="rounded-3xl border border-slate-700/50 bg-slate-950/60 p-4 space-y-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">WhatsApp API</p>
              <Input
                label="WhatsApp API URL"
                value={whatsappApiUrl}
                onChange={setWhatsappApiUrl}
                placeholder="https://api.provider.com/v1/messages"
              />
              <Input
                label="WhatsApp API Key"
                type="password"
                value={whatsappApiKey}
                onChange={setWhatsappApiKey}
              />
              <Input
                label="API Key Header"
                value={whatsappKeyHeader}
                onChange={setWhatsappKeyHeader}
                placeholder="Authorization"
              />
              <Input
                label="WhatsApp sender ID"
                value={whatsappSender}
                onChange={setWhatsappSender}
                placeholder="whatsapp:+254700000000"
              />
              <Input
                label="WhatsApp recipients"
                value={whatsappRecipients}
                onChange={setWhatsappRecipients}
                placeholder="whatsapp:+254700000000, whatsapp:+254711000000"
              />
              <div className="rounded-3xl border border-slate-700/50 bg-slate-950/60 p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">SMS API</p>
                    <p className="text-[10px] text-slate-500">Use SMS for owner alerts and customer invoice delivery.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmsAlertsEnabled(prev => !prev)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${smsAlertsEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-100'}`}
                  >
                    {smsAlertsEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <Input
                  label="SMS API URL"
                  value={smsApiUrl}
                  onChange={setSmsApiUrl}
                  placeholder="https://api.provider.com/v1/messages"
                />
                <Input
                  label="SMS API Key"
                  type="password"
                  value={smsApiKey}
                  onChange={setSmsApiKey}
                />
                <Input
                  label="API Key Header"
                  value={smsKeyHeader}
                  onChange={setSmsKeyHeader}
                  placeholder="Authorization"
                />
                <Input
                  label="SMS sender ID"
                  value={smsSender}
                  onChange={setSmsSender}
                  placeholder="+254700000000"
                />
                <Input
                  label="SMS recipients"
                  value={smsRecipients}
                  onChange={setSmsRecipients}
                  placeholder="+254700000000, +254711000000"
                />
                <Input
                  label="SMS payload template"
                  value={smsPayloadTemplate}
                  onChange={setSmsPayloadTemplate}
                  placeholder='{"to":"%to%","from":"%from%","body":"%message%"}'
                />
                <p className="text-[10px] font-mono text-slate-400">
                  Owner and invoice SMS use the configured SMS provider template. Use %to%, %from%, and %message% placeholders.
                </p>
              </div>
              <Input
                label="Low stock alert threshold"
                type="number"
                value={lowStockAlertThreshold}
                onChange={setLowStockAlertThreshold}
              />
              <p className="text-[10px] font-mono text-slate-400">
                Owner alerts will be delivered by email, WhatsApp, and SMS when configured. Use this section to configure your messaging providers and recipients.
              </p>
            </div>
          </div>
        </Section>

        {/* Email Receipt Settings */}
        <Section title="Email Receipts" icon={<Mail className="w-5 h-5" />}>
          <div className="space-y-4">
            <Toggle
              label="Enable Email Receipts"
              active={emailReceiptsEnabled}
              onToggle={() => setEmailReceiptsEnabled(prev => !prev)}
            />
            <div className="rounded-3xl border border-slate-700/50 bg-slate-950/60 p-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Mailer Mode</p>
              <div className="inline-flex rounded-3xl border border-slate-700/80 bg-slate-900/80 p-1">
                <button
                  type="button"
                  onClick={() => setEmailTransportMode('smtp')}
                  className={`rounded-3xl px-4 py-2 text-xs font-bold transition ${emailTransportMode === 'smtp' ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:text-slate-100'}`}
                >
                  SMTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailTransportMode('brevo');
                    if (!smtpHost) setSmtpHost('smtp-relay.brevo.com');
                    if (!smtpPort) setSmtpPort('587');
                    setSmtpSecure(false);
                  }}
                  className={`rounded-3xl px-4 py-2 text-xs font-bold transition ${emailTransportMode === 'brevo' ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:text-slate-100'}`}
                >
                  Brevo SMTP
                </button>
                <button
                  type="button"
                  onClick={() => setEmailTransportMode('brevo-api')}
                  className={`rounded-3xl px-4 py-2 text-xs font-bold transition ${emailTransportMode === 'brevo-api' ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:text-slate-100'}`}
                >
                  Brevo API
                </button>
                <button
                  type="button"
                  onClick={() => setEmailTransportMode('direct')}
                  className={`rounded-3xl px-4 py-2 text-xs font-bold transition ${emailTransportMode === 'direct' ? 'bg-slate-100 text-slate-950' : 'text-slate-300 hover:text-slate-100'}`}
                >
                  Built-in Nodemailer
                </button>
              </div>
              <p className="mt-3 text-[10px] font-mono text-slate-300">
                {emailTransportMode === 'brevo-api'
                  ? 'Use Brevo Send via HTTP API. Enter your Brevo API key and optional template ID for branded receipts.'
                  : emailTransportMode === 'brevo'
                  ? 'Use Brevo Send via Brevo SMTP relay. Enter your Brevo SMTP username/password and sender email.'
                  : emailTransportMode === 'direct'
                  ? 'Use Nodemailer direct delivery with only a sender email. This may still depend on network and mail server acceptance.'
                  : 'Use a custom SMTP provider when you need a trusted mail relay.'}
              </p>
            </div>
            <Input
              label="From Email Address"
              type="email"
              value={receiptFromEmail}
              onChange={setReceiptFromEmail}
            />
            {emailTransportMode === 'brevo-api' && (
              <>
                <Input
                  label="Brevo API Key"
                  type="password"
                  value={brevoApiKey}
                  onChange={setBrevoApiKey}
                />
                <Input
                  label="Brevo Template ID (Optional)"
                  type="number"
                  value={brevoTemplateId}
                  onChange={setBrevoTemplateId}
                  placeholder="Leave empty to use built-in or custom HTML"
                />
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono font-semibold tracking-widest text-slate-300">
                    Brevo HTML Template (Optional)
                  </label>
                  <textarea
                    value={brevoTemplateHtml}
                    onChange={e => setBrevoTemplateHtml(e.target.value)}
                    placeholder="Paste your Brevo email HTML template here. Leave empty to use the built-in receipt design."
                    className="w-full min-h-[160px] rounded-3xl bg-slate-950/80 border border-slate-700/80 px-4 py-3 text-xs font-mono text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10 transition-all"
                  />
                  <p className="text-[10px] font-mono text-slate-400">
                    Use this field to store a custom HTML template for Brevo API delivery. If a Template ID is provided, that template will be used instead.
                  </p>
                </div>
              </>
            )}
            {emailTransportMode !== 'direct' && emailTransportMode !== 'brevo-api' && (
              <>
                <Input
                  label="SMTP Host"
                  value={smtpHost}
                  onChange={setSmtpHost}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="SMTP Port"
                    type="number"
                    value={smtpPort}
                    onChange={setSmtpPort}
                  />
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono font-semibold tracking-widest text-slate-300">Secure Connection</label>
                    <button
                      type="button"
                      onClick={() => setSmtpSecure(prev => !prev)}
                      className={`inline-flex h-10 items-center justify-center rounded-2xl px-4 text-xs font-bold transition ${smtpSecure ? 'bg-cyan-400 text-slate-950' : 'bg-slate-900 text-slate-100'}`}
                    >
                      {smtpSecure ? 'TLS / SSL' : 'No TLS'}
                    </button>
                  </div>
                </div>
                <Input label="SMTP Username" value={smtpUser} onChange={setSmtpUser} />
                <Input label="SMTP Password" type="password" value={smtpPass} onChange={setSmtpPass} />
              </>
            )}
            {emailTransportMode === 'direct' && (
              <p className="text-[10px] font-mono text-slate-300">No SMTP host or credentials are required for direct Nodemailer delivery.</p>
            )}
            <Input label="Email Subject" value={emailSubject} onChange={setEmailSubject} />
            <p className="text-[10px] font-mono text-slate-300">When enabled, the POS will send the receipt to the customer email saved on the customer profile after checkout.</p>
          </div>
        </Section>

        {/* Integration */}
        <Section title="Accounting Software" icon={<ExternalLink className="w-5 h-5" />}>
          <div className="space-y-4">
            <p className="text-[10px] font-mono opacity-60 leading-relaxed">Export-ready settings for regional tax and accounting workflows.</p>
            <button className="w-full flex items-center justify-between p-4 bg-slate-950 border border-slate-700/80 hover:border-cyan-400/60 transition-all rounded-3xl">
              <span className="font-bold text-xs text-emerald-400">iTax KRA Connector</span>
              <span className="text-[9px] font-mono text-slate-300">Active</span>
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-slate-950 border border-slate-700/80 hover:border-cyan-400/60 transition-all rounded-3xl">
              <span className="font-bold text-xs">QuickBooks Online</span>
              <span className="text-[9px] font-mono text-amber-400 font-bold">Planned</span>
            </button>
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Team Management */}
        <Section title="Team Management" icon={<UserPlus className="w-5 h-5" />}>
          <div className="space-y-6">
            <form onSubmit={handleAddUser} className="space-y-4 bg-slate-950 border border-slate-700/80 p-4 rounded-[2rem]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-300 mb-2">Add Team Member</p>
              <Input label="Staff Name" value={newUserName} onChange={setNewUserName} />
              <Input label="Email Address" value={newUserEmail} onChange={setNewUserEmail} />
              <Input label="Temporary Password" type="password" value={newUserPassword} onChange={setNewUserPassword} />
              <Select label="Assigned Role" value={newUserRole} options={['staff', 'admin']} onChange={setNewUserRole} />
              <button
                type="submit"
                className="w-full rounded-3xl bg-slate-900/80 border border-slate-700/80 text-slate-100 py-3 font-bold text-[10px] tracking-widest uppercase hover:bg-slate-900 transition-all"
              >
                Authorize User
              </button>
            </form>

            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Active Team</p>
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 border border-slate-700/80 group hover:border-cyan-400/60 transition-colors rounded-3xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-800 flex items-center justify-center font-bold text-xs uppercase text-slate-100">
                      {u.fullName?.charAt(0) || u.email?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold">{u.fullName}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[8px] font-bold uppercase px-1 py-0.5',
                            u.role === 'admin' ? 'bg-black text-white' : 'bg-slate-800 text-slate-300'
                          )}
                        >
                          {u.role}
                        </span>
                        <span className="text-[8px] font-mono text-slate-300">{u.email}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleUserStatus(u)}
                    className={cn(
                      'p-2 transition-colors',
                      u.active ? 'text-emerald-600 hover:text-red-600' : 'text-red-300 hover:text-emerald-600'
                    )}
                    title={u.active ? 'Deactivate User' : 'Activate User'}
                  >
                    {u.active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Backup / Restore */}
        <Section title="Backup & Restore" icon={<HardDrive className="w-5 h-5" />}>
          <div className="space-y-4">
            {backupUiError && (
              <div className="p-3 bg-red-950/40 border border-red-700/50 text-red-300 text-[10px] font-mono rounded">
                {backupUiError}
              </div>
            )}
            {backupUiSuccess && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-700/50 text-emerald-300 text-[10px] font-mono rounded">
                {backupUiSuccess}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={backupCreating}
              className="w-full rounded-3xl bg-slate-900/80 border border-slate-700/80 text-slate-100 py-3 font-bold tracking-widest text-xs hover:bg-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {backupCreating ? (
                <span className="inline-block w-2 h-2 rounded-full border border-slate-500/40 border-t-slate-200 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Create Backup
            </button>

            <div className="space-y-3 pt-2 border-t border-slate-700/80">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Saved Backups</p>

              {backupsLoading ? (
                <p className="text-[10px] font-mono text-slate-300">Loading backups…</p>
              ) : backups.length === 0 ? (
                <p className="text-[10px] font-mono text-slate-300">No backups found yet.</p>
              ) : (
                <div className="space-y-2">
                  {backups.map(b => (
                    <div key={b.id} className="flex items-start justify-between gap-4 p-3 border border-slate-700/80 hover:border-cyan-400/60 transition-colors rounded-3xl bg-slate-950">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold truncate">{b.fileName}</p>
                        <p className="text-[9px] font-mono opacity-60 break-all">{new Date(b.createdAt).toLocaleString('en-KE')}</p>
                        <p className="text-[9px] font-mono opacity-60">{formatBytes(b.sizeBytes)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRestoreBackup(b.id)}
                        disabled={backupRestoringId === b.id}
                        className={cn(
                          'shrink-0 px-3 py-2 border rounded text-[10px] font-bold tracking-widest uppercase transition-colors',
                          backupRestoringId === b.id
                            ? 'opacity-50 cursor-not-allowed border-amber-200 text-amber-500'
                            : 'border-amber-200 text-amber-500 hover:bg-amber-950/30'
                        )}
                        title="Restore this backup"
                      >
                        <span className="inline-flex items-center gap-2">
                          <RotateCcw className="w-4 h-4" />
                          {backupRestoringId === b.id ? 'Restoring…' : 'Restore'}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[9px] font-mono opacity-60 leading-relaxed">
              Tip: Create backups before major changes. Restoring overwrites the current local database file.
            </p>
          </div>
        </Section>

        {/* Feedback Section */}
        <Section title="Submit Feedback" icon={<MessageSquare className="w-5 h-5" />}>
          <form onSubmit={handleFeedback} className="space-y-4">
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="How can we improve OmniSync?"
              className="w-full min-h-[100px] p-4 bg-slate-950 border border-slate-700/80 outline-none focus:border-cyan-400 text-xs font-medium resize-none text-slate-100"
            />
            <button type="submit" className="w-full rounded-3xl bg-slate-900/80 border border-slate-700/80 text-slate-100 py-3 font-bold tracking-widest text-xs hover:bg-slate-900 transition-all">
              {submitted ? 'Feedback Sent' : 'Send Feedback'}
            </button>
          </form>
        </Section>

        {/* Support Section */}
        <Section title="System Status" icon={<Shield className="w-5 h-5" />}>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs font-bold">
              <span>Local Database</span>
              <span className="text-emerald-600">Operational</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span>M-Pesa Gateway</span>
              <span className="text-emerald-600">Operational</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span>Cloud Backup</span>
              <span className="text-amber-600">Not configured</span>
            </div>
          </div>
        </Section>

        <Section title="Developer Contact" icon={<Mail className="w-5 h-5" />}>
          <div className="space-y-3 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Ezra Bosire</p>
            <p>Company: ConnectfyOne</p>
            <p>Email: <span className="text-cyan-300">ezra@connectfyone.com</span></p>
            <p>Alternate email: <span className="text-cyan-300">ezrabosire1@gmail.com</span></p>
            <p>Phone: <span className="text-cyan-300">+254 703 147 873</span></p>
            <p className="text-[11px] text-slate-400">Use this contact if you need activation support, billing help, or any developer assistance.</p>
          </div>
        </Section>
      </div>

      <div className="pt-12 border-t border-slate-700/80">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="rounded-3xl bg-slate-900/80 border border-slate-700/80 text-slate-100 px-12 py-4 font-black text-sm tracking-widest flex items-center gap-2 hover:bg-slate-900 transition-all disabled:opacity-50"
        >
          {saving ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 border-2 border-slate-500/40 border-t-slate-200 rounded-full"
            />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Save Global Settings
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: any) {
  return (
    <div className="glass-card rounded-[2rem] border border-slate-700/50 p-8 relative overflow-hidden shadow-panel">
      <div className="absolute top-0 left-0 w-full h-1 bg-slate-100/10" />
      <header className="flex items-center gap-3 mb-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-slate-900/70 border border-slate-700/50 text-cyan-300">
          {icon}
        </div>
        <h3 className="font-bold tracking-widest text-sm text-slate-100">{title}</h3>
      </header>
      {children}
    </div>
  );
}

function Select({ label, value, options, onChange }: any) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-mono font-semibold tracking-widest text-slate-300">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl bg-slate-950/80 border border-slate-700/80 px-4 py-3 text-xs font-bold text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10 transition-all"
      >
        {options.map((opt: string) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, active, onToggle }: any) {
  return (
    <div className="flex items-center justify-between rounded-3xl border border-slate-700/50 bg-slate-950/70 px-4 py-3">
      <span className="text-xs font-bold tracking-tight text-slate-100">{label}</span>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-8 w-16 items-center rounded-full p-1 transition ${
          active ? 'bg-cyan-400/20' : 'bg-slate-800/80'
        }`}
        aria-label={label}
      >
        <span className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-slate-200 shadow-sm transition-all ${active ? 'translate-x-8 bg-cyan-300' : 'translate-x-0 bg-slate-600'}`} />
      </button>
    </div>
  );
}

function Input({ label, type = 'text', value, onChange = () => {} }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono font-semibold tracking-widest text-slate-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-2xl px-4 py-3 bg-slate-950/80 border border-slate-700/80 text-xs font-bold text-slate-100 outline-none focus:border-cyan-400 focus:bg-slate-950/95 focus:ring-2 focus:ring-cyan-400/10 transition-all"
      />
    </div>
  );
}
