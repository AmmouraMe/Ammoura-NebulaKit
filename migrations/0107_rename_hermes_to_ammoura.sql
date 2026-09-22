-- Migration: 0107_rename_hermes_to_ammoura
-- Description: Retire the "Hermes" codename from seeded data. The platform is
--   Ammoura; every user-visible default that still says Hermes is rewritten.
-- Rollback: reverse each REPLACE ('Ammoura' -> 'Hermes eCommerce', and the
--   default-site row back to 'Hermes Store' / 'hermes.local').
--
-- Scope, deliberately narrow. Only values that are still the untouched seed
-- defaults are touched:
--   * a store name a tenant has already changed does not match, so it is safe;
--   * superseded page revisions are LEFT ALONE. A revision records what was
--     saved at the time; rewriting one would make the history a lie. Only the
--     published revision -- the content visitors actually see -- is updated.

-- 1. The default site row (seeded by 0002).
UPDATE sites
SET name = 'Ammoura Store',
    description = 'Default Ammoura Store',
    updated_at = strftime('%s', 'now')
WHERE id = 'default-site'
  AND name = 'Hermes Store';

UPDATE sites
SET domain = 'ammoura.local',
    updated_at = strftime('%s', 'now')
WHERE id = 'default-site'
  AND domain = 'hermes.local'
  AND NOT EXISTS (SELECT 1 FROM sites WHERE domain = 'ammoura.local');

-- 2. Settings defaults (seeded by 0026). `general_store_name` feeds the navbar
--    logo, page titles and every ${site.name} substitution.
UPDATE site_settings
SET setting_value = 'Ammoura'
WHERE setting_key = 'general_store_name'
  AND setting_value = 'Hermes eCommerce';

UPDATE site_settings
SET setting_value = 'Ammoura Store'
WHERE setting_key = 'email_from_name'
  AND setting_value = 'Hermes Store';

-- 3. Builder components (seeded by 0037, 0042, 0059, 0061): navbar logo text
--    and the pricing section heading, both inside the config JSON blob.
UPDATE components
SET config = REPLACE(config, 'Hermes eCommerce Pricing', 'Ammoura Pricing'),
    updated_at = CURRENT_TIMESTAMP
WHERE config LIKE '%Hermes eCommerce Pricing%';

UPDATE components
SET config = REPLACE(config, 'Hermes eCommerce', 'Ammoura'),
    updated_at = CURRENT_TIMESTAMP
WHERE config LIKE '%Hermes eCommerce%';

-- 4. The built-in home page's published content (seeded by 0063).
UPDATE page_revisions
SET widgets_snapshot = REPLACE(widgets_snapshot, 'Hermes eCommerce Pricing', 'Ammoura Pricing')
WHERE is_published = 1
  AND widgets_snapshot LIKE '%Hermes eCommerce Pricing%';

UPDATE page_revisions
SET widgets_snapshot = REPLACE(widgets_snapshot, 'Hermes eCommerce', 'Ammoura')
WHERE is_published = 1
  AND widgets_snapshot LIKE '%Hermes eCommerce%';
