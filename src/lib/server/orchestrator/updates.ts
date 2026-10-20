/**
 * Update channels for client sites.
 *
 * David's condition for a site per client: "we would have to definitely have
 * a way to force push security updates." So there are two channels:
 *
 * - **security** — forced. Every site behind the release gets it, whatever
 *   its owner chose. There is no opt-out to read.
 * - **feature** — offered. A site takes it only if its owner opted in to that
 *   release, or turned on "take every feature release". Nobody's store
 *   changes under them.
 *
 * This file only decides; `rollout.ts` applies.
 */

export type UpdateChannel = 'security' | 'feature';

export interface Release {
  /** Stable id the site owner opts in to, e.g. `@nebulakit/builder@0.2.0`. */
  id: string;
  package: string;
  version: string;
  channel: UpdateChannel;
  /** Git ref in the NebulaKit template that carries the release. */
  ref: string;
  notes?: string;
}

export interface SiteUpdateState {
  siteId: string;
  packages: Record<string, string>;
  updates: { autoApplyFeatures: boolean; optedIn: string[] };
}

export type UpdateDecision = 'apply' | 'offer' | 'current';

export interface PlannedUpdate {
  siteId: string;
  release: Release;
  decision: UpdateDecision;
  reason: string;
}

/** Compare dotted numeric versions (`0.10.0` > `0.9.3`). Pre-release tags sort before the release. */
export function compareVersions(a: string, b: string): number {
  const [coreA, preA] = a.split('-', 2);
  const [coreB, preB] = b.split('-', 2);
  const pa = coreA.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = coreB.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  if (preA === preB) return 0;
  if (preA === undefined) return 1;
  if (preB === undefined) return -1;
  return preA < preB ? -1 : 1;
}

export function planUpdate(site: SiteUpdateState, release: Release): PlannedUpdate {
  const base = { siteId: site.siteId, release };
  const installed = site.packages[release.package];
  if (installed === undefined) {
    // A site built without the package (a plain kit site with no shop) is not
    // given one by an update.
    return { ...base, decision: 'current', reason: `${release.package} is not installed` };
  }
  if (compareVersions(installed, release.version) >= 0) {
    return { ...base, decision: 'current', reason: `already on ${installed}` };
  }
  if (release.channel === 'security') {
    return { ...base, decision: 'apply', reason: 'security release — forced on every site' };
  }
  if (site.updates.optedIn.includes(release.id)) {
    return { ...base, decision: 'apply', reason: 'owner opted in to this release' };
  }
  if (site.updates.autoApplyFeatures) {
    return { ...base, decision: 'apply', reason: 'owner takes every feature release' };
  }
  return { ...base, decision: 'offer', reason: 'feature release — waiting for the owner' };
}

/** Every release against every site. Security releases sort first so they are applied first. */
export function planRollout(sites: SiteUpdateState[], releases: Release[]): PlannedUpdate[] {
  const ordered = [...releases].sort(
    (a, b) =>
      Number(b.channel === 'security') - Number(a.channel === 'security') ||
      compareVersions(a.version, b.version)
  );
  return sites.flatMap((site) => ordered.map((release) => planUpdate(site, release)));
}

const RELEASE_ID = /^[A-Za-z0-9@/._-]{1,100}$/;

export function parseReleases(raw: unknown): Release[] {
  if (!Array.isArray(raw)) throw new Error('Releases must be a list');
  return raw.map((entry, i) => {
    const r = entry as Partial<Release>;
    if (
      typeof r?.id !== 'string' ||
      !RELEASE_ID.test(r.id) ||
      typeof r.package !== 'string' ||
      !r.package ||
      typeof r.version !== 'string' ||
      !r.version ||
      (r.channel !== 'security' && r.channel !== 'feature') ||
      typeof r.ref !== 'string' ||
      !r.ref
    ) {
      throw new Error(
        `Release ${i} needs id, package, version, channel (security|feature) and ref`
      );
    }
    return {
      id: r.id,
      package: r.package,
      version: r.version,
      channel: r.channel,
      ref: r.ref,
      ...(r.notes ? { notes: String(r.notes) } : {})
    };
  });
}
