/**
 * Hostnames attached to sites: free platform subdomains and customer-owned
 * custom domains (provisioned via Cloudflare for SaaS in a later phase).
 */

import { execute, executeOne, generateId, getCurrentTimestamp } from './connection.js';

export type SiteDomainKind = 'platform' | 'custom';
export type SiteDomainStatus =
  'pending_dns' | 'pending_validation' | 'active' | 'error' | 'removed';

export interface SiteDomain {
  id: string;
  site_id: string;
  hostname: string;
  kind: SiteDomainKind;
  is_primary: number;
  status: SiteDomainStatus;
  cf_custom_hostname_id: string | null;
  verification: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateSiteDomainData {
  site_id: string;
  hostname: string;
  kind: SiteDomainKind;
  is_primary?: boolean;
  status?: SiteDomainStatus;
  cf_custom_hostname_id?: string;
  verification?: Record<string, unknown>;
}

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '').split(':')[0];
}

export async function addSiteDomain(
  db: D1Database,
  data: CreateSiteDomainData
): Promise<SiteDomain> {
  const id = generateId();
  const timestamp = getCurrentTimestamp();

  await db
    .prepare(
      `INSERT INTO site_domains
         (id, site_id, hostname, kind, is_primary, status, cf_custom_hostname_id, verification, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      data.site_id,
      normalizeHostname(data.hostname),
      data.kind,
      data.is_primary ? 1 : 0,
      data.status || 'pending_dns',
      data.cf_custom_hostname_id || null,
      data.verification ? JSON.stringify(data.verification) : null,
      timestamp,
      timestamp
    )
    .run();

  const domain = await getSiteDomainById(db, id);
  if (!domain) {
    throw new Error('Failed to create site domain');
  }
  return domain;
}

export async function getSiteDomainById(db: D1Database, id: string): Promise<SiteDomain | null> {
  return await executeOne<SiteDomain>(db, 'SELECT * FROM site_domains WHERE id = ?', [id]);
}

export async function getSiteDomainByHostname(
  db: D1Database,
  hostname: string
): Promise<SiteDomain | null> {
  return await executeOne<SiteDomain>(
    db,
    "SELECT * FROM site_domains WHERE hostname = ? AND status != 'removed'",
    [normalizeHostname(hostname)]
  );
}

/**
 * Like getSiteDomainByHostname but includes soft-removed rows — needed when
 * re-adding a hostname, since hostname is UNIQUE across all statuses.
 */
export async function getAnySiteDomainByHostname(
  db: D1Database,
  hostname: string
): Promise<SiteDomain | null> {
  return await executeOne<SiteDomain>(db, 'SELECT * FROM site_domains WHERE hostname = ?', [
    normalizeHostname(hostname)
  ]);
}

/**
 * Permanently delete a domain row. Only for reclaiming soft-removed rows;
 * active domains should go through removeSiteDomain (soft delete).
 */
export async function hardDeleteSiteDomain(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM site_domains WHERE id = ?').bind(id).run();
}

/**
 * Resolve a hostname to its site id. Only active domains route traffic.
 */
export async function getActiveSiteIdForHostname(
  db: D1Database,
  hostname: string
): Promise<string | null> {
  const row = await executeOne<{ site_id: string }>(
    db,
    `SELECT site_domains.site_id
     FROM site_domains
     JOIN sites ON sites.id = site_domains.site_id
     WHERE site_domains.hostname = ? AND site_domains.status = 'active'
       AND sites.status = 'active'`,
    [normalizeHostname(hostname)]
  );
  return row?.site_id || null;
}

export async function getDomainsForSite(db: D1Database, siteId: string): Promise<SiteDomain[]> {
  const result = await execute<SiteDomain>(
    db,
    "SELECT * FROM site_domains WHERE site_id = ? AND status != 'removed' ORDER BY is_primary DESC, created_at ASC",
    [siteId]
  );
  return result.results || [];
}

export async function updateSiteDomainStatus(
  db: D1Database,
  id: string,
  status: SiteDomainStatus,
  verification?: Record<string, unknown>
): Promise<boolean> {
  const params: unknown[] = [status];
  let sql = 'UPDATE site_domains SET status = ?';
  if (verification !== undefined) {
    sql += ', verification = ?';
    params.push(JSON.stringify(verification));
  }
  sql += ', updated_at = ? WHERE id = ?';
  params.push(getCurrentTimestamp(), id);

  const result = await db
    .prepare(sql)
    .bind(...params)
    .run();
  return (result.meta?.changes || 0) > 0;
}

/**
 * Mark one domain primary and clear the flag on the site's other domains.
 */
export async function setPrimarySiteDomain(
  db: D1Database,
  siteId: string,
  domainId: string
): Promise<void> {
  const timestamp = getCurrentTimestamp();
  await db
    .prepare('UPDATE site_domains SET is_primary = 0, updated_at = ? WHERE site_id = ?')
    .bind(timestamp, siteId)
    .run();
  await db
    .prepare('UPDATE site_domains SET is_primary = 1, updated_at = ? WHERE id = ? AND site_id = ?')
    .bind(timestamp, domainId, siteId)
    .run();
}

export async function removeSiteDomain(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE site_domains SET status = 'removed', updated_at = ? WHERE id = ?")
    .bind(getCurrentTimestamp(), id)
    .run();
  return (result.meta?.changes || 0) > 0;
}
