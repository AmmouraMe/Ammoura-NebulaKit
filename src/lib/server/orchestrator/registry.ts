/**
 * The control room's list of client sites.
 *
 * One record per NebulaKit site Ammoura runs: where it lives, how to reach its
 * API, and what it last reported (template and package versions, the owner's
 * update choices). Two stores share one interface: D1 for the deployed
 * Ammoura (`orchestrated_sites`, migration 0108, key encrypted at rest) and a
 * JSON file for the local CLI (`file-registry.ts`).
 */
import { decrypt, encrypt } from '../crypto';

export type ClientSiteStatus = 'provisioned' | 'healthy' | 'unreachable';

export interface ClientSite {
  id: string;
  name: string;
  slug: string;
  /** Where the site's API answers. */
  baseUrl: string;
  /** The site's own repository: a local path, or a remote URL. */
  repo: string;
  /** The orchestrator key (plaintext in memory only). */
  apiKey: string;
  status: ClientSiteStatus;
  templateVersion: string | null;
  packages: Record<string, string>;
  updates: { autoApplyFeatures: boolean; optedIn: string[] };
  lastSeenAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface SiteRegistry {
  list(): Promise<ClientSite[]>;
  get(idOrSlug: string): Promise<ClientSite | null>;
  save(site: ClientSite): Promise<void>;
  remove(id: string): Promise<boolean>;
}

export const SITE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

export function newClientSite(
  input: Pick<ClientSite, 'name' | 'slug' | 'baseUrl' | 'repo' | 'apiKey'>
): ClientSite {
  if (!SITE_SLUG.test(input.slug))
    throw new Error('Site slug must be lowercase letters, digits and dashes');
  if (!input.name.trim()) throw new Error('Site name is required');
  return {
    id: crypto.randomUUID(),
    ...input,
    name: input.name.trim(),
    status: 'provisioned',
    templateVersion: null,
    packages: {},
    updates: { autoApplyFeatures: false, optedIn: [] },
    lastSeenAt: null,
    lastError: null,
    createdAt: new Date().toISOString()
  };
}

export class MemoryRegistry implements SiteRegistry {
  protected sites = new Map<string, ClientSite>();

  async list() {
    return [...this.sites.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  }
  async get(idOrSlug: string) {
    return (
      this.sites.get(idOrSlug) ??
      [...this.sites.values()].find((site) => site.slug === idOrSlug) ??
      null
    );
  }
  async save(site: ClientSite) {
    const clash = [...this.sites.values()].find((s) => s.slug === site.slug && s.id !== site.id);
    if (clash) throw new Error(`A site with slug "${site.slug}" is already registered`);
    this.sites.set(site.id, structuredClone(site));
  }
  async remove(id: string) {
    return this.sites.delete(id);
  }
}

type Row = Record<string, unknown>;

/** D1-backed registry. The orchestrator key is stored encrypted with Ammoura's ENCRYPTION_KEY. */
export class D1Registry implements SiteRegistry {
  constructor(
    private readonly db: D1Database,
    private readonly encryptionKey: string
  ) {
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY is required to store site keys');
  }

  private async toSite(row: Row): Promise<ClientSite> {
    const json = <T>(raw: unknown, fallback: T): T => {
      try {
        return raw ? (JSON.parse(String(raw)) as T) : fallback;
      } catch {
        return fallback;
      }
    };
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      baseUrl: row.base_url as string,
      repo: row.repo as string,
      apiKey: await decrypt(row.api_key_encrypted as string, this.encryptionKey),
      status: row.status as ClientSiteStatus,
      templateVersion: (row.template_version as string | null) ?? null,
      packages: json(row.packages, {}),
      updates: json(row.updates, { autoApplyFeatures: false, optedIn: [] }),
      lastSeenAt: (row.last_seen_at as string | null) ?? null,
      lastError: (row.last_error as string | null) ?? null,
      createdAt: row.created_at as string
    };
  }

  async list() {
    const { results } = await this.db
      .prepare('SELECT * FROM orchestrated_sites ORDER BY slug')
      .all<Row>();
    return Promise.all(results.map((row) => this.toSite(row)));
  }

  async get(idOrSlug: string) {
    const row = await this.db
      .prepare('SELECT * FROM orchestrated_sites WHERE id = ? OR slug = ? LIMIT 1')
      .bind(idOrSlug, idOrSlug)
      .first<Row>();
    return row ? this.toSite(row) : null;
  }

  async save(site: ClientSite) {
    await this.db
      .prepare(
        `INSERT INTO orchestrated_sites
         (id, name, slug, base_url, repo, api_key_encrypted, status, template_version, packages, updates, last_seen_at, last_error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, slug = excluded.slug, base_url = excluded.base_url, repo = excluded.repo,
           api_key_encrypted = excluded.api_key_encrypted, status = excluded.status,
           template_version = excluded.template_version, packages = excluded.packages,
           updates = excluded.updates, last_seen_at = excluded.last_seen_at, last_error = excluded.last_error`
      )
      .bind(
        site.id,
        site.name,
        site.slug,
        site.baseUrl,
        site.repo,
        await encrypt(site.apiKey, this.encryptionKey),
        site.status,
        site.templateVersion,
        JSON.stringify(site.packages),
        JSON.stringify(site.updates),
        site.lastSeenAt,
        site.lastError,
        site.createdAt
      )
      .run();
  }

  async remove(id: string) {
    const result = await this.db
      .prepare('DELETE FROM orchestrated_sites WHERE id = ?')
      .bind(id)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }
}
