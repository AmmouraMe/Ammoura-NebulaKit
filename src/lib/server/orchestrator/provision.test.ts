/**
 * Provisioning and rollout against real git repositories in a temp dir —
 * the same commands the CLI runs, with a tiny stand-in template whose
 * `customize` script just rewrites one file.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateOrchestratorKey, provisionSite, sha256Hex, upsertEnvLine } from './provision';
import { applyUpdate } from './rollout';
import { CommandError, must, runCommand } from './runner';
import { planUpdate, type Release } from './updates';

const ID = ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid'];

async function git(cwd: string, ...args: string[]) {
  return (await must(runCommand, 'git', [...ID, ...args], { cwd })).stdout.trim();
}

async function makeTemplate(root: string) {
  const template = join(root, 'nebulakit');
  mkdirSync(join(template, 'scripts'), { recursive: true });
  writeFileSync(join(template, 'site.txt'), 'name=NebulaKit\n');
  writeFileSync(join(template, '.gitignore'), '.dev.vars\n');
  writeFileSync(
    join(template, 'scripts/customize.mjs'),
    `import { readFileSync, writeFileSync } from 'node:fs';
const config = JSON.parse(readFileSync('customize.config.json', 'utf8'));
writeFileSync('site.txt', 'name=' + config.name + '\\nslug=' + config.slug + '\\n');
`
  );
  await git(template, 'init', '--quiet', '-b', 'main');
  await git(template, 'add', '-A');
  await git(template, 'commit', '--quiet', '-m', 'template');
  return template;
}

const security: Release = {
  id: '@nebulakit/security@0.1.1',
  package: '@nebulakit/security',
  version: '0.1.1',
  channel: 'security',
  ref: 'release/security-0.1.1'
};
const state = {
  siteId: 's1',
  packages: { '@nebulakit/security': '0.1.0' },
  updates: { autoApplyFeatures: false, optedIn: [] }
};

describe('provisionSite', () => {
  it('clones the template, customizes it, and hands the site only the key hash', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ammoura-prov-'));
    const template = await makeTemplate(root);
    const sitesDir = join(root, 'sites');
    mkdirSync(sitesDir);

    const site = await provisionSite(
      {
        name: 'Acme Prints',
        slug: 'acme',
        templatePath: template,
        sitesDir,
        url: 'https://acme.test',
        author: 'Acme',
        devPort: 4400,
        customizeCommand: ['node', 'scripts/customize.mjs']
      },
      runCommand
    );
    expect(site.repoPath).toBe(join(sitesDir, 'acme'));
    expect(site.branch).toBe('site/acme');
    expect(readFileSync(join(site.repoPath, 'site.txt'), 'utf8')).toBe(
      'name=Acme Prints\nslug=acme\n'
    );
    expect(existsSync(join(site.repoPath, 'customize.config.json'))).toBe(false);
    const devVars = readFileSync(join(site.repoPath, '.dev.vars'), 'utf8');
    expect(devVars).toBe(`ORCHESTRATOR_KEY_SHA256=${await sha256Hex(site.apiKey)}\n`);
    expect(devVars).not.toContain(site.apiKey);
    expect(statSync(join(site.repoPath, '.dev.vars')).mode & 0o777).toBe(0o600);
    expect(await git(site.repoPath, 'log', '-1', '--format=%s')).toBe(
      'site: customize NebulaKit for Acme Prints'
    );
    expect(await git(site.repoPath, 'remote')).toBe('nebulakit');
    expect(await git(site.repoPath, 'status', '--porcelain')).toBe('');

    await expect(
      provisionSite(
        { name: 'Again', slug: 'acme', templatePath: template, sitesDir, url: 'https://x.test' },
        runCommand
      )
    ).rejects.toThrow('already exists');
    await expect(
      provisionSite(
        { name: 'Bad', slug: 'Bad', templatePath: template, sitesDir, url: 'https://x.test' },
        runCommand
      )
    ).rejects.toThrow('slug');
  });

  it('skips the commit when customize changes nothing, and cleans up on failure', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ammoura-prov-'));
    const template = await makeTemplate(root);
    const site = await provisionSite(
      {
        name: 'Same',
        slug: 'same',
        templatePath: template,
        sitesDir: root,
        url: 'https://s.test',
        customizeCommand: ['true']
      },
      runCommand
    );
    expect(await git(site.repoPath, 'log', '-1', '--format=%s')).toBe('template');

    await expect(
      provisionSite(
        {
          name: 'Broken',
          slug: 'broken',
          templatePath: template,
          sitesDir: root,
          url: 'https://b.test',
          customizeCommand: ['false']
        },
        runCommand
      )
    ).rejects.toBeInstanceOf(CommandError);
    expect(existsSync(join(root, 'broken', 'customize.config.json'))).toBe(false);
  });

  it('mints keys and edits env lines', async () => {
    expect(generateOrchestratorKey()).toMatch(/^nk_[0-9a-f]{64}$/);
    expect(
      upsertEnvLine('A=1\nORCHESTRATOR_KEY_SHA256=old\n\n', 'ORCHESTRATOR_KEY_SHA256', 'new')
    ).toBe('A=1\nORCHESTRATOR_KEY_SHA256=new\n');
  });
});

describe('applyUpdate', () => {
  async function setup() {
    const root = mkdtempSync(join(tmpdir(), 'ammoura-roll-'));
    const template = await makeTemplate(root);
    const site = await provisionSite(
      {
        name: 'Acme',
        slug: 'acme',
        templatePath: template,
        sitesDir: root,
        url: 'https://a.test',
        customizeCommand: ['node', 'scripts/customize.mjs']
      },
      runCommand
    );
    return { template, repo: site.repoPath };
  }

  async function release(template: string, file: string, content: string, branch = security.ref) {
    await git(template, 'checkout', '--quiet', '-b', branch);
    writeFileSync(join(template, file), content);
    await git(template, 'add', '-A');
    await git(template, 'commit', '--quiet', '-m', `release ${branch}`);
    await git(template, 'checkout', '--quiet', 'main');
  }

  it('merges a forced security release and runs the site tests', async () => {
    const { template, repo } = await setup();
    await release(template, 'SECURITY.txt', 'patched\n');
    const result = await applyUpdate(planUpdate(state, security), repo, runCommand, {
      testCommand: ['test', '-f', 'SECURITY.txt']
    });
    expect(result).toMatchObject({ outcome: 'applied', releaseId: security.id });
    expect(readFileSync(join(repo, 'SECURITY.txt'), 'utf8')).toBe('patched\n');
    // The client's customization survives the merge.
    expect(readFileSync(join(repo, 'site.txt'), 'utf8')).toContain('name=Acme');
    const again = await applyUpdate(planUpdate(state, security), repo, runCommand);
    expect(again).toMatchObject({ outcome: 'applied', detail: 'already contained the release' });
  });

  it('rolls back when the site tests fail', async () => {
    const { template, repo } = await setup();
    await release(template, 'SECURITY.txt', 'patched\n');
    const before = await git(repo, 'rev-parse', 'HEAD');
    const result = await applyUpdate(planUpdate(state, security), repo, runCommand, {
      testCommand: ['sh', '-c', 'echo boom >&2; exit 1']
    });
    expect(result).toMatchObject({ outcome: 'tests-failed', detail: 'boom' });
    expect(await git(repo, 'rev-parse', 'HEAD')).toBe(before);
  });

  it('aborts a conflicting merge and leaves the site as it was', async () => {
    const { template, repo } = await setup();
    await release(template, 'site.txt', 'name=Upstream\n');
    const before = await git(repo, 'rev-parse', 'HEAD');
    const result = await applyUpdate(planUpdate(state, security), repo, runCommand);
    expect(result.outcome).toBe('conflict');
    expect(await git(repo, 'rev-parse', 'HEAD')).toBe(before);
    expect(await git(repo, 'status', '--porcelain')).toBe('');
  });

  it('skips what the plan does not apply, and refuses a dirty or broken checkout', async () => {
    const { repo } = await setup();
    const feature = { ...security, channel: 'feature' as const, id: 'f@1' };
    expect(await applyUpdate(planUpdate(state, feature), repo, runCommand)).toMatchObject({
      outcome: 'skipped',
      detail: 'feature release — waiting for the owner'
    });
    const missingRef = await applyUpdate(planUpdate(state, security), repo, runCommand);
    expect(missingRef.outcome).toBe('error');
    writeFileSync(join(repo, 'stray.txt'), 'x');
    expect(await applyUpdate(planUpdate(state, security), repo, runCommand)).toMatchObject({
      outcome: 'error',
      detail: 'the site checkout has uncommitted changes'
    });
  });
});

describe('runCommand', () => {
  it('reports exit codes and missing commands without throwing', async () => {
    expect((await runCommand('sh', ['-c', 'exit 3'], { cwd: tmpdir() })).code).toBe(3);
    expect((await runCommand('definitely-not-a-command-xyz', [], { cwd: tmpdir() })).code).toBe(1);
    expect(
      (await runCommand('sh', ['-c', 'echo $X'], { cwd: tmpdir(), env: { X: 'hi' } })).stdout
    ).toBe('hi\n');
  });
});
