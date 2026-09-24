import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Widget and layout ids carry no site of their own, so these APIs must check
 * that the parent page/layout belongs to the requesting site before touching
 * it. Otherwise an admin of site B could edit site A's widgets by id.
 */

const getWidgetByIdForSite = vi.fn();
const getPageById = vi.fn();
const updatePageComponent = vi.fn();
const deletePageComponent = vi.fn();
const getPageComponents = vi.fn();
const createPageComponent = vi.fn();
const reorderPageComponents = vi.fn();
const getLayout = vi.fn();
const getLayoutComponents = vi.fn();
const updateLayoutComponents = vi.fn();
const updateLayout = vi.fn();
const createLayoutWidget = vi.fn();
const deleteLayoutWidget = vi.fn();

vi.mock('$lib/server/db/connection', () => ({ getDB: vi.fn(() => ({})) }));
vi.mock('$lib/server/db/pages', () => ({
  getWidgetByIdForSite: (...a: unknown[]) => getWidgetByIdForSite(...a),
  getPageById: (...a: unknown[]) => getPageById(...a),
  updatePageComponent: (...a: unknown[]) => updatePageComponent(...a),
  deletePageComponent: (...a: unknown[]) => deletePageComponent(...a),
  getPageComponents: (...a: unknown[]) => getPageComponents(...a),
  createPageComponent: (...a: unknown[]) => createPageComponent(...a),
  reorderPageComponents: (...a: unknown[]) => reorderPageComponents(...a)
}));
vi.mock('$lib/server/db/layouts', () => ({
  getLayout: (...a: unknown[]) => getLayout(...a),
  getLayoutComponents: (...a: unknown[]) => getLayoutComponents(...a),
  updateLayoutComponents: (...a: unknown[]) => updateLayoutComponents(...a),
  updateLayout: (...a: unknown[]) => updateLayout(...a),
  createLayoutWidget: (...a: unknown[]) => createLayoutWidget(...a),
  deleteLayoutWidget: (...a: unknown[]) => deleteLayoutWidget(...a)
}));

const widget = await import('./[id]/+server');
const pageComponents = await import('../pages/[id]/components/+server');
const layoutComponents = await import('../layouts/[layoutId]/components/+server');
const layout = await import('../layouts/[layoutId]/+server');

function ev(params: Record<string, string>, body?: unknown) {
  return {
    params,
    platform: { env: { DB: {} } },
    locals: { siteId: 'site-b' },
    request: new Request('https://b.example.com/', {
      method: body === undefined ? 'GET' : 'POST',
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } as never;
}

async function status(p: unknown): Promise<number> {
  try {
    const res = (await p) as Response;
    return res.status;
  } catch (e) {
    return (e as { status: number }).status;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PUT/DELETE /api/page-components/[id]', () => {
  it("404s on another site's widget and never writes", async () => {
    getWidgetByIdForSite.mockResolvedValue(null);

    expect(await status(widget.PUT(ev({ id: 'w-a' }, { position: 1 })))).toBe(404);
    expect(await status(widget.DELETE(ev({ id: 'w-a' })))).toBe(404);
    expect(getWidgetByIdForSite).toHaveBeenCalledWith({}, 'site-b', 'w-a');
    expect(updatePageComponent).not.toHaveBeenCalled();
    expect(deletePageComponent).not.toHaveBeenCalled();
  });

  it("updates this site's widget", async () => {
    getWidgetByIdForSite.mockResolvedValue({ id: 'w-b' });
    updatePageComponent.mockResolvedValue({ id: 'w-b', position: 1 });

    expect(await status(widget.PUT(ev({ id: 'w-b' }, { position: 1 })))).toBe(200);
  });
});

describe('/api/pages/[id]/components', () => {
  it("404s on another site's page for every method", async () => {
    getPageById.mockResolvedValue(null);

    expect(await status(pageComponents.GET(ev({ id: 'p-a' })))).toBe(404);
    expect(
      await status(
        pageComponents.POST(ev({ id: 'p-a' }, { type: 'text', config: {}, position: 0 }))
      )
    ).toBe(404);
    expect(await status(pageComponents.PUT(ev({ id: 'p-a' }, { componentIds: ['x'] })))).toBe(404);
    expect(getPageById).toHaveBeenCalledWith({}, 'site-b', 'p-a');
    expect(createPageComponent).not.toHaveBeenCalled();
    expect(reorderPageComponents).not.toHaveBeenCalled();
  });

  it("serves this site's page", async () => {
    getPageById.mockResolvedValue({ id: 'p-b' });
    getPageComponents.mockResolvedValue([]);

    expect(await status(pageComponents.GET(ev({ id: 'p-b' })))).toBe(200);
  });
});

describe('/api/layouts/[layoutId]/components', () => {
  it("404s on another site's layout", async () => {
    getLayout.mockResolvedValue(null);

    expect(await status(layoutComponents.GET(ev({ layoutId: '3' })))).toBe(404);
    expect(
      await status(layoutComponents.PUT(ev({ layoutId: '3' }, { components: [{ id: 'w' }] })))
    ).toBe(404);
    expect(getLayout).toHaveBeenCalledWith({}, 'site-b', 3);
    expect(updateLayoutComponents).not.toHaveBeenCalled();
  });

  it('scopes widget updates to the layout', async () => {
    getLayout.mockResolvedValue({ id: 3 });
    const components = [{ id: 'w', position: 0 }];

    expect(await status(layoutComponents.PUT(ev({ layoutId: '3' }, { components })))).toBe(200);
    expect(updateLayoutComponents).toHaveBeenCalledWith({}, 3, components);
  });

  it('returns 400, not 500, for a malformed body', async () => {
    getLayout.mockResolvedValue({ id: 3 });

    expect(await status(layoutComponents.PUT(ev({ layoutId: '3' }, { components: 'x' })))).toBe(
      400
    );
  });
});

describe('PUT /api/layouts/[layoutId]', () => {
  it("404s on another site's layout before touching its widgets", async () => {
    getLayout.mockResolvedValue(null);

    expect(
      await status(layout.PUT(ev({ layoutId: '3' }, { components: [{ id: 'w', position: 0 }] })))
    ).toBe(404);
    expect(getLayoutComponents).not.toHaveBeenCalled();
    expect(deleteLayoutWidget).not.toHaveBeenCalled();
    expect(updateLayoutComponents).not.toHaveBeenCalled();
  });

  it('scopes widget updates to the layout', async () => {
    getLayout.mockResolvedValue({ id: 3 });
    getLayoutComponents.mockResolvedValue([{ id: 'w' }]);

    expect(
      await status(
        layout.PUT(ev({ layoutId: '3' }, { components: [{ id: 'w', type: 't', position: 0 }] }))
      )
    ).toBe(200);
    expect(updateLayoutComponents).toHaveBeenCalledWith({}, 3, expect.any(Array));
  });
});
