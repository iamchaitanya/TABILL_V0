
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AppTab, TourData, UserProfile, InspectionEntry } from './types';
import { generateId, MONTHS, isHoliday, formatCurrency, isHolidayStr } from './utils';
import { EntriesPage } from './EntriesPage';
import { ReportPage } from './ReportPage';
import { SummaryPage } from './SummaryPage';
import { ProfilePage } from './ProfilePage';
import { RbiaClosurePage } from './RbiaClosurePage';
import { supabase, isCloudConfigured, signInWithGoogle, signOutCloud } from './supabase';
import {
  pullSnapshot,
  pushSnapshot,
  mergeRemoteEntries,
  mergeProfiles,
  isLocalEmpty,
  isRemoteEmpty,
} from './cloud';
import { getOrCreateTourId, loadSyncMeta, saveSyncMeta, setStoredTourId } from './storage';
import type { SyncMeta, SyncState } from './types';
import type { Session } from '@supabase/supabase-js';

const App = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const SECURITY_CREDENTIAL_LABELS = ['CBS', 'DMS', 'HRMS', 'ELEARNING'] as const;
  const normalizeCredentialKey = (label: string) => label.toUpperCase().replace(/[^A-Z]/g, '');

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
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    designation: '',
    basicPay: '',
    accountNumber: '',
    accountBranch: '',
    credentials: [
      { id: generateId(), label: 'CBS', value: '' },
      { id: generateId(), label: 'DMS', value: '' },
      { id: generateId(), label: 'HRMS', value: '' },
      { id: generateId(), label: 'ELEARNING', value: '' }
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
  const [showRbiaClosurePage, setShowRbiaClosurePage] = useState(false);
  const [closureBranch, setClosureBranch] = useState<string>('');

  // --- Cloud sync ---
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('signed-out');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => loadSyncMeta().lastSyncedAt ?? null);

  const tourIdRef = useRef<string>(getOrCreateTourId());
  const metaRef = useRef<SyncMeta>(loadSyncMeta());
  const dataRef = useRef(data);
  const profileRef = useRef(profile);
  const sessionRef = useRef<Session | null>(null);
  const syncingRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const pushTimerRef = useRef<number | null>(null);
  /** JSON of the last state actually pushed, so identical state never re-syncs. */
  const lastPushedRef = useRef<string | null>(null);

  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { sessionRef.current = session; }, [session]);

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

        // Keep only requested security credentials and preserve any existing values when possible.
        const existingCredentials = Array.isArray(parsedProfile.credentials) ? parsedProfile.credentials : [];
        const valueByKey = new Map<string, string>();
        existingCredentials.forEach((cred: any) => {
          const label = String(cred?.label || '');
          const value = String(cred?.value || '');
          const key = normalizeCredentialKey(label);
          if (key) valueByKey.set(key, value);
        });

        parsedProfile.credentials = SECURITY_CREDENTIAL_LABELS.map(label => {
          const key = normalizeCredentialKey(label);
          const fallbackKeys = key === 'ELEARNING' ? ['LEARNING'] : [];
          const preserved = valueByKey.get(key) ?? fallbackKeys.map(k => valueByKey.get(k)).find(Boolean) ?? '';
          return { id: generateId(), label, value: preserved };
        });

        setProfile(prev => ({ ...prev, ...parsedProfile })); 
      } catch (e) {}
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('iotabill_data', JSON.stringify(data));
  }, [data, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('iotabill_profile', JSON.stringify(profile));
  }, [profile, hydrated]);

  // --- Cloud session ---
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  /**
   * Only replace the profile when the merged copy really differs. Without this,
   * every sync produced a new object identity, re-triggering the push effect in
   * an endless ~1.5s loop.
   */
  const commitRemoteProfile = (next: UserProfile) => {
    if (JSON.stringify(next) === JSON.stringify(profileRef.current)) return;
    profileRef.current = next;
    setProfile(next);
  };

  const runSync = async (mode: 'initial' | 'now' = 'now') => {
    const currentSession = sessionRef.current;
    if (!supabase || !currentSession || syncingRef.current) return;
    syncingRef.current = true;
    setSyncState('syncing');
    setSyncMessage(null);
    try {
      const userId = currentSession.user.id;
      const remote = await pullSnapshot(userId);
      let nextData = dataRef.current;

      if (remote.tour) {
        tourIdRef.current = remote.tour.id;
        setStoredTourId(remote.tour.id);
      }

      if (mode === 'initial' && !isRemoteEmpty(remote)) {
        if (isLocalEmpty(profileRef.current, nextData)) {
          const merged = mergeRemoteEntries({ ...nextData, entries: [] }, remote.entries, { entries: {} });
          metaRef.current = merged.meta;
          if (merged.changed) { applyingRemoteRef.current = true; nextData = merged.data; setData(nextData); }
          if (remote.tour) {
            nextData = {
              ...nextData,
              tourName: remote.tour.name || nextData.tourName,
              startDate: remote.tour.start_date || nextData.startDate,
              endDate: remote.tour.end_date || nextData.endDate,
              currency: remote.tour.currency || nextData.currency,
            };
            setData(nextData);
          }
          if (remote.profile) {
            commitRemoteProfile(mergeProfiles(profileRef.current, remote.profile.data));
          }
        } else {
          const merged = mergeRemoteEntries(nextData, remote.entries, metaRef.current);
          metaRef.current = merged.meta;
          if (merged.changed) { applyingRemoteRef.current = true; nextData = merged.data; setData(nextData); }
          if (remote.profile) {
            commitRemoteProfile(mergeProfiles(profileRef.current, remote.profile.data));
          }
        }
      } else {
        const merged = mergeRemoteEntries(nextData, remote.entries, metaRef.current);
        metaRef.current = merged.meta;
        if (merged.changed) { applyingRemoteRef.current = true; nextData = merged.data; setData(nextData); }
        if (remote.profile) {
          commitRemoteProfile(mergeProfiles(profileRef.current, remote.profile.data));
        }
      }

      const nextMeta = await pushSnapshot(userId, tourIdRef.current, nextData, profileRef.current, metaRef.current);
      metaRef.current = nextMeta;
      saveSyncMeta(nextMeta);
      lastPushedRef.current = JSON.stringify({ data: nextData, profile: profileRef.current });
      setLastSyncedAt(nextMeta.lastSyncedAt ?? new Date().toISOString());
      setSyncState('synced');
    } catch (e: any) {
      setSyncState('error');
      setSyncMessage(e?.message || 'Sync failed.');
    } finally {
      syncingRef.current = false;
      setTimeout(() => { applyingRemoteRef.current = false; }, 0);
    }
  };

  useEffect(() => {
    if (!session || !hydrated) return;
    void runSync('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hydrated]);

  useEffect(() => {
    if (!session || !hydrated || !supabase || applyingRemoteRef.current) return;
    if (JSON.stringify({ data, profile }) === lastPushedRef.current) {
      if (pushTimerRef.current) {
        window.clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
      return;
    }
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    pushTimerRef.current = window.setTimeout(() => {
      // The state may have been pushed by another sync while the timer waited.
      const current = JSON.stringify({ data: dataRef.current, profile: profileRef.current });
      if (current === lastPushedRef.current) return;
      void runSync('now');
    }, 1500);
    return () => {
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, profile, session, hydrated]);

  useEffect(() => {
    if (!session) return;
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void runSync('now');
    };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // --- Cloud handlers ---
  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await signOutCloud();
    sessionRef.current = null;
    setSession(null);
    setSyncState('signed-out');
    setSyncMessage(null);
  };

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
        showAlert('please fill required fields');
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

  const savedEntries = useMemo(() => {
    const saved = data.entries.filter(e => e.lastSavedAt);
    const dateMap = new Map<string, InspectionEntry>();
    saved.forEach(entry => dateMap.set(entry.date, entry));
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.entries]);

  const reportGeneratedOn = useMemo(() => toIsoDate(new Date()), []);

  const closureBranchOptions = useMemo(() => {
    const now = new Date();
    const fourMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const threshold = `${fourMonthsAgo.getFullYear()}-${String(fourMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
    const uniq = new Map<string, string>();
    savedEntries.forEach(e => {
      if (
        (e.inspectionType || '').toUpperCase() === 'RBIA' &&
        e.dayStatus === 'Inspection' &&
        !isHolidayStr(e.date) &&
        e.date >= threshold &&
        e.date <= reportGeneratedOn
      ) {
        const b = (e.branch || '').trim();
        if (b && !uniq.has(b.toLowerCase())) uniq.set(b.toLowerCase(), b);
      }
    });
    return Array.from(uniq.values()).sort((a, b) => a.localeCompare(b));
  }, [savedEntries, reportGeneratedOn]);

  const generateDateRange = (start: string, end: string) => {
    const dates: string[] = [];
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const cursor = new Date(sy, sm - 1, sd);
    const endDate = new Date(ey, em - 1, ed);
    while (cursor <= endDate) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  };

  const formatDateLabel = (dStr: string) => {
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const openRbiaClosurePage = () => {
    if (!closureBranch && closureBranchOptions.length) {
      setClosureBranch(closureBranchOptions[0]);
    }
    setShowRbiaClosurePage(true);
  };

  const rbiaClosureData = useMemo(() => {
    if (!closureBranch) {
      return {
        startDate: null as string | null,
        endDate: reportGeneratedOn,
        error: closureBranchOptions.length ? 'Select a branch to generate RBIA report.' : 'No RBIA branches found in the last 4 months.',
        rbiaDates: [] as string[],
        sundays: [] as string[],
        secondSaturdays: [] as string[],
        fourthSaturdays: [] as string[],
        holidays: [] as string[],
        leaves: [] as string[],
        otherAuditsInSelectedBranch: [] as { date: string; branch: string; inspectionType: string }[],
        otherBranchWork: [] as { date: string; branch: string; inspectionType: string }[]
      };
    }

    const key = closureBranch.trim().toLowerCase();
    const rbiaEntriesForSelectedBranch = savedEntries
      .filter(e =>
        (e.inspectionType || '').toUpperCase() === 'RBIA' &&
        e.dayStatus === 'Inspection' &&
        !isHolidayStr(e.date) &&
        (e.branch || '').trim().toLowerCase() === key &&
        e.date <= reportGeneratedOn
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!rbiaEntriesForSelectedBranch.length) {
      return {
        startDate: null as string | null,
        endDate: reportGeneratedOn,
        error: 'No RBIA entries found for selected branch.',
        rbiaDates: [] as string[],
        sundays: [] as string[],
        secondSaturdays: [] as string[],
        fourthSaturdays: [] as string[],
        holidays: [] as string[],
        leaves: [] as string[],
        otherAuditsInSelectedBranch: [] as { date: string; branch: string; inspectionType: string }[],
        otherBranchWork: [] as { date: string; branch: string; inspectionType: string }[]
      };
    }

    const lastRbiaDate = rbiaEntriesForSelectedBranch[rbiaEntriesForSelectedBranch.length - 1].date;
    const [ly, lm, ld] = lastRbiaDate.split('-').map(Number);
    const windowStartDate = new Date(ly, lm - 1 - 4, 1);
    const daysInWindowStartMonth = new Date(windowStartDate.getFullYear(), windowStartDate.getMonth() + 1, 0).getDate();
    windowStartDate.setDate(Math.min(ld, daysInWindowStartMonth));
    const windowStart = `${windowStartDate.getFullYear()}-${String(windowStartDate.getMonth() + 1).padStart(2, '0')}-${String(windowStartDate.getDate()).padStart(2, '0')}`;

    const rbiaForSelectedBranch = rbiaEntriesForSelectedBranch
      .filter(e => e.date >= windowStart && e.date <= lastRbiaDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    const startDate = rbiaForSelectedBranch[0].date;
    const endDate = lastRbiaDate;
    const allDates = generateDateRange(startDate, endDate);
    const entriesByDate = new Map<string, InspectionEntry>(savedEntries.map(e => [e.date, e] as const));
    const rbiaDateSet = new Set(rbiaForSelectedBranch.map(e => e.date));

    const rbiaDates: string[] = [];
    const sundays: string[] = [];
    const secondSaturdays: string[] = [];
    const fourthSaturdays: string[] = [];
    const holidays: string[] = [];
    const leaves: string[] = [];
    const otherAuditsInSelectedBranch: { date: string; branch: string; inspectionType: string }[] = [];
    const otherBranchWork: { date: string; branch: string; inspectionType: string }[] = [];
    const selectedBranchAuditSeen = new Set<string>();
    const otherBranchSeen = new Set<string>();

    allDates.forEach(d => {
      const [y, m, dayNum] = d.split('-').map(Number);
      const dt = new Date(y, m - 1, dayNum);
      const day = dt.getDay();
      const isSunday = day === 0;
      const isSecondSaturday = day === 6 && dayNum >= 8 && dayNum <= 14;
      const isFourthSaturday = day === 6 && dayNum >= 22 && dayNum <= 28;

      const entry = entriesByDate.get(d);

      // Exclusive classification by final visible state: each date belongs to exactly one bucket.
      if (isSunday) {
        sundays.push(d);
        return;
      }
      if (isSecondSaturday) {
        secondSaturdays.push(d);
        return;
      }
      if (isFourthSaturday) {
        fourthSaturdays.push(d);
        return;
      }

      if (!entry) return;

      if (entry.dayStatus === 'Holiday') {
        holidays.push(d);
        return;
      }

      if (entry.dayStatus === 'Leave') {
        leaves.push(d);
        return;
      }

      if (entry.dayStatus !== 'Inspection') return;

      const branch = (entry.branch || '').trim();
      const branchKey = branch.toLowerCase();
      const inspectionType = (entry.inspectionType || '').trim();
      const inspectionUpper = inspectionType.toUpperCase();

      if (inspectionUpper === 'RBIA' && branchKey === key && rbiaDateSet.has(d)) {
        rbiaDates.push(d);
        return;
      }

      const isNonRbiaAuditInSelectedBranch = branchKey === key && inspectionUpper !== 'RBIA';
      const isWorkInOtherBranch = branchKey !== key;
      if (branch && isNonRbiaAuditInSelectedBranch) {
        const rowKey = `${d}::${branchKey}::${inspectionUpper}`;
        if (!selectedBranchAuditSeen.has(rowKey)) {
          selectedBranchAuditSeen.add(rowKey);
          otherAuditsInSelectedBranch.push({
            date: d,
            branch,
            inspectionType: inspectionType || '-'
          });
        }
      }
      if (branch && isWorkInOtherBranch) {
        const rowKey = `${d}::${branchKey}::${inspectionUpper}`;
        if (!otherBranchSeen.has(rowKey)) {
          otherBranchSeen.add(rowKey);
          otherBranchWork.push({
            date: d,
            branch,
            inspectionType: inspectionType || '-'
          });
        }
      }
    });

    return {
      startDate,
      endDate,
      error: null as string | null,
      rbiaDates,
      sundays,
      secondSaturdays,
      fourthSaturdays,
      holidays,
      leaves,
      otherAuditsInSelectedBranch,
      otherBranchWork
    };
  }, [closureBranch, closureBranchOptions.length, reportGeneratedOn, savedEntries]);

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
              onClick={openRbiaClosurePage}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-black transition-colors"
              title="RBIA Closure"
            >
              RBIA
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
        {showRbiaClosurePage ? (
          <RbiaClosurePage
            branchOptions={closureBranchOptions}
            selectedBranch={closureBranch}
            onBranchChange={setClosureBranch}
            onClose={() => setShowRbiaClosurePage(false)}
            startDate={rbiaClosureData.startDate}
            endDate={rbiaClosureData.endDate}
            error={rbiaClosureData.error}
            formatDateLabel={formatDateLabel}
            rbiaDates={rbiaClosureData.rbiaDates}
            sundays={rbiaClosureData.sundays}
            secondSaturdays={rbiaClosureData.secondSaturdays}
            fourthSaturdays={rbiaClosureData.fourthSaturdays}
            holidays={rbiaClosureData.holidays}
            leaves={rbiaClosureData.leaves}
            otherAuditsInSelectedBranch={rbiaClosureData.otherAuditsInSelectedBranch}
            otherBranchWork={rbiaClosureData.otherBranchWork}
          />
        ) : (
          <>
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
                cloudConfigured={isCloudConfigured}
                accountEmail={session?.user?.email ?? null}
                accountAvatar={(session?.user?.user_metadata?.avatar_url as string) ?? null}
                syncState={syncState}
                syncMessage={syncMessage}
                lastSyncedAt={lastSyncedAt}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                onSyncNow={() => runSync('now')}
              />
            )}
          </>
        )}
      </main>

      {!showRbiaClosurePage && (
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
      )}

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

// Service worker: production only. In dev it served stale modules and blanked the app.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration failed: ', err);
      });
    });
  } else {
    window.addEventListener('load', async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    });
  }
}
