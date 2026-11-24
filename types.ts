
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
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  designation: string;
  basicPay: string;
  accountNumber: string;
  accountBranch: string;
  credentials: CredentialItem[];
  /** ISO timestamp of the last credential change, used for last-write-wins sync. */
  credentialsUpdatedAt?: string;
}

export interface TourData {
  tourName: string;
  startDate: string;
  endDate: string;
  currency: string;
  entries: InspectionEntry[];
}

export type AppTab = 'entries' | 'report' | 'summary' | 'profile';

/** Cloud sync status shown on the profile page. */
export type SyncState = 'signed-out' | 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncMetaEntry {
  pushedAt: string;
  json: string;
}

export interface SyncMeta {
  entries: Record<string, SyncMetaEntry>;
  lastSyncedAt?: string;
}
