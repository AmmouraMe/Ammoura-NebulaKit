import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST, DELETE, PATCH } from './+server';
import type { RequestHandler } from './$types';
import type { AISession } from '$lib/types/ai-chat';
import type { DBUser } from '$lib/server/db/users';
import { createLogger } from '$lib/server/observability';

/** Locals now carry a request id and a logger (hooks.server.ts). */
const observabilityLocals = {
  requestId: 'test-request',
  log: createLogger({ level: 'error', sink: { debug() {}, info() {}, warn() {}, error() {} } })
};

type ExtractRequestEvent<T> = T extends (event: infer E) => unknown ? E : never;
type MockRequestEvent = ExtractRequestEvent<RequestHandler>;
interface SessionsResponse {
  sessions?: AISession[];
  id?: string;
  title?: string;
  [key: string]: unknown;
}

// Mock the database functions
vi.mock('$lib/server/db/connection', () => ({
  getDB: vi.fn(() => ({}))
}));

vi.mock('$lib/server/db/ai-sessions', () => ({
  getUserAISessions: vi.fn(),
  getAISession: vi.fn(),
  createAISession: vi.fn(),
  deleteAISession: vi.fn(),
  updateAISessionTitle: vi.fn(),
  updateAISessionStatus: vi.fn()
}));

import {
  getUserAISessions,
  getAISession,
  createAISession,
  deleteAISession,
  updateAISessionTitle,
  updateAISessionStatus
} from '$lib/server/db/ai-sessions';

describe('AI Chat Sessions API', () => {
  const mockSessions: AISession[] = [
    {
      id: 'session-1',
      user_id: 'user-1',
      site_id: 'site-1',
      title: 'Test Session 1',
      messages: [],
      status: 'active',
      created_at: 1000,
      updated_at: 2000,
      expires_at: 10000
    },
    {
      id: 'session-2',
      user_id: 'user-1',
      site_id: 'site-1',
      title: 'Test Session 2',
      messages: [],
      status: 'active',
      created_at: 1500,
      updated_at: 2500,
      expires_at: 10500
    }
  ];

  let mockEvent: Partial<MockRequestEvent>;

  beforeEach(() => {
    mockEvent = {
      platform: {
        env: {
          DB: {} as D1Database,
          MEDIA_BUCKET: {} as R2Bucket,
          ENCRYPTION_KEY: 'test-key'
        },
        context: {} as ExecutionContext,
        caches: {} as CacheStorage & { default: Cache }
      },
      locals: {
        currentUser: {
          id: 'user-1',
          role: 'admin'
        } as unknown as DBUser,
        siteId: 'site-1',
        isAdmin: true,
        locale: 'en',
        i18n: { defaultLocale: 'en', enabledLocales: ['en'] },
        ...observabilityLocals
      },
      url: new URL('http://localhost/api/ai-chat/sessions'),
      request: new Request('http://localhost/api/ai-chat/sessions')
    };

    vi.clearAllMocks();
  });

  describe('GET /api/ai-chat/sessions', () => {
    it('returns all sessions for the current user', async () => {
      vi.mocked(getUserAISessions).mockResolvedValue(mockSessions);

      const response = await GET(mockEvent as MockRequestEvent);
      const data = (await response.json()) as SessionsResponse;

      expect(getUserAISessions).toHaveBeenCalledWith({}, 'site-1', 'user-1', undefined);
      expect(data).toEqual(mockSessions);
    });

    it('filters sessions by status', async () => {
      mockEvent.url = new URL('http://localhost/api/ai-chat/sessions?status=completed');
      vi.mocked(getUserAISessions).mockResolvedValue([]);

      await GET(mockEvent as MockRequestEvent);

      expect(getUserAISessions).toHaveBeenCalledWith({}, 'site-1', 'user-1', 'completed');
    });

    it('returns 401 when user not authenticated', async () => {
      mockEvent.locals = {
        currentUser: undefined,
        siteId: 'site-1',
        isAdmin: false,
        locale: 'en',
        i18n: { defaultLocale: 'en', enabledLocales: ['en'] },
        ...observabilityLocals
      };

      await expect(GET(mockEvent as MockRequestEvent)).rejects.toThrow();
    });

    it('returns 403 when user is not admin', async () => {
      mockEvent.locals = {
        currentUser: { id: 'user-1', role: 'customer' } as unknown as DBUser,
        siteId: 'site-1',
        isAdmin: false,
        locale: 'en',
        i18n: { defaultLocale: 'en', enabledLocales: ['en'] },
        ...observabilityLocals
      };

      await expect(GET(mockEvent as MockRequestEvent)).rejects.toThrow();
    });
  });

  describe('POST /api/ai-chat/sessions', () => {
    it('creates a new session with default title', async () => {
      const newSession = { ...mockSessions[0], id: 'new-session' };
      vi.mocked(createAISession).mockResolvedValue(newSession);

      mockEvent.request = new Request('http://localhost/api/ai-chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Conversation' })
      });

      const response = await POST(mockEvent as MockRequestEvent);
      const data = (await response.json()) as SessionsResponse;

      expect(createAISession).toHaveBeenCalledWith({}, 'site-1', 'user-1', 'New Conversation');
      expect(data).toEqual(newSession);
      expect(response.status).toBe(201);
    });

    it('creates a new session with custom title', async () => {
      const newSession = { ...mockSessions[0], id: 'new-session', title: 'Custom Title' };
      vi.mocked(createAISession).mockResolvedValue(newSession);

      mockEvent.request = new Request('http://localhost/api/ai-chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ title: 'Custom Title' })
      });

      await POST(mockEvent as MockRequestEvent);

      expect(createAISession).toHaveBeenCalledWith({}, 'site-1', 'user-1', 'Custom Title');
    });
  });

  describe('DELETE /api/ai-chat/sessions', () => {
    it('deletes a session that belongs to the user', async () => {
      mockEvent.url = new URL('http://localhost/api/ai-chat/sessions?id=session-1');
      vi.mocked(getAISession).mockResolvedValue(mockSessions[0]);
      vi.mocked(deleteAISession).mockResolvedValue();

      const response = await DELETE(mockEvent as MockRequestEvent);
      const data = (await response.json()) as SessionsResponse;

      expect(getAISession).toHaveBeenCalledWith({}, 'site-1', 'session-1');
      expect(deleteAISession).toHaveBeenCalledWith({}, 'site-1', 'session-1');
      expect(data).toEqual({ success: true });
    });

    it('returns 400 when session ID is missing', async () => {
      await expect(DELETE(mockEvent as MockRequestEvent)).rejects.toThrow();
    });

    it('returns 404 when session not found', async () => {
      mockEvent.url = new URL('http://localhost/api/ai-chat/sessions?id=nonexistent');
      vi.mocked(getAISession).mockResolvedValue(null);

      await expect(DELETE(mockEvent as MockRequestEvent)).rejects.toThrow();
    });

    it('returns 403 when session belongs to another user', async () => {
      mockEvent.url = new URL('http://localhost/api/ai-chat/sessions?id=session-1');
      const otherUserSession = { ...mockSessions[0], user_id: 'other-user' };
      vi.mocked(getAISession).mockResolvedValue(otherUserSession);

      await expect(DELETE(mockEvent as MockRequestEvent)).rejects.toThrow();
    });
  });

  describe('PATCH /api/ai-chat/sessions', () => {
    it('updates session title', async () => {
      mockEvent.url = new URL('http://localhost/api/ai-chat/sessions?id=session-1');
      vi.mocked(getAISession)
        .mockResolvedValueOnce(mockSessions[0])
        .mockResolvedValueOnce({ ...mockSessions[0], title: 'Updated Title' });
      vi.mocked(updateAISessionTitle).mockResolvedValue();

      mockEvent.request = new Request('http://localhost/api/ai-chat/sessions?id=session-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated Title' })
      });

      const response = await PATCH(mockEvent as MockRequestEvent);
      const data = (await response.json()) as SessionsResponse;

      expect(updateAISessionTitle).toHaveBeenCalledWith({}, 'site-1', 'session-1', 'Updated Title');
      expect(data.title).toBe('Updated Title');
    });

    it('updates session status', async () => {
      mockEvent.url = new URL('http://localhost/api/ai-chat/sessions?id=session-1');
      vi.mocked(getAISession)
        .mockResolvedValueOnce(mockSessions[0])
        .mockResolvedValueOnce({ ...mockSessions[0], status: 'completed' });
      vi.mocked(updateAISessionStatus).mockResolvedValue();

      mockEvent.request = new Request('http://localhost/api/ai-chat/sessions?id=session-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' })
      });

      await PATCH(mockEvent as MockRequestEvent);

      expect(updateAISessionStatus).toHaveBeenCalledWith({}, 'site-1', 'session-1', 'completed');
    });

    it('updates both title and status', async () => {
      mockEvent.url = new URL('http://localhost/api/ai-chat/sessions?id=session-1');
      vi.mocked(getAISession)
        .mockResolvedValueOnce(mockSessions[0])
        .mockResolvedValueOnce({
          ...mockSessions[0],
          title: 'Updated Title',
          status: 'completed'
        });

      mockEvent.request = new Request('http://localhost/api/ai-chat/sessions?id=session-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated Title', status: 'completed' })
      });

      await PATCH(mockEvent as MockRequestEvent);

      expect(updateAISessionTitle).toHaveBeenCalledWith({}, 'site-1', 'session-1', 'Updated Title');
      expect(updateAISessionStatus).toHaveBeenCalledWith({}, 'site-1', 'session-1', 'completed');
    });

    it('returns 400 when session ID is missing', async () => {
      await expect(PATCH(mockEvent as MockRequestEvent)).rejects.toThrow();
    });

    it('returns 403 when session belongs to another user', async () => {
      mockEvent.url = new URL('http://localhost/api/ai-chat/sessions?id=session-1');
      const otherUserSession = { ...mockSessions[0], user_id: 'other-user' };
      vi.mocked(getAISession).mockResolvedValue(otherUserSession);

      mockEvent.request = new Request('http://localhost/api/ai-chat/sessions?id=session-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated' })
      });

      await expect(PATCH(mockEvent as MockRequestEvent)).rejects.toThrow();
    });
  });
});
