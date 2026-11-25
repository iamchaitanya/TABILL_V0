import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleSignInButton } from './GoogleSignInButton';
import type { SyncState, UserProfile } from './types';

interface ProfilePageProps {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accountEmail: string | null;
  accountAvatar: string | null;
  syncState: SyncState;
  syncMessage: string | null;
  lastSyncedAt: string | null;
  onSignIn: () => Promise<void> | void;
  onSignOut: () => Promise<void> | void;
  onSyncNow: () => Promise<void> | void;
}

const syncStatusLabel: Record<SyncState, string> = {
  'signed-out': 'Local only',
  idle: 'Ready',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync error',
};

type TextFieldKey =
  | 'name'
  | 'employeeId'
  | 'mobile'
  | 'email'
  | 'unit'
  | 'zi'
  | 'addressLine1'
  | 'addressLine2'
  | 'addressLine3'
  | 'designation'
  | 'basicPay'
  | 'accountNumber'
  | 'accountBranch';

const detailFields: Array<{
  key: TextFieldKey;
  label: string;
  placeholder: string;
  type?: string;
  large?: boolean;
}> = [
  { key: 'name', label: 'Name', placeholder: 'Enter name', large: true },
  { key: 'employeeId', label: 'Employee ID', placeholder: 'Enter employee ID' },
  { key: 'mobile', label: 'Mobile', placeholder: 'Enter mobile' },
  { key: 'email', label: 'Mail', placeholder: 'Enter email', type: 'email' },
  { key: 'unit', label: 'Unit', placeholder: 'Enter unit' },
  { key: 'zi', label: 'ZI', placeholder: 'Enter ZI' },
  { key: 'addressLine1', label: 'Address Line 1', placeholder: 'Enter address line 1' },
  { key: 'addressLine2', label: 'Address Line 2', placeholder: 'Enter address line 2' },
  { key: 'addressLine3', label: 'Address Line 3', placeholder: 'Enter address line 3' },
  { key: 'designation', label: 'Designation', placeholder: 'Enter designation' },
  { key: 'basicPay', label: 'Basic Pay', placeholder: 'Enter basic pay' },
  { key: 'accountNumber', label: 'Account Number', placeholder: 'Enter account number' },
  { key: 'accountBranch', label: 'Account Branch', placeholder: 'Enter account branch' },
];

const inputClass =
  'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 focus:ring-2 focus:ring-teal-500 focus:border-teal-400 outline-none text-slate-900 dark:text-slate-100 transition-colors';

export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  setProfile,
  fileInputRef,
  handleAvatarUpload,
  accountEmail,
  accountAvatar,
  syncState,
  syncMessage,
  lastSyncedAt,
  onSignIn,
  onSignOut,
  onSyncNow,
}) => {
  const [activeView, setActiveView] = useState<'details' | 'passwords'>('details');
  const [showPasswords, setShowPasswords] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Edits live in a draft until the user hits Save.
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [justSaved, setJustSaved] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(profile),
    [draft, profile],
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Pick up external updates (hydrate, cloud merge) unless there are unsaved edits.
  useEffect(() => {
    if (!isDirtyRef.current) setDraft(profile);
  }, [profile]);

  // A newly uploaded photo should show immediately, even with unsaved edits elsewhere.
  useEffect(() => {
    setDraft((d) => (d.avatar === profile.avatar ? d : { ...d, avatar: profile.avatar }));
  }, [profile.avatar]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2200);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const updateField = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setJustSaved(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const updateCredential = (id: string, field: 'label' | 'value', val: string) => {
    setJustSaved(false);
    setDraft((d) => ({
      ...d,
      credentialsUpdatedAt: new Date().toISOString(),
      credentials: d.credentials.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
    }));
  };

  const saveDraft = () => {
    if (!isDirty) return;
    setProfile(draft);
    setJustSaved(true);
  };

  const runAccountAction = async (fn: () => Promise<void> | void) => {
    setAccountError(null);
    setAccountBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setAccountError(e?.message || 'Something went wrong.');
    } finally {
      setAccountBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white dark:bg-slate-900 p-10 rounded-[40px] shadow-sm border border-teal-100 dark:border-slate-800 flex flex-col items-center transition-colors">
        {/* Avatar Section */}
        <div className="w-32 h-32 rounded-[40px] border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-xl overflow-hidden relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          {draft.avatar ? (
            <img src={draft.avatar} className="w-full h-full object-cover" alt="Avatar" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-black text-teal-200 dark:text-teal-900">
              {draft.name.charAt(0)}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-[10px] font-black uppercase tracking-widest">Change Photo</span>
          </div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />

        {/* Google account / cloud sync */}
        <div className="w-full mt-8 space-y-3">
          {accountEmail ? (
            <div className="rounded-2xl border border-teal-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {accountAvatar ? (
                  <img src={accountAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-black">
                    {accountEmail.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{accountEmail}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${syncState === 'error' ? 'bg-red-500' : syncState === 'syncing' ? 'bg-amber-400' : 'bg-teal-500'}`} />
                    {syncStatusLabel[syncState]}
                    {lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void runAccountAction(onSyncNow)}
                  disabled={accountBusy || syncState === 'syncing'}
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  Sync now
                </button>
                <button
                  onClick={() => void runAccountAction(onSignOut)}
                  disabled={accountBusy}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <GoogleSignInButton
              onError={(message) => setAccountError(message)}
              onRedirect={() => void runAccountAction(onSignIn)}
              fallback={
                <button
                  onClick={() => void runAccountAction(onSignIn)}
                  disabled={accountBusy}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md hover:border-teal-300 dark:hover:border-teal-600 transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 01-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0012 24z" />
                    <path fill="#FBBC05" d="M5.27 14.29a7.19 7.19 0 010-4.58V6.62H1.29a12 12 0 000 10.76l3.98-3.09z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.94 11.94 0 0012 0 11.99 11.99 0 001.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
                  </svg>
                  Sign in with Google
                </button>
              }
            />
          )}

          {syncMessage && (
            <p className={`text-[11px] font-bold text-center ${syncState === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
              {syncMessage}
            </p>
          )}
          {accountError && (
            <p className="text-[11px] font-bold text-center text-red-600">{accountError}</p>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex w-full mt-10 p-1 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
          <button
            onClick={() => setActiveView('details')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeView === 'details' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-teal-600'}`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveView('passwords')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeView === 'passwords' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-teal-600'}`}
          >
            Passwords
          </button>
        </div>

        <div className="w-full mt-10">
          {activeView === 'details' ? (
            /* Details Section */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between border-b border-teal-50 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">Profile Details</h3>
                <button
                  onClick={saveDraft}
                  disabled={!isDirty}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDirty ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}
                >
                  {justSaved ? 'Saved' : 'Save'}
                </button>
              </div>

              {detailFields.map((field) => (
                <div key={field.key}>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">{field.label}</label>
                  <input
                    type={field.type || 'text'}
                    className={`${inputClass} ${field.large ? 'text-lg font-black' : 'text-sm font-bold'}`}
                    value={draft[field.key]}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Passwords Section */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between border-b border-teal-50 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">Passwords & Security</h3>
                <div className="flex gap-2">
                  <button
                    onClick={saveDraft}
                    disabled={!isDirty}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDirty ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}
                  >
                    {justSaved ? 'Saved' : 'Save'}
                  </button>
                  <button
                    onClick={() => setShowPasswords(!showPasswords)}
                    title={showPasswords ? 'Hide Passwords' : 'View Passwords'}
                    className={`p-2 rounded-xl transition-all ${showPasswords ? 'bg-teal-900 dark:bg-teal-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                  >
                    {showPasswords ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {draft.credentials.map((cred) => (
                  <div key={cred.id} className="flex items-center gap-4">
                    <div className="w-1/3 min-w-[100px]">
                      <div className="w-full bg-slate-100 dark:bg-slate-800/50 border border-transparent rounded-xl text-[10px] font-black uppercase tracking-widest p-3 text-teal-900 dark:text-teal-400">
                        {cred.label}
                      </div>
                    </div>
                    <div className="flex-1">
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        placeholder={`Enter ${cred.label} details`}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm p-3 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400 transition-all text-slate-900 dark:text-slate-100"
                        value={cred.value}
                        onChange={(e) => updateCredential(cred.id, 'value', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Synced with your Google account.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
