/**
 * Ammoura's client for one NebulaKit site's API (`/api/v1`).
 *
 * The control room has no back door into a client site: everything it does —
 * reading versions, managing the shop, editing pages — goes through the same
 * API the site's own admin uses, authenticated with the orchestrator key
 * whose hash the site holds as `ORCHESTRATOR_KEY_SHA256`.
 * See plans/ammoura-as-orchestrator.md, rule 5 ("API first").
 */

export interface SiteDescription {
  name: string;
  slug: string;
  url: string;
  template: { name: string; version: string };
  packages: Record<string, string>;
  updates: { autoApplyFeatures: boolean; optedIn: string[]; updatedAt: string | null };
  api: { version: string; openapi: string };
}

export interface SiteProduct {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  currency: string;
  active: boolean;
  [key: string]: unknown;
}

export interface SiteOrder {
  id: string;
  status: string;
  email: string;
  totalCents: number;
  currency: string;
  [key: string]: unknown;
}

export class SiteApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = []
  ) {
    super(message);
  }
}

export class NebulaKitSiteClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 15_000
  ) {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      // The orchestrator key is a bearer credential for the whole site.
      throw new Error('A site API must be reached over https (http is allowed for localhost only)');
    }
    this.baseUrl = url.origin;
    if (!apiKey) throw new Error('An orchestrator API key is required');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (err) {
      throw new SiteApiError(`Site unreachable: ${(err as Error).message}`, 0);
    }
    if (response.status === 204) return undefined as T;
    let payload: { error?: string; details?: string[] } & Record<string, unknown> = {};
    try {
      payload = await response.json();
    } catch {
      // Not JSON: a proxy error page, or not a NebulaKit site at all.
    }
    if (!response.ok) {
      throw new SiteApiError(
        payload.error ?? `Site API returned ${response.status}`,
        response.status,
        payload.details ?? []
      );
    }
    return payload as T;
  }

  /** Any site API call, for tools that drive endpoints this client has no helper for. */
  call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    if (!path.startsWith('/api/v1/')) throw new Error('Only /api/v1/ paths are site API calls');
    return this.request(method, path, body);
  }

  describe(): Promise<SiteDescription> {
    return this.request('GET', '/api/v1/site');
  }

  async listProducts(includeInactive = true): Promise<SiteProduct[]> {
    const { products } = await this.request<{ products: SiteProduct[] }>(
      'GET',
      `/api/v1/products${includeInactive ? '?all=1' : ''}`
    );
    return products;
  }

  async createProduct(input: Record<string, unknown>): Promise<SiteProduct> {
    const { product } = await this.request<{ product: SiteProduct }>(
      'POST',
      '/api/v1/products',
      input
    );
    return product;
  }

  async listOrders(status?: string): Promise<SiteOrder[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const { orders } = await this.request<{ orders: SiteOrder[] }>('GET', `/api/v1/orders${query}`);
    return orders;
  }

  async savePage(
    slug: string,
    page: { title: string; document: unknown; published?: boolean }
  ): Promise<unknown> {
    const { page: saved } = await this.request<{ page: unknown }>(
      'PUT',
      `/api/v1/pages/${encodeURIComponent(slug)}`,
      page
    );
    return saved;
  }
}
