/**
 * OAuth callback endpoint
 * Handles OAuth provider callbacks and completes authentication
 */

import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { getDB, getUserByEmail, createUserSession } from '$lib/server/db';
import { USER_SESSION_COOKIE, USER_SESSION_TTL_SECONDS } from '$lib/server/db/user-sessions.js';
import { createUser } from '$lib/server/db/users.js';
import {
  getOAuthSession,
  deleteOAuthSession,
  createProviderAccount,
  getProviderAccountByProviderId,
  createAuthAuditLog
} from '$lib/server/db/oauth.js';
import { getSSOProvider } from '$lib/server/db/sso-providers.js';
import { getEnvOAuthCredentials } from '$lib/server/oauth/env-providers.js';
import { createOAuthProvider } from '$lib/server/oauth/providers/index.js';
import type { OAuthProvider } from '$lib/types/oauth.js';
import { logActivity } from '$lib/server/activity-logger';
import { hashPassword } from '$lib/server/password';

/**
 * GET /api/auth/oauth/[provider]/callback
 * Handles OAuth callback from provider
 */
export const GET: RequestHandler = async ({ params, url, platform, locals, cookies, request }) => {
  const provider = params.provider as OAuthProvider;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const db = getDB(platform);
  const siteId = locals.siteId;

  // Handle OAuth errors from provider
  if (error) {
    console.error(`OAuth error from ${provider}:`, error);
    await createAuthAuditLog(db, siteId, {
      event_type: 'sso_failed',
      provider,
      ip_address:
        request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      details: { error, description: url.searchParams.get('error_description') }
    });
    throw redirect(302, `/auth/login?error=oauth_denied&provider=${provider}`);
  }

  // Validate required parameters
  if (!code || !state) {
    throw redirect(302, `/auth/login?error=invalid_callback`);
  }

  try {
    // Retrieve and validate OAuth session
    const oauthSession = await getOAuthSession(db, state);
    if (!oauthSession || oauthSession.provider !== provider) {
      throw redirect(302, `/auth/login?error=invalid_state`);
    }

    const encryptionKey = platform?.env.ENCRYPTION_KEY;

    let clientId: string;
    let clientSecret: string;
    let tenant: string | undefined;

    // Try database first (site-specific config), fall back to env vars
    if (encryptionKey) {
      const ssoProvider = await getSSOProvider(db, siteId, provider, encryptionKey);
      if (ssoProvider && ssoProvider.enabled) {
        clientId = ssoProvider.client_id;
        clientSecret = ssoProvider.client_secret;
        tenant = ssoProvider.tenant || undefined;
      } else {
        const envCreds = getEnvOAuthCredentials(
          platform?.env as unknown as Record<string, unknown>,
          provider
        );
        if (!envCreds) {
          throw new Error(`OAuth provider ${provider} not configured for this site`);
        }
        clientId = envCreds.clientId;
        clientSecret = envCreds.clientSecret;
      }
    } else {
      const envCreds = getEnvOAuthCredentials(
        platform?.env as unknown as Record<string, unknown>,
        provider
      );
      if (!envCreds) {
        throw new Error(
          `OAuth provider ${provider} not configured (no encryption key or env vars)`
        );
      }
      clientId = envCreds.clientId;
      clientSecret = envCreds.clientSecret;
    }

    // Create provider instance and exchange code for tokens
    const oauthProvider = createOAuthProvider(provider, { clientId, clientSecret, tenant });
    const tokens = await oauthProvider.exchangeCodeForTokens(
      code,
      oauthSession.redirect_uri,
      oauthSession.code_verifier
    );

    // Get user profile from provider
    const userProfile = await oauthProvider.getUserProfile(tokens.access_token);

    if (!userProfile.email) {
      redirect(302, `/auth/login?error=no_email&provider=${provider}`);
    }

    // Clean up OAuth session
    await deleteOAuthSession(db, state);

    // Check if provider account already exists
    const providerAccount = await getProviderAccountByProviderId(
      db,
      siteId,
      provider,
      userProfile.id
    );

    let userId: string;

    if (providerAccount) {
      // Existing provider account - use linked user
      userId = providerAccount.user_id;

      // Update tokens
      const { updateProviderAccountTokens } = await import('$lib/server/db/oauth.js');
      await updateProviderAccountTokens(db, providerAccount.id, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : undefined,
        scope: tokens.scope
      });
    } else {
      // Check if user exists with same email (account linking)
      let existingUser = await getUserByEmail(db, siteId, userProfile.email);

      if (existingUser) {
        // Link provider to existing user — but only on an address the provider
        // has verified. Otherwise anyone who can register an account with an
        // unverified email at the provider (Twitter never verifies, Discord and
        // LinkedIn may not) could sign in as that email's owner here,
        // including a site admin.
        if (!userProfile.email_verified) {
          redirect(302, `/auth/login?error=email_unverified&provider=${provider}`);
        }
        userId = existingUser.id;
      } else {
        // Create new user with a random password nobody knows (SSO-only).
        const password_hash = await hashPassword(crypto.randomUUID());

        existingUser = await createUser(db, siteId, {
          email: userProfile.email,
          name: userProfile.name || userProfile.email.split('@')[0],
          password_hash,
          role: 'customer',
          status: 'active'
        });
        userId = existingUser.id;
      }

      // Create provider account link
      await createProviderAccount(db, siteId, userId, provider, {
        provider_account_id: userProfile.id,
        email: userProfile.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokens.expires_in
          ? Math.floor(Date.now() / 1000) + tokens.expires_in
          : undefined,
        scope: tokens.scope,
        id_token: tokens.id_token,
        profile_data: userProfile
      });

      // Log account linking
      await createAuthAuditLog(db, siteId, {
        user_id: userId,
        event_type: 'account_linked',
        provider,
        ip_address:
          request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || undefined,
        user_agent: request.headers.get('user-agent') || undefined,
        details: { email: userProfile.email }
      });
    }

    // Get full user object
    const { getUserById, updateUser: updateUserRole } = await import('$lib/server/db/users.js');
    let user = await getUserById(db, siteId, userId);

    if (!user || user.status !== 'active') {
      redirect(302, `/auth/login?error=account_inactive`);
    }

    // Check if this user's email matches the platform engineer email from env
    const platformEngineerEmail = platform?.env?.PLATFORM_ENGINEER_EMAIL;
    if (
      platformEngineerEmail &&
      userProfile.email_verified &&
      user.email.toLowerCase() === platformEngineerEmail.toLowerCase() &&
      user.role !== 'platform_engineer'
    ) {
      await updateUserRole(db, siteId, user.id, { role: 'platform_engineer' });
      user = await getUserById(db, siteId, userId);
      if (!user) {
        redirect(302, `/auth/login?error=account_inactive`);
      }

      await logActivity(db, {
        siteId,
        userId: user.id,
        action: 'user.role_elevated',
        entityType: 'user',
        entityId: user.id,
        entityName: user.name,
        description: `User role elevated to platform_engineer via PLATFORM_ENGINEER_EMAIL match`,
        ipAddress:
          request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        metadata: { provider, previous_role: 'customer' }
      });
    }

    // Establish a server-side session; the cookie carries only an opaque
    // bearer token, and role/permissions are re-read from the DB per request.
    const { token } = await createUserSession(db, user.id, siteId);
    cookies.set(USER_SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      secure: !dev,
      sameSite: 'lax',
      maxAge: USER_SESSION_TTL_SECONDS
    });

    // Update last login
    const { updateUser } = await import('$lib/server/db/users.js');
    const ipAddress =
      request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    await updateUser(db, siteId, user.id, {
      last_login_at: Math.floor(Date.now() / 1000),
      last_login_ip: ipAddress
    });

    // Log successful SSO to auth audit log (for OAuth-specific tracking)
    await createAuthAuditLog(db, siteId, {
      user_id: userId,
      event_type: 'sso_completed',
      provider,
      ip_address: ipAddress || undefined,
      user_agent: userAgent || undefined,
      details: { email: user.email }
    });

    // Log successful SSO login to activity log (for general activity tracking)
    await logActivity(db, {
      siteId,
      userId: user.id,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      entityName: user.name,
      description: `User logged in via ${provider} SSO`,
      ipAddress,
      userAgent,
      metadata: { method: 'sso', provider }
    });

    // Redirect to dashboard
    throw redirect(302, '/admin/dashboard');
  } catch (error) {
    // Re-throw redirects (SvelteKit uses throw for control flow)
    if (error instanceof Response || (error && typeof error === 'object' && 'status' in error)) {
      throw error;
    }
    console.error(`OAuth callback error for ${provider}:`, error);

    await createAuthAuditLog(db, siteId, {
      event_type: 'sso_failed',
      provider,
      ip_address:
        request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
      details: { error: String(error) }
    });

    throw redirect(302, `/auth/login?error=oauth_failed&provider=${provider}`);
  }
};
