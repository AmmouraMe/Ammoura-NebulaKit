import { describe, it, expect } from 'vitest';
import { MemoryReleaseStore, D1ReleaseStore, parseReleaseForm } from './releases';

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const good = {
  package: '@nebulakit/security',
  version: '0.1.1',
  channel: 'security',
  ref: 'release/security-0.1.1',
  notes: ' Fixes session fixation '
};

describe('parseReleaseForm', () => {
  it('builds the release id from package and version', () => {
    expect(parseReleaseForm(form(good))).toEqual({
      ok: true,
      value: {
        id: '@nebulakit/security@0.1.1',
        package: '@nebulakit/security',
        version: '0.1.1',
        channel: 'security',
        ref: 'release/security-0.1.1',
        notes: 'Fixes session fixation'
      }
    });
  });

  it.each([
    ['version', 'v1'],
    ['channel', 'urgent'],
    ['ref', ''],
    ['package', '']
  ])('refuses a bad %s', (key, value) => {
    expect(parseReleaseForm(form({ ...good, [key]: value })).ok).toBe(false);
  });
});

describe('MemoryReleaseStore', () => {
  it('saves, replaces and removes by id', async () => {
    const store = new MemoryReleaseStore();
    const r = {
      id: 'a@1.0.0',
      package: 'a',
      version: '1.0.0',
      channel: 'feature' as const,
      ref: 'x'
    };
    await store.save(r);
    await store.save({ ...r, ref: 'y' });
    expect(await store.list()).toEqual([{ ...r, ref: 'y' }]);
    expect(await store.remove('a@1.0.0')).toBe(true);
    expect(await store.remove('a@1.0.0')).toBe(false);
  });
});

describe('D1ReleaseStore', () => {
  it('maps rows to releases and drops a blank note', async () => {
    const db = {
      prepare: () => ({
        all: async () => ({
          results: [
            {
              id: 'a@1.0.0',
              package: 'a',
              version: '1.0.0',
              channel: 'feature',
              ref: 'x',
              notes: null
            }
          ]
        })
      })
    } as unknown as D1Database;
    expect(await new D1ReleaseStore(db).list()).toEqual([
      { id: 'a@1.0.0', package: 'a', version: '1.0.0', channel: 'feature', ref: 'x' }
    ]);
  });

  it('binds every field on save and reports whether a delete matched', async () => {
    const calls: unknown[][] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => {
          calls.push([sql.slice(0, 11), ...args]);
          return { run: async () => ({ meta: { changes: sql.startsWith('DELETE') ? 1 : 0 } }) };
        }
      })
    } as unknown as D1Database;
    const store = new D1ReleaseStore(db);
    await store.save({
      id: 'a@1.0.0',
      package: 'a',
      version: '1.0.0',
      channel: 'security',
      ref: 'x'
    });
    expect(calls[0]).toEqual(['INSERT INTO', 'a@1.0.0', 'a', '1.0.0', 'security', 'x', null]);
    expect(await store.remove('a@1.0.0')).toBe(true);
  });
});
