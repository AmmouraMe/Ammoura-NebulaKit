import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getEquipmentById,
  getAllEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getEquipmentFieldById,
  getEquipmentFields,
  createEquipmentField,
  updateEquipmentField,
  deleteEquipmentField,
  getProductEquipment,
  addProductEquipment,
  removeProductEquipment,
  getProductEquipmentWithFields,
  saveOrderItemEquipmentValues,
  getOrderItemEquipmentValues,
  setProductEquipmentSize,
  getProductEquipmentLinks,
  getProductFitInfo
} from './equipment';

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('equipment', () => {
  let mockDb: any;
  const testSiteId = 'test-site';
  const testEquipmentId = 'equip-123';
  const testFieldId = 'field-456';
  const testProductId = 'product-789';

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      first: vi.fn(),
      all: vi.fn()
    };
  });

  // --- Equipment CRUD ---

  describe('getAllEquipment', () => {
    it('fetches all equipment for a site', async () => {
      const mockRows = [
        {
          id: 'equip-1',
          site_id: testSiteId,
          name: 'Laser Engraver',
          description: 'Industrial laser',
          is_active: 1,
          created_at: 1000,
          updated_at: 1000
        },
        {
          id: 'equip-2',
          site_id: testSiteId,
          name: 'Heat Press',
          description: null,
          is_active: 0,
          created_at: 2000,
          updated_at: 2000
        }
      ];

      mockDb.all.mockResolvedValue({ results: mockRows });

      const equipment = await getAllEquipment(mockDb, testSiteId);

      expect(equipment).toHaveLength(2);
      expect(equipment[0].name).toBe('Laser Engraver');
      expect(equipment[0].isActive).toBe(true);
      expect(equipment[0].siteId).toBe(testSiteId);
      expect(equipment[1].name).toBe('Heat Press');
      expect(equipment[1].isActive).toBe(false);
      expect(equipment[1].description).toBeNull();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE site_id = ?'));
    });

    it('returns empty array when no equipment exists', async () => {
      mockDb.all.mockResolvedValue({ results: [] });

      const equipment = await getAllEquipment(mockDb, testSiteId);

      expect(equipment).toEqual([]);
    });

    it('handles null results', async () => {
      mockDb.all.mockResolvedValue({ results: null });

      const equipment = await getAllEquipment(mockDb, testSiteId);

      expect(equipment).toEqual([]);
    });
  });

  describe('getEquipmentById', () => {
    it('fetches a single equipment by id', async () => {
      mockDb.first.mockResolvedValue({
        id: testEquipmentId,
        site_id: testSiteId,
        name: 'Embroidery Machine',
        description: 'Multi-needle embroidery',
        is_active: 1,
        created_at: 1000,
        updated_at: 1000
      });

      const equipment = await getEquipmentById(mockDb, testSiteId, testEquipmentId);

      expect(equipment).not.toBeNull();
      expect(equipment!.id).toBe(testEquipmentId);
      expect(equipment!.name).toBe('Embroidery Machine');
      expect(equipment!.description).toBe('Multi-needle embroidery');
      expect(equipment!.isActive).toBe(true);
    });

    it('returns null when equipment not found', async () => {
      mockDb.first.mockResolvedValue(null);

      const equipment = await getEquipmentById(mockDb, testSiteId, 'nonexistent');

      expect(equipment).toBeNull();
    });
  });

  describe('createEquipment', () => {
    it('creates equipment with all fields', async () => {
      mockDb.first.mockResolvedValue({
        id: 'new-equip',
        site_id: testSiteId,
        name: 'CNC Router',
        description: 'Precision CNC',
        is_active: 1,
        created_at: 1000,
        updated_at: 1000
      });

      const equipment = await createEquipment(mockDb, testSiteId, {
        name: 'CNC Router',
        description: 'Precision CNC',
        isActive: true
      });

      expect(equipment.name).toBe('CNC Router');
      expect(equipment.description).toBe('Precision CNC');
      expect(equipment.isActive).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
    });

    it('creates equipment with defaults', async () => {
      mockDb.first.mockResolvedValue({
        id: 'new-equip',
        site_id: testSiteId,
        name: 'Vinyl Cutter',
        description: null,
        is_active: 1,
        created_at: 1000,
        updated_at: 1000
      });

      const equipment = await createEquipment(mockDb, testSiteId, {
        name: 'Vinyl Cutter'
      });

      expect(equipment.name).toBe('Vinyl Cutter');
      expect(equipment.description).toBeNull();
      expect(equipment.isActive).toBe(true);
    });

    it('throws when creation fails to return record', async () => {
      mockDb.first.mockResolvedValue(null);

      await expect(createEquipment(mockDb, testSiteId, { name: 'Ghost' })).rejects.toThrow(
        'Failed to create equipment'
      );
    });
  });

  describe('updateEquipment', () => {
    it('updates equipment properties', async () => {
      mockDb.first
        .mockResolvedValueOnce({
          id: testEquipmentId,
          site_id: testSiteId,
          name: 'Old Name',
          description: null,
          is_active: 1,
          created_at: 1000,
          updated_at: 1000
        })
        .mockResolvedValueOnce({
          id: testEquipmentId,
          site_id: testSiteId,
          name: 'Updated Name',
          description: 'New description',
          is_active: 0,
          created_at: 1000,
          updated_at: 2000
        });

      const equipment = await updateEquipment(mockDb, testSiteId, testEquipmentId, {
        name: 'Updated Name',
        description: 'New description',
        isActive: false
      });

      expect(equipment).not.toBeNull();
      expect(equipment!.name).toBe('Updated Name');
      expect(equipment!.description).toBe('New description');
      expect(equipment!.isActive).toBe(false);
    });

    it('returns null when equipment not found', async () => {
      mockDb.first.mockResolvedValue(null);

      const equipment = await updateEquipment(mockDb, testSiteId, 'nonexistent', {
        name: 'Updated'
      });

      expect(equipment).toBeNull();
    });

    it('returns existing equipment when no updates provided', async () => {
      const existing = {
        id: testEquipmentId,
        site_id: testSiteId,
        name: 'Unchanged',
        description: null,
        is_active: 1,
        created_at: 1000,
        updated_at: 1000
      };

      mockDb.first.mockResolvedValue(existing);

      const equipment = await updateEquipment(mockDb, testSiteId, testEquipmentId, {});

      expect(equipment).not.toBeNull();
      expect(equipment!.name).toBe('Unchanged');
    });
  });

  describe('deleteEquipment', () => {
    it('deletes an existing equipment', async () => {
      mockDb.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

      const result = await deleteEquipment(mockDb, testSiteId, testEquipmentId);

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM'));
    });

    it('returns false when equipment not found', async () => {
      mockDb.run.mockResolvedValue({ success: true, meta: { changes: 0 } });

      const result = await deleteEquipment(mockDb, testSiteId, 'nonexistent');

      expect(result).toBe(false);
    });
  });

  // --- Equipment Fields CRUD ---

  describe('getEquipmentFields', () => {
    it('fetches all fields for an equipment', async () => {
      const mockFields = [
        {
          id: 'field-1',
          site_id: testSiteId,
          equipment_id: testEquipmentId,
          name: 'Material Type',
          field_type: 'select',
          options: '["Wood","Acrylic","Metal"]',
          placeholder: null,
          required: 1,
          max_length: null,
          min_value: null,
          max_value: null,
          default_value: 'Wood',
          sort_order: 0,
          media_requirements: null,
          created_at: 1000,
          updated_at: 1000
        },
        {
          id: 'field-2',
          site_id: testSiteId,
          equipment_id: testEquipmentId,
          name: 'Engraving Depth',
          field_type: 'number',
          options: null,
          placeholder: 'mm',
          required: 0,
          max_length: null,
          min_value: 0.1,
          max_value: 5.0,
          default_value: '1',
          sort_order: 1,
          media_requirements: null,
          created_at: 1000,
          updated_at: 1000
        }
      ];

      mockDb.all.mockResolvedValue({ results: mockFields });

      const fields = await getEquipmentFields(mockDb, testSiteId, testEquipmentId);

      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('Material Type');
      expect(fields[0].fieldType).toBe('select');
      expect(fields[0].options).toEqual(['Wood', 'Acrylic', 'Metal']);
      expect(fields[0].required).toBe(true);
      expect(fields[0].defaultValue).toBe('Wood');
      expect(fields[1].name).toBe('Engraving Depth');
      expect(fields[1].fieldType).toBe('number');
      expect(fields[1].minValue).toBe(0.1);
      expect(fields[1].maxValue).toBe(5.0);
      expect(fields[1].required).toBe(false);
    });

    it('returns empty array when no fields exist', async () => {
      mockDb.all.mockResolvedValue({ results: [] });

      const fields = await getEquipmentFields(mockDb, testSiteId, testEquipmentId);

      expect(fields).toEqual([]);
    });

    it('handles null results', async () => {
      mockDb.all.mockResolvedValue({ results: null });

      const fields = await getEquipmentFields(mockDb, testSiteId, testEquipmentId);

      expect(fields).toEqual([]);
    });
  });

  describe('getEquipmentFieldById', () => {
    it('fetches a single field by id', async () => {
      mockDb.first.mockResolvedValue({
        id: testFieldId,
        site_id: testSiteId,
        equipment_id: testEquipmentId,
        name: 'Thread Color',
        field_type: 'color',
        options: null,
        placeholder: null,
        required: 1,
        max_length: null,
        min_value: null,
        max_value: null,
        default_value: '#000000',
        sort_order: 0,
        media_requirements: null,
        created_at: 1000,
        updated_at: 1000
      });

      const field = await getEquipmentFieldById(mockDb, testSiteId, testFieldId);

      expect(field).not.toBeNull();
      expect(field!.id).toBe(testFieldId);
      expect(field!.name).toBe('Thread Color');
      expect(field!.fieldType).toBe('color');
      expect(field!.defaultValue).toBe('#000000');
    });

    it('returns null when field not found', async () => {
      mockDb.first.mockResolvedValue(null);

      const field = await getEquipmentFieldById(mockDb, testSiteId, 'nonexistent');

      expect(field).toBeNull();
    });
  });

  describe('createEquipmentField', () => {
    it('creates a select field with options', async () => {
      mockDb.first.mockResolvedValue({
        id: 'new-field',
        site_id: testSiteId,
        equipment_id: testEquipmentId,
        name: 'Paper Weight',
        field_type: 'select',
        options: '["80gsm","120gsm","200gsm"]',
        placeholder: null,
        required: 1,
        max_length: null,
        min_value: null,
        max_value: null,
        default_value: '80gsm',
        sort_order: 0,
        media_requirements: null,
        created_at: 1000,
        updated_at: 1000
      });

      const field = await createEquipmentField(mockDb, testSiteId, {
        equipmentId: testEquipmentId,
        name: 'Paper Weight',
        fieldType: 'select',
        options: ['80gsm', '120gsm', '200gsm'],
        required: true,
        defaultValue: '80gsm'
      });

      expect(field.name).toBe('Paper Weight');
      expect(field.fieldType).toBe('select');
      expect(field.options).toEqual(['80gsm', '120gsm', '200gsm']);
      expect(field.required).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
    });

    it('creates a text field with max length', async () => {
      mockDb.first.mockResolvedValue({
        id: 'new-field',
        site_id: testSiteId,
        equipment_id: testEquipmentId,
        name: 'Custom Text',
        field_type: 'text',
        options: null,
        placeholder: 'Enter your text',
        required: 0,
        max_length: 50,
        min_value: null,
        max_value: null,
        default_value: null,
        sort_order: 1,
        media_requirements: null,
        created_at: 1000,
        updated_at: 1000
      });

      const field = await createEquipmentField(mockDb, testSiteId, {
        equipmentId: testEquipmentId,
        name: 'Custom Text',
        fieldType: 'text',
        placeholder: 'Enter your text',
        maxLength: 50,
        sortOrder: 1
      });

      expect(field.name).toBe('Custom Text');
      expect(field.fieldType).toBe('text');
      expect(field.placeholder).toBe('Enter your text');
      expect(field.maxLength).toBe(50);
      expect(field.required).toBe(false);
    });

    it('throws when creation fails', async () => {
      mockDb.first.mockResolvedValue(null);

      await expect(
        createEquipmentField(mockDb, testSiteId, {
          equipmentId: testEquipmentId,
          name: 'Ghost Field',
          fieldType: 'text'
        })
      ).rejects.toThrow('Failed to create equipment field');
    });

    it('creates an image field with media requirements', async () => {
      const mediaReqs = {
        maxFileSize: 10485760,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        minWidth: 800,
        minHeight: 600
      };
      mockDb.first.mockResolvedValue({
        id: 'new-field',
        site_id: testSiteId,
        equipment_id: testEquipmentId,
        name: 'Product Photo',
        field_type: 'image',
        options: null,
        placeholder: null,
        required: 1,
        max_length: null,
        min_value: null,
        max_value: null,
        default_value: null,
        sort_order: 0,
        media_requirements: JSON.stringify(mediaReqs),
        created_at: 1000,
        updated_at: 1000
      });

      const field = await createEquipmentField(mockDb, testSiteId, {
        equipmentId: testEquipmentId,
        name: 'Product Photo',
        fieldType: 'image',
        required: true,
        mediaRequirements: mediaReqs
      });

      expect(field.name).toBe('Product Photo');
      expect(field.fieldType).toBe('image');
      expect(field.mediaRequirements).toEqual(mediaReqs);
      expect(field.required).toBe(true);
    });

    it('creates an audio field with duration requirements', async () => {
      const mediaReqs = { maxDuration: 120, minBitrate: 128 };
      mockDb.first.mockResolvedValue({
        id: 'new-field',
        site_id: testSiteId,
        equipment_id: testEquipmentId,
        name: 'Voice Message',
        field_type: 'audio',
        options: null,
        placeholder: null,
        required: 0,
        max_length: null,
        min_value: null,
        max_value: null,
        default_value: null,
        sort_order: 0,
        media_requirements: JSON.stringify(mediaReqs),
        created_at: 1000,
        updated_at: 1000
      });

      const field = await createEquipmentField(mockDb, testSiteId, {
        equipmentId: testEquipmentId,
        name: 'Voice Message',
        fieldType: 'audio',
        mediaRequirements: mediaReqs
      });

      expect(field.fieldType).toBe('audio');
      expect(field.mediaRequirements).toEqual(mediaReqs);
    });

    it('creates a video field with resolution requirements', async () => {
      const mediaReqs = { minResolution: 720, minFrameRate: 24 };
      mockDb.first.mockResolvedValue({
        id: 'new-field',
        site_id: testSiteId,
        equipment_id: testEquipmentId,
        name: 'Demo Video',
        field_type: 'video',
        options: null,
        placeholder: null,
        required: 0,
        max_length: null,
        min_value: null,
        max_value: null,
        default_value: null,
        sort_order: 0,
        media_requirements: JSON.stringify(mediaReqs),
        created_at: 1000,
        updated_at: 1000
      });

      const field = await createEquipmentField(mockDb, testSiteId, {
        equipmentId: testEquipmentId,
        name: 'Demo Video',
        fieldType: 'video',
        mediaRequirements: mediaReqs
      });

      expect(field.fieldType).toBe('video');
      expect(field.mediaRequirements).toEqual(mediaReqs);
    });

    it('creates a media field without requirements', async () => {
      mockDb.first.mockResolvedValue({
        id: 'new-field',
        site_id: testSiteId,
        equipment_id: testEquipmentId,
        name: 'Reference Image',
        field_type: 'image',
        options: null,
        placeholder: null,
        required: 0,
        max_length: null,
        min_value: null,
        max_value: null,
        default_value: null,
        sort_order: 0,
        media_requirements: null,
        created_at: 1000,
        updated_at: 1000
      });

      const field = await createEquipmentField(mockDb, testSiteId, {
        equipmentId: testEquipmentId,
        name: 'Reference Image',
        fieldType: 'image'
      });

      expect(field.fieldType).toBe('image');
      expect(field.mediaRequirements).toBeNull();
    });
  });

  describe('updateEquipmentField', () => {
    it('updates field properties', async () => {
      mockDb.first
        .mockResolvedValueOnce({
          id: testFieldId,
          site_id: testSiteId,
          equipment_id: testEquipmentId,
          name: 'Old Field',
          field_type: 'text',
          options: null,
          placeholder: null,
          required: 0,
          max_length: null,
          min_value: null,
          max_value: null,
          default_value: null,
          sort_order: 0,
          media_requirements: null,
          created_at: 1000,
          updated_at: 1000
        })
        .mockResolvedValueOnce({
          id: testFieldId,
          site_id: testSiteId,
          equipment_id: testEquipmentId,
          name: 'Updated Field',
          field_type: 'textarea',
          options: null,
          placeholder: 'Details here',
          required: 1,
          max_length: 500,
          min_value: null,
          max_value: null,
          default_value: null,
          sort_order: 0,
          media_requirements: null,
          created_at: 1000,
          updated_at: 2000
        });

      const field = await updateEquipmentField(mockDb, testSiteId, testFieldId, {
        name: 'Updated Field',
        fieldType: 'textarea',
        placeholder: 'Details here',
        required: true,
        maxLength: 500
      });

      expect(field).not.toBeNull();
      expect(field!.name).toBe('Updated Field');
      expect(field!.fieldType).toBe('textarea');
      expect(field!.required).toBe(true);
      expect(field!.maxLength).toBe(500);
    });

    it('returns null when field not found', async () => {
      mockDb.first.mockResolvedValue(null);

      const field = await updateEquipmentField(mockDb, testSiteId, 'nonexistent', {
        name: 'Nope'
      });

      expect(field).toBeNull();
    });

    it('returns existing field when no updates provided', async () => {
      mockDb.first.mockResolvedValue({
        id: testFieldId,
        site_id: testSiteId,
        equipment_id: testEquipmentId,
        name: 'Unchanged',
        field_type: 'text',
        options: null,
        placeholder: null,
        required: 0,
        max_length: null,
        min_value: null,
        max_value: null,
        default_value: null,
        sort_order: 0,
        media_requirements: null,
        created_at: 1000,
        updated_at: 1000
      });

      const field = await updateEquipmentField(mockDb, testSiteId, testFieldId, {});

      expect(field).not.toBeNull();
      expect(field!.name).toBe('Unchanged');
    });

    it('updates media requirements on a field', async () => {
      const newReqs = { maxFileSize: 5242880, minWidth: 400 };
      mockDb.first
        .mockResolvedValueOnce({
          id: testFieldId,
          site_id: testSiteId,
          equipment_id: testEquipmentId,
          name: 'Photo',
          field_type: 'image',
          options: null,
          placeholder: null,
          required: 1,
          max_length: null,
          min_value: null,
          max_value: null,
          default_value: null,
          sort_order: 0,
          media_requirements: null,
          created_at: 1000,
          updated_at: 1000
        })
        .mockResolvedValueOnce({
          id: testFieldId,
          site_id: testSiteId,
          equipment_id: testEquipmentId,
          name: 'Photo',
          field_type: 'image',
          options: null,
          placeholder: null,
          required: 1,
          max_length: null,
          min_value: null,
          max_value: null,
          default_value: null,
          sort_order: 0,
          media_requirements: JSON.stringify(newReqs),
          created_at: 1000,
          updated_at: 2000
        });

      const field = await updateEquipmentField(mockDb, testSiteId, testFieldId, {
        mediaRequirements: newReqs
      });

      expect(field).not.toBeNull();
      expect(field!.mediaRequirements).toEqual(newReqs);
    });

    it('clears media requirements when set to null', async () => {
      const existingReqs = { maxFileSize: 5242880 };
      mockDb.first
        .mockResolvedValueOnce({
          id: testFieldId,
          site_id: testSiteId,
          equipment_id: testEquipmentId,
          name: 'Photo',
          field_type: 'image',
          options: null,
          placeholder: null,
          required: 1,
          max_length: null,
          min_value: null,
          max_value: null,
          default_value: null,
          sort_order: 0,
          media_requirements: JSON.stringify(existingReqs),
          created_at: 1000,
          updated_at: 1000
        })
        .mockResolvedValueOnce({
          id: testFieldId,
          site_id: testSiteId,
          equipment_id: testEquipmentId,
          name: 'Photo',
          field_type: 'image',
          options: null,
          placeholder: null,
          required: 1,
          max_length: null,
          min_value: null,
          max_value: null,
          default_value: null,
          sort_order: 0,
          media_requirements: null,
          created_at: 1000,
          updated_at: 2000
        });

      const field = await updateEquipmentField(mockDb, testSiteId, testFieldId, {
        mediaRequirements: null
      });

      expect(field).not.toBeNull();
      expect(field!.mediaRequirements).toBeNull();
    });
  });

  describe('deleteEquipmentField', () => {
    it('deletes an existing field', async () => {
      mockDb.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

      const result = await deleteEquipmentField(mockDb, testSiteId, testFieldId);

      expect(result).toBe(true);
    });

    it('returns false when field not found', async () => {
      mockDb.run.mockResolvedValue({ success: true, meta: { changes: 0 } });

      const result = await deleteEquipmentField(mockDb, testSiteId, 'nonexistent');

      expect(result).toBe(false);
    });
  });

  // --- Product-Equipment Associations ---

  describe('getProductEquipment', () => {
    it('fetches equipment associated with a product', async () => {
      const mockRows = [
        {
          id: 'pe-1',
          site_id: testSiteId,
          product_id: testProductId,
          equipment_id: 'equip-1',
          sort_order: 0,
          created_at: 1000
        },
        {
          id: 'pe-2',
          site_id: testSiteId,
          product_id: testProductId,
          equipment_id: 'equip-2',
          sort_order: 1,
          created_at: 2000
        }
      ];

      mockDb.all.mockResolvedValue({ results: mockRows });

      const associations = await getProductEquipment(mockDb, testSiteId, testProductId);

      expect(associations).toHaveLength(2);
      expect(associations[0].equipmentId).toBe('equip-1');
      expect(associations[0].sortOrder).toBe(0);
      expect(associations[1].equipmentId).toBe('equip-2');
      expect(associations[1].sortOrder).toBe(1);
    });

    it('returns empty array when no equipment associated', async () => {
      mockDb.all.mockResolvedValue({ results: [] });

      const associations = await getProductEquipment(mockDb, testSiteId, testProductId);

      expect(associations).toEqual([]);
    });
  });

  describe('addProductEquipment', () => {
    it('adds equipment to a product', async () => {
      mockDb.first.mockResolvedValue({
        id: 'pe-new',
        site_id: testSiteId,
        product_id: testProductId,
        equipment_id: testEquipmentId,
        sort_order: 0,
        created_at: 1000
      });

      const association = await addProductEquipment(
        mockDb,
        testSiteId,
        testProductId,
        testEquipmentId,
        0
      );

      expect(association.productId).toBe(testProductId);
      expect(association.equipmentId).toBe(testEquipmentId);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO product_equipment')
      );
    });

    it('throws when association fails', async () => {
      mockDb.first.mockResolvedValue(null);

      await expect(
        addProductEquipment(mockDb, testSiteId, testProductId, testEquipmentId, 0)
      ).rejects.toThrow('Failed to add equipment to product');
    });
  });

  describe('removeProductEquipment', () => {
    it('removes equipment from a product', async () => {
      mockDb.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

      const result = await removeProductEquipment(
        mockDb,
        testSiteId,
        testProductId,
        testEquipmentId
      );

      expect(result).toBe(true);
    });

    it('returns false when association not found', async () => {
      mockDb.run.mockResolvedValue({ success: true, meta: { changes: 0 } });

      const result = await removeProductEquipment(mockDb, testSiteId, testProductId, 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getProductEquipmentWithFields', () => {
    it('fetches equipment with fields for a product', async () => {
      // First call: product_equipment join equipment
      mockDb.all.mockResolvedValueOnce({
        results: [
          {
            id: 'pe-1',
            site_id: testSiteId,
            product_id: testProductId,
            equipment_id: 'equip-1',
            sort_order: 0,
            created_at: 1000,
            eq_id: 'equip-1',
            eq_name: 'Laser Engraver',
            eq_description: 'For engraving',
            eq_is_active: 1,
            eq_created_at: 900,
            eq_updated_at: 900
          }
        ]
      });

      // Second call: equipment fields for equip-1
      mockDb.all.mockResolvedValueOnce({
        results: [
          {
            id: 'field-1',
            site_id: testSiteId,
            equipment_id: 'equip-1',
            name: 'Material',
            field_type: 'select',
            options: '["Wood","Metal"]',
            placeholder: null,
            required: 1,
            max_length: null,
            min_value: null,
            max_value: null,
            default_value: 'Wood',
            sort_order: 0,
            media_requirements: null,
            created_at: 1000,
            updated_at: 1000
          }
        ]
      });

      const equipmentWithFields = await getProductEquipmentWithFields(
        mockDb,
        testSiteId,
        testProductId
      );

      expect(equipmentWithFields).toHaveLength(1);
      expect(equipmentWithFields[0].name).toBe('Laser Engraver');
      expect(equipmentWithFields[0].fields).toHaveLength(1);
      expect(equipmentWithFields[0].fields[0].name).toBe('Material');
      expect(equipmentWithFields[0].fields[0].options).toEqual(['Wood', 'Metal']);
    });

    it('returns empty array when no equipment associated', async () => {
      mockDb.all.mockResolvedValue({ results: [] });

      const result = await getProductEquipmentWithFields(mockDb, testSiteId, testProductId);

      expect(result).toEqual([]);
    });
  });

  // --- Order Item Equipment Values ---

  describe('saveOrderItemEquipmentValues', () => {
    it('saves equipment values for an order item', async () => {
      const values = [
        {
          equipmentId: 'equip-1',
          equipmentFieldId: 'field-1',
          fieldName: 'Material',
          value: 'Wood'
        },
        {
          equipmentId: 'equip-1',
          equipmentFieldId: 'field-2',
          fieldName: 'Depth',
          value: '2mm'
        }
      ];

      await saveOrderItemEquipmentValues(mockDb, 'order-item-1', values);

      // Should have been called twice (once per value)
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO order_item_equipment_values')
      );
    });

    it('handles empty values array', async () => {
      await saveOrderItemEquipmentValues(mockDb, 'order-item-1', []);

      // Should not have called prepare for the insert
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });
  });

  describe('getOrderItemEquipmentValues', () => {
    it('fetches saved equipment values for an order item', async () => {
      mockDb.all.mockResolvedValue({
        results: [
          {
            id: 'val-1',
            order_item_id: 'order-item-1',
            equipment_id: 'equip-1',
            equipment_field_id: 'field-1',
            field_name: 'Material',
            value: 'Metal',
            created_at: 1000
          },
          {
            id: 'val-2',
            order_item_id: 'order-item-1',
            equipment_id: 'equip-1',
            equipment_field_id: 'field-2',
            field_name: 'Finish',
            value: 'Matte',
            created_at: 1000
          }
        ]
      });

      const values = await getOrderItemEquipmentValues(mockDb, 'order-item-1');

      expect(values).toHaveLength(2);
      expect(values[0].field_name).toBe('Material');
      expect(values[0].value).toBe('Metal');
      expect(values[1].field_name).toBe('Finish');
      expect(values[1].value).toBe('Matte');
    });

    it('returns empty array when no values stored', async () => {
      mockDb.all.mockResolvedValue({ results: [] });

      const values = await getOrderItemEquipmentValues(mockDb, 'order-item-1');

      expect(values).toEqual([]);
    });
  });

  // --- Machine capabilities ---

  describe('capabilities', () => {
    const caps = {
      kind: 'dtg-printer',
      maxAreaIn: { widthIn: 16, heightIn: 20 },
      substrates: ['cotton']
    };
    const row = {
      id: 'eq-1',
      site_id: testSiteId,
      name: 'Epson SureColor F2100',
      description: null,
      is_active: 1,
      kind: 'dtg-printer',
      make: 'Epson',
      model: 'SureColor F2100',
      catalog_model_id: 'epson-surecolor-f2100',
      capabilities: JSON.stringify(caps),
      created_at: 1,
      updated_at: 1
    };

    it('stores a catalog machine with its capabilities as JSON', async () => {
      mockDb.first.mockResolvedValue(row);
      const eq = await createEquipment(mockDb, testSiteId, {
        name: row.name,
        make: 'Epson',
        model: 'SureColor F2100',
        catalogModelId: 'epson-surecolor-f2100',
        capabilities: caps as any
      });
      const bound = mockDb.bind.mock.calls[0];
      expect(bound).toContain('dtg-printer');
      expect(bound).toContain(JSON.stringify(caps));
      expect(eq.capabilities).toEqual(caps);
      expect(eq.make).toBe('Epson');
      expect(eq.catalogModelId).toBe('epson-surecolor-f2100');
    });

    it('reads bad capabilities JSON as none', async () => {
      mockDb.first.mockResolvedValue({ ...row, capabilities: '{not json' });
      const eq = await getEquipmentById(mockDb, testSiteId, 'eq-1');
      expect(eq?.capabilities).toBeNull();
    });

    it('reads legacy rows without the new columns', async () => {
      mockDb.first.mockResolvedValue({
        id: 'eq-0',
        site_id: testSiteId,
        name: 'Old',
        description: null,
        is_active: 1,
        created_at: 1,
        updated_at: 1
      });
      const eq = await getEquipmentById(mockDb, testSiteId, 'eq-0');
      expect(eq).toMatchObject({ kind: null, make: null, capabilities: null });
    });

    it('keeps kind in step when capabilities change', async () => {
      mockDb.first.mockResolvedValue(row);
      await updateEquipment(mockDb, testSiteId, 'eq-1', { capabilities: caps as any });
      const sql = mockDb.prepare.mock.calls
        .map((c: string[]) => c[0])
        .find((q: string) => q.startsWith('UPDATE equipment'));
      expect(sql).toContain('capabilities = ?');
      expect(sql).toContain('kind = ?');
    });
  });

  describe('setProductEquipmentSize', () => {
    it('updates the size, scoped by site', async () => {
      const ok = await setProductEquipmentSize(mockDb, testSiteId, testProductId, 'eq', 'round-1');
      expect(ok).toBe(true);
      expect(mockDb.bind).toHaveBeenCalledWith('round-1', testSiteId, testProductId, 'eq');
    });
  });

  describe('getProductEquipmentLinks', () => {
    it("lists a machine's products with names and size", async () => {
      mockDb.all.mockResolvedValue({
        results: [
          {
            id: 'pe-1',
            site_id: testSiteId,
            product_id: 'p1',
            equipment_id: 'eq',
            size_id: 'round-1.25',
            sort_order: 0,
            created_at: 1,
            product_name: '1¼" Pin',
            equipment_name: 'ABM',
            equipment_is_active: 1,
            equipment_capabilities: null
          }
        ]
      });
      const links = await getProductEquipmentLinks(mockDb, testSiteId, { equipmentId: 'eq' });
      expect(links[0]).toMatchObject({
        productId: 'p1',
        productName: '1¼" Pin',
        sizeId: 'round-1.25',
        equipmentIsActive: true
      });
      const sql = mockDb.prepare.mock.calls.at(-1)[0];
      expect(sql).toContain('pe.equipment_id = ?');
      expect(sql).toContain('pe.site_id = ?');
    });

    it('can list by product instead', async () => {
      mockDb.all.mockResolvedValue({ results: [] });
      await getProductEquipmentLinks(mockDb, testSiteId, { productId: 'p1' });
      expect(mockDb.prepare.mock.calls.at(-1)[0]).toContain('pe.product_id = ?');
    });
  });

  describe('getProductFitInfo', () => {
    it('returns null for a product on another site', async () => {
      mockDb.first.mockResolvedValue(null);
      expect(await getProductFitInfo(mockDb, testSiteId, 'p-x')).toBeNull();
    });

    it('returns the template type and print areas in inches', async () => {
      mockDb.first.mockResolvedValue({ name: 'Tee', product_type: 'tee' });
      mockDb.all.mockResolvedValue({
        results: [
          { name: 'Front', phys_width: 12, phys_height: 16, unit: 'in', required_dpi: 150 },
          { name: 'Pocket', phys_width: 101.6, phys_height: 101.6, unit: 'mm', required_dpi: 300 }
        ]
      });
      const info = await getProductFitInfo(mockDb, testSiteId, testProductId);
      expect(info?.templateType).toBe('tee');
      expect(info?.printAreas[0]).toEqual({
        name: 'Front',
        widthIn: 12,
        heightIn: 16,
        requiredDpi: 150
      });
      expect(info?.printAreas[1].widthIn).toBeCloseTo(4);
    });
  });
});
