/**
 * The control room's list of releases. The deployed Ammoura is a Worker and
 * cannot read the template's git history, so a platform engineer records each
 * release here (or the CLI imports it); `updates.ts` plans it against sites.
 */
import { parseReleases, type Release } from './updates';

export interface ReleaseStore {
  list(): Promise<Release[]>;
  save(release: Release): Promise<void>;
  remove(id: string): Promise<boolean>;
}

/** One release from the "record a release" form, checked by the same rules as a releases file. */
export function parseReleaseForm(
  form: FormData
): { ok: true; value: Release } | { ok: false; error: string } {
  const field = (name: string) => String(form.get(name) ?? '').trim();
  const pkg = field('package');
  const version = field('version');
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?$/.test(version))
    return { ok: false, error: 'The version looks like 1.2.3.' };
  try {
    const [release] = parseReleases([
      {
        id: `${pkg}@${version}`,
        package: pkg,
        version,
        channel: field('channel'),
        ref: field('ref'),
        notes: field('notes')
      }
    ]);
    return { ok: true, value: release };
  } catch {
    return { ok: false, error: 'Give the package, a version, a channel and the git ref.' };
  }
}

export class MemoryReleaseStore implements ReleaseStore {
  private releases = new Map<string, Release>();
  async list() {
    return [...this.releases.values()];
  }
  async save(release: Release) {
    this.releases.set(release.id, structuredClone(release));
  }
  async remove(id: string) {
    return this.releases.delete(id);
  }
}

type Row = Record<string, unknown>;

export class D1ReleaseStore implements ReleaseStore {
  constructor(private readonly db: D1Database) {}

  async list() {
    const { results } = await this.db
      .prepare('SELECT * FROM orchestrator_releases ORDER BY created_at DESC, id')
      .all<Row>();
    return results.map((row) => ({
      id: row.id as string,
      package: row.package as string,
      version: row.version as string,
      channel: row.channel as Release['channel'],
      ref: row.ref as string,
      ...(row.notes ? { notes: row.notes as string } : {})
    }));
  }

  async save(release: Release) {
    await this.db
      .prepare(
        `INSERT INTO orchestrator_releases (id, package, version, channel, ref, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET channel = excluded.channel, ref = excluded.ref, notes = excluded.notes`
      )
      .bind(
        release.id,
        release.package,
        release.version,
        release.channel,
        release.ref,
        release.notes ?? null
      )
      .run();
  }

  async remove(id: string) {
    const result = await this.db
      .prepare('DELETE FROM orchestrator_releases WHERE id = ?')
      .bind(id)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }
}
