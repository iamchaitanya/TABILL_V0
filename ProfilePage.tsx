
import React, { useState } from 'react';
import { UserProfile, TourData, CredentialItem } from './types';
import { generateId } from './utils';

interface ProfilePageProps {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  data: TourData;
  setData: (d: TourData) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  setProfile,
  data,
  setData,
  fileInputRef,
  handleAvatarUpload,
}) => {
  const [activeView, setActiveView] = useState<'details' | 'passwords'>('details');
  const [isLocked, setIsLocked] = useState(true);
  const [showPasswords, setShowPasswords] = useState(false);

  const updateCredential = (id: string, field: 'label' | 'value', val: string) => {
    if (isLocked) return;
    setProfile({
      ...profile,
      credentials: profile.credentials.map(c => c.id === id ? { ...c, [field]: val } : c)
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white dark:bg-slate-900 p-10 rounded-[40px] shadow-sm border border-teal-100 dark:border-slate-800 flex flex-col items-center transition-colors">
        {/* Avatar Section */}
        <div className="w-32 h-32 rounded-[40px] border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-xl overflow-hidden relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          {profile.avatar ? (
            <img src={profile.avatar} className="w-full h-full object-cover" alt="Avatar" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl font-black text-teal-200 dark:text-teal-900">
              {profile.name.charAt(0)}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-[10px] font-black uppercase tracking-widest">Change Photo</span>
          </div>
        </div>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />

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
              <h3 className="text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest border-b border-teal-50 dark:border-slate-800 pb-2">Profile Details</h3>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Name</label>
                <input 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black p-4 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-slate-100 transition-colors" 
                  value={profile.name} 
                  onChange={e => setProfile({...profile, name: e.target.value})} 
                  placeholder="Enter name"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Employee ID</label>
                <input 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold p-4 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-slate-100 transition-colors" 
                  value={profile.employeeId} 
                  onChange={e => setProfile({...profile, employeeId: e.target.value})} 
                  placeholder="Enter employee ID"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Mobile</label>
                <input 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold p-4 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-slate-100 transition-colors" 
                  value={profile.mobile} 
                  onChange={e => setProfile({...profile, mobile: e.target.value})} 
                  placeholder="Enter mobile"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Mail</label>
                <input 
                  type="email"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold p-4 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-slate-100 transition-colors" 
                  value={profile.email} 
                  onChange={e => setProfile({...profile, email: e.target.value})} 
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Unit</label>
                <input 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold p-4 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-slate-100 transition-colors" 
                  value={profile.unit} 
                  onChange={e => setProfile({...profile, unit: e.target.value})} 
                  placeholder="Enter unit"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">ZI</label>
                <input 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold p-4 focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 dark:text-slate-100 transition-colors" 
                  value={profile.zi} 
                  onChange={e => setProfile({...profile, zi: e.target.value})} 
                  placeholder="Enter ZI"
                />
              </div>
            </div>
          ) : (
            /* Passwords Section */
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between border-b border-teal-50 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">Passwords & Security</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsLocked(!isLocked)}
                    title={isLocked ? "Unlock to edit" : "Lock to save"}
                    className={`p-2 rounded-xl transition-all ${isLocked ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' : 'bg-teal-900 dark:bg-teal-600 text-white shadow-lg'}`}
                  >
                    {isLocked ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <button 
                    onClick={() => setShowPasswords(!showPasswords)}
                    title={showPasswords ? "Hide Passwords" : "View Passwords"}
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
                {profile.credentials.map((cred) => (
                  <div key={cred.id} className="flex items-center gap-4">
                    <div className="w-1/3 min-w-[100px]">
                      <div className="w-full bg-slate-100 dark:bg-slate-800/50 border border-transparent rounded-xl text-[10px] font-black uppercase tracking-widest p-3 text-teal-900 dark:text-teal-400">
                        {cred.label}
                      </div>
                    </div>
                    <div className="flex-1">
                      <input 
                        type={showPasswords ? "text" : "password"}
                        placeholder={isLocked ? "••••••••" : `Enter ${cred.label} details`}
                        readOnly={isLocked}
                        className={`w-full bg-slate-50 dark:bg-slate-800 border ${isLocked ? 'border-transparent' : 'border-slate-200 dark:border-slate-700'} rounded-xl text-sm p-3 outline-none focus:ring-2 focus:ring-teal-500 transition-all text-slate-900 dark:text-slate-100 ${isLocked ? 'cursor-default' : ''}`}
                        value={cred.value}
                        onChange={e => updateCredential(cred.id, 'value', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
