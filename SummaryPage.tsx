
import React, { useMemo, useState } from 'react';
import { formatCurrency, isHolidayStr, MONTHS } from './utils';
import { InspectionEntry, UserProfile } from './types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface SummaryPageProps {
  selectedMonthLabel: string;
  navigateMonth: (direction: number) => void;
  reportTotals: { halting: number; lodging: number; travel: number; total: number };
  currency: string;
  reportEntries: InspectionEntry[];
  profile: UserProfile;
  tourName: string;
}

export const SummaryPage: React.FC<SummaryPageProps> = ({
  selectedMonthLabel,
  navigateMonth,
  reportTotals,
  currency,
  reportEntries,
  profile,
  tourName,
}) => {
  // Collapsable states
  const [isSheet1Expanded, setIsSheet1Expanded] = useState(false);
  const [isSheet2Expanded, setIsSheet2Expanded] = useState(false);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [isDetailedExpanded, setIsDetailedExpanded] = useState(false);
  const [isLeaveExpanded, setIsLeaveExpanded] = useState(false);
  const [isHolidayExpanded, setIsHolidayExpanded] = useState(false);
  const [isTotalDaysExpanded, setIsTotalDaysExpanded] = useState(false);

  // Helper to check consecutive dates
  const isConsecutive = (d1Str: string, d2Str: string) => {
    const [y1, m1, day1] = d1Str.split('-').map(Number);
    const [y2, m2, day2] = d2Str.split('-').map(Number);
    const d1 = new Date(y1, m1 - 1, day1);
    const d2 = new Date(y2, m2 - 1, day2);
    d1.setDate(d1.getDate() + 1);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const formatDate = (dStr: string) => {
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const getDayNum = (dStr: string) => dStr.split('-')[2];

  const getHolidayNature = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDay();
    if (day === 0) return 'Sundays';
    if (day === 6) return 'Saturdays';
    return 'Holidays';
  };

  // Generate all dates for the selected month (Sheet 2 logic)
  const monthDates = useMemo(() => {
    const parts = selectedMonthLabel.split(' ');
    if (parts.length < 2) return [];
    const monthName = parts[0];
    const year = parseInt(parts[1]);
    const monthIndex = MONTHS.indexOf(monthName);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    });
  }, [selectedMonthLabel]);

  const branchSummary = useMemo(() => {
    const segments: { 
      branch: string; 
      dpCode: string; 
      inspectionType: string; 
      startDate: string; 
      endDate: string;
      dates: string[];
    }[] = [];
    
    let currentSegment: { 
      branch: string; 
      dpCode: string; 
      inspectionType: string; 
      startDate: string; 
      endDate: string;
      dates: string[];
    } | null = null;

    const sortedEntries = [...reportEntries].sort((a, b) => a.date.localeCompare(b.date));

    sortedEntries.forEach(entry => {
      const isAutoHoliday = isHolidayStr(entry.date);
      const isLeave = entry.dayStatus === 'Leave';
      const isHoliday = entry.dayStatus === 'Holiday' || isAutoHoliday;

      if (isHoliday || isLeave || entry.dayStatus !== 'Inspection' || !entry.branch) {
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = null;
        }
      } else {
        const branchName = entry.branch.trim();
        const dpCode = (entry.dpCode || '').trim();
        const type = (entry.inspectionType || '').trim();

        if (currentSegment && 
            currentSegment.branch === branchName &&
            currentSegment.inspectionType === type &&
            isConsecutive(currentSegment.endDate, entry.date)) {
          currentSegment.endDate = entry.date;
          currentSegment.dates.push(entry.date);

          // Keep optional DP code stable across a continuous duty stretch.
          if (!currentSegment.dpCode && dpCode) {
            currentSegment.dpCode = dpCode;
          }
        } else {
          if (currentSegment) {
            segments.push(currentSegment);
          }
          currentSegment = { 
            branch: branchName, 
            dpCode: dpCode,
            inspectionType: type,
            startDate: entry.date, 
            endDate: entry.date,
            dates: [entry.date]
          };
        }
      }
    });

    if (currentSegment) {
      segments.push(currentSegment);
    }

    return segments.map(seg => ({
      branch: seg.branch,
      dpCode: seg.dpCode,
      inspectionType: seg.inspectionType,
      fromDate: formatDate(seg.startDate),
      toDate: formatDate(seg.endDate),
      manDays: seg.dates.length,
      datesList: seg.dates.map(getDayNum).join(', ')
    }));
  }, [reportEntries]);

  const leaveSummary = useMemo(() => {
    const segments: { 
      startDate: string; 
      endDate: string;
      dates: string[];
    }[] = [];
    
    let currentSegment: { 
      startDate: string; 
      endDate: string;
      dates: string[];
    } | null = null;

    const sortedEntries = [...reportEntries].sort((a, b) => a.date.localeCompare(b.date));

    sortedEntries.forEach(entry => {
      const isHoliday = entry.dayStatus === 'Holiday' || isHolidayStr(entry.date);
      const isActualLeave = entry.dayStatus === 'Leave' && !isHoliday;

      if (isActualLeave) {
        if (currentSegment && isConsecutive(currentSegment.endDate, entry.date)) {
          currentSegment.endDate = entry.date;
          currentSegment.dates.push(entry.date);
        } else {
          if (currentSegment) segments.push(currentSegment);
          currentSegment = { 
            startDate: entry.date, 
            endDate: entry.date,
            dates: [entry.date]
          };
        }
      } else {
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = null;
        }
      }
    });

    if (currentSegment) segments.push(currentSegment);

    return segments.map(seg => ({
      nature: 'Leave',
      fromDate: formatDate(seg.startDate),
      toDate: formatDate(seg.endDate),
      count: seg.dates.length,
      datesList: seg.dates.map(getDayNum).join(', ')
    }));
  }, [reportEntries]);

  const holidaySummary = useMemo(() => {
    const buckets: Record<string, { count: number; dates: string[] }> = {
      'Sundays': { count: 0, dates: [] },
      'Saturdays': { count: 0, dates: [] },
      'Holidays': { count: 0, dates: [] }
    };

    const sortedEntries = [...reportEntries].sort((a, b) => a.date.localeCompare(b.date));

    sortedEntries.forEach(entry => {
      const isAutoHoliday = isHolidayStr(entry.date);
      const isHolidayEntry = entry.dayStatus === 'Holiday' || isAutoHoliday;

      if (isHolidayEntry) {
        const nature = getHolidayNature(entry.date);
        buckets[nature].count += 1;
        buckets[nature].dates.push(getDayNum(entry.date));
      }
    });

    return Object.entries(buckets)
      .filter(([_, data]) => data.count > 0)
      .map(([nature, data]) => ({
        nature,
        count: data.count,
        datesList: data.dates.join(', ')
      }));
  }, [reportEntries]);

  const holidayTotal = useMemo(() => {
    return holidaySummary.reduce((acc, curr) => acc + curr.count, 0);
  }, [holidaySummary]);

  const manDaysTotal = useMemo(() => {
    return branchSummary.reduce((acc, curr) => acc + curr.manDays, 0);
  }, [branchSummary]);

  const leaveTotal = useMemo(() => {
    return leaveSummary.reduce((acc, curr) => acc + curr.count, 0);
  }, [leaveSummary]);

  const totalDaysSummary = useMemo(() => {
    return [
      { nature: 'Man Days', count: manDaysTotal },
      { nature: 'Leaves', count: leaveTotal },
      { nature: 'Holidays', count: holidayTotal },
      { nature: '', count: 0 }
    ];
  }, [manDaysTotal, leaveTotal, holidayTotal]);

  const grandTotalDays = useMemo(() => {
    return manDaysTotal + leaveTotal + holidayTotal;
  }, [manDaysTotal, leaveTotal, holidayTotal]);

  const downloadExcel = async () => {
    const resp = await fetch('/Template.xlsx');
    const arrayBuf = await resp.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuf);

    const ws1 = wb.getWorksheet('Sheet1');
    const ws2 = wb.getWorksheet('Sheet2');
    const ws3 = wb.getWorksheet('Sheet3');

    const setCell = (ws: ExcelJS.Worksheet, r: number, c: number, v: any, upper: boolean = true) => {
      const cell = ws.getCell(r, c);
      const target = (cell as any).master || cell; // write to top-left if merged
      if (v === undefined || v === null || v === '') {
        target.value = '-';
      } else {
        const val = upper && typeof v === 'string' ? v.toUpperCase() : v;
        target.value = val;
      }
    };
    const clearCell = (ws: ExcelJS.Worksheet, r: number, c: number) => {
      const cell = ws.getCell(r, c);
      const target = (cell as any).master || cell;
      target.value = null;
    };
    const clearRange = (ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) => {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) clearCell(ws, r, c);
      }
    };
    const toUpper = (v: any) => (v === undefined || v === null || v === '' ? '-' : String(v).toUpperCase());
    const getCellText = (v: ExcelJS.CellValue): string => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object') {
        if ('text' in (v as any) && typeof (v as any).text === 'string') return (v as any).text;
        if ('richText' in (v as any) && Array.isArray((v as any).richText)) {
          return (v as any).richText.map((t: any) => t?.text || '').join('');
        }
      }
      return '';
    };
    const findRowByText = (ws: ExcelJS.Worksheet, needle: string): number | null => {
      const query = needle.toUpperCase();
      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        for (let c = 1; c <= ws.columnCount; c++) {
          const text = getCellText(row.getCell(c).value).toUpperCase();
          if (text.includes(query)) return r;
        }
      }
      return null;
    };

    // Resolve dynamic section anchors so small template layout shifts don't break mapping.
    const dutyHeaderRow = findRowByText(ws1, '1. PARTICULARS OF DUTY ATTENDED') ?? 27;
    const mandaysHeaderRow = findRowByText(ws1, '2. TOTAL MANDAYS ATTENDED') ?? 43;
    const holidayHeaderRow = findRowByText(ws1, '4. PUBLIC HOLIDAYS') ?? 69;
    const grandTotalHeaderRow = findRowByText(ws1, '5. GRAND TOTAL') ?? 78;
    const leaveHeaderRow = findRowByText(ws1, '3. LEAVE AVAILED') ?? 65;
    const localConveyanceHeaderRow = findRowByText(ws1, '6. AMOUNT CLAIMED UNDER LOCAL CONVEYANCE') ?? 88;

    const dutyStartRow = dutyHeaderRow + 3; // headers occupy 2 rows after section title
    const mandaysStartRow = mandaysHeaderRow + 5; // section title + 4 header rows
    const holidayStartRow = holidayHeaderRow + 2; // section title + 1 header row
    const holidayTotalRow = holidayStartRow + 3;
    const leaveStartRow = leaveHeaderRow + 3; // section title + 2 header rows
    const leaveEndRow = holidayHeaderRow - 1;
    const dutyEndRow = mandaysHeaderRow - 2;
    const mandaysEndRow = leaveHeaderRow - 3;
    const grandTotalManDaysRow = grandTotalHeaderRow + 2;
    const grandTotalLeaveRow = grandTotalHeaderRow + 3;
    const grandTotalHolidayRow = grandTotalHeaderRow + 4;
    const grandTotalAllDaysRow = grandTotalHeaderRow + 6;

    // Sheet1 header
    setCell(ws1, 7, 4, profile.name);
    setCell(ws1, 8, 4, profile.employeeId);
    setCell(ws1, 22, 17, selectedMonthLabel, false);
    setCell(ws1, 22, 22, reportTotals.total, false);

    // Duty rows (uppercase strings)
    clearRange(ws1, dutyStartRow, 2, dutyEndRow, 25);
    const dutyRowsCapacity = Math.max(0, dutyEndRow - dutyStartRow + 1);
    branchSummary.slice(0, dutyRowsCapacity).forEach((seg, idx) => {
      const r = dutyStartRow + idx;
      setCell(ws1, r, 2, idx + 1, false);
      for (let c = 3; c <= 8; c++) setCell(ws1, r, c, seg.branch, true);
      for (let c = 9; c <= 10; c++) setCell(ws1, r, c, seg.dpCode || '-', true);
      for (let c = 11; c <= 15; c++) setCell(ws1, r, c, seg.inspectionType || '-', true);
      for (let c = 16; c <= 18; c++) setCell(ws1, r, c, seg.fromDate || '-', false);
      for (let c = 19; c <= 21; c++) setCell(ws1, r, c, seg.toDate || '-', false);
      setCell(ws1, r, 22, seg.branch || '-', true);
    });

    // Mandays
    for (let r = mandaysHeaderRow + 3; r <= mandaysStartRow - 1; r++) {
      const bText = getCellText(ws1.getCell(r, 2).value).toUpperCase();
      if (bText.includes('SL. NO.')) clearRange(ws1, r, 2, r, 25);
    }
    clearRange(ws1, mandaysStartRow, 2, mandaysEndRow, 25);
    const mandaysRowsCapacity = Math.max(0, mandaysEndRow - mandaysStartRow + 1);
    branchSummary.slice(0, mandaysRowsCapacity).forEach((seg, idx) => {
      const r = mandaysStartRow + idx;
      setCell(ws1, r, 2, idx + 1, false);
      for (let c = 3; c <= 8; c++) setCell(ws1, r, c, seg.branch, true);
      for (let c = 9; c <= 10; c++) setCell(ws1, r, c, seg.dpCode || '-', true);
      for (let c = 11; c <= 13; c++) setCell(ws1, r, c, seg.fromDate || '-', false);
      for (let c = 14; c <= 16; c++) setCell(ws1, r, c, seg.toDate || '-', false);
      setCell(ws1, r, 17, seg.manDays || '-', false);
      setCell(ws1, r, 20, seg.manDays === 1 ? 'Day' : 'Days', false);
      setCell(ws1, r, 21, seg.datesList || '-', true);
    });
    // Keep merge consistent with surrounding rows (user-noted N51/O51 misalignment in updated template)
    const mergeFixRow = mandaysStartRow + 2;
    if (mergeFixRow <= mandaysEndRow) {
      try { ws1.unMergeCells(mergeFixRow, 14, mergeFixRow, 16); } catch {}
      try { ws1.unMergeCells(mergeFixRow, 15, mergeFixRow, 16); } catch {}
      try { ws1.mergeCells(mergeFixRow, 14, mergeFixRow, 16); } catch {}
    }

    // Leave table
    clearRange(ws1, leaveStartRow, 2, leaveEndRow, 25);
    const leaveRowsCapacity = Math.max(0, leaveEndRow - leaveStartRow + 1);
    leaveSummary.slice(0, leaveRowsCapacity).forEach((seg, idx) => {
      const r = leaveStartRow + idx;
      setCell(ws1, r, 2, idx + 1, false);
      for (let c = 3; c <= 10; c++) setCell(ws1, r, c, seg.nature, true);
      for (let c = 11; c <= 13; c++) setCell(ws1, r, c, seg.fromDate || '-', false);
      for (let c = 14; c <= 16; c++) setCell(ws1, r, c, seg.toDate || '-', false);
      for (let c = 17; c <= 18; c++) setCell(ws1, r, c, seg.count || '-', false);
      for (let c = 19; c <= 20; c++) setCell(ws1, r, c, seg.count || '-', false);
      setCell(ws1, r, 21, seg.datesList || '-', true);
    });

    // Holidays
    clearRange(ws1, holidayStartRow, 2, holidayTotalRow, 25);
    holidaySummary.slice(0, 3).forEach((seg, idx) => {
      const r = holidayStartRow + idx;
      setCell(ws1, r, 2, idx + 1, false);
      for (let c = 3; c <= 13; c++) setCell(ws1, r, c, seg.nature, true);
      for (let c = 14; c <= 16; c++) setCell(ws1, r, c, seg.count, false);
      for (let c = 17; c <= 20; c++) setCell(ws1, r, c, seg.count, false);
      setCell(ws1, r, 21, seg.datesList, true);
    });
    setCell(ws1, holidayTotalRow, 3, 'TOTAL', true);
    for (let c = 14; c <= 16; c++) setCell(ws1, holidayTotalRow, c, holidayTotal, false);
    // Keep Q76 blank as requested (updated template position of total row in this section).
    for (let c = 17; c <= 20; c++) clearCell(ws1, holidayTotalRow, c);

    // Totals summary
    const leaveTotal = totalDaysSummary.find(r => r.nature === 'Leaves')?.count || 0;
    for (let c = 17; c <= 20; c++) setCell(ws1, grandTotalManDaysRow, c, manDaysTotal, false);
    for (let c = 17; c <= 20; c++) setCell(ws1, grandTotalLeaveRow, c, leaveTotal || '-', false);
    for (let c = 17; c <= 20; c++) setCell(ws1, grandTotalHolidayRow, c, holidayTotal, false);
    for (let c = 17; c <= 20; c++) setCell(ws1, grandTotalAllDaysRow, c, grandTotalDays, false);

    // Sheet2 audit
    const sheet2DataStartRow = 13;
    const sheet2DataEndRow = 74; // 31 days * 2 rows/day
    clearRange(ws2, sheet2DataStartRow, 2, sheet2DataEndRow, 15);

    monthDates.forEach((dateStr, idx) => {
      const entry = reportEntries.find(e => e.date === dateStr);
      const isHoliday = isHolidayStr(dateStr) || (entry && entry.dayStatus === 'Holiday');
      const isLeave = entry && entry.dayStatus === 'Leave';
      const isHolidayOrLeave = isHoliday || isLeave;
      const dateLabel = formatDate(dateStr);
      const catLabel = toUpper(isHoliday ? 'Holiday' : (isLeave ? 'Leave' : (entry?.inspectionType || '-')));
      const branchLabel = toUpper(isHoliday ? 'Holiday' : (isLeave ? 'Leave' : (entry?.branch || '-')));
      const onward = entry?.onwardJourney?.[0] || null;
      const returnJ = entry?.returnJourney?.[0] || null;
      let dailyHalting = 0, dailyLodging = 0;
      entry?.otherExpenses?.forEach(exp => { dailyHalting += exp.halting || 0; dailyLodging += exp.lodging || 0; });

      const rOn = sheet2DataStartRow + idx * 2;
      if (rOn + 1 > sheet2DataEndRow) return;
      setCell(ws2, rOn, 2, dateLabel, false);
      setCell(ws2, rOn, 3, catLabel, true);
      setCell(ws2, rOn, 4, 'Onward', false);
      setCell(ws2, rOn, 5, isHolidayOrLeave ? '-' : onward?.from || '-', true);
      setCell(ws2, rOn, 6, isHolidayOrLeave ? '-' : (onward?.startTime || '-'), false);
      setCell(ws2, rOn, 7, isHolidayOrLeave ? '-' : onward?.to || '-', true);
      setCell(ws2, rOn, 8, isHolidayOrLeave ? '-' : (onward?.arrivedTime || '-'), false);
      setCell(ws2, rOn, 9, isHolidayOrLeave || !onward?.distance ? '-' : onward.distance, false);
      setCell(ws2, rOn, 10, isHolidayOrLeave ? '-' : onward?.travelBy || (onward ? 'Bus' : '-'), true);
      setCell(ws2, rOn, 11, isHolidayOrLeave || !onward?.amount ? '-' : onward.amount, false);
      setCell(ws2, rOn, 12, isHolidayOrLeave || !dailyLodging ? '-' : dailyLodging, false);
      setCell(ws2, rOn, 13, '-', false);
      setCell(ws2, rOn, 14, isHolidayOrLeave || !dailyHalting ? '-' : dailyHalting, false);
      setCell(ws2, rOn, 15, '-', false);

      const rRet = rOn + 1;
      // Do NOT write date on return row, because Bx:Bx+1 is merged; writing here would clear the date.
      setCell(ws2, rRet, 3, branchLabel, true);
      setCell(ws2, rRet, 4, 'Return', false);
      setCell(ws2, rRet, 5, isHolidayOrLeave ? '-' : returnJ?.from || '-', true);
      setCell(ws2, rRet, 6, isHolidayOrLeave ? '-' : (returnJ?.startTime || '-'), false);
      setCell(ws2, rRet, 7, isHolidayOrLeave ? '-' : returnJ?.to || '-', true);
      setCell(ws2, rRet, 8, isHolidayOrLeave ? '-' : (returnJ?.arrivedTime || '-'), false);
      setCell(ws2, rRet, 9, isHolidayOrLeave || !returnJ?.distance ? '-' : returnJ.distance, false);
      setCell(ws2, rRet, 10, isHolidayOrLeave ? '-' : returnJ?.travelBy || (returnJ ? 'Bus' : '-'), true);
      setCell(ws2, rRet, 11, isHolidayOrLeave || !returnJ?.amount ? '-' : returnJ.amount, false);
      setCell(ws2, rRet, 12, '-', false);
      setCell(ws2, rRet, 13, '-', false);
      setCell(ws2, rRet, 14, '-', false);
      setCell(ws2, rRet, 15, '-', false);
    });

    // Sheet3 totals (minimal)
    setCell(ws3, 7, 18, reportTotals.travel, false);
    setCell(ws3, 9, 18, reportTotals.lodging, false);
    setCell(ws3, 11, 18, '-', false);
    setCell(ws3, 13, 18, reportTotals.halting, false);
    setCell(ws3, 15, 18, 0, false);
    setCell(ws3, 20, 18, reportTotals.total, false);
    setCell(ws3, 22, 18, 0, false);
    setCell(ws3, 24, 18, reportTotals.total, false);

    // Apply borders to all table regions across sheets.
    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      right: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' }
    };
    const applyBorderRange = (ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) => {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          ws.getCell(r, c).border = thinBorder as ExcelJS.Borders;
        }
      }
    };

    applyBorderRange(ws1, dutyHeaderRow + 1, 2, dutyEndRow, 25);
    applyBorderRange(ws1, mandaysHeaderRow + 1, 2, mandaysEndRow, 25);
    applyBorderRange(ws1, leaveHeaderRow + 1, 2, leaveEndRow, 25);
    applyBorderRange(ws1, holidayHeaderRow + 1, 2, holidayTotalRow, 25);
    applyBorderRange(ws1, grandTotalHeaderRow + 1, 2, grandTotalAllDaysRow, 25);
    applyBorderRange(ws1, localConveyanceHeaderRow + 1, 2, localConveyanceHeaderRow + 2, 25);
    applyBorderRange(ws2, 9, 2, 75, 18);
    applyBorderRange(ws3, 5, 2, 32, 18);

    const ws4 = wb.getWorksheet('Sheet4');
    if (ws4 && ws4.rowCount > 0 && ws4.columnCount > 0) {
      applyBorderRange(ws4, 1, 1, ws4.rowCount, ws4.columnCount);
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `TA_BILL_${selectedMonthLabel.replace(' ', '_')}.xlsx`);
  };

  const downloadCSV = () => {
    let csv = `TOUR EXPENSE REPORT - ${selectedMonthLabel}\n`;
    csv += `==================================================\n`;
    csv += `Inspector Name:,"${profile.name || ''}"\n`;
    csv += `Employee ID:,"${profile.employeeId || ''}"\n`;
    csv += `Tour Name:,"${tourName || ''}"\n`;
    csv += `Report Month:,"${selectedMonthLabel}"\n`;
    csv += `==================================================\n\n`;

    // SUMMARY TOTALS
    csv += `SUMMARY OF ALLOWANCES\n`;
    csv += `--------------------------------------------------\n`;
    csv += `Total Halting Allowance:,,,,,,,,,,,"${reportTotals.halting.toFixed(2)}"\n`;
    csv += `Total Lodging Allowance:,,,,,,,,,,,"${reportTotals.lodging.toFixed(2)}"\n`;
    csv += `Total Travel Expenses:,,,,,,,,,,,"${reportTotals.travel.toFixed(2)}"\n`;
    csv += `TOTAL REIMBURSEMENT CLAIM:,,,,,,,,,,,"${reportTotals.total.toFixed(2)} ${currency}"\n\n`;

    // --- SHEET 1 SECTION ---
    csv += "--- SHEET 1: SUMMARIES ---\n\n";

    csv += "1. PARTICULARS OF DUTY\n";
    csv += "Sl.No,Branch Name,DP Code,Inspection Type,From,To,Place of Operation\n";
    branchSummary.forEach((seg, idx) => {
      csv += `${idx + 1},"${seg.branch}","${seg.dpCode}","${seg.inspectionType}","${seg.fromDate}","${seg.toDate}","${seg.branch}"\n`;
    });
    csv += "\n";

    csv += "2. TOTAL MANDAYS ATTENDED\n";
    csv += "Sl.No,Branch,DP Code,From,To,Man Days,Dates\n";
    branchSummary.forEach((seg, idx) => {
      csv += `${idx + 1},"${seg.branch}","${seg.dpCode}","${seg.fromDate}","${seg.toDate}",${seg.manDays},"${seg.datesList}"\n`;
    });
    csv += "\n";

    csv += "3. LEAVES AVAILED\n";
    csv += "Sl.No,Nature,From,To,No. of Days,Dates\n";
    leaveSummary.forEach((seg, idx) => {
      csv += `${idx + 1},"${seg.nature}","${seg.fromDate}","${seg.toDate}",${seg.count},"${seg.datesList}"\n`;
    });
    csv += "\n";

    csv += "4. HOLIDAYS\n";
    csv += "Sl.No,Nature,No. of Full Days,Dates\n";
    holidaySummary.forEach((seg, idx) => {
      csv += `${idx + 1},"${seg.nature}",${seg.count},"${seg.datesList}"\n`;
    });
    csv += `Total,,${holidayTotal}\n\n`;

    csv += "5. TOTAL DAYS SUMMARY\n";
    csv += "Sl.No,Nature,Total No. of Days\n";
    totalDaysSummary.forEach((row, idx) => {
      csv += `${idx + 1},"${row.nature}",${row.count || ""}\n`;
    });
    csv += `Total,,${grandTotalDays}\n\n`;

    // --- SHEET 2 SECTION ---
    csv += "--- SHEET 2: DETAILED AUDIT LOG ---\n\n";
    const sheet2Headers = [
      "Date", "Category/Branch", "O/R", "Start From", "Start Time", "Arrival To", "Arrival Time", 
      "Distance", "Mode", "Fare", "Lodging", "Boarding", "Halting", "Diem"
    ];
    csv += sheet2Headers.join(",") + "\n";

    monthDates.forEach((dateStr) => {
      const entry = reportEntries.find(e => e.date === dateStr);
      const isHoliday = isHolidayStr(dateStr) || (entry && entry.dayStatus === 'Holiday');
      const isLeave = entry && entry.dayStatus === 'Leave';
      const isHolidayOrLeave = isHoliday || isLeave;

      const dateLabel = formatDate(dateStr);
      const catLabel = isHoliday ? 'Holiday' : (isLeave ? 'Leave' : (entry?.inspectionType || '-'));
      const branchLabel = isHoliday ? 'Holiday' : (isLeave ? 'Leave' : (entry?.branch || '-'));

      const onward = (entry?.onwardJourney?.[0]) || null;
      const returnJ = (entry?.returnJourney?.[0]) || null;

      let dailyHalting = 0, dailyLodging = 0;
      entry?.otherExpenses?.forEach(exp => {
        dailyHalting += exp.halting || 0;
        dailyLodging += exp.lodging || 0;
      });

      // ONWARD ROW
      const onwardRow = [
        dateLabel,
        `"${catLabel}"`,
        "Onward",
        `"${isHolidayOrLeave ? '-' : (onward?.from || '-')}"`,
        `"${isHolidayOrLeave ? '-' : (onward?.startTime || '-')}"`,
        `"${isHolidayOrLeave ? '-' : (onward?.to || '-')}"`,
        `"${isHolidayOrLeave ? '-' : (onward?.arrivedTime || '-')}"`,
        isHolidayOrLeave || !onward?.distance ? '-' : onward.distance,
        `"${isHolidayOrLeave ? '-' : (onward?.travelBy || (onward ? 'Bus' : '-'))}"`,
        isHolidayOrLeave || !onward?.amount ? '-' : onward.amount.toFixed(2),
        isHolidayOrLeave || !dailyLodging ? '-' : dailyLodging.toFixed(2),
        "-", // Boarding
        isHolidayOrLeave || !dailyHalting ? '-' : dailyHalting.toFixed(2),
        "-"  // Diem
      ];
      csv += onwardRow.join(",") + "\n";

      // RETURN ROW
      const returnRow = [
        "", // Blank date to indicate span
        `"${branchLabel}"`,
        "Return",
        `"${isHolidayOrLeave ? '-' : (returnJ?.from || '-')}"`,
        `"${isHolidayOrLeave ? '-' : (returnJ?.startTime || '-')}"`,
        `"${isHolidayOrLeave ? '-' : (returnJ?.to || '-')}"`,
        `"${isHolidayOrLeave ? '-' : (returnJ?.arrivedTime || '-')}"`,
        isHolidayOrLeave || !returnJ?.distance ? '-' : returnJ.distance,
        `"${isHolidayOrLeave ? '-' : (returnJ?.travelBy || (returnJ ? 'Bus' : '-'))}"`,
        isHolidayOrLeave || !returnJ?.amount ? '-' : returnJ.amount.toFixed(2),
        "-", // Lodging
        "-", // Boarding
        "-", // Halting
        "-"  // Diem
      ];
      csv += returnRow.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Tour_Report_${selectedMonthLabel.replace(' ', '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-teal-100 dark:border-slate-800 p-3 shadow-sm flex flex-col items-center no-print transition-colors">
        <div className="flex items-center justify-between w-full max-md bg-teal-50/50 dark:bg-teal-900/10 p-1.5 rounded-xl border border-teal-100 dark:border-teal-900/50">
          <button onClick={() => navigateMonth(-1)} className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/20 rounded-lg transition-all active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <h2 className="text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">{selectedMonthLabel}</h2>
          </div>
          <button onClick={() => navigateMonth(1)} className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/20 rounded-lg transition-all active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-teal-100 dark:border-slate-800 p-8 shadow-sm space-y-8 invoice-shadow transition-colors">
        <div className="flex items-center justify-between border-b border-teal-50 dark:border-slate-800 pb-4">
          <h3 className="text-sm font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">Monthly Summary</h3>
          <div className="bg-teal-50 dark:bg-teal-900/20 px-3 py-1 rounded-full">
             <span className="text-[10px] font-black text-teal-600 dark:text-teal-500 uppercase tracking-widest">{selectedMonthLabel}</span>
          </div>
        </div>
        
        {/* Horizontal Stacking of Allowances */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Halting Allowance</p>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100">{formatCurrency(reportTotals.halting, currency)}</p>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lodging Allowance</p>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100">{formatCurrency(reportTotals.lodging, currency)}</p>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Travel Expenses</p>
            <p className="text-lg font-black text-slate-800 dark:text-slate-100">{formatCurrency(reportTotals.travel, currency)}</p>
          </div>
        </div>

        {/* Total Reimbursement Claim */}
        <div className="py-6 border-y-2 border-teal-50 dark:border-slate-800 flex flex-col items-center gap-2 transition-colors">
          <p className="text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">Total Reimbursement Claim</p>
          <p className="text-4xl font-black text-teal-600 dark:text-teal-500 tracking-tight">{formatCurrency(reportTotals.total, currency)}</p>
        </div>

        {/* Sheet 1 - Main Collapsable Container */}
        <div className="space-y-4">
          <button 
            onClick={() => setIsSheet1Expanded(!isSheet1Expanded)}
            className="w-full flex items-center justify-between p-4 bg-teal-50/50 dark:bg-teal-900/10 rounded-2xl border border-teal-100 dark:border-teal-900/50 group cursor-pointer focus:outline-none hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all"
          >
            <h4 className="text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-[0.2em] group-hover:text-teal-600 transition-colors">Sheet 1</h4>
            <div className={`p-1 rounded-md transition-all duration-300 ${isSheet1Expanded ? 'rotate-180 text-teal-600' : 'text-teal-400'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {isSheet1Expanded && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Particulars of Duty */}
              <div className="space-y-4 pl-4 border-l-2 border-teal-50 dark:border-slate-800">
                <button 
                  onClick={() => setIsLogExpanded(!isLogExpanded)}
                  className="w-full flex items-center justify-between group cursor-pointer focus:outline-none"
                >
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] group-hover:text-teal-600 transition-colors">Particulars of Duty</h4>
                  <div className={`p-1 rounded-md transition-all duration-300 ${isLogExpanded ? 'rotate-180 text-teal-600 bg-teal-50 dark:bg-teal-900/20' : 'text-slate-400 bg-slate-50 dark:bg-slate-800'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {isLogExpanded && (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors">
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">Sl.No</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">Branch Name</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">DP Code</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">Inspection Type</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">From</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">To</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest">Place of Operation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {branchSummary.length > 0 ? (
                          branchSummary.map((seg, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500">{idx + 1}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{seg.branch}</td>
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{seg.dpCode || '-'}</td>
                              <td className="px-4 py-4 text-[11px] font-bold text-teal-600 dark:text-teal-500 uppercase">{seg.inspectionType}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200">{seg.fromDate}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200">{seg.toDate}</td>
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-tight">{seg.branch}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-6 py-10 text-center text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest italic">
                              No inspection data recorded for this month
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Total Mandays Attended */}
              <div className="space-y-4 pl-4 border-l-2 border-teal-50 dark:border-slate-800">
                <button 
                  onClick={() => setIsDetailedExpanded(!isDetailedExpanded)}
                  className="w-full flex items-center justify-between group cursor-pointer focus:outline-none"
                >
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] group-hover:text-teal-600 transition-colors">Total Mandays Attended</h4>
                  <div className={`p-1 rounded-md transition-all duration-300 ${isDetailedExpanded ? 'rotate-180 text-teal-600 bg-teal-50 dark:bg-teal-900/20' : 'text-slate-400 bg-slate-50 dark:bg-slate-800'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {isDetailedExpanded && (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors text-center">
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Sl.No</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Branch</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">DP Code</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">From</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">To</th>
                          <th colSpan={2} className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest border-x border-slate-200 dark:border-slate-700">No. of Man Days</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Dates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {branchSummary.length > 0 ? (
                          branchSummary.map((seg, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-center">
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 text-left">{idx + 1}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight text-left">{seg.branch}</td>
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-left">{seg.dpCode || '-'}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200 text-left">{seg.fromDate}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200 text-left">{seg.toDate}</td>
                              <td className="px-2 py-4 text-[11px] font-black text-teal-600 dark:text-teal-500 border-l border-slate-100 dark:border-slate-800">{seg.manDays}</td>
                              <td className="px-2 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter border-r border-slate-100 dark:border-slate-800">{seg.manDays === 1 ? 'Day' : 'Days'}</td>
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-500 text-left">{seg.datesList}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-6 py-10 text-center text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest italic">
                              No detailed inspection data available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Leaves Availed */}
              <div className="space-y-4 pl-4 border-l-2 border-teal-50 dark:border-slate-800">
                <button 
                  onClick={() => setIsLeaveExpanded(!isLeaveExpanded)}
                  className="w-full flex items-center justify-between group cursor-pointer focus:outline-none"
                >
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] group-hover:text-teal-600 transition-colors">Leaves Availed</h4>
                  <div className={`p-1 rounded-md transition-all duration-300 ${isLeaveExpanded ? 'rotate-180 text-teal-600 bg-teal-50 dark:bg-teal-900/20' : 'text-slate-400 bg-slate-50 dark:bg-slate-800'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {isLeaveExpanded && (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors text-center">
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Sl.No</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Nature</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">From</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">To</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">No. of Days</th>
                          <th colSpan={2} className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest border-x border-slate-200 dark:border-slate-700">No. of Man Days</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Dates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {leaveSummary.length > 0 ? (
                          leaveSummary.map((seg, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-center">
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 text-left">{idx + 1}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight text-left">{seg.nature}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200 text-left">{seg.fromDate}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200 text-left">{seg.toDate}</td>
                              <td className="px-4 py-4 text-[11px] font-black text-teal-600 dark:text-teal-500 text-left">{seg.count}</td>
                              <td className="px-2 py-4 text-[11px] font-black text-teal-600 dark:text-teal-500 border-l border-slate-100 dark:border-slate-800">{seg.count}</td>
                              <td className="px-2 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter border-r border-slate-100 dark:border-slate-800">{seg.count === 1 ? 'Day' : 'Days'}</td>
                              <td className="px-4 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-500 text-left">{seg.datesList}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="px-6 py-10 text-center text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest italic">
                              No leave data available for this month
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Holidays */}
              <div className="space-y-4 pl-4 border-l-2 border-teal-50 dark:border-slate-800">
                <button 
                  onClick={() => setIsHolidayExpanded(!isHolidayExpanded)}
                  className="w-full flex items-center justify-between group cursor-pointer focus:outline-none"
                >
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] group-hover:text-teal-600 transition-colors">Holidays</h4>
                  <div className={`p-1 rounded-md transition-all duration-300 ${isHolidayExpanded ? 'rotate-180 text-teal-600 bg-teal-50 dark:bg-teal-900/20' : 'text-slate-400 bg-slate-50 dark:bg-slate-800'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {isHolidayExpanded && (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors text-center">
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Sl.No</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Nature</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left text-center">No. of Full Days</th>
                          <th colSpan={2} className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest border-x border-slate-200 dark:border-slate-700">No. of Man Days</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Dates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {holidaySummary.length > 0 ? (
                          <>
                            {holidaySummary.map((seg, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-center">
                                <td className="px-4 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 text-left">{idx + 1}</td>
                                <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight text-left">{seg.nature}</td>
                                <td className="px-4 py-4 text-[11px] font-black text-teal-600 dark:text-teal-500 text-center">{seg.count}</td>
                                <td className="px-2 py-4 text-[11px] font-black text-teal-600 dark:text-teal-500 border-l border-slate-100 dark:border-slate-800">{seg.count}</td>
                                <td className="px-2 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter border-r border-slate-100 dark:border-slate-800">{seg.count === 1 ? 'Day' : 'Days'}</td>
                                <td className="px-4 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-500 text-left">{seg.datesList}</td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 font-black">
                              <td colSpan={2} className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-right">Total</td>
                              <td className="px-4 py-4 text-[11px] text-teal-600 dark:text-teal-500 text-center">{holidayTotal}</td>
                              <td className="px-2 py-4 text-[11px] text-teal-600 dark:text-teal-500 border-l border-slate-100 dark:border-slate-800">{holidayTotal}</td>
                              <td className="px-2 py-4 text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-tighter border-r border-slate-100 dark:border-slate-800">{holidayTotal === 1 ? 'Day' : 'Days'}</td>
                              <td className="px-4 py-4"></td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest italic">
                              No holiday data available for this month
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Total Days Summary */}
              <div className="space-y-4 pl-4 border-l-2 border-teal-50 dark:border-slate-800">
                <button 
                  onClick={() => setIsTotalDaysExpanded(!isTotalDaysExpanded)}
                  className="w-full flex items-center justify-between group cursor-pointer focus:outline-none"
                >
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] group-hover:text-teal-600 transition-colors">Total Days</h4>
                  <div className={`p-1 rounded-md transition-all duration-300 ${isTotalDaysExpanded ? 'rotate-180 text-teal-600 bg-teal-50 dark:bg-teal-900/20' : 'text-slate-400 bg-slate-50 dark:bg-slate-800'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {isTotalDaysExpanded && (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors">
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Sl.No</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-left">Nature</th>
                          <th className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-center">Total No. of Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {totalDaysSummary.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500">{idx + 1}</td>
                            <td className="px-4 py-4 text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{row.nature}</td>
                            <td className="px-4 py-4 text-[11px] font-black text-teal-600 dark:text-teal-500 text-center">{row.count || ''}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50/50 dark:bg-slate-800/50 font-black">
                          <td colSpan={2} className="px-4 py-4 text-[10px] font-black text-teal-900 dark:text-teal-400 uppercase tracking-widest text-right">Total</td>
                          <td className="px-4 py-4 text-[11px] text-teal-600 dark:text-teal-500 text-center">{grandTotalDays}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sheet 2 - 14 Columns Audit Log */}
        <div className="space-y-4">
          <button 
            onClick={() => setIsSheet2Expanded(!isSheet2Expanded)}
            className="w-full flex items-center justify-between p-4 bg-teal-50/50 dark:bg-teal-900/10 rounded-2xl border border-teal-100 dark:border-teal-900/50 group cursor-pointer focus:outline-none hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all"
          >
            <h4 className="text-xs font-black text-teal-900 dark:text-teal-400 uppercase tracking-[0.2em] group-hover:text-teal-600 transition-colors">Sheet 2</h4>
            <div className={`p-1 rounded-md transition-all duration-300 ${isSheet2Expanded ? 'rotate-180 text-teal-600' : 'text-teal-400'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {isSheet2Expanded && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="border border-slate-100 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
                  <table className="w-full text-left border-collapse min-w-[1400px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-teal-900 text-white border-b border-teal-800">
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest">Date</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest">Category</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest">O/R</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest">Start From</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest">Start Time</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest">Arrival To</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest">Arrival Time</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest text-center">Distance</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest">Mode</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest text-right">Fare</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest text-right">Lodging</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest text-right">Boarding</th>
                        <th className="px-3 py-4 text-[9px] font-black uppercase tracking-widest text-right">Halting</th>
                        <th className="px-3 py-4 text-[9px) font-black uppercase tracking-widest text-right">Diem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {monthDates.map((dateStr) => {
                        const entry = reportEntries.find(e => e.date === dateStr);
                        const isHoliday = isHolidayStr(dateStr) || (entry && entry.dayStatus === 'Holiday');
                        const isLeave = entry && entry.dayStatus === 'Leave';
                        const isHolidayOrLeave = isHoliday || isLeave;
                        
                        // Extracting Journey Details
                        const onward = (entry && entry.onwardJourney && entry.onwardJourney.length > 0) ? entry.onwardJourney[0] : null;
                        const returnJ = (entry && entry.returnJourney && entry.returnJourney.length > 0) ? entry.returnJourney[0] : null;
                        
                        // Extracting Daily Allowance
                        let halting = 0, lodging = 0;
                        if (entry && entry.otherExpenses) {
                          entry.otherExpenses.forEach(exp => {
                            halting += exp.halting || 0;
                            lodging += exp.lodging || 0;
                          });
                        }

                        const category = isHoliday ? 'Holiday' : (isLeave ? 'Leave' : (entry?.inspectionType || '-'));
                        const branchName = isHoliday ? 'Holiday' : (isLeave ? 'Leave' : (entry?.branch || '-'));
                        const dateLabel = formatDate(dateStr);

                        // Row Styling Logic
                        const rowStyle = isHoliday ? 'bg-red-50/10 dark:bg-red-900/5' : (isLeave ? 'bg-blue-50/10 dark:bg-blue-900/5' : '');

                        return (
                          <React.Fragment key={dateStr}>
                            {/* ONWARD ROW */}
                            <tr className={`hover:bg-teal-50/20 dark:hover:bg-slate-800 transition-colors ${rowStyle}`}>
                              <td rowSpan={2} className="px-3 py-4 text-[10px] font-black text-slate-900 dark:text-slate-100 border-r border-slate-50 dark:border-slate-800">{dateLabel}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-teal-600 dark:text-teal-500 uppercase border-r border-slate-50 dark:border-slate-800">{category}</td>
                              <td className="px-3 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Onward</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-800 dark:text-slate-200">{isHolidayOrLeave ? '-' : (onward?.from || '-')}</td>
                              <td className="px-3 py-3 text-[9px] font-medium text-slate-600 dark:text-slate-400">{isHolidayOrLeave ? '-' : (onward?.startTime || '-')}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-800 dark:text-slate-200">{isHolidayOrLeave ? '-' : (onward?.to || '-')}</td>
                              <td className="px-3 py-3 text-[9px] font-medium text-slate-600 dark:text-slate-400">{isHolidayOrLeave ? '-' : (onward?.arrivedTime || '-')}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-800 dark:text-slate-200 text-center">{isHolidayOrLeave || !onward?.distance ? '-' : `${onward.distance} km`}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase">{isHolidayOrLeave ? '-' : (onward?.travelBy || (onward ? 'Bus' : '-'))}</td>
                              <td className="px-3 py-3 text-[9px] font-black text-teal-700 dark:text-teal-400 text-right">{isHolidayOrLeave || !onward?.amount ? '-' : onward.amount.toFixed(2)}</td>
                              <td className="px-3 py-3 text-[9px] font-black text-slate-700 dark:text-slate-300 text-right">{isHolidayOrLeave || !lodging ? '-' : lodging.toFixed(2)}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-400 dark:text-slate-600 text-right">-</td>
                              <td className="px-3 py-3 text-[9px] font-black text-slate-700 dark:text-slate-300 text-right">{isHolidayOrLeave || !halting ? '-' : halting.toFixed(2)}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-400 dark:text-slate-600 text-right">-</td>
                            </tr>
                            {/* RETURN ROW */}
                            <tr className={`hover:bg-teal-50/20 dark:hover:bg-slate-800 transition-colors ${rowStyle}`}>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-700 dark:text-slate-300 uppercase border-r border-slate-50 dark:border-slate-800">{branchName}</td>
                              <td className="px-3 py-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Return</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-800 dark:text-slate-200">{isHolidayOrLeave ? '-' : (returnJ?.from || '-')}</td>
                              <td className="px-3 py-3 text-[9px] font-medium text-slate-600 dark:text-slate-400">{isHolidayOrLeave ? '-' : (returnJ?.startTime || '-')}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-800 dark:text-slate-200">{isHolidayOrLeave ? '-' : (returnJ?.to || '-')}</td>
                              <td className="px-3 py-3 text-[9px] font-medium text-slate-600 dark:text-slate-400">{isHolidayOrLeave ? '-' : (returnJ?.arrivedTime || '-')}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-800 dark:text-slate-200 text-center">{isHolidayOrLeave || !returnJ?.distance ? '-' : `${returnJ.distance} km`}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase">{isHolidayOrLeave ? '-' : (returnJ?.travelBy || (returnJ ? 'Bus' : '-'))}</td>
                              <td className="px-3 py-3 text-[9px] font-black text-teal-700 dark:text-teal-400 text-right">{isHolidayOrLeave || !returnJ?.amount ? '-' : returnJ.amount.toFixed(2)}</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-400 dark:text-slate-600 text-right">-</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-400 dark:text-slate-600 text-right">-</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-400 dark:text-slate-600 text-right">-</td>
                              <td className="px-3 py-3 text-[9px] font-bold text-slate-400 dark:text-slate-600 text-right">-</td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Buttons at bottom */}
        <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-3 w-full justify-center no-print">
          <button 
            onClick={downloadExcel} 
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white rounded-[20px] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel Export
          </button>
        </div>
      </div>
    </div>
  );
};
