import type {
  InspectionEntry,
  SyncMeta,
  TourData,
  UserProfile,
} from './types';
import { supabase } from './supabase';

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
  onward_journey: any[];
  return_journey: any[];
  other_expenses: any[];
  last_saved_at: string | null;
  deleted_at: string | null;
  updated_at: string;
}

export interface RemoteSnapshot {
  profile: { data: any; updated_at: string } | null;
  tour: TourRow | null;
  entries: EntryRow[];
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

/**
 * Fill credential slots from the cloud copy. Matching is by label because
 * credential ids are regenerated on every load.
 */
function valuesByCredentialLabel(
  local: UserProfile['credentials'],
  remote: any,
): UserProfile['credentials'] {
  if (!Array.isArray(remote)) return local;
  const byLabel = new Map<string, string>();
  for (const item of remote) {
    const label = String(item?.label ?? '').trim().toUpperCase();
    if (label) byLabel.set(label, String(item?.value ?? ''));
  }
  return local.map((cred) => {
    const remoteValue = byLabel.get(cred.label.trim().toUpperCase());
    return remoteValue === undefined ? cred : { ...cred, value: remoteValue };
  });
}

export function mergeProfiles(local: UserProfile, remoteData: any): UserProfile {
  if (!remoteData || typeof remoteData !== 'object') return local;

  // Credentials sync last-write-wins: whichever device changed them most
  // recently owns the values, so clearing them on one device sticks everywhere.
  const remoteCredentials = Array.isArray(remoteData.credentials) ? remoteData.credentials : [];
  const localAt = Date.parse(local.credentialsUpdatedAt ?? '') || 0;
  const remoteAt = Date.parse(remoteData.credentialsUpdatedAt ?? '') || 0;
  const localHasValues = local.credentials.some((cred) => cred.value.trim());
  const remoteHasValues = remoteCredentials.some((item: any) => String(item?.value ?? '').trim());

  const takeRemoteValues =
    remoteCredentials.length > 0 &&
    (remoteAt > localAt ||
      (!local.credentialsUpdatedAt && !localHasValues && remoteHasValues));

  const credentials = takeRemoteValues
    ? valuesByCredentialLabel(local.credentials, remoteCredentials)
    : local.credentials;

  let result: UserProfile;
  if (local.name.trim() || local.employeeId.trim()) {
    result = {
      ...local,
      credentials,
      credentialsUpdatedAt: takeRemoteValues
        ? remoteData.credentialsUpdatedAt ?? local.credentialsUpdatedAt
        : local.credentialsUpdatedAt,
    };
  } else {
    const { credentials: _remoteCredentials, credentialsUpdatedAt: _remoteAt, ...rest } = remoteData;
    void _remoteCredentials;
    void _remoteAt;
    result = { ...local, ...rest, credentials };
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
    profile: (profileRes.data as any) ?? null,
    tour: (tourRes.data as any) ?? null,
    entries: ((entryRes.data as any[]) ?? []) as EntryRow[],
  };
}

function toEntryRow(userId: string, tourId: string, entry: InspectionEntry): EntryRow {
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
    updated_at: new Date().toISOString(),
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
    onwardJourney: row.onward_journey ?? [],
    returnJourney: row.return_journey ?? [],
    otherExpenses: row.other_expenses ?? [],
    lastSavedAt: row.last_saved_at ?? undefined,
  };
}

/**
 * Push local state. Only rows whose JSON changed since the last push are sent;
 * locally-deleted entries become tombstones so other devices remove them too.
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
  const meta: SyncMeta = { entries: { ...previousMeta.entries }, lastSyncedAt: now };

  const tourRow = {
    user_id: userId,
    id: tourId,
    name: data.tourName || 'Inspection Tour',
    start_date: data.startDate || null,
    end_date: data.endDate || null,
    currency: data.currency || 'INR',
  };
  const { error: tourError } = await db
    .from('tours')
    .upsert(tourRow, { onConflict: 'user_id,id' });
  if (tourError) throw tourError;

  const { error: profileError } = await db
    .from('profiles')
    .upsert({ user_id: userId, data: profile }, { onConflict: 'user_id' });
  if (profileError) throw profileError;

  const upserts: EntryRow[] = [];
  for (const entry of data.entries) {
    const json = JSON.stringify(entry);
    const previous = previousMeta.entries[entry.id];
    if (previous && previous.json === json) continue;
    upserts.push(toEntryRow(userId, tourId, entry));
    meta.entries[entry.id] = { pushedAt: now, json };
  }
  if (upserts.length) {
    const { error } = await db.from('entries').upsert(upserts, { onConflict: 'user_id,id' });
    if (error) throw error;
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
