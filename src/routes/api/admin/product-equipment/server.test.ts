/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const db = {
  getDB: vi.fn(() => ({})),
  getEquipmentById: vi.fn(),
  getProductById: vi.fn(),
  getProductEquipmentLinks: vi.fn(),
  getProductFitInfo: vi.fn(),
  addProductEquipment: vi.fn(),
  removeProductEquipment: vi.fn(),
  setProductEquipmentSize: vi.fn()
};
vi.mock('$lib/server/db', () => db);

const { GET, POST, PATCH } = await import('./+server');

const press = {
  id: 'eq-1',
  capabilities: {
    kind: 'button-press',
    substrates: ['button'],
    sizes: [{ id: 'round-1.25', label: '1¼"', shape: 'round', widthIn: 1.25, heightIn: 1.25 }]
  }
};

function event(body?: unknown, search = '') {
  return {
    platform: { env: { DB: {} } },
    locals: { siteId: 'site-a' },
    url: new URL(`http://x/api/admin/product-equipment${search}`),
    request: { json: async () => body }
  } as any;
}

async function status(promise: unknown): Promise<number> {
  try {
    const res = (await promise) as Response;
    return res.status;
  } catch (err: any) {
    return err.status;
  }
}

describe('/api/admin/product-equipment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getProductById.mockResolvedValue({ id: 'p-1' });
    db.getEquipmentById.mockResolvedValue(press);
    db.addProductEquipment.mockResolvedValue({ id: 'pe-1' });
    db.setProductEquipmentSize.mockResolvedValue(true);
  });

  it('links a product at an owned size', async () => {
    expect(
      await status(POST(event({ productId: 'p-1', equipmentId: 'eq-1', sizeId: 'round-1.25' })))
    ).toBe(201);
    expect(db.addProductEquipment).toHaveBeenCalledWith(
      {},
      'site-a',
      'p-1',
      'eq-1',
      0,
      'round-1.25'
    );
  });

  it('refuses a size the machine does not have', async () => {
    expect(
      await status(POST(event({ productId: 'p-1', equipmentId: 'eq-1', sizeId: 'round-3' })))
    ).toBe(400);
    expect(db.addProductEquipment).not.toHaveBeenCalled();
  });

  it("refuses another site's product or equipment", async () => {
    db.getProductById.mockResolvedValueOnce(null);
    expect(await status(POST(event({ productId: 'p-x', equipmentId: 'eq-1' })))).toBe(404);
    db.getEquipmentById.mockResolvedValueOnce(null);
    expect(await status(POST(event({ productId: 'p-1', equipmentId: 'eq-x' })))).toBe(404);
    expect(db.addProductEquipment).not.toHaveBeenCalled();
    expect(db.getProductById).toHaveBeenCalledWith({}, 'site-a', 'p-x');
  });

  it('reports a duplicate link as a conflict', async () => {
    db.addProductEquipment.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));
    expect(await status(POST(event({ productId: 'p-1', equipmentId: 'eq-1' })))).toBe(409);
  });

  it('changes and clears the size', async () => {
    expect(
      await status(PATCH(event({ productId: 'p-1', equipmentId: 'eq-1', sizeId: 'round-1.25' })))
    ).toBe(200);
    expect(
      await status(PATCH(event({ productId: 'p-1', equipmentId: 'eq-1', sizeId: null })))
    ).toBe(200);
    expect(db.setProductEquipmentSize).toHaveBeenLastCalledWith({}, 'site-a', 'p-1', 'eq-1', null);
  });

  it('returns links plus fit info for a product, and 404s a foreign product', async () => {
    db.getProductEquipmentLinks.mockResolvedValue([]);
    db.getProductFitInfo.mockResolvedValueOnce({
      productName: 'Pin',
      templateType: null,
      printAreas: []
    });
    const res = (await GET(event(undefined, '?productId=p-1'))) as Response;
    expect(await res.json()).toEqual({
      links: [],
      product: { productName: 'Pin', templateType: null, printAreas: [] }
    });
    db.getProductFitInfo.mockResolvedValueOnce(null);
    expect(await status(GET(event(undefined, '?productId=p-x')))).toBe(404);
  });

  it('lists links for a machine', async () => {
    db.getProductEquipmentLinks.mockResolvedValue([{ productId: 'p-1' }]);
    const res = (await GET(event(undefined, '?equipmentId=eq-1'))) as Response;
    expect(await res.json()).toEqual({ links: [{ productId: 'p-1' }] });
    expect(db.getProductEquipmentLinks).toHaveBeenCalledWith({}, 'site-a', { equipmentId: 'eq-1' });
  });
});
