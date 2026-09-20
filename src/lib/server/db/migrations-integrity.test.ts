/**
 * The rules in scripts/check-migrations.js, and the real migrations/ directory
 * held to them. The script is what CI and the pre-commit gate run; this is what
 * stops the rules themselves quietly loosening.
 */
import { describe, it, expect } from 'vitest';
import {
  MIGRATION_NAME_PATTERN,
  HISTORICAL_DUPLICATES,
  findNamingViolations,
  findNewDuplicates,
  findMutatedMigrations,
  listMigrations
} from '../../../../scripts/check-migrations.js';

describe('migration naming', () => {
  it('accepts NNNN_snake_case_name.sql', () => {
    for (const name of ['0001_initial.sql', '0104_fulfillment_relays.sql', '9999_a1_b2.sql']) {
      expect(MIGRATION_NAME_PATTERN.test(name), name).toBe(true);
    }
  });

  it('rejects anything else', () => {
    const bad = [
      'add_thing.sql', // no number
      '1_thing.sql', // not four digits
      '00012_thing.sql', // five digits
      '0001_Thing.sql', // capitals
      '0001-thing.sql', // hyphen
      '0001_thing.SQL',
      '0001_.sql',
      '0001_thing__x.sql'
    ];
    expect(findNamingViolations(bad)).toEqual([...bad].sort());
  });

  it('every migration in the repo is named correctly', () => {
    expect(findNamingViolations(listMigrations())).toEqual([]);
  });
});

describe('duplicate migration numbers', () => {
  it('passes a directory where every number is used once', () => {
    expect(findNewDuplicates(['0001_a.sql', '0002_b.sql', '0003_c.sql'], {})).toEqual([]);
  });

  it('reports a number used twice', () => {
    expect(findNewDuplicates(['0007_a.sql', '0007_b.sql'], {})).toEqual([
      { number: '0007', files: ['0007_a.sql', '0007_b.sql'] }
    ]);
  });

  it('forgives a frozen historical pair, exactly as recorded', () => {
    const historical = { '0007': ['0007_a.sql', '0007_b.sql'] };
    expect(findNewDuplicates(['0007_a.sql', '0007_b.sql'], historical)).toEqual([]);
  });

  it('does not forgive a third file sneaking onto a historical number', () => {
    const historical = { '0007': ['0007_a.sql', '0007_b.sql'] };
    expect(findNewDuplicates(['0007_a.sql', '0007_b.sql', '0007_c.sql'], historical)).toEqual([
      { number: '0007', files: ['0007_a.sql', '0007_b.sql', '0007_c.sql'] }
    ]);
  });

  it('does not forgive a substitute file at a historical number', () => {
    // Renaming one half of a frozen pair is editing an applied migration.
    const historical = { '0007': ['0007_a.sql', '0007_b.sql'] };
    expect(findNewDuplicates(['0007_a.sql', '0007_renamed.sql'], historical)).toEqual([
      { number: '0007', files: ['0007_a.sql', '0007_renamed.sql'] }
    ]);
  });

  it('the repo has no duplicate number beyond the five already on main', () => {
    expect(findNewDuplicates(listMigrations())).toEqual([]);
  });

  it('the frozen list still describes the repo, file for file', () => {
    const onDisk = listMigrations();
    for (const [number, files] of Object.entries(HISTORICAL_DUPLICATES)) {
      const actual = onDisk.filter((name: string) => name.startsWith(`${number}_`)).sort();
      expect(actual, `files at ${number}`).toEqual([...files].sort());
    }
  });

  it('records only numbers that really are duplicated, so the list cannot hide a clean number', () => {
    for (const files of Object.values(HISTORICAL_DUPLICATES)) {
      expect(files.length).toBeGreaterThan(1);
    }
  });
});

describe('migration immutability', () => {
  const base = { '0001_a.sql': 'hash-a', '0002_b.sql': 'hash-b' };

  it('passes when nothing on the base ref changed', () => {
    expect(findMutatedMigrations(base, { ...base })).toEqual([]);
  });

  it('allows a brand new migration on top', () => {
    expect(findMutatedMigrations(base, { ...base, '0003_c.sql': 'hash-c' })).toEqual([]);
  });

  it('catches an edit to an applied migration', () => {
    expect(findMutatedMigrations(base, { ...base, '0002_b.sql': 'different' })).toEqual([
      { file: '0002_b.sql', change: 'modified' }
    ]);
  });

  it('catches a deletion', () => {
    expect(findMutatedMigrations(base, { '0001_a.sql': 'hash-a' })).toEqual([
      { file: '0002_b.sql', change: 'deleted' }
    ]);
  });

  it('reports every offender, not just the first', () => {
    expect(findMutatedMigrations(base, { '0001_a.sql': 'changed' })).toEqual([
      { file: '0001_a.sql', change: 'modified' },
      { file: '0002_b.sql', change: 'deleted' }
    ]);
  });
});
