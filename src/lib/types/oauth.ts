/**
 * OAuth and SSO type definitions
 */

export type OAuthProvider =
  'google' | 'linkedin' | 'apple' | 'facebook' | 'github' | 'twitter' | 'microsoft' | 'discord';

export type AuthEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'sso_initiated'
  | 'sso_completed'
  | 'sso_failed'
  | 'account_linked'
  | 'account_unlinked'
  | 'token_refreshed'
  | 'token_expired'
  | 'session_revoked'
  | 'suspicious_activity';

export interface ProviderAccount {
  id: string;
  user_id: string;
  site_id: string;
  provider: OAuthProvider;
  provider_account_id: string;
  email: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
  scope: string | null;
  id_token: string | null;
  profile_data: string;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}

export interface OAuthSession {
  id: string;
  site_id: string;
  state: string;
  code_verifier: string;
  code_challenge: string;
  nonce: string | null;
  provider: OAuthProvider;
  redirect_uri: string;
  created_at: number;
  expires_at: number;
}

export interface AuthAuditLog {
  id: string;
  site_id: string;
  user_id: string | null;
  event_type: AuthEventType;
  provider: OAuthProvider | null;
  ip_address: string | null;
  user_agent: string | null;
  details: string;
  created_at: number;
}

export interface OAuthProviderConfig {
  name: string;
  displayName: string;
  icon: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  pkceRequired: boolean;
  supportsRefresh: boolean;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface OAuthUserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

export interface PKCEChallenge {
  verifier: string;
  challenge: string;
  method: 'S256' | 'plain';
}
