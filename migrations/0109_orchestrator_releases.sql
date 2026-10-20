-- Releases the control room can roll out to client sites
-- (src/lib/server/orchestrator/releases.ts). Platform-level, no site_id.
-- A release is a NebulaKit package version on a channel: `security` is forced
-- on every site, `feature` is offered and each owner opts in.

CREATE TABLE IF NOT EXISTS orchestrator_releases (
  id TEXT PRIMARY KEY,
  package TEXT NOT NULL,
  version TEXT NOT NULL,
  -- security | feature
  channel TEXT NOT NULL CHECK (channel IN ('security', 'feature')),
  -- Git ref in the NebulaKit template that carries the release.
  ref TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
