import type { SyncMeta } from './types';

export const STORAGE_KEYS = {
  data: 'iotabill_data',
  profile: 'iotabill_profile',
  dark: 'iotabill_darkmode',
  syncMeta: 'iotabill_sync_meta',
  tourId: 'iotabill_tour_id',
} as const;

export function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Stable local id for the single tour row this app manages. */
export function getOrCreateTourId(): string {
  let id = localStorage.getItem(STORAGE_KEYS.tourId);
  if (!id) {
    id = `tour_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_KEYS.tourId, id);
  }
  return id;
}

/** Adopt the cloud tour id so every device writes to the same tour row. */
export function setStoredTourId(id: string): void {
  localStorage.setItem(STORAGE_KEYS.tourId, id);
}

export function loadSyncMeta(): SyncMeta {
  return parseJson<SyncMeta>(localStorage.getItem(STORAGE_KEYS.syncMeta)) ?? { entries: {} };
}

export function saveSyncMeta(meta: SyncMeta): void {
  localStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify(meta));
}
