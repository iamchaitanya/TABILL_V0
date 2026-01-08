
export interface ExpenseItem {
  id: string;
  halting: number;
  lodging: number;
}

export interface JourneyItem {
  id: string;
  from: string;
  to: string;
  startTime: string;
  arrivedTime: string;
  amount: number;
  distance?: number;
  travelBy?: string;
}

export interface InspectionEntry {
  id: string;
  date: string;
  branch: string;
  dpCode: string;
  inspectionType: string;
  onwardJourney: JourneyItem[];
  returnJourney: JourneyItem[];
  otherExpenses: ExpenseItem[];
  lastSavedAt?: string;
  dayStatus: 'Inspection' | 'Leave' | 'Holiday';
}

export interface CredentialItem {
  id: string;
  label: string;
  value: string;
  isCustom?: boolean;
}

export interface UserProfile {
  name: string;
  bio: string;
  homeCurrency: string;
  avatar: string | null;
  employeeId: string;
  mobile: string;
  email: string;
  unit: string;
  zi: string;
  credentials: CredentialItem[];
}

export interface TourData {
  tourName: string;
  startDate: string;
  endDate: string;
  currency: string;
  entries: InspectionEntry[];
}

export type AppTab = 'entries' | 'report' | 'summary' | 'profile';
