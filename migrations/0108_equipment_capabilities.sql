-- Migration: 0108_equipment_capabilities
-- Description: Let a site's equipment be a known machine with known capabilities.
--   equipment.kind / make / model: what the machine is (e.g. 'dtg-printer',
--     'Epson', 'SureColor F2100'). NULL kind = a legacy, free-form entry.
--   equipment.catalog_model_id: the built-in catalog entry it was added from
--     (src/lib/data/equipmentCatalog.ts); NULL for a machine the owner described.
--   equipment.capabilities: JSON EquipmentCapabilities, copied from the catalog
--     and editable per site — print area, media width, inks, substrates, and for
--     size-based machines (button dies, mug sizes) only the sizes the site owns.
--   product_equipment.size_id: which of the machine's sizes the product is made
--     at, e.g. 'round-1.25' for a 1¼" button. NULL when sizes do not apply.
-- Rollback (D1 has no DROP COLUMN on older SQLite; rebuild the tables without):
--   ALTER TABLE product_equipment DROP COLUMN size_id;
--   ALTER TABLE equipment DROP COLUMN capabilities;
--   ALTER TABLE equipment DROP COLUMN catalog_model_id;
--   ALTER TABLE equipment DROP COLUMN model;
--   ALTER TABLE equipment DROP COLUMN make;
--   ALTER TABLE equipment DROP COLUMN kind;

ALTER TABLE equipment ADD COLUMN kind TEXT;
ALTER TABLE equipment ADD COLUMN make TEXT;
ALTER TABLE equipment ADD COLUMN model TEXT;
ALTER TABLE equipment ADD COLUMN catalog_model_id TEXT;
ALTER TABLE equipment ADD COLUMN capabilities TEXT;

ALTER TABLE product_equipment ADD COLUMN size_id TEXT;

CREATE INDEX IF NOT EXISTS idx_equipment_kind ON equipment(site_id, kind);
