/**
 * A registry kept in one JSON file, for the local control-room CLI
 * (`scripts/orchestrator.ts`). Node-only — never imported by the Worker.
 *
 * The file holds orchestrator keys in plaintext, so it is written 0600 and
 * belongs outside any repository (default: ~/.local/share/ammoura/sites.json).
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MemoryRegistry, type ClientSite } from './registry';

export class FileRegistry extends MemoryRegistry {
  private constructor(private readonly path: string) {
    super();
  }

  static open(path: string): FileRegistry {
    const registry = new FileRegistry(path);
    if (existsSync(path)) {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as { sites?: ClientSite[] };
      for (const site of parsed.sites ?? []) registry.sites.set(site.id, site);
    }
    return registry;
  }

  private flush() {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify({ sites: [...this.sites.values()] }, null, 2) + '\n', {
      mode: 0o600
    });
    renameSync(tmp, this.path);
    chmodSync(this.path, 0o600);
  }

  override async save(site: ClientSite) {
    await super.save(site);
    this.flush();
  }

  override async remove(id: string) {
    const removed = await super.remove(id);
    if (removed) this.flush();
    return removed;
  }
}
