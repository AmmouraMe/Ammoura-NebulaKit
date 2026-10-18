/**
 * Create a client site from the NebulaKit template.
 *
 * A client site is its own repository that still pulls from NebulaKit
 * (plans/ammoura-as-orchestrator.md, rule 1). This makes one locally:
 *
 *   1. clone the template into `<sitesDir>/<slug>`, with the template kept as
 *      the `nebulakit` remote so later updates are one merge away;
 *   2. run the template's own rebranding pass (`scripts/customize.mjs`,
 *      non-interactive via customize.config.json) with the client's name;
 *   3. mint the orchestrator key and give the site only its SHA-256, in
 *      `.dev.vars` for local runs (gitignored). A deployed site gets the same
 *      value as the Worker secret `ORCHESTRATOR_KEY_SHA256` — that deploy step
 *      is not automated yet, on purpose: it touches live Cloudflare;
 *   4. commit the customization on the site's own branch.
 *
 * Pushing to a remote host, creating the GitHub repo, DNS and deploy are the
 * next steps and are deliberately not here.
 */
import { existsSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SITE_SLUG } from './registry';
import { must, type CommandRunner } from './runner';

export interface ProvisionInput {
  name: string;
  slug: string;
  templatePath: string;
  sitesDir: string;
  /** Public URL the site will live at; also used by customize as `url`. */
  url: string;
  author?: string;
  devPort?: number;
  /** The template command that rebrands a fresh copy. */
  customizeCommand?: [string, ...string[]];
}

export interface ProvisionedSite {
  repoPath: string;
  apiKey: string;
  apiKeySha256: string;
  branch: string;
}

export function generateOrchestratorKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return 'nk_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Set or replace one KEY=value line in a dotenv-style file. */
export function upsertEnvLine(text: string, key: string, value: string): string {
  const lines = text.split('\n').filter((line) => !line.startsWith(`${key}=`));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  lines.push(`${key}=${value}`);
  return lines.join('\n') + '\n';
}

export async function provisionSite(
  input: ProvisionInput,
  run: CommandRunner
): Promise<ProvisionedSite> {
  if (!SITE_SLUG.test(input.slug))
    throw new Error('Site slug must be lowercase letters, digits and dashes');
  const templatePath = resolve(input.templatePath);
  const repoPath = resolve(input.sitesDir, input.slug);
  if (existsSync(repoPath)) throw new Error(`${repoPath} already exists`);
  const branch = `site/${input.slug}`;

  await must(run, 'git', ['clone', '--quiet', '--origin', 'nebulakit', templatePath, repoPath], {
    cwd: resolve(input.sitesDir)
  });
  await must(run, 'git', ['checkout', '--quiet', '-b', branch], { cwd: repoPath });

  const config = {
    name: input.name,
    shortName: input.name,
    slug: input.slug,
    url: input.url,
    ...(input.author ? { author: input.author } : {}),
    ...(input.devPort ? { devPort: input.devPort } : {})
  };
  const configPath = join(repoPath, 'customize.config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  const [cmd, ...args] = input.customizeCommand ?? ['bun', 'scripts/customize.mjs'];
  try {
    await must(run, cmd, args, { cwd: repoPath });
  } finally {
    // The template says to delete it after the run so it is never committed.
    rmSync(configPath, { force: true });
  }

  const apiKey = generateOrchestratorKey();
  const apiKeySha256 = await sha256Hex(apiKey);
  const devVars = join(repoPath, '.dev.vars');
  const current = existsSync(devVars) ? readFileSync(devVars, 'utf8') : '';
  writeFileSync(devVars, upsertEnvLine(current, 'ORCHESTRATOR_KEY_SHA256', apiKeySha256), {
    mode: 0o600
  });

  // The template gitignores .dev.vars; refuse to go on if this one does not,
  // rather than commit a credential hash into the client's history.
  const ignored = await run('git', ['check-ignore', '-q', '.dev.vars'], { cwd: repoPath });
  if (ignored.code !== 0) throw new Error('The template does not gitignore .dev.vars');
  await must(run, 'git', ['add', '-A'], { cwd: repoPath });
  const staged = await run('git', ['diff', '--cached', '--quiet'], { cwd: repoPath });
  if (staged.code !== 0) {
    await must(
      run,
      'git',
      [
        '-c',
        'user.name=Ammoura',
        '-c',
        'user.email=orchestrator@ammoura.invalid',
        'commit',
        '--quiet',
        '-m',
        `site: customize NebulaKit for ${input.name}`
      ],
      { cwd: repoPath }
    );
  }
  return { repoPath, apiKey, apiKeySha256, branch };
}
