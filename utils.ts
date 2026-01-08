import { ExpenseItem, JourneyItem } from './types';

export const INSPECTION_TYPES = ['RBIA', 'Others'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

export const formatCurrency = (amount: number, currency: string = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const sumItems = (items: (ExpenseItem | JourneyItem)[]) => {
  return items.reduce((acc, item) => {
    if ('halting' in item) {
      return acc + (item.halting || 0) + (item.lodging || 0);
    }
    return acc + (item.amount || 0);
  }, 0);
};

/**
 * Checks if a given date is a Sunday, 2nd Saturday, or 4th Saturday.
 */
export const isHoliday = (date: Date): boolean => {
  const day = date.getDay();
  const dateNum = date.getDate();
  const isSunday = day === 0;
  const isSaturday = day === 6;
  const isSecondSaturday = isSaturday && dateNum >= 8 && dateNum <= 14;
  const isFourthSaturday = isSaturday && dateNum >= 22 && dateNum <= 28;
  return isSunday || isSecondSaturday || isFourthSaturday;
};

/**
 * Checks if a given YYYY-MM-DD date string is a holiday.
 */
export const isHolidayStr = (dateStr: string): boolean => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return isHoliday(new Date(y, m - 1, d));
};
