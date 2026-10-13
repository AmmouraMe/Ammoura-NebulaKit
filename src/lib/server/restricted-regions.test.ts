import { describe, it, expect } from 'vitest';
import { isGeoBlockedRoute, requestLocation, shouldBlockRequest } from './restricted-regions';

describe('requestLocation', () => {
  it('prefers Cloudflare metadata', () => {
    const headers = new Headers({ 'cf-ipcountry': 'US' });
    expect(requestLocation({ country: 'UA', regionCode: '43' }, headers)).toEqual({
      country: 'UA',
      region: '43'
    });
  });

  it('falls back to the cf-ipcountry header', () => {
    expect(requestLocation(undefined, new Headers({ 'cf-ipcountry': 'ir' }))).toEqual({
      country: 'IR',
      region: null
    });
  });

  it('treats unknown and Tor as no location', () => {
    expect(requestLocation({ country: 'XX' }, undefined).country).toBeNull();
    expect(requestLocation({ country: 'T1' }, undefined).country).toBeNull();
    expect(requestLocation(undefined, undefined).country).toBeNull();
  });
});

describe('isGeoBlockedRoute', () => {
  it.each([
    ['/api/account/signup', 'POST'],
    ['/api/auth/oauth/google', 'GET'],
    ['/api/auth/oauth/google/callback', 'GET'],
    ['/api/checkout/session', 'POST'],
    ['/api/orders', 'POST']
  ])('covers %s %s', (path, method) => {
    expect(isGeoBlockedRoute(path, method)).toBe(true);
  });

  it.each([
    ['/', 'GET'],
    ['/products/tee', 'GET'],
    ['/signup', 'GET'],
    ['/api/orders', 'GET'],
    ['/api/checkout/shipping', 'POST'],
    ['/api/account/signup-extra', 'POST']
  ])('leaves %s %s open', (path, method) => {
    expect(isGeoBlockedRoute(path, method)).toBe(false);
  });
});

describe('shouldBlockRequest', () => {
  it('blocks only a restricted place on a blocked route', () => {
    expect(shouldBlockRequest({ country: 'KP', region: null }, '/api/orders', 'POST')).toBe(true);
    expect(shouldBlockRequest({ country: 'KP', region: null }, '/', 'GET')).toBe(false);
    expect(shouldBlockRequest({ country: 'US', region: null }, '/api/orders', 'POST')).toBe(false);
    expect(shouldBlockRequest({ country: null, region: null }, '/api/orders', 'POST')).toBe(false);
  });
});
