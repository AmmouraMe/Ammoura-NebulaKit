# OAuth SSO Setup Guide

This guide explains how to configure and use the multi-provider OAuth Single Sign-On (SSO) system in Ammoura.

## Overview

Ammoura supports seamless authentication through 8 major OAuth providers:

- 🔍 **Google** - OAuth 2.0 / OpenID Connect
- 💼 **LinkedIn** - OAuth 2.0
- 🍎 **Apple** - Sign In with Apple
- 📘 **Facebook** - Facebook Login
- 🐙 **GitHub** - GitHub OAuth
- 𝕏 **X (Twitter)** - OAuth 2.0
- 🪟 **Microsoft** - Microsoft Entra ID (Azure AD)
- 💬 **Discord** - OAuth 2.0 (`identify` + `email` scopes)

## Features

- ✅ **Account Linking** - Automatically links provider accounts with same email
- ✅ **PKCE Security** - Implements RFC 7636 for enhanced security
- ✅ **Role Preservation** - Maintains user roles across SSO logins
- ✅ **Token Refresh** - Automatic token refresh for supported providers
- ✅ **Audit Logging** - Comprehensive logging of all SSO events
- ✅ **Error Handling** - User-friendly error messages
- ✅ **Mobile Responsive** - Optimized for all devices

## Architecture

### Database Schema

The SSO system uses three main tables:

1. **provider_accounts** - Links users to OAuth providers
2. **oauth_sessions** - Temporary sessions for OAuth flows (PKCE state)
3. **auth_audit_logs** - Security audit trail

### OAuth Flow

```
User clicks SSO button
    ↓
Generate PKCE challenge + state
    ↓
Redirect to OAuth provider
    ↓
User authorizes
    ↓
Provider redirects back with code
    ↓
Exchange code for tokens (with PKCE)
    ↓
Fetch user profile
    ↓
Link/create account
    ↓
Create session
    ↓
Redirect to dashboard
```

## Provider Configuration

### Prerequisites

For each provider you want to enable, you'll need to:

1. Register an OAuth application with the provider
2. Obtain Client ID and Client Secret
3. Configure authorized redirect URIs
4. Set environment variables in Cloudflare

### Redirect URI Format

All providers use the same redirect URI pattern:

```
https://your-domain.com/api/auth/oauth/{provider}/callback
```

Examples:

- `https://mystore.com/api/auth/oauth/google/callback`
- `https://mystore.com/api/auth/oauth/github/callback`

### 1. Google OAuth Setup

**Step 1: Create OAuth Client**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `https://your-domain.com/api/auth/oauth/google/callback`

**Step 2: Configure Environment Variables**

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
```

**Scopes Used:** `openid`, `email`, `profile`

**Token Refresh:** ✅ Supported

---

### 2. LinkedIn OAuth Setup

**Step 1: Create LinkedIn App**

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Click "Create app"
3. Fill in app details
4. Navigate to "Auth" tab
5. Add redirect URL: `https://your-domain.com/api/auth/oauth/linkedin/callback`
6. Request access to "Sign In with LinkedIn using OpenID Connect"

**Step 2: Configure Environment Variables**

```bash
wrangler secret put LINKEDIN_CLIENT_ID
wrangler secret put LINKEDIN_CLIENT_SECRET
```

**Scopes Used:** `openid`, `profile`, `email`

**Token Refresh:** ✅ Supported

---

### 3. Apple Sign In Setup

**Step 1: Configure Apple Developer Account**

1. Go to [Apple Developer](https://developer.apple.com/)
2. Navigate to "Certificates, Identifiers & Profiles"
3. Create a new "App ID" or "Services ID"
4. Enable "Sign in with Apple"
5. Configure domains and return URLs
6. Create a private key for Sign in with Apple

**Step 2: Configure Environment Variables**

```bash
wrangler secret put APPLE_CLIENT_ID
wrangler secret put APPLE_CLIENT_SECRET  # This is a JWT created with your private key
```

**Scopes Used:** `name`, `email`

**Token Refresh:** ✅ Supported

**Note:** Apple uses JWT-based client secret authentication. You'll need to generate a JWT using your private key.

---

### 4. Facebook Login Setup

**Step 1: Create Facebook App**

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "Create App"
3. Choose "Consumer" app type
4. Add "Facebook Login" product
5. Configure OAuth redirect URI: `https://your-domain.com/api/auth/oauth/facebook/callback`
6. Enable "Client OAuth Login" and "Web OAuth Login"

**Step 2: Configure Environment Variables**

```bash
wrangler secret put FACEBOOK_CLIENT_ID
wrangler secret put FACEBOOK_CLIENT_SECRET
```

**Scopes Used:** `email`, `public_profile`

**Token Refresh:** ❌ Uses long-lived tokens instead

---

### 5. GitHub OAuth Setup

**Step 1: Register OAuth App**

1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Click "OAuth Apps" > "New OAuth App"
3. Fill in application details
4. Set authorization callback URL: `https://your-domain.com/api/auth/oauth/github/callback`

**Step 2: Configure Environment Variables**

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

**Scopes Used:** `read:user`, `user:email`

**Token Refresh:** ✅ Supported

**Note:** GitHub may not include email in the user object. The system fetches it separately if needed.

---

### 6. X (Twitter) OAuth Setup

**Step 1: Create Twitter App**

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new project and app
3. Enable OAuth 2.0
4. Add callback URL: `https://your-domain.com/api/auth/oauth/twitter/callback`
5. Set app permissions to read

**Step 2: Configure Environment Variables**

```bash
wrangler secret put TWITTER_CLIENT_ID
wrangler secret put TWITTER_CLIENT_SECRET
```

**Scopes Used:** `tweet.read`, `users.read`

**Token Refresh:** ✅ Supported

**Note:** Twitter OAuth 2.0 may not always provide email. Users should verify email separately if needed.

---

### 7. Microsoft OAuth Setup

**Step 1: Register Azure AD App**

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Set redirect URI: `https://your-domain.com/api/auth/oauth/microsoft/callback`
5. Under "Certificates & secrets", create a new client secret

**Step 2: Configure Environment Variables**

```bash
wrangler secret put MICROSOFT_CLIENT_ID
wrangler secret put MICROSOFT_CLIENT_SECRET
```

**Scopes Used:** `openid`, `profile`, `email`, `User.Read`

**Token Refresh:** ✅ Supported

**Note:** Uses "common" tenant by default. Can be configured for specific tenants.

---

## Environment Variable Setup

### Development (.dev.vars)

For local development, create a `.dev.vars` file:

```env
# Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# LinkedIn
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret

# Apple
APPLE_CLIENT_ID=your-apple-client-id
APPLE_CLIENT_SECRET=your-apple-jwt-secret

# Facebook
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret

# GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Twitter
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret

# Microsoft
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

### Production (Cloudflare Workers)

For production deployment, use Wrangler to set secrets:

```bash
# Set secrets for production
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Repeat for each provider you want to enable...
```

## Usage

### User Login Flow

1. Users navigate to `/auth/login`
2. Click on any SSO provider button
3. Get redirected to provider's OAuth page
4. Authorize the application
5. Get redirected back and logged in
6. Session created with proper role

### Account Linking

**Automatic Linking:**

- If a user signs in with Google using `user@example.com`
- Then later signs in with GitHub using the same `user@example.com`
- The system automatically links both accounts to the same user

**Manual Unlinking:**

- Users can manage connected accounts in profile settings (future feature)
- Admins can view linked accounts in the user management dashboard

### Testing SSO

To test SSO integration:

1. Configure at least one provider (Google recommended for testing)
2. Start the development server: `npm run dev`
3. Navigate to `http://localhost:5173/auth/login`
4. Click the provider button
5. Authorize the test account
6. Verify successful login

## Security Features

### PKCE (Proof Key for Code Exchange)

All providers use PKCE flow:

- Code verifier generated (128 random characters)
- Code challenge created (SHA-256 hash, base64url encoded)
- Prevents authorization code interception attacks

### State Parameter

CSRF protection via state:

- Random 32-character state generated
- Stored in database with 10-minute expiration
- Validated on callback

### Token Storage

- Access tokens stored encrypted at rest (future enhancement)
- Refresh tokens stored encrypted at rest (future enhancement)
- Tokens never exposed to client-side JavaScript

### Audit Logging

Every SSO event is logged:

- `sso_initiated` - User starts OAuth flow
- `sso_completed` - Successful authentication
- `sso_failed` - Failed authentication
- `account_linked` - New provider linked to account
- `token_refreshed` - Token refresh occurred

Logs include:

- User ID
- Provider
- IP address
- User agent
- Timestamp
- Event details

## Error Handling

### Common Errors

**Error: `oauth_denied`**

- User cancelled the authorization
- Solution: Try again or use different provider

**Error: `oauth_failed`**

- OAuth flow failed
- Check provider configuration
- Verify credentials are correct

**Error: `no_email`**

- Provider didn't provide email
- Some providers (Twitter) may not share email
- User needs to grant email permission

**Error: `account_inactive`**

- User account is suspended or expired
- Contact administrator

**Error: `invalid_state`**

- CSRF validation failed or session expired
- Try logging in again

## Troubleshooting

### Provider button not appearing

Check:

1. Environment variables are set correctly
2. Client ID and Secret are valid
3. Provider is enabled in the code

### Redirect URI mismatch

Ensure:

1. Redirect URI in provider config matches exactly
2. Include protocol (https://)
3. No trailing slashes unless in config

### Token refresh not working

Verify:

1. Provider supports token refresh
2. Refresh token was granted
3. Scopes include offline access (if required)

### Email not provided

Some providers require:

1. Email scope explicitly requested
2. User approval for email sharing
3. Separate API call (GitHub)

## API Reference

### Initiate OAuth Flow

```
GET /api/auth/oauth/{provider}
```

Providers: `google`, `linkedin`, `apple`, `facebook`, `github`, `twitter`, `microsoft`

### OAuth Callback

```
GET /api/auth/oauth/{provider}/callback?code={code}&state={state}
```

Handled automatically by the system.

## Database Schema

### provider_accounts

```sql
CREATE TABLE provider_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at INTEGER,
  scope TEXT,
  id_token TEXT,
  profile_data TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  last_used_at INTEGER
);
```

### oauth_sessions

```sql
CREATE TABLE oauth_sessions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  state TEXT UNIQUE NOT NULL,
  code_verifier TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  nonce TEXT,
  provider TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  created_at INTEGER,
  expires_at INTEGER
);
```

### auth_audit_logs

```sql
CREATE TABLE auth_audit_logs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  user_id TEXT,
  event_type TEXT NOT NULL,
  provider TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at INTEGER
);
```

## Future Enhancements

- [ ] Token encryption at rest
- [ ] Account management UI in profile settings
- [ ] Device/session revocation
- [ ] Suspicious activity detection
- [ ] Multi-factor authentication
- [ ] OAuth scope management
- [ ] Provider account switching

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review provider-specific documentation
3. Check audit logs for detailed error information
4. Contact support with audit log details

## References

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [OpenID Connect](https://openid.net/connect/)
