import type {
  InspectionEntry,
  SyncMeta,
  TourData,
  UserProfile,
} from './types';
import { supabase } from './supabase';
import { generateId } from './utils';

export interface TourRow {
  user_id: string;
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  updated_at: string;
}

export interface EntryRow {
  user_id: string;
  id: string;
  tour_id: string | null;
  date: string;
  branch: string;
  dp_code: string;
  inspection_type: string;
  day_status: 'Inspection' | 'Leave' | 'Holiday';
  onward_journey: unknown[];
  return_journey: unknown[];
  other_expenses: unknown[];
  last_saved_at: string | null;
  deleted_at: string | null;
  updated_at: string;
}

export interface RemoteSnapshot {
  profile: { data: unknown; updated_at: string } | null;
  tour: TourRow | null;
  entries: EntryRow[];
}

export interface ProfileMergeOptions {
  /** Server timestamp of the remote profile row. */
  remoteUpdatedAt?: string;
  /** Server timestamp of the last profile row this device pushed. */
  localUpdatedAt?: string;
  /** True when this device has unsaved profile edits. */
  localDirty?: boolean;
}

function client() {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  return supabase;
}

export function isLocalEmpty(profile: UserProfile, data: TourData): boolean {
  if (profile.name.trim() || profile.employeeId.trim()) return false;
  if (data.entries.some(entry => entry.lastSavedAt)) return false;
  return data.entries.every(entry => !entry.branch && !entry.dpCode && entry.onwardJourney.length === 0 && entry.returnJourney.length === 0 && entry.otherExpenses.length === 0);
}

export function isRemoteEmpty(snapshot: RemoteSnapshot): boolean {
  return !snapshot.profile && !snapshot.tour && snapshot.entries.length === 0;
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Cloud data is user-controlled JSON. Validate it before it reaches React state
 * so a malformed row can never crash the UI.
 */
function sanitizeRemoteProfile(raw: unknown): Partial<UserProfile> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  const textFields = [
    'name', 'bio', 'homeCurrency', 'employeeId', 'mobile', 'email', 'unit', 'zi',
    'addressLine1', 'addressLine2', 'addressLine3', 'designation', 'basicPay',
    'accountNumber', 'accountBranch', 'credentialsUpdatedAt',
  ];
  for (const key of textFields) {
    if (typeof value[key] === 'string') result[key] = value[key];
  }
  if (value.avatar === null || typeof value.avatar === 'string') {
    result.avatar = value.avatar;
  }
  if (Array.isArray(value.credentials)) {
    result.credentials = value.credentials
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({
        id: asString(item.id) || generateId(),
        label: asString(item.label),
        value: asString(item.value),
        ...(typeof item.isCustom === 'boolean' ? { isCustom: item.isCustom } : {}),
      }));
  }

  return result as Partial<UserProfile>;
}

/**
 * Fill credential slots from the cloud copy. Matching is by label because
 * credential ids are regenerated on every load.
 */
function valuesByCredentialLabel(
  local: UserProfile['credentials'],
  remote: unknown,
): UserProfile['credentials'] {
  if (!Array.isArray(remote)) return local;
  const byLabel = new Map<string, string>();
  for (const item of remote) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const label = asString(record.label).trim().toUpperCase();
    if (label) byLabel.set(label, asString(record.value));
  }
  return local.map((cred) => {
    const remoteValue = byLabel.get(cred.label.trim().toUpperCase());
    return remoteValue === undefined ? cred : { ...cred, value: remoteValue };
  });
}

/**
 * Merge a remote profile into the local one.
 *
 * Conflict resolution uses the server-side `updated_at` values, not device
 * clocks. A device with unsaved edits always wins (local-first); otherwise the
 * copy with the newer server timestamp wins, field by field. This replaces the
 * old "first device wins" behaviour that silently discarded edits made on a
 * second device.
 */
export function mergeProfiles(
  local: UserProfile,
  remoteRaw: unknown,
  options: ProfileMergeOptions = {},
): UserProfile {
  const remote = sanitizeRemoteProfile(remoteRaw);
  if (!remote) return local;

  const remoteCredentials = Array.isArray(remote.credentials) ? remote.credentials : [];
  const localAt = Date.parse(options.localUpdatedAt ?? '') || 0;
  const remoteAt = Date.parse(options.remoteUpdatedAt ?? '') || 0;
  const hasLocalIdentity = Boolean(local.name.trim() || local.employeeId.trim());
  const localDirty = Boolean(options.localDirty);

  // Fresh device (or signed-out workspace) adopts the cloud copy wholesale.
  const adoptRemote = !localDirty && !hasLocalIdentity;
  // Both devices have data: the newer server-written copy wins.
  const takeRemote = !localDirty && hasLocalIdentity && localAt > 0 && remoteAt > localAt;
  const takeRemoteFields = adoptRemote || takeRemote;

  const credentials = takeRemoteFields
    ? valuesByCredentialLabel(local.credentials, remoteCredentials)
    : local.credentials;
  const credentialsUpdatedAt = takeRemoteFields
    ? remote.credentialsUpdatedAt ?? local.credentialsUpdatedAt
    : local.credentialsUpdatedAt;

  let result: UserProfile;
  if (adoptRemote) {
    result = { ...local, ...remote, credentials, credentialsUpdatedAt };
  } else if (takeRemote) {
    const { credentials: _credentials, credentialsUpdatedAt: _timestamp, ...fields } = remote;
    void _credentials;
    void _timestamp;
    result = { ...local, ...fields, credentials, credentialsUpdatedAt };
  } else {
    result = { ...local, credentials, credentialsUpdatedAt };
  }

  // Preserve object identity when nothing changed — callers use it to avoid
  // re-triggering debounced syncs.
  return JSON.stringify(result) === JSON.stringify(local) ? local : result;
}

export async function pullSnapshot(userId: string): Promise<RemoteSnapshot> {
  const db = client();
  const [profileRes, tourRes, entryRes] = await Promise.all([
    db.from('profiles').select('data, updated_at').eq('user_id', userId).maybeSingle(),
    db.from('tours').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('entries').select('*').eq('user_id', userId),
  ]);

  const error = profileRes.error || tourRes.error || entryRes.error;
  if (error) throw error;

  return {
    profile: (profileRes.data as RemoteSnapshot['profile']) ?? null,
    tour: (tourRes.data as TourRow) ?? null,
    entries: ((entryRes.data as unknown[]) ?? []) as EntryRow[],
  };
}

type EntryInsert = Omit<EntryRow, 'updated_at'>;

function toEntryRow(userId: string, tourId: string, entry: InspectionEntry): EntryInsert {
  return {
    user_id: userId,
    id: entry.id,
    tour_id: tourId,
    date: entry.date,
    branch: entry.branch || '',
    dp_code: entry.dpCode || '',
    inspection_type: entry.inspectionType || 'RBIA',
    day_status: entry.dayStatus || 'Inspection',
    onward_journey: entry.onwardJourney ?? [],
    return_journey: entry.returnJourney ?? [],
    other_expenses: entry.otherExpenses ?? [],
    last_saved_at: entry.lastSavedAt ?? null,
    deleted_at: null,
    // updated_at is set by the database so all devices compare server clocks.
  };
}

function fromEntryRow(row: EntryRow): InspectionEntry {
  return {
    id: row.id,
    date: row.date,
    branch: row.branch ?? '',
    dpCode: row.dp_code ?? '',
    inspectionType: row.inspection_type ?? 'RBIA',
    dayStatus: row.day_status ?? 'Inspection',
    onwardJourney: (row.onward_journey ?? []) as InspectionEntry['onwardJourney'],
    returnJourney: (row.return_journey ?? []) as InspectionEntry['returnJourney'],
    otherExpenses: (row.other_expenses ?? []) as InspectionEntry['otherExpenses'],
    lastSavedAt: row.last_saved_at ?? undefined,
  };
}

/**
 * Push local state. Only rows whose JSON changed since the last push are sent;
 * locally-deleted entries become tombstones so other devices remove them too.
 * Server-returned timestamps become the new conflict-resolution baseline.
 */
export async function pushSnapshot(
  userId: string,
  tourId: string,
  data: TourData,
  profile: UserProfile,
  previousMeta: SyncMeta,
): Promise<SyncMeta> {
  const db = client();
  const now = new Date().toISOString();
  const meta: SyncMeta = { ...previousMeta, entries: { ...previousMeta.entries }, lastSyncedAt: now };

  const tourRow = {
    user_id: userId,
    id: tourId,
    name: data.tourName || 'Inspection Tour',
    start_date: data.startDate || null,
    end_date: data.endDate || null,
    currency: data.currency || 'INR',
  };
  const tourJson = JSON.stringify(tourRow);
  if (tourJson !== previousMeta.tourJson) {
    const { data: rows, error } = await db
      .from('tours')
      .upsert(tourRow, { onConflict: 'user_id,id' })
      .select('updated_at');
    if (error) throw error;
    meta.tourJson = tourJson;
    meta.tourUpdatedAt = rows?.[0]?.updated_at ?? previousMeta.tourUpdatedAt;
  }

  const profileJson = JSON.stringify(profile);
  if (profileJson !== previousMeta.profileJson) {
    const { data: rows, error } = await db
      .from('profiles')
      .upsert({ user_id: userId, data: profile }, { onConflict: 'user_id' })
      .select('updated_at');
    if (error) throw error;
    meta.profileJson = profileJson;
    meta.profileUpdatedAt = rows?.[0]?.updated_at ?? previousMeta.profileUpdatedAt;
  }

  const upserts: EntryInsert[] = [];
  for (const entry of data.entries) {
    const json = JSON.stringify(entry);
    const previous = previousMeta.entries[entry.id];
    if (previous && previous.json === json) continue;
    upserts.push(toEntryRow(userId, tourId, entry));
    meta.entries[entry.id] = { pushedAt: now, json };
  }
  if (upserts.length) {
    const { data: rows, error } = await db
      .from('entries')
      .upsert(upserts, { onConflict: 'user_id,id' })
      .select('id, updated_at');
    if (error) throw error;
    for (const row of (rows ?? []) as Array<{ id: string; updated_at: string }>) {
      if (meta.entries[row.id]) {
        meta.entries[row.id] = { ...meta.entries[row.id], pushedAt: row.updated_at };
      }
    }
  }

  const localIds = new Set(data.entries.map(entry => entry.id));
  const removed = Object.keys(previousMeta.entries).filter(id => !localIds.has(id));
  if (removed.length) {
    const { error } = await db
      .from('entries')
      .update({ deleted_at: now })
      .eq('user_id', userId)
      .in('id', removed);
    if (error) throw error;
    removed.forEach(id => delete meta.entries[id]);
  }

  return meta;
}

/**
 * Merge remote rows into local state. Remote tombstones remove local rows unless
 * the local copy has unsaved (draft) edits or was modified after it was pushed.
 */
export function mergeRemoteEntries(
  local: TourData,
  remote: EntryRow[],
  meta: SyncMeta,
): { data: TourData; meta: SyncMeta; changed: boolean } {
  const byId = new Map(local.entries.map(entry => [entry.id, entry] as const));
  const metaEntries = { ...meta.entries };
  let changed = false;

  for (const row of remote.filter(item => !item.deleted_at)) {
    const localEntry = byId.get(row.id);
    const previous = meta.entries[row.id];
    const remoteTime = Date.parse(row.updated_at);
    const localDirty = previous ? previous.json !== JSON.stringify(localEntry) : Boolean(localEntry);
    const remoteNewer = !previous || remoteTime > Date.parse(previous.pushedAt);

    // Drafts are local-only until the user saves them.
    if (localEntry && !localEntry.lastSavedAt) continue;
    if (localEntry && localDirty && !remoteNewer) continue;

    if (!localEntry || remoteNewer) {
      const mapped = fromEntryRow(row);
      byId.set(row.id, mapped);
      metaEntries[row.id] = { pushedAt: row.updated_at, json: JSON.stringify(mapped) };
      changed = true;
    }
  }

  for (const row of remote.filter(item => item.deleted_at)) {
    const localEntry = byId.get(row.id);
    const previous = meta.entries[row.id];
    const localDirty = previous ? previous.json !== JSON.stringify(localEntry) : Boolean(localEntry);
    if (localEntry && localEntry.lastSavedAt && localDirty) continue;
    if (byId.delete(row.id)) changed = true;
    delete metaEntries[row.id];
  }

  return {
    data: changed ? { ...local, entries: Array.from(byId.values()) } : local,
    meta: { ...meta, entries: metaEntries },
    changed,
  };
}
