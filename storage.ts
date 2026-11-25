import type { SyncMeta } from './types';

export const STORAGE_KEYS = {
  data: 'iotabill_data',
  profile: 'iotabill_profile',
  dark: 'iotabill_darkmode',
  syncMeta: 'iotabill_sync_meta',
  tourId: 'iotabill_tour_id',
  owner: 'iotabill_scope_owner',
} as const;

/** Storage scope used when nobody is signed in. */
export const LOCAL_SCOPE = 'local';

/** Every user gets their own namespace; data can never bleed across accounts. */
export function scopedKey(base: string, scope: string): string {
  return `${base}:${scope}`;
}

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Quota errors (e.g. a large avatar) must not take down the app.
    console.warn('TA BILL: could not save local data', error);
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadScoped<T>(base: string, scope: string): T | null {
  return parseJson<T>(safeGet(scopedKey(base, scope)));
}

export function saveScoped(base: string, scope: string, value: unknown): void {
  safeSet(scopedKey(base, scope), JSON.stringify(value));
}

/** Stable local id for the single tour row this app manages, per account. */
export function getOrCreateTourId(scope: string): string {
  const key = scopedKey(STORAGE_KEYS.tourId, scope);
  let id = safeGet(key);
  if (!id) {
    id = `tour_${Math.random().toString(36).slice(2, 10)}`;
    safeSet(key, id);
  }
  return id;
}

/** Adopt the cloud tour id so every device writes to the same tour row. */
export function setStoredTourId(scope: string, id: string): void {
  safeSet(scopedKey(STORAGE_KEYS.tourId, scope), id);
}

export function loadSyncMeta(scope: string): SyncMeta {
  return loadScoped<SyncMeta>(STORAGE_KEYS.syncMeta, scope) ?? { entries: {} };
}

export function saveSyncMeta(scope: string, meta: SyncMeta): void {
  saveScoped(STORAGE_KEYS.syncMeta, scope, meta);
}

/** Unscoped keys written by versions before per-account storage. */
export const LEGACY_KEYS = [
  STORAGE_KEYS.data,
  STORAGE_KEYS.profile,
  STORAGE_KEYS.syncMeta,
  STORAGE_KEYS.tourId,
] as const;

export function legacyPresent(): boolean {
  return LEGACY_KEYS.some((key) => safeGet(key) !== null);
}

export function readLegacy<T>(base: string): T | null {
  return parseJson<T>(safeGet(base));
}

/** Move old unscoped data into its new account namespace, then delete the originals. */
export function moveLegacyToScope(scope: string): void {
  for (const key of LEGACY_KEYS) {
    const raw = safeGet(key);
    if (raw !== null) safeSet(scopedKey(key, scope), raw);
    safeRemove(key);
  }
  safeSet(STORAGE_KEYS.owner, scope);
}

/** Drop unscoped data that belongs to a different account. */
export function discardLegacy(scope: string): void {
  for (const key of LEGACY_KEYS) safeRemove(key);
  safeSet(STORAGE_KEYS.owner, scope);
}
