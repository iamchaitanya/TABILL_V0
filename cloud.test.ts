import { describe, expect, it } from 'vitest';
import {
  isLocalEmpty,
  isRemoteEmpty,
  mergeProfiles,
  mergeRemoteEntries,
  type EntryRow,
  type RemoteSnapshot,
} from './cloud';
import type { InspectionEntry, SyncMeta, TourData, UserProfile } from './types';

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  name: '',
  bio: '',
  homeCurrency: '',
  avatar: null,
  employeeId: '',
  mobile: '',
  email: '',
  unit: '',
  zi: '',
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  designation: '',
  basicPay: '',
  accountNumber: '',
  accountBranch: '',
  credentials: [
    { id: 'c1', label: 'CBS', value: '' },
    { id: 'c2', label: 'DMS', value: '' },
    { id: 'c3', label: 'HRMS', value: '' },
    { id: 'c4', label: 'ELEARNING', value: '' },
  ],
  ...overrides,
});

const makeEntry = (overrides: Partial<InspectionEntry> = {}): InspectionEntry => ({
  id: 'e1',
  date: '2026-01-01',
  branch: 'Branch A',
  dpCode: 'DP1',
  inspectionType: 'RBIA',
  onwardJourney: [],
  returnJourney: [],
  otherExpenses: [],
  dayStatus: 'Inspection',
  lastSavedAt: '10:00',
  ...overrides,
});

const makeData = (entries: InspectionEntry[] = [makeEntry()]): TourData => ({
  tourName: 'Inspection Tour',
  startDate: '2026-01-01',
  endDate: '2026-01-07',
  currency: 'INR',
  entries,
});

const makeRow = (overrides: Partial<EntryRow> = {}): EntryRow => ({
  user_id: 'user-1',
  id: 'e2',
  tour_id: 'tour-1',
  date: '2026-01-02',
  branch: 'Branch B',
  dp_code: 'DP2',
  inspection_type: 'RBIA',
  day_status: 'Inspection',
  onward_journey: [],
  return_journey: [],
  other_expenses: [],
  last_saved_at: '11:00',
  deleted_at: null,
  updated_at: '2026-01-02T00:00:00Z',
  ...overrides,
});

describe('mergeProfiles', () => {
  it('adopts the cloud profile on a fresh device, including credentials', () => {
    const local = makeProfile();
    const remote = {
      name: 'Asha',
      employeeId: '123',
      designation: 'Inspector',
      credentials: [{ id: 'x', label: 'CBS', value: 'secret' }],
      credentialsUpdatedAt: '2026-01-01T00:00:00Z',
    };
    const merged = mergeProfiles(local, remote, { remoteUpdatedAt: '2026-01-02T00:00:00Z' });

    expect(merged.name).toBe('Asha');
    expect(merged.designation).toBe('Inspector');
    expect(merged.credentials.find((c) => c.label === 'CBS')?.value).toBe('secret');
  });

  it('takes remote fields when the server says the remote copy is newer', () => {
    const local = makeProfile({ name: 'Asha', employeeId: '123', designation: 'Old role' });
    const merged = mergeProfiles(local, { designation: 'New role' }, {
      localUpdatedAt: '2026-02-01T00:00:00Z',
      remoteUpdatedAt: '2026-02-02T00:00:00Z',
    });

    expect(merged.designation).toBe('New role');
  });

  it('keeps local fields when the remote copy is older', () => {
    const local = makeProfile({ name: 'Asha', employeeId: '123', designation: 'Local role' });
    const merged = mergeProfiles(local, { designation: 'Stale role' }, {
      localUpdatedAt: '2026-03-01T00:00:00Z',
      remoteUpdatedAt: '2026-02-01T00:00:00Z',
    });

    expect(merged.designation).toBe('Local role');
  });

  it('never overwrites unsaved local edits', () => {
    const local = makeProfile({ name: 'Asha', employeeId: '123', designation: 'Unsaved edit' });
    const merged = mergeProfiles(local, { designation: 'Remote edit' }, {
      localUpdatedAt: '2026-01-01T00:00:00Z',
      remoteUpdatedAt: '2026-12-01T00:00:00Z',
      localDirty: true,
    });

    expect(merged.designation).toBe('Unsaved edit');
  });

  it('preserves object identity on a no-op merge', () => {
    const local = makeProfile({ name: 'Asha' });
    expect(mergeProfiles(local, null)).toBe(local);
    expect(mergeProfiles(local, 'malformed')).toBe(local);
    expect(mergeProfiles(local, { name: 42, credentials: 'nope' })).toBe(local);
  });

  it('does not crash on malformed cloud JSON', () => {
    const local = makeProfile();
    expect(() => mergeProfiles(local, { credentials: [null, 3, { label: 5, value: 7 }] })).not.toThrow();
  });
});

describe('mergeRemoteEntries', () => {
  it('adds a new remote row and removes a tombstone', () => {
    const local = makeData();
    const first = mergeRemoteEntries(local, [makeRow()], { entries: {} });
    expect(first.changed).toBe(true);
    expect(first.data.entries.map((entry) => entry.id)).toEqual(['e1', 'e2']);

    // A tombstone removes a pushed entry that has no local edits.
    const pushedMeta: SyncMeta = {
      entries: { e1: { pushedAt: '2026-01-01T00:00:00Z', json: JSON.stringify(makeEntry()) } },
    };
    const second = mergeRemoteEntries(makeData(), [makeRow({ id: 'e1', deleted_at: '2026-01-03T00:00:00Z' })], pushedMeta);
    expect(second.changed).toBe(true);
    expect(second.data.entries).toEqual([]);
    expect(second.meta.entries.e1).toBeUndefined();
  });

  it('keeps a locally edited entry when the remote copy is older', () => {
    const local = makeData();
    const meta: SyncMeta = {
      entries: { e1: { pushedAt: '2026-01-02T00:00:00Z', json: JSON.stringify(makeEntry({ branch: 'Old' })) } },
    };
    const result = mergeRemoteEntries(local, [makeRow({ id: 'e1', branch: 'Remote', updated_at: '2026-01-01T00:00:00Z' })], meta);

    expect(result.changed).toBe(false);
    expect(result.data.entries[0].branch).toBe('Branch A');
  });
});

describe('emptiness helpers', () => {
  it('detects empty local state', () => {
    expect(isLocalEmpty(makeProfile(), makeData([makeEntry({ branch: '', dpCode: '', lastSavedAt: undefined })]))).toBe(true);
    expect(isLocalEmpty(makeProfile({ name: 'Asha' }), makeData([makeEntry({ branch: '' })]))).toBe(false);
  });

  it('detects an empty cloud snapshot', () => {
    const empty: RemoteSnapshot = { profile: null, tour: null, entries: [] };
    expect(isRemoteEmpty(empty)).toBe(true);
    expect(isRemoteEmpty({ ...empty, entries: [makeRow()] })).toBe(false);
  });
});
