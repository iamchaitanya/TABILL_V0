
import React from 'react';
import { TourData, InspectionEntry } from './types';
import { formatCurrency, isHolidayStr } from './utils';

interface ReportPageProps {
  selectedMonthLabel: string;
  navigateMonth: (direction: number) => void;
  reportEntries: InspectionEntry[];
  deleteFromReport: (id: string) => void;
  reportTotals: { halting: number; lodging: number; travel: number; total: number };
  currency: string;
}

export const ReportPage: React.FC<ReportPageProps> = ({
  selectedMonthLabel,
  navigateMonth,
  reportEntries,
  deleteFromReport,
  reportTotals,
  currency,
}) => {
  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-teal-100 dark:border-slate-800 p-3 shadow-sm flex flex-col items-center no-print transition-colors">
        <div className="flex items-center justify-between w-full max-w-md bg-teal-50/50 dark:bg-teal-900/10 p-1.5 rounded-xl border border-teal-100 dark:border-teal-900/50">
          <button onClick={() => navigateMonth(-1)} className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/20 rounded-lg transition-all active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg></button>
          <div className="text-center"><h2 className="text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">{selectedMonthLabel}</h2></div>
          <button onClick={() => navigateMonth(1)} className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/20 rounded-lg transition-all active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg></button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-teal-100 dark:border-slate-800 overflow-hidden shadow-sm invoice-shadow transition-colors">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-teal-100 dark:border-slate-700 transition-colors">
                <th className="px-4 py-2 text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-wider">Branch</th>
                <th className="px-4 py-2 text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-wider">Category</th>
                <th className="px-4 py-2 text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-wider text-center no-print">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reportEntries.map(entry => {
                const isAutoHoliday = isHolidayStr(entry.date);
                const isHoliday = isAutoHoliday || entry.dayStatus === 'Holiday';
                const isLeave = entry.dayStatus === 'Leave';
                
                const branchToDisplay = isAutoHoliday ? 'Holiday' : (entry.dayStatus === 'Inspection' ? entry.branch : entry.dayStatus);
                const categoryToDisplay = isAutoHoliday ? 'Holiday' : (entry.dayStatus === 'Inspection' ? entry.inspectionType : entry.dayStatus);

                let rowBgClass = 'hover:bg-teal-50/30 dark:hover:bg-teal-900/10 transition-all';
                let textColorClass = 'text-slate-900 dark:text-slate-100 font-black'; 
                let categoryColorClass = 'text-slate-950 dark:text-slate-200 font-black'; 
                let dateColorClass = 'text-slate-950 dark:text-slate-200 font-black';

                if (isHoliday) {
                  rowBgClass += ' bg-red-50/20 dark:bg-red-900/10 opacity-70';
                  textColorClass = 'text-red-600 dark:text-red-400 font-bold';
                  categoryColorClass = 'text-red-600 dark:text-red-400 font-bold';
                  dateColorClass = 'text-red-600 dark:text-red-400 font-bold';
                } else if (isLeave) {
                  rowBgClass += ' bg-blue-50/20 dark:bg-blue-900/10 opacity-70';
                  textColorClass = 'text-blue-600 dark:text-blue-400 font-bold';
                  categoryColorClass = 'text-blue-600 dark:text-blue-400 font-bold';
                  dateColorClass = 'text-blue-600 dark:text-blue-400 font-bold';
                }

                return (
                  <tr key={entry.id} className={rowBgClass}>
                    <td className="px-4 py-1">
                      <p className={`text-xs ${dateColorClass}`}>
                        {formatDate(entry.date)}
                      </p>
                    </td>
                    <td className="px-4 py-1">
                      <p className={`text-xs uppercase tracking-tight leading-tight ${textColorClass}`}>
                        {branchToDisplay}
                      </p>
                    </td>
                    <td className="px-4 py-1">
                      <span className={`text-xs uppercase tracking-tight leading-none ${categoryColorClass}`}>
                        {categoryToDisplay}
                      </span>
                    </td>
                    <td className="px-4 py-1 text-center no-print">
                      <button onClick={() => deleteFromReport(entry.id)} className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {reportEntries.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest">No saved entries for {selectedMonthLabel}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
