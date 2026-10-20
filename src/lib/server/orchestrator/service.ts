/**
 * The control room's operations on its registry of client sites. Each one
 * reaches a site only through its API (`site-client.ts`).
 */
import { newClientSite, type ClientSite, type SiteRegistry } from './registry';
import { NebulaKitSiteClient, SiteApiError, type SiteDescription } from './site-client';
import { planRollout, type PlannedUpdate, type Release } from './updates';

export type ClientFactory = (site: Pick<ClientSite, 'baseUrl' | 'apiKey'>) => NebulaKitSiteClient;

export const defaultClientFactory: ClientFactory = (site) =>
  new NebulaKitSiteClient(site.baseUrl, site.apiKey);

function applyDescription(site: ClientSite, description: SiteDescription): ClientSite {
  return {
    ...site,
    status: 'healthy',
    templateVersion: description.template.version,
    packages: description.packages,
    updates: {
      autoApplyFeatures: description.updates.autoApplyFeatures,
      optedIn: description.updates.optedIn
    },
    lastSeenAt: new Date().toISOString(),
    lastError: null
  };
}

/**
 * Register a site Ammoura can already reach. The first API call is the
 * proof: a key the site does not accept is never registered.
 */
export async function registerSite(
  registry: SiteRegistry,
  input: Pick<ClientSite, 'name' | 'slug' | 'baseUrl' | 'repo' | 'apiKey'>,
  clients: ClientFactory = defaultClientFactory
): Promise<ClientSite> {
  if (await registry.get(input.slug)) throw new Error(`"${input.slug}" is already registered`);
  const site = newClientSite(input);
  const description = await clients(site).describe();
  const registered = applyDescription(site, description);
  await registry.save(registered);
  return registered;
}

/** Ask a site how it is; record the answer, or record that it did not answer. */
export async function syncSite(
  registry: SiteRegistry,
  idOrSlug: string,
  clients: ClientFactory = defaultClientFactory
): Promise<ClientSite> {
  const site = await registry.get(idOrSlug);
  if (!site) throw new Error(`No site "${idOrSlug}"`);
  let next: ClientSite;
  try {
    next = applyDescription(site, await clients(site).describe());
  } catch (err) {
    if (!(err instanceof SiteApiError)) throw err;
    next = { ...site, status: 'unreachable', lastError: `${err.status}: ${err.message}` };
  }
  await registry.save(next);
  return next;
}

export async function syncAll(
  registry: SiteRegistry,
  clients: ClientFactory = defaultClientFactory
): Promise<ClientSite[]> {
  const out: ClientSite[] = [];
  for (const site of await registry.list()) out.push(await syncSite(registry, site.id, clients));
  return out;
}

/**
 * Plan releases against every healthy site, from what each last reported.
 * An unreachable site is left out rather than planned on stale data; the
 * caller sees it in `skipped`.
 */
export async function planForRegistry(
  registry: SiteRegistry,
  releases: Release[]
): Promise<{ plan: PlannedUpdate[]; skipped: ClientSite[] }> {
  const sites = await registry.list();
  const healthy = sites.filter((site) => site.status === 'healthy');
  return {
    plan: planRollout(
      healthy.map((site) => ({ siteId: site.id, packages: site.packages, updates: site.updates })),
      releases
    ),
    skipped: sites.filter((site) => site.status !== 'healthy')
  };
}
