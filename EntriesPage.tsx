
import React from 'react';
import { InspectionEntry, TourData } from './types';
import { MONTHS, YEARS, INSPECTION_TYPES } from './utils';

interface EntriesPageProps {
  data: TourData;
  handleEntryChange: (id: string, field: keyof InspectionEntry, value: any) => void;
  handleDatePartChange: (id: string, part: 'day' | 'month' | 'year', value: string) => void;
  saveEntry: (id: string) => void;
  resetEntry: (id: string) => void;
  toggleSection: (entryId: string, category: string) => void;
  expandedSections: Record<string, boolean>;
  handleExpenseItemChange: (entryId: string, category: any, itemId: string, field: string, value: any) => void;
  removeExpenseItem: (entryId: string, category: any, itemId: string) => void;
  addExpenseItem: (entryId: string, category: any) => void;
  recentlySaved: string | null;
  attemptedSaveIds: Set<string>;
}

export const EntriesPage: React.FC<EntriesPageProps> = ({
  data,
  handleEntryChange,
  handleDatePartChange,
  saveEntry,
  resetEntry,
  toggleSection,
  expandedSections,
  handleExpenseItemChange,
  removeExpenseItem,
  addExpenseItem,
  recentlySaved,
  attemptedSaveIds,
}) => {
  const renderExpenseSection = (entry: InspectionEntry, category: 'onwardJourney' | 'returnJourney' | 'otherExpenses', label: string) => {
    const isExpanded = !!expandedSections[`${entry.id}-${category}`];
    const isJourney = category === 'onwardJourney' || category === 'returnJourney';
    const isOther = category === 'otherExpenses';
    
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
          <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</label>
          <button 
            onClick={() => {
              if (!isExpanded && entry[category].length === 0) {
                addExpenseItem(entry.id, category);
              }
              toggleSection(entry.id, category);
            }}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm ${isExpanded ? 'bg-red-50 dark:bg-red-900/20 text-red-600 rotate-45' : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        
        {isExpanded && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {entry[category].map((item: any) => (
              <div key={item.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl relative group shadow-sm transition-colors">
                {isJourney ? (
                  <div className="flex flex-col gap-4 pr-6">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">From</label>
                      <input type="text" placeholder="Origin" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs p-2.5 outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 dark:text-slate-100" value={item.from} onChange={e => handleExpenseItemChange(entry.id, category, item.id, 'from', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">To</label>
                      <input type="text" placeholder="Destination" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs p-2.5 outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 dark:text-slate-100" value={item.to} onChange={e => handleExpenseItemChange(entry.id, category, item.id, 'to', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Start Time</label>
                      <input type="time" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs p-2.5 outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 dark:text-slate-100" value={item.startTime} onChange={e => handleExpenseItemChange(entry.id, category, item.id, 'startTime', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Arrived Time</label>
                      <input type="time" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs p-2.5 outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 dark:text-slate-100" value={item.arrivedTime} onChange={e => handleExpenseItemChange(entry.id, category, item.id, 'arrivedTime', e.target.value)} />
                    </div>
                    {isJourney && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Distance (km)</label>
                          <input type="number" placeholder="0" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs p-2.5 outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 dark:text-slate-100" value={item.distance || ''} onChange={e => handleExpenseItemChange(entry.id, category, item.id, 'distance', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Travel By</label>
                          <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs p-2.5 outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 dark:text-slate-100" value={item.travelBy || 'Bus'} onChange={e => handleExpenseItemChange(entry.id, category, item.id, 'travelBy', e.target.value)}>
                            <option value="Bus">Bus</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </>
                    )}
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Ticket Amount</label>
                      <input type="number" placeholder="0.00" className="w-full bg-teal-50/30 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/50 rounded-lg text-xs p-2.5 font-bold text-teal-700 dark:text-teal-400 outline-none focus:ring-1 focus:ring-teal-500" value={item.amount || ''} onChange={e => handleExpenseItemChange(entry.id, category, item.id, 'amount', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                ) : isOther ? (
                  <div className="flex flex-col gap-4 pr-6">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Halting allowance</label>
                      <input type="number" placeholder="0.00" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs p-2.5 outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 dark:text-slate-100" value={item.halting || ''} onChange={e => handleExpenseItemChange(entry.id, category, item.id, 'halting', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Lodging allowance</label>
                      <input type="number" placeholder="0.00" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs p-2.5 outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 dark:text-slate-100" value={item.lodging || ''} onChange={e => handleExpenseItemChange(entry.id, category, item.id, 'lodging', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {[...data.entries].filter(e => !e.lastSavedAt).sort((a,b) => a.date.localeCompare(b.date)).map((entry) => {
        const [y, m, d] = entry.date.split('-');
        const yearVal = parseInt(y);
        const monthVal = parseInt(m);
        const dayVal = parseInt(d);
        const daysInThisMonth = new Date(yearVal, monthVal, 0).getDate();
        const dynamicDays = Array.from({ length: daysInThisMonth }, (_, i) => i + 1);

        const isAttempted = attemptedSaveIds.has(entry.id);
        const branchError = isAttempted && (!entry.branch || !entry.branch.trim());
        const typeError = isAttempted && (!entry.inspectionType || !entry.inspectionType.trim());

        const isExpenseGroupExpanded = !!expandedSections[`${entry.id}-expenseGroup`];

        return (
          <div key={entry.id} id={`entry-card-${entry.id}`} className="p-6 md:p-10 bg-white dark:bg-slate-900 rounded-3xl border border-teal-100 dark:border-slate-800 space-y-4 relative group hover:border-teal-300 dark:hover:border-teal-700 transition-all shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inspection Date</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm p-3 outline-none focus:ring-2 focus:ring-teal-500 appearance-none text-slate-900 dark:text-slate-100 transition-colors" value={dayVal} onChange={e => handleDatePartChange(entry.id, 'day', e.target.value)}>
                      {dynamicDays.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm p-3 outline-none focus:ring-2 focus:ring-teal-500 appearance-none text-slate-900 dark:text-slate-100 transition-colors" value={monthVal} onChange={e => handleDatePartChange(entry.id, 'month', e.target.value)}>
                      {MONTHS.map((month, idx) => <option key={month} value={idx + 1}>{month}</option>)}
                    </select>
                    <select className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm p-3 outline-none focus:ring-2 focus:ring-teal-500 appearance-none text-slate-900 dark:text-slate-100 transition-colors" value={yearVal} onChange={e => handleDatePartChange(entry.id, 'year', e.target.value)}>
                      {YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Day Status</label>
                  <div className="flex gap-2">
                    {['Inspection', 'Leave', 'Holiday'].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleEntryChange(entry.id, 'dayStatus', status)}
                        className={`flex-1 py-3 text-[11px] font-black uppercase tracking-tighter rounded-xl transition-all border-2 ${
                          (entry.dayStatus || 'Inspection') === status
                            ? 'bg-teal-900 dark:bg-teal-600 border-teal-900 dark:border-teal-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-teal-100 dark:hover:border-slate-700'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {entry.dayStatus === 'Inspection' && (
                  <>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Branch Name <span className="text-red-500">*</span></label>
                      <input type="text" className={`w-full bg-slate-50 dark:bg-slate-800 border ${branchError ? 'border-red-500' : 'border-slate-100 dark:border-slate-700'} rounded-xl text-sm p-3.5 outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100 transition-colors`} value={entry.branch} onChange={e => handleEntryChange(entry.id, 'branch', e.target.value)} placeholder="Enter branch name" />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">DP Code</label>
                      <input type="text" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm p-3.5 outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-slate-100 transition-colors" value={entry.dpCode} onChange={e => handleEntryChange(entry.id, 'dpCode', e.target.value)} placeholder="Branch code" />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Inspection Category <span className="text-red-500">*</span></label>
                      <select 
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-sm p-3.5 outline-none focus:ring-2 focus:ring-teal-500 appearance-none text-slate-900 dark:text-slate-100 transition-colors" 
                        value={entry.inspectionType === 'RBIA' ? 'RBIA' : 'Others'} 
                        onChange={e => handleEntryChange(entry.id, 'inspectionType', e.target.value === 'RBIA' ? 'RBIA' : '')}
                      >
                        {INSPECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {entry.inspectionType !== 'RBIA' && (
                        <input 
                          type="text" 
                          placeholder="Enter custom category"
                          className={`w-full mt-2 bg-slate-50 dark:bg-slate-800 border ${typeError ? 'border-red-500' : 'border-slate-100 dark:border-slate-700'} rounded-xl text-sm p-3.5 outline-none focus:ring-2 focus:ring-teal-500 animate-in slide-in-from-top-1 duration-200 text-slate-900 dark:text-slate-100 transition-colors`} 
                          value={entry.inspectionType} 
                          onChange={e => handleEntryChange(entry.id, 'inspectionType', e.target.value)} 
                        />
                      )}
                    </div>
                  </>
                )}
              </div>

              {entry.dayStatus === 'Inspection' && (
                <div className="space-y-2">
                   <button 
                    onClick={() => toggleSection(entry.id, 'expenseGroup')}
                    className="flex items-center justify-between w-full p-4 bg-teal-50/50 dark:bg-teal-900/10 rounded-2xl border border-teal-100 dark:border-slate-800 hover:bg-teal-50 dark:hover:bg-slate-800 transition-all text-[11px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest"
                  >
                    <span>Travel and Halting Expenses</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-300 ${isExpenseGroupExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpenseGroupExpanded && (
                    <div className="space-y-8 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      {renderExpenseSection(entry, 'onwardJourney', 'Onward Journey')}
                      {renderExpenseSection(entry, 'returnJourney', 'Return Journey')}
                      {renderExpenseSection(entry, 'otherExpenses', 'Other Expenses')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex gap-2 w-full max-w-lg mx-auto no-print">
              <button 
                onClick={() => resetEntry(entry.id)}
                title="Reset form fields"
                className="basis-[10%] h-14 md:h-16 shrink-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700 rounded-2xl hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/20 transition-all active:scale-95 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              <button 
                onClick={() => saveEntry(entry.id)}
                className={`flex-1 h-14 md:h-16 flex items-center justify-center gap-3 px-6 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${recentlySaved === entry.id ? 'bg-green-600 text-white' : 'bg-teal-900 dark:bg-teal-600 text-white hover:bg-black dark:hover:bg-teal-500'}`}
              >
                {recentlySaved === entry.id ? (
                  <><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>Saved!</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>Save Entry</>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
