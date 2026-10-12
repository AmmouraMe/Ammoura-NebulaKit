import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getDB,
  getAllEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getEquipmentFields,
  createEquipmentField,
  updateEquipmentField,
  deleteEquipmentField
} from '$lib/server/db';
import type { EquipmentFieldType, UpdateEquipmentData } from '$lib/types/equipment';
import { sanitizeCapabilities } from '$lib/server/equipment/sanitizeCapabilities';
import { getCatalogModel } from '$lib/data/equipmentCatalog';

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * The machine identity fields a request may set: make, model, catalog entry and
 * capabilities. Only keys present in the body are returned, so a PUT that leaves
 * one out keeps it.
 */
type MachineFields = Pick<
  UpdateEquipmentData,
  'make' | 'model' | 'catalogModelId' | 'capabilities' | 'kind'
>;

function machineFields(data: Record<string, unknown>): MachineFields {
  const out: MachineFields = {};
  if ('make' in data) out.make = optionalText(data.make, 80);
  if ('model' in data) out.model = optionalText(data.model, 120);
  if ('catalogModelId' in data) {
    // Only a real catalog entry; anything else is a machine the owner described.
    out.catalogModelId = getCatalogModel(optionalText(data.catalogModelId, 80))?.id ?? null;
  }
  if ('capabilities' in data) {
    if (data.capabilities === null) {
      out.capabilities = null;
      out.kind = null;
    } else {
      const capabilities = sanitizeCapabilities(data.capabilities);
      if (!capabilities) throw error(400, 'Invalid equipment capabilities');
      out.capabilities = capabilities;
      out.kind = capabilities.kind;
    }
  }
  return out;
}

const VALID_FIELD_TYPES: EquipmentFieldType[] = [
  'text',
  'textarea',
  'select',
  'color',
  'number',
  'date',
  'image',
  'audio',
  'video'
];

// GET all equipment (with optional fields)
export const GET: RequestHandler = async ({ platform, locals, url }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const equipmentId = url.searchParams.get('equipmentId');

    if (equipmentId) {
      // Return fields for a specific equipment
      const fields = await getEquipmentFields(db, siteId, equipmentId);
      return json(fields);
    }

    const equipment = await getAllEquipment(db, siteId);
    return json(equipment);
  } catch (err) {
    console.error('Error fetching equipment:', err);
    throw error(500, 'Failed to fetch equipment');
  }
};

// POST create equipment or equipment field
export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const data = (await request.json()) as Record<string, unknown>;

    // If equipmentId is present, create a field
    if (data.equipmentId) {
      if (!data.name || String(data.name).trim().length === 0) {
        throw error(400, 'Field name is required');
      }
      const fieldType = String(data.fieldType) as EquipmentFieldType;
      if (!data.fieldType || !VALID_FIELD_TYPES.includes(fieldType)) {
        throw error(400, 'Valid field type is required');
      }

      const field = await createEquipmentField(db, siteId, {
        equipmentId: String(data.equipmentId),
        name: String(data.name).trim(),
        fieldType,
        options: Array.isArray(data.options) ? data.options : undefined,
        placeholder: data.placeholder ? String(data.placeholder).trim() : undefined,
        required: data.required === true,
        maxLength: typeof data.maxLength === 'number' ? data.maxLength : undefined,
        minValue: typeof data.minValue === 'number' ? data.minValue : undefined,
        maxValue: typeof data.maxValue === 'number' ? data.maxValue : undefined,
        defaultValue: data.defaultValue ? String(data.defaultValue) : undefined,
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : undefined,
        mediaRequirements:
          data.mediaRequirements && typeof data.mediaRequirements === 'object'
            ? (data.mediaRequirements as Record<string, unknown>)
            : undefined
      });

      return json(field, { status: 201 });
    }

    // Otherwise create equipment
    if (!data.name || String(data.name).trim().length === 0) {
      throw error(400, 'Equipment name is required');
    }

    const equipment = await createEquipment(db, siteId, {
      name: String(data.name).trim(),
      description: data.description ? String(data.description).trim() : undefined,
      isActive: data.isActive !== false,
      ...machineFields(data)
    });

    return json(equipment, { status: 201 });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error creating equipment:', err);
    throw error(500, 'Failed to create equipment');
  }
};

// PUT update equipment or equipment field
export const PUT: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const data = (await request.json()) as Record<string, unknown>;

    if (!data.id) {
      throw error(400, 'ID is required');
    }

    const id = String(data.id);

    // If fieldType or equipmentId is set, it's a field update
    if (data.isField) {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = String(data.name).trim();
      if (data.fieldType !== undefined) {
        const ft = String(data.fieldType) as EquipmentFieldType;
        if (!VALID_FIELD_TYPES.includes(ft)) {
          throw error(400, 'Invalid field type');
        }
        updateData.fieldType = ft;
      }
      if (data.options !== undefined) updateData.options = data.options;
      if (data.placeholder !== undefined) updateData.placeholder = data.placeholder;
      if (data.required !== undefined) updateData.required = data.required;
      if (data.maxLength !== undefined) updateData.maxLength = data.maxLength;
      if (data.minValue !== undefined) updateData.minValue = data.minValue;
      if (data.maxValue !== undefined) updateData.maxValue = data.maxValue;
      if (data.defaultValue !== undefined) updateData.defaultValue = data.defaultValue;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
      if (data.mediaRequirements !== undefined) {
        updateData.mediaRequirements =
          data.mediaRequirements && typeof data.mediaRequirements === 'object'
            ? data.mediaRequirements
            : null;
      }

      const field = await updateEquipmentField(db, siteId, id, updateData);
      if (!field) {
        throw error(404, 'Equipment field not found');
      }
      return json(field);
    }

    // Update equipment
    const updateData: Record<string, unknown> = { ...machineFields(data) };
    if (data.name !== undefined) {
      if (String(data.name).trim().length === 0) {
        throw error(400, 'Equipment name cannot be empty');
      }
      updateData.name = String(data.name).trim();
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const equipment = await updateEquipment(db, siteId, id, updateData);
    if (!equipment) {
      throw error(404, 'Equipment not found');
    }
    return json(equipment);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error updating equipment:', err);
    throw error(500, 'Failed to update equipment');
  }
};

// DELETE equipment or equipment field
export const DELETE: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const data = (await request.json()) as Record<string, unknown>;

    if (!data.id) {
      throw error(400, 'ID is required');
    }

    const id = String(data.id);

    if (data.isField) {
      const deleted = await deleteEquipmentField(db, siteId, id);
      if (!deleted) {
        throw error(404, 'Equipment field not found');
      }
      return json({ success: true });
    }

    const deleted = await deleteEquipment(db, siteId, id);
    if (!deleted) {
      throw error(404, 'Equipment not found');
    }
    return json({ success: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error deleting equipment:', err);
    throw error(500, 'Failed to delete equipment');
  }
};
