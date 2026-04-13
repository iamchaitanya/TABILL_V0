import React from 'react';

interface OtherBranchWorkRow {
  date: string;
  branch: string;
  inspectionType: string;
}

interface RbiaClosurePageProps {
  branchOptions: string[];
  selectedBranch: string;
  onBranchChange: (branch: string) => void;
  onClose: () => void;
  startDate: string | null;
  endDate: string;
  error: string | null;
  formatDateLabel: (date: string) => string;
  rbiaDates: string[];
  sundays: string[];
  secondSaturdays: string[];
  fourthSaturdays: string[];
  holidays: string[];
  leaves: string[];
  otherBranchWork: OtherBranchWorkRow[];
}

const DateListCard: React.FC<{ title: string; dates: string[]; formatDateLabel: (date: string) => string }> = ({ title, dates, formatDateLabel }) => (
  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">{title}</h3>
      <span className="text-[10px] font-black px-2 py-1 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
        {dates.length}
      </span>
    </div>
    {dates.length ? (
      <div className="flex flex-wrap gap-2">
        {dates.map((d) => (
          <span key={`${title}-${d}`} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            {formatDateLabel(d)}
          </span>
        ))}
      </div>
    ) : (
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">No dates found.</p>
    )}
  </section>
);

export const RbiaClosurePage: React.FC<RbiaClosurePageProps> = ({
  branchOptions,
  selectedBranch,
  onBranchChange,
  onClose,
  startDate,
  endDate,
  error,
  formatDateLabel,
  rbiaDates,
  sundays,
  secondSaturdays,
  fourthSaturdays,
  holidays,
  leaves,
  otherBranchWork
}) => {
  return (
    <div className="no-print">
      <div className="rounded-[30px] border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-teal-50 to-white dark:from-slate-900 dark:to-slate-950 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">RBIA Report</p>
            <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white">
              Branch Timeline from RBIA Start to Report Date
            </h2>
          </div>
          <button onClick={onClose} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider hover:bg-black transition-colors">
            Close
          </button>
        </div>

        <div className="p-5">
          <div className="grid md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">RBIA Branch (Last 4 Months)</label>
              <select
                value={selectedBranch}
                onChange={e => onBranchChange(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[12px] font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">{branchOptions.length ? 'Select Branch' : 'No RBIA branches found'}</option>
                {branchOptions.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Period</p>
              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 mt-1">
                {startDate ? `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}` : `- to ${formatDateLabel(endDate)}`}
              </p>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-4 text-xs font-bold text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : (
            <>
              <div className="grid lg:grid-cols-2 gap-4">
                <DateListCard title="RBIA in Selected Branch" dates={rbiaDates} formatDateLabel={formatDateLabel} />
                <DateListCard title="Sundays" dates={sundays} formatDateLabel={formatDateLabel} />
                <DateListCard title="Second Saturdays" dates={secondSaturdays} formatDateLabel={formatDateLabel} />
                <DateListCard title="Fourth Saturdays" dates={fourthSaturdays} formatDateLabel={formatDateLabel} />
                <DateListCard title="Holidays" dates={holidays} formatDateLabel={formatDateLabel} />
                <DateListCard title="Leaves Taken" dates={leaves} formatDateLabel={formatDateLabel} />
              </div>

              <section className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">Work Conducted in Other Branches</h3>
                  <span className="text-[10px] font-black px-2 py-1 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                    {otherBranchWork.length}
                  </span>
                </div>
                {otherBranchWork.length ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                    <table className="min-w-full text-left text-[11px]">
                      <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase tracking-[0.15em]">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Branch</th>
                          <th className="px-3 py-2">Work Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {otherBranchWork.map((row, idx) => (
                          <tr key={`${row.date}-${row.branch}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{formatDateLabel(row.date)}</td>
                            <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{row.branch}</td>
                            <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{row.inspectionType || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">No work in other branches found for this period.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

