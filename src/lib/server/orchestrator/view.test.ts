import { describe, it, expect } from 'vitest';
import { newClientSite } from './registry';
import { parseRegistration, pendingBySite, toSiteView } from './view';

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const good = {
  name: ' Acme Prints ',
  slug: 'Acme',
  baseUrl: 'https://acme.example/some/path',
  repo: 'git@example.com:acme/site.git',
  apiKey: ' key-123 '
};

describe('toSiteView', () => {
  it('has no key in it', () => {
    const site = newClientSite({
      name: 'Acme',
      slug: 'acme',
      baseUrl: 'https://acme.example',
      repo: '/r',
      apiKey: 'secret-key'
    });
    const view = toSiteView(site);
    expect(view).not.toHaveProperty('apiKey');
    expect(JSON.stringify(view)).not.toContain('secret-key');
    expect(view.slug).toBe('acme');
  });
});

describe('parseRegistration', () => {
  it('trims fields, lowercases the slug and keeps only the origin', () => {
    const r = parseRegistration(form(good));
    expect(r).toEqual({
      ok: true,
      value: {
        name: 'Acme Prints',
        slug: 'acme',
        baseUrl: 'https://acme.example',
        repo: 'git@example.com:acme/site.git',
        apiKey: 'key-123'
      }
    });
  });

  it('allows http for localhost only', () => {
    expect(parseRegistration(form({ ...good, baseUrl: 'http://localhost:4401' })).ok).toBe(true);
    const r = parseRegistration(form({ ...good, baseUrl: 'http://acme.example' }));
    expect(r.ok).toBe(false);
  });

  it.each([
    ['name', ''],
    ['slug', 'Bad Slug!'],
    ['baseUrl', 'not a url'],
    ['apiKey', '']
  ])('refuses a bad %s', (key, value) => {
    expect(parseRegistration(form({ ...good, [key]: value })).ok).toBe(false);
  });
});

describe('pendingBySite', () => {
  const site = (slug: string, over: Partial<ReturnType<typeof newClientSite>> = {}) => ({
    ...newClientSite({ name: slug, slug, baseUrl: 'https://x.example', repo: '/r', apiKey: 'k' }),
    status: 'healthy' as const,
    packages: { '@nebulakit/security': '0.1.0', '@nebulakit/commerce': '0.1.0' },
    ...over
  });
  const releases = [
    {
      id: '@nebulakit/security@0.1.1',
      package: '@nebulakit/security',
      version: '0.1.1',
      channel: 'security' as const,
      ref: 'r1'
    },
    {
      id: '@nebulakit/commerce@0.2.0',
      package: '@nebulakit/commerce',
      version: '0.2.0',
      channel: 'feature' as const,
      ref: 'r2'
    }
  ];

  it('forces security, offers features, and skips what a site already has', () => {
    const a = site('a');
    const b = site('b', {
      packages: { '@nebulakit/security': '0.1.1', '@nebulakit/commerce': '0.1.0' }
    });
    const out = pendingBySite([a, b], releases);
    expect(out[a.id].map((p) => [p.releaseId, p.decision])).toEqual([
      ['@nebulakit/security@0.1.1', 'apply'],
      ['@nebulakit/commerce@0.2.0', 'offer']
    ]);
    expect(out[b.id].map((p) => p.decision)).toEqual(['offer']);
  });

  it('does not plan a site that did not answer', () => {
    const down = site('down', { status: 'unreachable' });
    expect(pendingBySite([down], releases)[down.id]).toBeUndefined();
  });
});
