import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS,
  discardLegacy,
  legacyPresent,
  loadScoped,
  loadSyncMeta,
  moveLegacyToScope,
  parseJson,
  safeGet,
  safeSet,
  saveScoped,
  scopedKey,
} from './storage';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const memory = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true });

beforeEach(() => memory.clear());

describe('scoped storage', () => {
  it('isolates every account under its own namespace', () => {
    saveScoped(STORAGE_KEYS.data, 'user-a', { entries: ['a'] });
    saveScoped(STORAGE_KEYS.data, 'user-b', { entries: ['b'] });

    expect(loadScoped<{ entries: string[] }>(STORAGE_KEYS.data, 'user-a')?.entries).toEqual(['a']);
    expect(loadScoped<{ entries: string[] }>(STORAGE_KEYS.data, 'user-b')?.entries).toEqual(['b']);
    expect(loadScoped(STORAGE_KEYS.data, 'user-c')).toBeNull();
  });

  it('moves legacy data into the target scope and deletes the originals', () => {
    memory.setItem(STORAGE_KEYS.data, '{"entries":["legacy"]}');
    memory.setItem(STORAGE_KEYS.profile, '{"name":"Asha"}');
    memory.setItem(STORAGE_KEYS.tourId, 'tour_old');
    expect(legacyPresent()).toBe(true);

    moveLegacyToScope('user-a');

    expect(safeGet(scopedKey(STORAGE_KEYS.data, 'user-a'))).toBe('{"entries":["legacy"]}');
    expect(safeGet(scopedKey(STORAGE_KEYS.tourId, 'user-a'))).toBe('tour_old');
    expect(legacyPresent()).toBe(false);
    expect(safeGet(STORAGE_KEYS.owner)).toBe('user-a');
  });

  it('discards legacy data that belongs to another account', () => {
    memory.setItem(STORAGE_KEYS.data, '{"entries":["someone-else"]}');
    discardLegacy('user-b');

    expect(legacyPresent()).toBe(false);
    expect(loadScoped(STORAGE_KEYS.data, 'user-b')).toBeNull();
  });

  it('returns a default sync meta when none is stored', () => {
    expect(loadSyncMeta('user-a')).toEqual({ entries: {} });
  });

  it('survives corrupt JSON and full storage', () => {
    expect(parseJson('{not json')).toBeNull();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = memory.setItem.bind(memory);
    memory.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => safeSet('key', 'value')).not.toThrow();
    memory.setItem = original;
    warn.mockRestore();
  });
});
