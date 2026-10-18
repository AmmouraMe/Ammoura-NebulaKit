import { describe, expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { generateEncryptionKey } from '../crypto';
import { FileRegistry } from './file-registry';
import {
  compareVersions,
  D1Registry,
  MemoryRegistry,
  NebulaKitSiteClient,
  newClientSite,
  parseReleases,
  planForRegistry,
  planRollout,
  planUpdate,
  registerSite,
  SiteApiError,
  syncAll,
  syncSite,
  type ClientSite,
  type Release,
  type SiteDescription
} from './index';

const description: SiteDescription = {
  name: 'Acme',
  slug: 'acme',
  url: 'https://acme.test',
  template: { name: 'nebulakit', version: '0.0.1' },
  packages: { '@nebulakit/commerce': '0.1.0', '@nebulakit/security': '0.1.0' },
  updates: { autoApplyFeatures: false, optedIn: ['@nebulakit/commerce@0.3.0'], updatedAt: null },
  api: { version: 'v1', openapi: '/api/v1/openapi.json' }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

const security: Release = {
  id: '@nebulakit/security@0.1.1',
  package: '@nebulakit/security',
  version: '0.1.1',
  channel: 'security',
  ref: 'release/security-0.1.1'
};
const feature: Release = {
  id: '@nebulakit/commerce@0.2.0',
  package: '@nebulakit/commerce',
  version: '0.2.0',
  channel: 'feature',
  ref: 'release/commerce-0.2.0'
};

describe('update channels', () => {
  it('compares versions numerically, with pre-releases first', () => {
    expect(compareVersions('0.10.0', '0.9.3')).toBe(1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0-rc')).toBe(1);
    expect(compareVersions('1.0.0-a', '1.0.0-b')).toBe(-1);
    expect(compareVersions('1.0.0-b', '1.0.0-a')).toBe(1);
    expect(compareVersions('x', '0')).toBe(0);
  });

  const site = {
    siteId: 's1',
    packages: { '@nebulakit/commerce': '0.1.0', '@nebulakit/security': '0.1.0' },
    updates: { autoApplyFeatures: false, optedIn: [] as string[] }
  };

  it('forces security releases on every site that is behind', () => {
    expect(planUpdate(site, security).decision).toBe('apply');
    expect(
      planUpdate({ ...site, packages: { '@nebulakit/security': '0.2.0' } }, security)
    ).toMatchObject({
      decision: 'current',
      reason: 'already on 0.2.0'
    });
  });

  it('only offers feature releases unless the owner opted in', () => {
    expect(planUpdate(site, feature)).toMatchObject({ decision: 'offer' });
    expect(
      planUpdate({ ...site, updates: { autoApplyFeatures: false, optedIn: [feature.id] } }, feature)
    ).toMatchObject({ decision: 'apply', reason: 'owner opted in to this release' });
    expect(
      planUpdate({ ...site, updates: { autoApplyFeatures: true, optedIn: [] } }, feature)
    ).toMatchObject({ decision: 'apply', reason: 'owner takes every feature release' });
  });

  it('never installs a package a site does not have', () => {
    expect(planUpdate({ ...site, packages: {} }, security)).toMatchObject({
      decision: 'current',
      reason: '@nebulakit/security is not installed'
    });
  });

  it('plans security first across all sites', () => {
    const plan = planRollout([site, { ...site, siteId: 's2' }], [feature, security]);
    expect(plan.map((p) => `${p.siteId}:${p.release.channel}`)).toEqual([
      's1:security',
      's1:feature',
      's2:security',
      's2:feature'
    ]);
    const twoFeatures = planRollout([site], [{ ...feature, version: '0.3.0' }, feature]);
    expect(twoFeatures.map((p) => p.release.version)).toEqual(['0.2.0', '0.3.0']);
  });

  it('parses a release list strictly', () => {
    expect(parseReleases([{ ...security, notes: 'CVE fix' }])[0].notes).toBe('CVE fix');
    expect(parseReleases([feature])[0]).not.toHaveProperty('notes');
    expect(() => parseReleases({})).toThrow('must be a list');
    expect(() => parseReleases([{ ...feature, channel: 'beta' }])).toThrow('Release 0');
    expect(() => parseReleases([{ ...feature, ref: '' }])).toThrow('Release 0');
  });
});

describe('NebulaKitSiteClient', () => {
  it('sends the orchestrator key and reads the site API', async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/api/v1/site')) return jsonResponse(description);
      if (url.includes('/api/v1/products') && init.method === 'POST')
        return jsonResponse({ product: { id: 'p1' } }, 201);
      if (url.includes('/api/v1/products')) return jsonResponse({ products: [{ id: 'p1' }] });
      if (url.includes('/api/v1/orders')) return jsonResponse({ orders: [{ id: 'o1' }] });
      if (url.includes('/api/v1/pages/')) return jsonResponse({ page: { slug: 'home' } });
      return new Response(null, { status: 204 });
    });
    const client = new NebulaKitSiteClient(
      'https://acme.test/ignored',
      'nk_key',
      fetchImpl as never
    );
    expect(await client.describe()).toEqual(description);
    expect(await client.listProducts()).toEqual([{ id: 'p1' }]);
    expect(await client.listProducts(false)).toEqual([{ id: 'p1' }]);
    expect(await client.createProduct({ slug: 'tee' })).toEqual({ id: 'p1' });
    expect(await client.listOrders('paid')).toEqual([{ id: 'o1' }]);
    expect(await client.listOrders()).toEqual([{ id: 'o1' }]);
    expect(await client.savePage('home', { title: 'Home', document: {} })).toEqual({
      slug: 'home'
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://acme.test/api/v1/site');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer nk_key');
    const urls = fetchImpl.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(urls).toContain('https://acme.test/api/v1/products?all=1');
    expect(urls).toContain('https://acme.test/api/v1/orders?status=paid');
  });

  it('raises the site’s own error message and details', async () => {
    const refusing = new NebulaKitSiteClient('http://localhost:4277', 'nk_key', (async () =>
      jsonResponse({ error: 'Validation failed', details: ['slug'] }, 422)) as never);
    await expect(refusing.createProduct({})).rejects.toMatchObject({
      message: 'Validation failed',
      status: 422,
      details: ['slug']
    });
    const html = new NebulaKitSiteClient(
      'http://127.0.0.1:1',
      'nk_key',
      (async () => new Response('<html>', { status: 502 })) as never
    );
    await expect(html.describe()).rejects.toThrow('Site API returned 502');
    const down = new NebulaKitSiteClient('https://acme.test', 'nk_key', (async () => {
      throw new Error('ECONNREFUSED');
    }) as never);
    await expect(down.describe()).rejects.toMatchObject({ status: 0 });
    const empty = new NebulaKitSiteClient(
      'https://acme.test',
      'k',
      (async () => new Response(null, { status: 204 })) as never
    );
    expect(await empty.describe()).toBeUndefined();
  });

  it('refuses plain http to anything but localhost, and a missing key', () => {
    expect(() => new NebulaKitSiteClient('http://acme.test', 'k')).toThrow('https');
    expect(() => new NebulaKitSiteClient('https://acme.test', '')).toThrow('key is required');
  });
});

function siteInput(slug = 'acme') {
  return { name: 'Acme', slug, baseUrl: 'https://acme.test', repo: '/sites/acme', apiKey: 'nk_k' };
}

// Loaded through require: this Vite version does not treat `node:sqlite` as a builtin.
const { DatabaseSync } = createRequire(import.meta.url)(
  'node:sqlite'
) as typeof import('node:sqlite');

function sqliteD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(process.cwd(), 'migrations/0108_orchestrated_sites.sql'), 'utf8'));
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...next: unknown[]) => stmt(sql, next),
    first: async () => {
      const row = db.prepare(sql).get(...(args as never[]));
      return row ? { ...row } : null;
    },
    all: async () => ({
      results: db
        .prepare(sql)
        .all(...(args as never[]))
        .map((r) => ({ ...r }))
    }),
    run: async () => {
      const info = db.prepare(sql).run(...(args as never[]));
      return { meta: { changes: Number(info.changes) } };
    }
  });
  return { prepare: (sql: string) => stmt(sql) } as unknown as D1Database;
}

describe('registries', () => {
  it('keeps sites in memory, by id or slug, with unique slugs', async () => {
    const registry = new MemoryRegistry();
    const site = newClientSite(siteInput());
    await registry.save(site);
    expect(await registry.get('acme')).toMatchObject({ id: site.id });
    expect(await registry.get(site.id)).toMatchObject({ slug: 'acme' });
    expect(await registry.get('nope')).toBeNull();
    await expect(registry.save(newClientSite(siteInput()))).rejects.toThrow('already registered');
    await registry.save(newClientSite(siteInput('beta')));
    expect((await registry.list()).map((s) => s.slug)).toEqual(['acme', 'beta']);
    expect(await registry.remove(site.id)).toBe(true);
  });

  it('validates new sites', () => {
    expect(() => newClientSite({ ...siteInput(), slug: 'Bad Slug' })).toThrow('slug');
    expect(() => newClientSite({ ...siteInput(), name: ' ' })).toThrow('name');
  });

  it('persists to a 0600 JSON file', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'ammoura-reg-')), 'nested', 'sites.json');
    const registry = FileRegistry.open(path);
    const site = newClientSite(siteInput());
    await registry.save(site);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    const reopened = FileRegistry.open(path);
    expect(await reopened.get('acme')).toMatchObject({ apiKey: 'nk_k' });
    expect(await reopened.remove('missing')).toBe(false);
    expect(await reopened.remove(site.id)).toBe(true);
    expect(await FileRegistry.open(path).list()).toEqual([]);
  });

  it('stores the key encrypted in D1 and reads it back', async () => {
    const db = sqliteD1();
    const key = await generateEncryptionKey();
    const registry = new D1Registry(db, key);
    const site = { ...newClientSite(siteInput()), packages: { a: '1' } };
    await registry.save(site);
    const raw = (await db.prepare('SELECT api_key_encrypted FROM orchestrated_sites').first()) as {
      api_key_encrypted: string;
    };
    expect(raw.api_key_encrypted).not.toContain('nk_k');
    expect(await registry.get('acme')).toMatchObject({ apiKey: 'nk_k', packages: { a: '1' } });
    await registry.save({ ...site, status: 'healthy' });
    expect((await registry.list())[0].status).toBe('healthy');
    await db.prepare("UPDATE orchestrated_sites SET packages = '{bad', updates = ''").run();
    expect(await registry.get(site.id)).toMatchObject({
      packages: {},
      updates: { autoApplyFeatures: false, optedIn: [] }
    });
    expect(await registry.get('nope')).toBeNull();
    expect(await registry.remove(site.id)).toBe(true);
    expect(await registry.remove(site.id)).toBe(false);
    expect(() => new D1Registry(db, '')).toThrow('ENCRYPTION_KEY');
  });
});

describe('orchestrator service', () => {
  const healthy = () =>
    new NebulaKitSiteClient('https://acme.test', 'k', (async () =>
      jsonResponse(description)) as never);
  const failing = () =>
    new NebulaKitSiteClient('https://acme.test', 'k', (async () =>
      jsonResponse({ error: 'Invalid, expired or revoked API key' }, 401)) as never);

  it('registers only a site whose API accepts the key', async () => {
    const registry = new MemoryRegistry();
    await expect(registerSite(registry, siteInput(), failing)).rejects.toBeInstanceOf(SiteApiError);
    expect(await registry.list()).toEqual([]);
    const site = await registerSite(registry, siteInput(), healthy);
    expect(site).toMatchObject({
      status: 'healthy',
      templateVersion: '0.0.1',
      updates: { optedIn: ['@nebulakit/commerce@0.3.0'] }
    });
    await expect(registerSite(registry, siteInput(), healthy)).rejects.toThrow(
      'already registered'
    );
  });

  it('records unreachable sites and leaves them out of the plan', async () => {
    const registry = new MemoryRegistry();
    await registerSite(registry, siteInput(), healthy);
    await registerSite(registry, siteInput('beta'), healthy);
    const down = await syncSite(registry, 'beta', failing);
    expect(down).toMatchObject({
      status: 'unreachable',
      lastError: '401: Invalid, expired or revoked API key'
    });
    const { plan, skipped } = await planForRegistry(registry, [security, feature]);
    expect(skipped.map((s: ClientSite) => s.slug)).toEqual(['beta']);
    expect(plan.map((p) => p.decision)).toEqual(['apply', 'offer']);
    expect((await syncAll(registry, healthy)).every((s) => s.status === 'healthy')).toBe(true);
    await expect(syncSite(registry, 'ghost', healthy)).rejects.toThrow('No site');
    const broken = () => {
      throw new TypeError('bug');
    };
    await expect(syncSite(registry, 'acme', broken as never)).rejects.toThrow('bug');
  });
});
