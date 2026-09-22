import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { authStore, authState } from './auth';

// Mock fetch globally for auth tests
globalThis.fetch = vi.fn() as typeof fetch;

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset auth state before each test
    authState.set({
      user: null,
      isAuthenticated: false,
      isLoading: false
    });

    // Clear sessionStorage
    sessionStorage.clear();

    // Reset fetch mock
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with correct credentials', async () => {
      // Mock successful login response
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'admin-1',
            email: 'owner@ammoura.local',
            name: 'Site Owner',
            role: 'admin'
          }
        })
      });

      const success = await authStore.login('owner@ammoura.local', 'owner456Pass');

      expect(success).toBe(true);

      const state = get(authState);
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.user?.email).toBe('owner@ammoura.local');
      expect(state.user?.role).toBe('admin');
      expect(state.isLoading).toBe(false);
    });

    it('should fail login with incorrect credentials', async () => {
      // Mock failed login response
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const success = await authStore.login('wrong@email.com', 'wrongpass');

      expect(success).toBe(false);

      const state = get(authState);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading during login', async () => {
      // Mock successful login response
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'admin-1',
            email: 'owner@ammoura.local',
            name: 'Site Owner',
            role: 'admin'
          }
        })
      });

      const loginPromise = authStore.login('owner@ammoura.local', 'owner456Pass');

      // Check immediately that loading is true
      let state = get(authState);
      expect(state.isLoading).toBe(true);

      await loginPromise;

      // After login completes, loading should be false
      state = get(authState);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear user data on logout', async () => {
      // Mock successful login response
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'admin-1',
            email: 'owner@ammoura.local',
            name: 'Site Owner',
            role: 'admin'
          }
        })
      });

      // Login first
      await authStore.login('owner@ammoura.local', 'owner456Pass');

      let state = get(authState);
      expect(state.isAuthenticated).toBe(true);

      // Mock logout endpoint
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      // Logout
      authStore.logout();

      state = get(authState);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('should return true when authenticated', async () => {
      // Mock successful login response
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'admin-1',
            email: 'owner@ammoura.local',
            name: 'Site Owner',
            role: 'admin'
          }
        })
      });

      await authStore.login('owner@ammoura.local', 'owner456Pass');

      expect(authStore.checkAuth()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      expect(authStore.checkAuth()).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin users', async () => {
      // Mock successful login response
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'admin-1',
            email: 'owner@ammoura.local',
            name: 'Site Owner',
            role: 'admin'
          }
        })
      });

      await authStore.login('owner@ammoura.local', 'owner456Pass');

      expect(authStore.isAdmin()).toBe(true);
    });

    it('should return false when not authenticated', () => {
      expect(authStore.isAdmin()).toBe(false);
    });

    it('should return false for non-admin users', () => {
      // Manually set a non-admin user
      authState.set({
        user: {
          id: '2',
          email: 'user@example.com',
          name: 'Regular User',
          role: 'user'
        },
        isAuthenticated: true,
        isLoading: false
      });

      expect(authStore.isAdmin()).toBe(false);
    });

    it('should return false for platform_engineer users', () => {
      // Manually set a platform_engineer user
      authState.set({
        user: {
          id: 'engineer-1',
          email: 'engineer@ammoura.local',
          name: 'Platform Engineer',
          role: 'platform_engineer'
        },
        isAuthenticated: true,
        isLoading: false
      });

      // Platform engineers are not the same as admins
      expect(authStore.isAdmin()).toBe(false);
    });
  });

  describe('canAccessAdmin', () => {
    it('should return true for admin users', () => {
      authState.set({
        user: {
          id: 'admin-1',
          email: 'owner@ammoura.local',
          name: 'Site Owner',
          role: 'admin'
        },
        isAuthenticated: true,
        isLoading: false
      });

      expect(authStore.canAccessAdmin()).toBe(true);
    });

    it('should return true for platform_engineer users', () => {
      authState.set({
        user: {
          id: 'engineer-1',
          email: 'engineer@ammoura.local',
          name: 'Platform Engineer',
          role: 'platform_engineer'
        },
        isAuthenticated: true,
        isLoading: false
      });

      expect(authStore.canAccessAdmin()).toBe(true);
    });

    it('should return false for regular users', () => {
      authState.set({
        user: {
          id: 'user-1',
          email: 'user@ammoura.local',
          name: 'Regular User',
          role: 'user'
        },
        isAuthenticated: true,
        isLoading: false
      });

      expect(authStore.canAccessAdmin()).toBe(false);
    });

    it('should return false when not authenticated', () => {
      expect(authStore.canAccessAdmin()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle API errors during login', async () => {
      // Mock fetch to throw an error
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const success = await authStore.login('owner@ammoura.local', 'owner456Pass');

      expect(success).toBe(false);

      const state = get(authState);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should handle logout API errors gracefully', async () => {
      // Mock successful login response
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'admin-1',
            email: 'owner@ammoura.local',
            name: 'Site Owner',
            role: 'admin'
          }
        })
      });

      await authStore.login('owner@ammoura.local', 'owner456Pass');

      // Mock logout endpoint to throw an error
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      // Logout should still work even if API call fails
      authStore.logout();

      const state = get(authState);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should handle invalid response format from login API', async () => {
      // Mock response with success but no user data
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true
          // user is missing
        })
      });

      const success = await authStore.login('owner@ammoura.local', 'owner456Pass');

      expect(success).toBe(false);

      const state = get(authState);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should handle login exception in try/catch', async () => {
      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock fetch to throw
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const success = await authStore.login('test@test.com', 'password');

      expect(success).toBe(false);
      const state = get(authState);
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('subscribe', () => {
    it('should provide subscribe method', () => {
      expect(authStore.subscribe).toBeDefined();
      expect(typeof authStore.subscribe).toBe('function');
    });

    it('should notify subscribers on state changes', async () => {
      const states: Array<{ isAuthenticated: boolean }> = [];
      const unsubscribe = authStore.subscribe((state) => {
        states.push({ isAuthenticated: state.isAuthenticated });
      });

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'admin-1',
            email: 'owner@ammoura.local',
            name: 'Site Owner',
            role: 'admin'
          }
        })
      });

      await authStore.login('owner@ammoura.local', 'owner456Pass');

      // Should have received multiple state updates
      expect(states.length).toBeGreaterThan(1);
      expect(states[states.length - 1].isAuthenticated).toBe(true);

      unsubscribe();
    });
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage.setItem throwing during persist', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string) => {
        if (key === 'auth') throw new Error('QuotaExceededError');
      });

      // Trigger a state update — the subscription persist should catch the error
      authState.set({
        user: { id: '1', email: 'test@test.com', name: 'Test', role: 'admin' },
        isAuthenticated: true,
        isLoading: false
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save auth to localStorage:',
        expect.any(Error)
      );

      setItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should handle localStorage.removeItem throwing during persist', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const removeItemSpy = vi
        .spyOn(localStorage, 'removeItem')
        .mockImplementation((key: string) => {
          if (key === 'auth') throw new Error('SecurityError');
        });

      // Setting user to null triggers removeItem path
      authState.set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save auth to localStorage:',
        expect.any(Error)
      );

      removeItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('SSR and initialization error handling', () => {
    it('should return default state in SSR (non-browser) environment', async () => {
      vi.resetModules();
      vi.doMock('$app/environment', () => ({
        browser: false,
        building: false,
        dev: true,
        version: 'test'
      }));

      const { authState: ssrAuthState } = await import('./auth');
      const { get: getValue } = await import('svelte/store');

      const state = getValue(ssrAuthState);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);

      vi.doUnmock('$app/environment');
    });

    it('should return default state when localStorage has invalid JSON', async () => {
      vi.resetModules();
      vi.doMock('$app/environment', () => ({
        browser: true,
        building: false,
        dev: true,
        version: 'test'
      }));

      localStorage.setItem('auth', 'not valid json{{{');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { authState: freshAuthState } = await import('./auth');
      const { get: getValue } = await import('svelte/store');

      const state = getValue(freshAuthState);
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);

      consoleSpy.mockRestore();
      localStorage.removeItem('auth');
      vi.doUnmock('$app/environment');
    });
  });
});
