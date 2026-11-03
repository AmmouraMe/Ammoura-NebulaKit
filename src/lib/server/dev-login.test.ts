import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('isDevLoginEnabled', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function load(devFlag: boolean) {
    vi.doMock('$app/environment', () => ({ dev: devFlag }));
    const { isDevLoginEnabled } = await import('./dev-login');
    return isDevLoginEnabled;
  }

  it('is always on under vite dev', async () => {
    const enabled = await load(true);
    expect(enabled(undefined)).toBe(true);
    expect(enabled({ DEV_LOGIN: 'false' })).toBe(true);
  });

  it('is off in a build unless DEV_LOGIN is exactly "true"', async () => {
    const enabled = await load(false);
    expect(enabled(undefined)).toBe(false);
    expect(enabled({})).toBe(false);
    expect(enabled({ DEV_LOGIN: '1' })).toBe(false);
    expect(enabled({ DEV_LOGIN: 'yes' })).toBe(false);
    expect(enabled({ DEV_LOGIN: 'TRUE' })).toBe(false);
    expect(enabled({ DEV_LOGIN: true })).toBe(false);
  });

  it('is on in a build when the environment sets DEV_LOGIN = "true"', async () => {
    const enabled = await load(false);
    expect(enabled({ DEV_LOGIN: 'true' })).toBe(true);
  });
});
