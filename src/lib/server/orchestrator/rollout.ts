/**
 * Apply a planned update to one client site's repository.
 *
 * The site's repo still has the template as its `nebulakit` remote, so an
 * update is: fetch the release ref, merge it, run the site's own tests. A
 * merge conflict or a red test leaves the site exactly where it was — the
 * merge is aborted or reset — and the result says why. That is the
 * "bot PR → that site's tests → deploy" path from the plan, minus the two
 * outward-facing steps (opening a PR on the hosted repo and deploying),
 * which wait for hosting decisions and must not run from a local session.
 */
import type { PlannedUpdate } from './updates';
import { must, type CommandRunner } from './runner';

export interface RolloutResult {
  siteId: string;
  releaseId: string;
  outcome: 'applied' | 'skipped' | 'conflict' | 'tests-failed' | 'error';
  detail: string;
  commit?: string;
}

const GIT_IDENTITY = ['-c', 'user.name=Ammoura', '-c', 'user.email=orchestrator@ammoura.invalid'];

export async function applyUpdate(
  plan: PlannedUpdate,
  repoPath: string,
  run: CommandRunner,
  options: { testCommand?: [string, ...string[]] | null; remote?: string } = {}
): Promise<RolloutResult> {
  const base = { siteId: plan.siteId, releaseId: plan.release.id };
  if (plan.decision !== 'apply') return { ...base, outcome: 'skipped', detail: plan.reason };
  const remote = options.remote ?? 'nebulakit';
  const opts = { cwd: repoPath };

  let before: string;
  try {
    const dirty = await must(run, 'git', ['status', '--porcelain'], opts);
    if (dirty.stdout.trim()) {
      return { ...base, outcome: 'error', detail: 'the site checkout has uncommitted changes' };
    }
    before = (await must(run, 'git', ['rev-parse', 'HEAD'], opts)).stdout.trim();
    await must(run, 'git', ['fetch', '--quiet', remote, plan.release.ref], opts);
  } catch (err) {
    return { ...base, outcome: 'error', detail: (err as Error).message };
  }

  const merge = await run(
    'git',
    [
      ...GIT_IDENTITY,
      'merge',
      '--no-edit',
      '-m',
      `update: ${plan.release.id} (${plan.release.channel})`,
      'FETCH_HEAD'
    ],
    opts
  );
  if (merge.code !== 0) {
    await run('git', ['merge', '--abort'], opts);
    return {
      ...base,
      outcome: 'conflict',
      detail: (merge.stdout + merge.stderr).trim().slice(-500)
    };
  }

  if (options.testCommand) {
    const [cmd, ...args] = options.testCommand;
    const tests = await run(cmd, args, opts);
    if (tests.code !== 0) {
      await run('git', ['reset', '--hard', '--quiet', before], opts);
      return {
        ...base,
        outcome: 'tests-failed',
        detail: (tests.stderr || tests.stdout).trim().slice(-500)
      };
    }
  }

  const after = (await must(run, 'git', ['rev-parse', 'HEAD'], opts)).stdout.trim();
  return {
    ...base,
    outcome: 'applied',
    detail: after === before ? 'already contained the release' : plan.reason,
    commit: after
  };
}
