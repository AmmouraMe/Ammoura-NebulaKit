import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCHEDULED_JOBS, getScheduledJobByName, jobsForCron, registeredCrons } from './registry';

/**
 * The cron expressions wrangler will actually fire, read out of the top-level
 * `[triggers]` table. Parsed rather than imported: the point of the test is
 * that the deployed configuration and the code agree, so it has to read the
 * file that gets deployed.
 */
function cronsInWranglerToml(): string[] {
  const lines = readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8').split('\n');

  // Take the [triggers] table only — the per-environment ones are deliberately
  // empty and must not be mistaken for the production schedule. A TOML table
  // header is a '[' in the first column, which no line inside the array is.
  const start = lines.findIndex((line) => line.trim() === '[triggers]');
  if (start === -1) {
    return [];
  }

  const rest = lines.slice(start + 1);
  const nextHeader = rest.findIndex((line) => line.startsWith('['));
  const table = (nextHeader === -1 ? rest : rest.slice(0, nextHeader)).join('\n');

  const crons = table.match(/crons\s*=\s*\[([\s\S]*?)\]/);
  if (!crons) {
    return [];
  }

  return [...crons[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
}

describe('the job registry', () => {
  it('registers at least one job', () => {
    expect(SCHEDULED_JOBS.length).toBeGreaterThan(0);
  });

  it('gives every job a unique name', () => {
    const names = SCHEDULED_JOBS.map((job) => job.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every job a description, a timeout and a lock', () => {
    for (const job of SCHEDULED_JOBS) {
      expect(job.description, job.name).toBeTruthy();
      expect(job.timeoutMs, job.name).toBeGreaterThan(0);
      expect(job.lockMs, job.name).toBeGreaterThan(0);
    }
  });

  it('holds each lock for longer than the job may run', () => {
    // Otherwise a run that hangs past its timeout can have a second run
    // started underneath it.
    for (const job of SCHEDULED_JOBS) {
      expect(job.lockMs, job.name).toBeGreaterThan(job.timeoutMs);
    }
  });

  it('finds a job by name, and returns nothing for one that is not registered', () => {
    expect(getScheduledJobByName(SCHEDULED_JOBS[0].name)).toBe(SCHEDULED_JOBS[0]);
    expect(getScheduledJobByName('no-such-job')).toBeUndefined();
  });

  it('groups jobs by the cron that owns them', () => {
    const cron = SCHEDULED_JOBS[0].cron;
    expect(jobsForCron(cron)).toContain(SCHEDULED_JOBS[0]);
    expect(jobsForCron('0 0 31 2 *')).toEqual([]);
  });
});

describe('the registry and wrangler.toml', () => {
  it('has a Cron Trigger configured for every schedule a job names', () => {
    // A job on a cron that wrangler does not fire is a job that silently never
    // runs. This is the assertion that stops that shipping.
    expect(cronsInWranglerToml()).toEqual(expect.arrayContaining(registeredCrons()));
  });

  it('has no Cron Trigger that no job claims', () => {
    // The other direction: a trigger with nothing behind it wakes the Worker
    // for no reason, and reads as a job that was deleted without cleaning up.
    for (const cron of cronsInWranglerToml()) {
      expect(jobsForCron(cron), `no job is registered for cron "${cron}"`).not.toHaveLength(0);
    }
  });

  it('reads the top-level triggers, not a per-environment one', () => {
    // Guards the parser itself: preview and dev-staging pin `crons = []`, and
    // picking one of those up would make the assertions above vacuous.
    expect(cronsInWranglerToml().length).toBeGreaterThan(0);
  });
});
