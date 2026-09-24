// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  // Vite injected constants
  const __APP_VERSION__: string;

  namespace App {
    interface Error {
      message: string;
      /** Echoed to the visitor so a report can be matched to a log line. */
      requestId?: string;
    }
    interface Locals {
      siteId: string;
      /** One id per request; also returned as the `x-request-id` header. */
      requestId: string;
      /** Request-scoped structured logger, pre-bound with site and route. */
      log: import('$lib/server/observability').Logger;
      /** Resolved locale for this request (cookie → Accept-Language → site default) */
      locale: string;
      /** The site's language configuration (validated against supported locales) */
      i18n: { defaultLocale: string; enabledLocales: string[] };
      isAdmin: boolean;
      /** Platform account (site owner/collaborator), from the account_session cookie */
      account?: import('$lib/server/db/accounts').Account;
      currentUser?: import('$lib/server/db/users').DBUser;
      user?: {
        id: string;
      };
    }
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: {
        DB: D1Database;
        MEDIA_BUCKET: R2Bucket;
        SITE_ROUTES?: KVNamespace; // hostname → site id route cache (optional binding)
        PLATFORM_SITES_DOMAIN?: string; // wildcard domain for free platform subdomains
        CLOUDFLARE_API_TOKEN?: string; // secret: Cloudflare for SaaS custom hostnames
        CLOUDFLARE_ZONE_ID?: string; // zone id custom hostnames are provisioned on
        RESEND_API_KEY?: string; // secret: outbound email; absent in dev → console log
        EMAIL_FROM?: string; // From header for outbound email
        PLATFORM_ENGINEER_EMAIL?: string; // secret: this user is elevated to platform_engineer on sign-in
        ENCRYPTION_KEY?: string; // Base64-encoded AES-256 key for encrypting secrets
        CRON_SECRET?: string; // secret: bearer token for running a scheduled job by hand
        SCHEDULER_INTERNAL_TOKEN?: string; // minted per cron invocation in worker/entry.js; never stored
        // OAuth provider credentials (dynamically indexed)
        [key: string]: string | D1Database | R2Bucket | undefined;
      };
      context: ExecutionContext;
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
