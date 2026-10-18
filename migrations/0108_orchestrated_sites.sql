-- The control room's registry of client sites (src/lib/server/orchestrator/registry.ts).
--
-- Each client gets their own NebulaKit site (plans/ammoura-as-orchestrator.md);
-- Ammoura reaches each one only through that site's API. This table is
-- platform-level, not tenant data, so it has no site_id: it lists the sites.
-- The orchestrator key is stored encrypted with ENCRYPTION_KEY, never plain.

CREATE TABLE IF NOT EXISTS orchestrated_sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  repo TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  -- provisioned | healthy | unreachable
  status TEXT NOT NULL DEFAULT 'provisioned',
  template_version TEXT,
  packages TEXT NOT NULL DEFAULT '{}',
  updates TEXT NOT NULL DEFAULT '{"autoApplyFeatures":false,"optedIn":[]}',
  last_seen_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
