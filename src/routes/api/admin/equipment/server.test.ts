/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const db = {
  getDB: vi.fn(() => ({})),
  getAllEquipment: vi.fn(),
  createEquipment: vi.fn(async (_db: unknown, _site: string, data: unknown) => data),
  updateEquipment: vi.fn(async (_db: unknown, _site: string, _id: string, data: unknown) => data),
  deleteEquipment: vi.fn(),
  getEquipmentFields: vi.fn(),
  createEquipmentField: vi.fn(),
  updateEquipmentField: vi.fn(),
  deleteEquipmentField: vi.fn()
};
vi.mock('$lib/server/db', () => db);

const { POST, PUT } = await import('./+server');

function event(body: unknown) {
  return {
    platform: { env: { DB: {} } },
    locals: { siteId: 'site-a' },
    request: { json: async () => body }
  } as any;
}

describe('/api/admin/equipment machine fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a catalog machine with sanitized capabilities', async () => {
    const res = (await POST(
      event({
        name: 'Epson SureColor F2100',
        make: 'Epson',
        model: 'SureColor F2100',
        catalogModelId: 'epson-surecolor-f2100',
        capabilities: { kind: 'dtg-printer', substrates: ['cotton'], junk: 1 }
      })
    )) as Response;
    expect(res.status).toBe(201);
    expect(db.createEquipment).toHaveBeenCalledWith({}, 'site-a', {
      name: 'Epson SureColor F2100',
      description: undefined,
      isActive: true,
      make: 'Epson',
      model: 'SureColor F2100',
      catalogModelId: 'epson-surecolor-f2100',
      capabilities: { kind: 'dtg-printer', substrates: ['cotton'] },
      kind: 'dtg-printer'
    });
  });

  it('drops a catalog id that is not in the catalog', async () => {
    await POST(event({ name: 'Mystery', catalogModelId: 'made-up' }));
    expect((db.createEquipment.mock.calls[0][2] as any).catalogModelId).toBeNull();
  });

  it('rejects capabilities it cannot read', async () => {
    await expect(
      POST(event({ name: 'X', capabilities: { kind: 'toaster', substrates: [] } }))
    ).rejects.toMatchObject({ status: 400 });
  });

  it('leaves machine fields alone on a PUT that omits them', async () => {
    await PUT(event({ id: 'eq-1', name: 'Renamed' }));
    expect(db.updateEquipment).toHaveBeenCalledWith({}, 'site-a', 'eq-1', { name: 'Renamed' });
  });

  it('clears capabilities and kind together', async () => {
    await PUT(event({ id: 'eq-1', capabilities: null }));
    expect(db.updateEquipment.mock.calls[0][3]).toEqual({ capabilities: null, kind: null });
  });
});
