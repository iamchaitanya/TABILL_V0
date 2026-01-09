
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AppTab, TourData, UserProfile, InspectionEntry } from './types';
import { generateId, MONTHS, isHoliday, formatCurrency, isHolidayStr } from './utils';
import { EntriesPage } from './EntriesPage';
import { ReportPage } from './ReportPage';
import { SummaryPage } from './SummaryPage';
import { ProfilePage } from './ProfilePage';

const App = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- State ---
  const [activeTab, setActiveTab] = useState<AppTab>('entries');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [uiAlert, setUiAlert] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('iotabill_darkmode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const [selectedMonthYear, setSelectedMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    bio: '',
    homeCurrency: '',
    avatar: null,
    employeeId: '',
    mobile: '',
    email: '',
    unit: '',
    zi: '',
    credentials: [
      { id: generateId(), label: 'CBS', value: '' },
      { id: generateId(), label: 'DMS', value: '' },
      { id: generateId(), label: 'SAS', value: '' },
      { id: generateId(), label: 'DARPAN', value: '' },
      { id: generateId(), label: 'CONCURRENT', value: '' },
      { id: generateId(), label: 'HRMS', value: '' },
      { id: generateId(), label: 'LEARNING', value: '' }
    ]
  });

  const [data, setData] = useState<TourData>({
    tourName: 'Inspection Tour',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'INR',
    entries: [{ 
      id: generateId(), 
      date: new Date().toISOString().split('T')[0], 
      branch: '', 
      dpCode: '', 
      inspectionType: 'RBIA',
      onwardJourney: [],
      returnJourney: [],
      otherExpenses: [],
      lastSavedAt: undefined,
      dayStatus: 'Inspection'
    }],
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [recentlySaved, setRecentlySaved] = useState<string | null>(null);
  const [attemptedSaveIds, setAttemptedSaveIds] = useState<Set<string>>(new Set());

  // --- Theme Sync ---
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('iotabill_darkmode', String(isDarkMode));
  }, [isDarkMode]);

  // --- Persistence ---
  useEffect(() => {
    const savedTour = localStorage.getItem('iotabill_data');
    const savedProfile = localStorage.getItem('iotabill_profile');
    if (savedTour) {
      try { setData(prev => ({ ...prev, ...JSON.parse(savedTour) })); } catch (e) {}
    }
    if (savedProfile) {
      try { 
        const parsedProfile = JSON.parse(savedProfile);
        
        // Ensure credentials exist and include new defaults (DARPAN, CONCURRENT, HRMS, LEARNING)
        const defaultLabels = ['CBS', 'DMS', 'SAS', 'DARPAN', 'CONCURRENT', 'HRMS', 'LEARNING'];
        if (!parsedProfile.credentials) {
            parsedProfile.credentials = defaultLabels.map(l => ({ id: generateId(), label: l, value: '' }));
        } else {
            const existingLabels = parsedProfile.credentials.map((c: any) => c.label);
            defaultLabels.forEach(l => {
                if (!existingLabels.includes(l)) {
                    parsedProfile.credentials.push({ id: generateId(), label: l, value: '' });
                }
            });
        }

        setProfile(prev => ({ ...prev, ...parsedProfile })); 
      } catch (e) {}
    }
  }, []);

  useEffect(() => localStorage.setItem('iotabill_data', JSON.stringify(data)), [data]);
  useEffect(() => localStorage.setItem('iotabill_profile', JSON.stringify(profile)), [profile]);

  // --- Alert Timer ---
  useEffect(() => {
    if (uiAlert) {
      const timer = setTimeout(() => setUiAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [uiAlert]);

  // --- Handlers ---
  const handleEntryChange = (id: string, field: keyof InspectionEntry, value: any) => {
    setData(prev => ({
      ...prev,
      entries: prev.entries.map(entry => entry.id === id ? { ...entry, [field]: value } : entry)
    }));
  };

  const handleDatePartChange = (id: string, part: 'day' | 'month' | 'year', value: string) => {
    const entry = data.entries.find(e => e.id === id);
    if (!entry) return;
    let [y, m, d] = entry.date.split('-');
    if (part === 'day') d = value.padStart(2, '0');
    if (part === 'month') m = value.padStart(2, '0');
    if (part === 'year') y = value;
    const daysInNewMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
    if (parseInt(d) > daysInNewMonth) d = daysInNewMonth.toString().padStart(2, '0');
    handleEntryChange(id, 'date', `${y}-${m}-${d}`);
  };

  const showAlert = (message: string) => {
    setUiAlert(message);
  };

  const resetEntry = (id: string) => {
    setData(prev => ({
      ...prev,
      entries: prev.entries.map(e => e.id === id ? {
        ...e,
        branch: '',
        dpCode: '',
        inspectionType: 'RBIA',
        onwardJourney: [],
        returnJourney: [],
        otherExpenses: [],
        dayStatus: 'Inspection'
      } : e)
    }));
    setAttemptedSaveIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const saveEntry = (id: string) => {
    const entry = data.entries.find(e => e.id === id);
    if (!entry || entry.lastSavedAt) return;

    const isDuplicate = data.entries.some(e => e.lastSavedAt && e.date === entry.date);
    if (isDuplicate) {
      showAlert("entry already exists");
      return;
    }

    if (entry.dayStatus === 'Inspection') {
      const isBranchEmpty = !entry.branch || !entry.branch.trim();
      const isTypeEmpty = !entry.inspectionType || !entry.inspectionType.trim();

      if (isBranchEmpty || isTypeEmpty) {
        setAttemptedSaveIds(prev => new Set(prev).add(id));
        setTimeout(() => {
          const entryEl = document.getElementById(`entry-card-${id}`);
          if (entryEl) {
            const firstEmptyInput = entryEl.querySelector('input.border-red-500');
            if (firstEmptyInput) (firstEmptyInput as HTMLInputElement).focus();
          }
        }, 0);
        return;
      }
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const savedSnapshot: InspectionEntry = { 
      ...JSON.parse(JSON.stringify(entry)), 
      id: generateId(), 
      lastSavedAt: timestamp 
    };

    setData(prev => {
      const updatedEntries = prev.entries.map(e => {
        if (e.id === id) {
          const current = new Date(e.date);
          current.setDate(current.getDate() + 1);
          const nextDateStr = current.toISOString().split('T')[0];
          return { ...e, date: nextDateStr };
        }
        return e;
      });
      return {
        ...prev,
        entries: [...updatedEntries, savedSnapshot]
      };
    });

    setAttemptedSaveIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    setRecentlySaved(id);
    setTimeout(() => setRecentlySaved(null), 2000);
  };

  const deleteEntry = (id: string) => {
    const unsavedCards = data.entries.filter(e => !e.lastSavedAt);
    if (unsavedCards.length <= 1 && unsavedCards.some(e => e.id === id)) {
      resetEntry(id);
      return;
    }
    setData(prev => ({ ...prev, entries: prev.entries.filter(e => e.id !== id) }));
  };

  const navigateMonth = (direction: number) => {
    const [y, m] = selectedMonthYear.split('-').map(Number);
    const date = new Date(y, (m - 1) + direction, 1);
    setSelectedMonthYear(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const selectedMonthLabel = useMemo(() => {
    const [y, m] = selectedMonthYear.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }, [selectedMonthYear]);

  const reportEntries = useMemo(() => {
    const filtered = data.entries.filter(e => e.lastSavedAt && e.date.startsWith(selectedMonthYear));
    const dateMap = new Map<string, InspectionEntry>();
    filtered.forEach(entry => {
      dateMap.set(entry.date, entry);
    });
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.entries, selectedMonthYear]);

  const reportTotals = useMemo(() => {
    let h = 0, l = 0, t = 0;
    reportEntries.forEach(entry => {
      const isAutoHoliday = isHolidayStr(entry.date);
      const isHoliday = isAutoHoliday || entry.dayStatus === 'Holiday';
      const isLeave = entry.dayStatus === 'Leave';
      if (entry.dayStatus === 'Inspection' && !isHoliday && !isLeave) {
        entry.otherExpenses.forEach(i => { h += i.halting || 0; l += i.lodging || 0; });
        entry.onwardJourney.forEach(i => t += i.amount || 0);
        entry.returnJourney.forEach(i => t += i.amount || 0);
      }
    });
    return { halting: h, lodging: l, travel: t, total: h + l + t };
  }, [reportEntries]);

  const changeMonth = (offset: number) => {
    setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + offset, 1));
  };

  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear(), month = calendarViewDate.getMonth();
    const first = new Date(year, month, 1).getDay(), daysIn = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < first; i++) days.push(null);
    for (let i = 1; i <= daysIn; i++) days.push(new Date(year, month, i));
    while (days.length < 42) days.push(null);
    return { days, monthName: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarViewDate) };
  }, [calendarViewDate]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcfb] dark:bg-slate-950 selection:bg-teal-100 flex flex-col transition-colors duration-300">
      {/* Hidden professional header for print only */}
      <div className="print-only p-8 border-b-2 border-teal-900 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-black text-teal-900 uppercase tracking-tighter">Tour Expense Report</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">{data.tourName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Report Month</p>
            <p className="text-xl font-black text-teal-600">{selectedMonthLabel}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-12 mt-8">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inspector Name</p>
            <p className="text-lg font-black text-slate-800">{profile.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee ID</p>
            <p className="text-lg font-black text-slate-800">{profile.employeeId}</p>
          </div>
        </div>
      </div>

      {uiAlert && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xs px-4 animate-in fade-in slide-in-from-top-4 duration-300 no-print">
          <div className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              <span className="text-[10px] font-black uppercase tracking-[0.1em]">{uiAlert}</span>
            </div>
            <button onClick={() => setUiAlert(null)} className="opacity-60 hover:opacity-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-teal-100 dark:border-slate-800 p-4 no-print transition-colors">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600 text-white p-2 rounded-xl shadow-lg rotate-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2" /></svg></div>
            <div>
              <h1 className="text-xl font-black text-teal-900 dark:text-teal-400 leading-none">TA BILL</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.05 7.05l.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <button onClick={() => setShowCalendar(true)} className="p-2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <button 
              onClick={() => setActiveTab('profile')} 
              className={`p-1.5 rounded-full transition-all border-2 ${activeTab === 'profile' ? 'border-teal-600' : 'border-transparent text-slate-400 hover:text-teal-600'}`}
            >
              {profile.avatar ? (
                <img src={profile.avatar} className="w-6 h-6 rounded-full object-cover" alt="Profile" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {activeTab === 'entries' && (
          <div className="no-print">
            <EntriesPage 
              data={data} handleEntryChange={handleEntryChange} handleDatePartChange={handleDatePartChange}
              saveEntry={saveEntry} resetEntry={resetEntry} toggleSection={(id, cat) => setExpandedSections(p => ({...p, [`${id}-${cat}`]: !p[`${id}-${cat}`]}))}
              expandedSections={expandedSections} handleExpenseItemChange={(id, cat, iid, f, v) => setData(p => ({...p, entries: p.entries.map(e => e.id===id ? {...e, [cat]: e[cat].map((it:any)=>it.id===iid?{...it,[f]:v}:it)}:e)}))}
              removeExpenseItem={(id,cat,iid) => setData(p => ({...p, entries: p.entries.map(e => e.id===id ? {...e, [cat]: e[cat].filter((it:any)=>it.id!==iid)}:e)}))}
              addExpenseItem={(id,cat) => {
                const item = cat==='otherExpenses' 
                  ? {id:generateId(), halting:0, lodging:0} 
                  : {id:generateId(), from:'', to:'', startTime:'', arrivedTime:'', amount:0, distance: 0, travelBy: 'Bus'};
                setData(p => ({...p, entries: p.entries.map(e => e.id===id ? {...e, [cat]: [...e[cat], item]}:e)}));
              }}
              recentlySaved={recentlySaved} attemptedSaveIds={attemptedSaveIds}
            />
          </div>
        )}
        {activeTab === 'report' && (
          <ReportPage 
            selectedMonthLabel={selectedMonthLabel} navigateMonth={navigateMonth} reportEntries={reportEntries}
            deleteFromReport={deleteEntry} reportTotals={reportTotals} currency={data.currency}
          />
        )}
        {activeTab === 'summary' && (
          <SummaryPage 
            selectedMonthLabel={selectedMonthLabel} navigateMonth={navigateMonth}
            reportTotals={reportTotals} currency={data.currency}
            reportEntries={reportEntries} profile={profile} tourName={data.tourName}
          />
        )}
        {activeTab === 'profile' && (
          <ProfilePage 
            profile={profile} setProfile={setProfile}
            data={data} setData={setData}
            fileInputRef={fileInputRef} handleAvatarUpload={handleAvatarUpload}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-teal-100 dark:border-slate-800 flex justify-around items-center pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] px-6 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.3)] no-print transition-colors">
        <button onClick={() => setActiveTab('entries')} className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all ${activeTab === 'entries' ? 'text-teal-600 bg-teal-50/50 dark:bg-teal-900/20' : 'text-slate-400 dark:text-slate-500'}`}>
          <svg className="h-5 w-5" fill={activeTab === 'entries' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Entries</span>
        </button>
        <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all ${activeTab === 'report' ? 'text-teal-600 bg-teal-50/50 dark:bg-teal-900/20' : 'text-slate-400 dark:text-slate-500'}`}>
          <svg className="h-5 w-5" fill={activeTab === 'report' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Report</span>
        </button>
        <button onClick={() => setActiveTab('summary')} className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all ${activeTab === 'summary' ? 'text-teal-600 bg-teal-50/50 dark:bg-teal-900/20' : 'text-slate-400 dark:text-slate-500'}`}>
          <svg className="h-5 w-5" fill={activeTab === 'summary' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Summary</span>
        </button>
      </nav>

      {showCalendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm no-print">
          <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 bg-teal-900 text-white flex justify-between items-center">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
              <div className="text-center"><h2 className="font-black text-lg uppercase tracking-widest">Calendar</h2><p className="text-[10px] opacity-60 uppercase font-bold tracking-widest mt-1">{calendarDays.monthName}</p></div>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg></button>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (<div key={d + idx} className={`text-center text-[10px] font-black py-1 ${idx === 0 ? 'text-red-500' : 'text-slate-300 dark:text-slate-600'}`}>{d}</div>))}
                {calendarDays.days.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                  const isRedDay = isHoliday(day);
                  return (<div key={idx} className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-black transition-all ${isRedDay ? 'text-red-500 bg-red-50/50 dark:bg-red-900/10' : 'text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-teal-50 dark:hover:bg-slate-800'}`}>{day.getDate()}</div>);
                })}
              </div>
              <button onClick={() => setShowCalendar(false)} className="w-full mt-4 py-4 bg-slate-900 dark:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
