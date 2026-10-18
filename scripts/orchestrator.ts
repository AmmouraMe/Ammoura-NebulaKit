#!/usr/bin/env bun
/**
 * Ammoura control room — local CLI over per-client NebulaKit sites.
 * Plan: ../plans/ammoura-as-orchestrator.md (umbrella repo).
 *
 *   bun scripts/orchestrator.ts create   --name "Acme" --slug acme --template ~/_Projects/StarSpace/NebulaKit/NebulaKit \
 *                                        --sites-dir ~/sites --url http://localhost:4401 [--dev-port 4401]
 *   bun scripts/orchestrator.ts register --name "Acme" --slug acme --base-url https://acme.example \
 *                                        --repo /path/to/repo --key-env ACME_KEY
 *   bun scripts/orchestrator.ts status
 *   bun scripts/orchestrator.ts sync     [slug]
 *   bun scripts/orchestrator.ts call     <slug> <METHOD> </api/v1/path> [json-body]
 *   bun scripts/orchestrator.ts plan     --releases releases.json
 *   bun scripts/orchestrator.ts rollout  --releases releases.json [--test "bun run test"]
 *
 * Options: --registry <file> (default ~/.local/share/ammoura/sites.json, 0600).
 *
 * Local only. Nothing here pushes, creates remote repos, deploys, or touches
 * DNS: those steps wait for the hosting decisions in the plan.
 */
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FileRegistry } from '../src/lib/server/orchestrator/file-registry';
import { provisionSite } from '../src/lib/server/orchestrator/provision';
import { applyUpdate } from '../src/lib/server/orchestrator/rollout';
import { runCommand } from '../src/lib/server/orchestrator/runner';
import {
  defaultClientFactory,
  newClientSite,
  parseReleases,
  planForRegistry,
  registerSite,
  syncAll,
  syncSite
} from '../src/lib/server/orchestrator/index';

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = argv[i + 1] ?? '';
      i++;
    } else positional.push(arg);
  }
  return { positional, flags };
}

function need(flags: Record<string, string>, name: string): string {
  const value = flags[name];
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

const expandHome = (path: string) =>
  path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  const registry = FileRegistry.open(
    expandHome(flags.registry ?? '~/.local/share/ammoura/sites.json')
  );
  const redact = <T extends { apiKey: string }>(site: T) => ({ ...site, apiKey: '(hidden)' });

  switch (command) {
    case 'create': {
      const slug = need(flags, 'slug');
      if (await registry.get(slug)) throw new Error(`"${slug}" is already registered`);
      const url = need(flags, 'url');
      const provisioned = await provisionSite(
        {
          name: need(flags, 'name'),
          slug,
          templatePath: expandHome(need(flags, 'template')),
          sitesDir: expandHome(need(flags, 'sites-dir')),
          url,
          devPort: flags['dev-port'] ? Number(flags['dev-port']) : undefined
        },
        runCommand
      );
      const site = newClientSite({
        name: need(flags, 'name'),
        slug,
        baseUrl: url,
        repo: provisioned.repoPath,
        apiKey: provisioned.apiKey
      });
      await registry.save(site);
      print({
        created: redact(site),
        branch: provisioned.branch,
        next: 'start the site, then `sync` to mark it healthy. For a deployed site, set the Worker secret ORCHESTRATOR_KEY_SHA256 to the value in its .dev.vars.'
      });
      return;
    }
    case 'register': {
      const keyEnv = need(flags, 'key-env');
      const apiKey = process.env[keyEnv];
      // Keys come from the environment, never argv, so they stay out of shell history and ps.
      if (!apiKey) throw new Error(`Environment variable ${keyEnv} is empty`);
      const site = await registerSite(registry, {
        name: need(flags, 'name'),
        slug: need(flags, 'slug'),
        baseUrl: need(flags, 'base-url'),
        repo: flags.repo ?? '',
        apiKey
      });
      print(redact(site));
      return;
    }
    case 'status':
      print((await registry.list()).map(redact));
      return;
    case 'sync': {
      const sites = positional[0]
        ? [await syncSite(registry, positional[0])]
        : await syncAll(registry);
      print(sites.map(redact));
      return;
    }
    case 'call': {
      const [slug, method, path, body] = positional;
      const site = await registry.get(slug ?? '');
      if (!site || !method || !path)
        throw new Error('usage: call <slug> <METHOD> </api/v1/path> [json]');
      print(
        await defaultClientFactory(site).call(
          method.toUpperCase(),
          path,
          body ? JSON.parse(body) : undefined
        )
      );
      return;
    }
    case 'plan':
    case 'rollout': {
      const releases = parseReleases(
        JSON.parse(readFileSync(expandHome(need(flags, 'releases')), 'utf8'))
      );
      const { plan, skipped } = await planForRegistry(registry, releases);
      if (command === 'plan') {
        print({
          plan: plan.map((p) => ({
            site: p.siteId,
            release: p.release.id,
            decision: p.decision,
            reason: p.reason
          })),
          skipped: skipped.map((s) => ({ site: s.slug, status: s.status, lastError: s.lastError }))
        });
        return;
      }
      const test = flags.test ? (flags.test.split(' ') as [string, ...string[]]) : null;
      const results = [];
      for (const item of plan) {
        const site = await registry.get(item.siteId);
        results.push(await applyUpdate(item, site!.repo, runCommand, { testCommand: test }));
      }
      print({ results, skipped: skipped.map((s) => s.slug) });
      return;
    }
    default:
      console.error('commands: create | register | status | sync | call | plan | rollout');
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
