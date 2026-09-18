import type { D1Database } from '@cloudflare/workers-types';
import { encrypt, decrypt } from '../crypto.js';

export interface SiteSetting {
  id: string;
  site_id: string;
  setting_key: string;
  setting_value: string;
  created_at: number;
  updated_at: number;
}

export interface SiteThemeColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  secondary: string;
  secondaryHover: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  borderPrimary: string;
  borderSecondary: string;
}

export interface GeneralSettings {
  storeName: string;
  tagline: string;
  description: string;
  storeEmail: string;
  supportEmail: string;
  contactPhone: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  weightUnit: string;
  dimensionUnit: string;
}

export interface AddressSettings {
  street: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  geolocationEnabled: boolean;
}

export interface TaxSettings {
  calculationsEnabled: boolean;
  pricesIncludeTax: boolean;
  displayPricesWithTax: boolean;
  defaultRate: number;
  taxClasses: TaxClass[];
}

export interface TaxClass {
  id: string;
  name: string;
  rate: number;
}

export interface PaymentSettings {
  stripeEnabled: boolean;
  stripeMode: 'test' | 'live';
  stripePublicKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  paypalEnabled: boolean;
  paypalMode: 'sandbox' | 'live';
  paypalClientId: string;
  paypalClientSecret: string;
  testModeEnabled: boolean;
}

/** Settings keys whose values are encrypted at rest (secrets, not just config). */
const ENCRYPTED_PAYMENT_KEYS = new Set<keyof PaymentSettings>([
  'stripeSecretKey',
  'stripeWebhookSecret',
  'paypalClientSecret'
]);

export interface EmailSettings {
  provider: 'sendmail' | 'smtp';
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  fromName: string;
  fromAddress: string;
  newOrderEnabled: boolean;
  orderStatusEnabled: boolean;
  customerWelcomeEnabled: boolean;
}

export interface ApiSettings {
  restEnabled: boolean;
  webhookOrderCreated: string;
  webhookOrderUpdated: string;
  webhookProductUpdated: string;
  rateLimit: number;
  rateLimitWindow: number;
}

/**
 * Get all site settings for a given site
 */
export async function getSiteSettings(db: D1Database, siteId: string): Promise<SiteSetting[]> {
  const result = await db
    .prepare('SELECT * FROM site_settings WHERE site_id = ? ORDER BY setting_key')
    .bind(siteId)
    .all<SiteSetting>();

  return result.results || [];
}

/**
 * Get a specific site setting
 */
export async function getSiteSetting(
  db: D1Database,
  siteId: string,
  key: string
): Promise<string | null> {
  const result = await db
    .prepare('SELECT setting_value FROM site_settings WHERE site_id = ? AND setting_key = ?')
    .bind(siteId, key)
    .first<{ setting_value: string }>();

  return result?.setting_value || null;
}

/**
 * Update or insert a site setting
 */
export async function upsertSiteSetting(
  db: D1Database,
  siteId: string,
  key: string,
  value: string
): Promise<void> {
  const id = `${key}-${siteId}-${Date.now()}`;

  await db
    .prepare(
      `INSERT INTO site_settings (id, site_id, setting_key, setting_value, updated_at)
       VALUES (?, ?, ?, ?, strftime('%s', 'now'))
       ON CONFLICT(site_id, setting_key) 
       DO UPDATE SET setting_value = ?, updated_at = strftime('%s', 'now')`
    )
    .bind(id, siteId, key, value, value)
    .run();
}

/**
 * Get theme colors for a specific mode (light or dark)
 */
export async function getThemeColors(
  db: D1Database,
  siteId: string,
  mode: 'light' | 'dark'
): Promise<SiteThemeColors> {
  const prefix = `theme_${mode}_`;
  const settings = await getSiteSettings(db, siteId);

  const themeSettings = settings.filter((s) => s.setting_key.startsWith(prefix));

  const colors: SiteThemeColors = {
    primary: '#ef4444',
    primaryHover: '#dc2626',
    primaryLight: '#f87171',
    secondary: '#64748b',
    secondaryHover: '#475569',
    bgPrimary: mode === 'light' ? '#ffffff' : '#0a0118',
    bgSecondary: mode === 'light' ? '#f9fafb' : '#1a103d',
    bgTertiary: mode === 'light' ? '#fef2f2' : '#2d1b69',
    textPrimary: mode === 'light' ? '#111827' : '#fdf4ff',
    textSecondary: mode === 'light' ? '#374151' : '#f5d0fe',
    borderPrimary: mode === 'light' ? '#fca5a5' : '#9333ea',
    borderSecondary: mode === 'light' ? '#fecaca' : '#c084fc'
  };

  // Map database settings to color object
  themeSettings.forEach((setting) => {
    const key = setting.setting_key.replace(prefix, '');
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (camelKey in colors) {
      colors[camelKey as keyof SiteThemeColors] = setting.setting_value;
    }
  });

  return colors;
}

/**
 * Update theme colors for a specific mode
 */
export async function updateThemeColors(
  db: D1Database,
  siteId: string,
  mode: 'light' | 'dark',
  colors: Partial<SiteThemeColors>
): Promise<void> {
  const prefix = `theme_${mode}_`;

  const colorMap: Record<keyof SiteThemeColors, string> = {
    primary: 'primary',
    primaryHover: 'primary_hover',
    primaryLight: 'primary_light',
    secondary: 'secondary',
    secondaryHover: 'secondary_hover',
    bgPrimary: 'bg_primary',
    bgSecondary: 'bg_secondary',
    bgTertiary: 'bg_tertiary',
    textPrimary: 'text_primary',
    textSecondary: 'text_secondary',
    borderPrimary: 'border_primary',
    borderSecondary: 'border_secondary'
  };

  for (const [key, value] of Object.entries(colors)) {
    if (value) {
      const dbKey = colorMap[key as keyof SiteThemeColors];
      await upsertSiteSetting(db, siteId, `${prefix}${dbKey}`, value);
    }
  }
}

/**
 * Get general settings
 */
export async function getGeneralSettings(db: D1Database, siteId: string): Promise<GeneralSettings> {
  const settings = await getSiteSettings(db, siteId);
  const settingsMap = new Map(settings.map((s) => [s.setting_key, s.setting_value]));

  return {
    storeName: settingsMap.get('general_store_name') || 'Hermes eCommerce',
    tagline: settingsMap.get('general_tagline') || '',
    description: settingsMap.get('general_description') || '',
    storeEmail: settingsMap.get('general_store_email') || '',
    supportEmail: settingsMap.get('general_support_email') || '',
    contactPhone: settingsMap.get('general_contact_phone') || '',
    currency: settingsMap.get('general_currency') || 'USD',
    timezone: settingsMap.get('general_timezone') || 'UTC',
    dateFormat: settingsMap.get('general_date_format') || 'MM/DD/YYYY',
    timeFormat: settingsMap.get('general_time_format') || '12h',
    weightUnit: settingsMap.get('general_weight_unit') || 'lb',
    dimensionUnit: settingsMap.get('general_dimension_unit') || 'in'
  };
}

/**
 * Update general settings
 */
export async function updateGeneralSettings(
  db: D1Database,
  siteId: string,
  settings: Partial<GeneralSettings>
): Promise<void> {
  const settingsMap: Record<keyof GeneralSettings, string> = {
    storeName: 'general_store_name',
    tagline: 'general_tagline',
    description: 'general_description',
    storeEmail: 'general_store_email',
    supportEmail: 'general_support_email',
    contactPhone: 'general_contact_phone',
    currency: 'general_currency',
    timezone: 'general_timezone',
    dateFormat: 'general_date_format',
    timeFormat: 'general_time_format',
    weightUnit: 'general_weight_unit',
    dimensionUnit: 'general_dimension_unit'
  };

  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      const dbKey = settingsMap[key as keyof GeneralSettings];
      await upsertSiteSetting(db, siteId, dbKey, String(value));
    }
  }
}

/**
 * Per-site language configuration (i18n). `enabledLocales` always contains
 * `defaultLocale`; values are validated against the platform's supported
 * locales at write time by the settings action, not here.
 */
export interface LanguageSettings {
  defaultLocale: string;
  enabledLocales: string[];
}

export async function getLanguageSettings(
  db: D1Database,
  siteId: string
): Promise<LanguageSettings> {
  const settings = await getSiteSettings(db, siteId);
  return readLanguageSettings(new Map(settings.map((s) => [s.setting_key, s.setting_value])));
}

/**
 * The parsing half of getLanguageSettings, over an already-loaded settings map.
 *
 * Split out so a caller that needs more than one group of settings — the request
 * hook needs the locales and the coming-soon flag — reads the table once instead
 * of once per group.
 */
export function readLanguageSettings(settingsMap: Map<string, string>): LanguageSettings {
  const defaultLocale = settingsMap.get('i18n_default_locale') || 'en';

  let enabledLocales: string[] = [defaultLocale];
  const raw = settingsMap.get('i18n_enabled_locales');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((l) => typeof l === 'string')) {
        enabledLocales = parsed;
      }
    } catch {
      // Corrupt value: fall back to just the default locale
    }
  }

  if (!enabledLocales.includes(defaultLocale)) {
    enabledLocales = [defaultLocale, ...enabledLocales];
  }

  return { defaultLocale, enabledLocales };
}

/**
 * Whether the site is still behind its coming-soon gate.
 *
 * Read on every public request (see `hooks.server.ts`), so it rides on the same
 * `getSiteSettings` call the locale resolution already makes — a separate query
 * per request for one boolean would be a tax on every page view of every tenant
 * forever.
 *
 * Defaults to OFF for an existing site. Turning this on for sites that were live
 * before the feature existed would take working shops offline on deploy, and no
 * feature is worth that.
 */
export interface ComingSoonSettings {
  enabled: boolean;
}

export const COMING_SOON_SETTING_KEY = 'coming_soon_enabled';

export function readComingSoon(settings: Map<string, string>): ComingSoonSettings {
  return { enabled: settings.get(COMING_SOON_SETTING_KEY) === 'true' };
}

export async function getComingSoonSettings(
  db: D1Database,
  siteId: string
): Promise<ComingSoonSettings> {
  const settings = await getSiteSettings(db, siteId);
  return readComingSoon(new Map(settings.map((s) => [s.setting_key, s.setting_value])));
}

export async function updateComingSoonSettings(
  db: D1Database,
  siteId: string,
  settings: ComingSoonSettings
): Promise<void> {
  await upsertSiteSetting(db, siteId, COMING_SOON_SETTING_KEY, settings.enabled ? 'true' : 'false');
}

export async function updateLanguageSettings(
  db: D1Database,
  siteId: string,
  settings: Partial<LanguageSettings>
): Promise<void> {
  if (settings.defaultLocale !== undefined) {
    await upsertSiteSetting(db, siteId, 'i18n_default_locale', settings.defaultLocale);
  }
  if (settings.enabledLocales !== undefined) {
    const enabled = [...settings.enabledLocales];
    // Invariant: the default locale is always enabled
    const defaultLocale =
      settings.defaultLocale ?? (await getLanguageSettings(db, siteId)).defaultLocale;
    if (!enabled.includes(defaultLocale)) {
      enabled.unshift(defaultLocale);
    }
    await upsertSiteSetting(db, siteId, 'i18n_enabled_locales', JSON.stringify(enabled));
  }
}

/**
 * Get address settings
 */
export async function getAddressSettings(db: D1Database, siteId: string): Promise<AddressSettings> {
  const settings = await getSiteSettings(db, siteId);
  const settingsMap = new Map(settings.map((s) => [s.setting_key, s.setting_value]));

  return {
    street: settingsMap.get('address_street') || '',
    city: settingsMap.get('address_city') || '',
    state: settingsMap.get('address_state') || '',
    postcode: settingsMap.get('address_postcode') || '',
    country: settingsMap.get('address_country') || 'US',
    geolocationEnabled: settingsMap.get('address_geolocation_enabled') === 'true'
  };
}

/**
 * Update address settings
 */
export async function updateAddressSettings(
  db: D1Database,
  siteId: string,
  settings: Partial<AddressSettings>
): Promise<void> {
  const settingsMap: Record<keyof AddressSettings, string> = {
    street: 'address_street',
    city: 'address_city',
    state: 'address_state',
    postcode: 'address_postcode',
    country: 'address_country',
    geolocationEnabled: 'address_geolocation_enabled'
  };

  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      const dbKey = settingsMap[key as keyof AddressSettings];
      await upsertSiteSetting(db, siteId, dbKey, String(value));
    }
  }
}

/**
 * Get tax settings
 */
export async function getTaxSettings(db: D1Database, siteId: string): Promise<TaxSettings> {
  const settings = await getSiteSettings(db, siteId);
  const settingsMap = new Map(settings.map((s) => [s.setting_key, s.setting_value]));

  const taxClassesJson = settingsMap.get('tax_classes') || '[]';
  let taxClasses: TaxClass[] = [];
  try {
    taxClasses = JSON.parse(taxClassesJson);
  } catch {
    taxClasses = [];
  }

  return {
    calculationsEnabled: settingsMap.get('tax_calculations_enabled') === 'true',
    pricesIncludeTax: settingsMap.get('tax_prices_include_tax') === 'true',
    displayPricesWithTax: settingsMap.get('tax_display_prices_with_tax') === 'true',
    defaultRate: parseFloat(settingsMap.get('tax_default_rate') || '0'),
    taxClasses
  };
}

/**
 * Update tax settings
 */
export async function updateTaxSettings(
  db: D1Database,
  siteId: string,
  settings: Partial<TaxSettings>
): Promise<void> {
  if (settings.calculationsEnabled !== undefined) {
    await upsertSiteSetting(
      db,
      siteId,
      'tax_calculations_enabled',
      String(settings.calculationsEnabled)
    );
  }
  if (settings.pricesIncludeTax !== undefined) {
    await upsertSiteSetting(
      db,
      siteId,
      'tax_prices_include_tax',
      String(settings.pricesIncludeTax)
    );
  }
  if (settings.displayPricesWithTax !== undefined) {
    await upsertSiteSetting(
      db,
      siteId,
      'tax_display_prices_with_tax',
      String(settings.displayPricesWithTax)
    );
  }
  if (settings.defaultRate !== undefined) {
    await upsertSiteSetting(db, siteId, 'tax_default_rate', String(settings.defaultRate));
  }
  if (settings.taxClasses !== undefined) {
    await upsertSiteSetting(db, siteId, 'tax_classes', JSON.stringify(settings.taxClasses));
  }
}

/**
 * Get payment settings. Encrypted secrets (Stripe secret key, Stripe webhook
 * secret, PayPal client secret) are decrypted here if an encryptionKey is
 * given; otherwise those fields come back blank rather than as ciphertext.
 */
export async function getPaymentSettings(
  db: D1Database,
  siteId: string,
  encryptionKey?: string
): Promise<PaymentSettings> {
  const settings = await getSiteSettings(db, siteId);
  const settingsMap = new Map(settings.map((s) => [s.setting_key, s.setting_value]));

  const decryptField = async (key: string): Promise<string> => {
    const raw = settingsMap.get(key);
    if (!raw) return '';
    if (!encryptionKey) return '';
    try {
      return await decrypt(raw, encryptionKey);
    } catch (err) {
      console.error(`Failed to decrypt payment setting ${key}:`, err);
      return '';
    }
  };

  return {
    stripeEnabled: settingsMap.get('payment_stripe_enabled') === 'true',
    stripeMode: (settingsMap.get('payment_stripe_mode') as 'test' | 'live') || 'test',
    stripePublicKey: settingsMap.get('payment_stripe_public_key') || '',
    stripeSecretKey: await decryptField('payment_stripe_secret_key'),
    stripeWebhookSecret: await decryptField('payment_stripe_webhook_secret'),
    paypalEnabled: settingsMap.get('payment_paypal_enabled') === 'true',
    paypalMode: (settingsMap.get('payment_paypal_mode') as 'sandbox' | 'live') || 'sandbox',
    paypalClientId: settingsMap.get('payment_paypal_client_id') || '',
    paypalClientSecret: await decryptField('payment_paypal_client_secret'),
    testModeEnabled: settingsMap.get('payment_test_mode_enabled') === 'true'
  };
}

/**
 * Update payment settings. Encrypted secrets require an encryptionKey —
 * throws rather than silently persisting plaintext.
 */
export async function updatePaymentSettings(
  db: D1Database,
  siteId: string,
  settings: Partial<PaymentSettings>,
  encryptionKey?: string
): Promise<void> {
  const settingsMap: Record<keyof PaymentSettings, string> = {
    stripeEnabled: 'payment_stripe_enabled',
    stripeMode: 'payment_stripe_mode',
    stripePublicKey: 'payment_stripe_public_key',
    stripeSecretKey: 'payment_stripe_secret_key',
    stripeWebhookSecret: 'payment_stripe_webhook_secret',
    paypalEnabled: 'payment_paypal_enabled',
    paypalMode: 'payment_paypal_mode',
    paypalClientId: 'payment_paypal_client_id',
    paypalClientSecret: 'payment_paypal_client_secret',
    testModeEnabled: 'payment_test_mode_enabled'
  };

  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    const typedKey = key as keyof PaymentSettings;
    const dbKey = settingsMap[typedKey];

    if (ENCRYPTED_PAYMENT_KEYS.has(typedKey)) {
      if (!value) continue; // don't overwrite a stored secret with a blank re-submit
      if (!encryptionKey) {
        throw new Error(`Encryption key is required to store ${typedKey}`);
      }
      await upsertSiteSetting(db, siteId, dbKey, await encrypt(String(value), encryptionKey));
    } else {
      await upsertSiteSetting(db, siteId, dbKey, String(value));
    }
  }
}

/**
 * Get email settings
 */
export async function getEmailSettings(db: D1Database, siteId: string): Promise<EmailSettings> {
  const settings = await getSiteSettings(db, siteId);
  const settingsMap = new Map(settings.map((s) => [s.setting_key, s.setting_value]));

  return {
    provider: (settingsMap.get('email_provider') as 'sendmail' | 'smtp') || 'sendmail',
    smtpHost: settingsMap.get('email_smtp_host') || '',
    smtpPort: parseInt(settingsMap.get('email_smtp_port') || '587'),
    smtpSecure: settingsMap.get('email_smtp_secure') === 'true',
    smtpUsername: settingsMap.get('email_smtp_username') || '',
    smtpPassword: settingsMap.get('email_smtp_password') || '',
    fromName: settingsMap.get('email_from_name') || '',
    fromAddress: settingsMap.get('email_from_address') || '',
    newOrderEnabled: settingsMap.get('email_new_order_enabled') === 'true',
    orderStatusEnabled: settingsMap.get('email_order_status_enabled') === 'true',
    customerWelcomeEnabled: settingsMap.get('email_customer_welcome_enabled') === 'true'
  };
}

/**
 * Update email settings
 */
export async function updateEmailSettings(
  db: D1Database,
  siteId: string,
  settings: Partial<EmailSettings>
): Promise<void> {
  const settingsMap: Record<keyof EmailSettings, string> = {
    provider: 'email_provider',
    smtpHost: 'email_smtp_host',
    smtpPort: 'email_smtp_port',
    smtpSecure: 'email_smtp_secure',
    smtpUsername: 'email_smtp_username',
    smtpPassword: 'email_smtp_password',
    fromName: 'email_from_name',
    fromAddress: 'email_from_address',
    newOrderEnabled: 'email_new_order_enabled',
    orderStatusEnabled: 'email_order_status_enabled',
    customerWelcomeEnabled: 'email_customer_welcome_enabled'
  };

  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      const dbKey = settingsMap[key as keyof EmailSettings];
      await upsertSiteSetting(db, siteId, dbKey, String(value));
    }
  }
}

/**
 * Get API settings
 */
export async function getApiSettings(db: D1Database, siteId: string): Promise<ApiSettings> {
  const settings = await getSiteSettings(db, siteId);
  const settingsMap = new Map(settings.map((s) => [s.setting_key, s.setting_value]));

  return {
    restEnabled: settingsMap.get('api_rest_enabled') === 'true',
    webhookOrderCreated: settingsMap.get('api_webhook_order_created') || '',
    webhookOrderUpdated: settingsMap.get('api_webhook_order_updated') || '',
    webhookProductUpdated: settingsMap.get('api_webhook_product_updated') || '',
    rateLimit: parseInt(settingsMap.get('api_rate_limit') || '100'),
    rateLimitWindow: parseInt(settingsMap.get('api_rate_limit_window') || '60')
  };
}

/**
 * Update API settings
 */
export async function updateApiSettings(
  db: D1Database,
  siteId: string,
  settings: Partial<ApiSettings>
): Promise<void> {
  const settingsMap: Record<keyof ApiSettings, string> = {
    restEnabled: 'api_rest_enabled',
    webhookOrderCreated: 'api_webhook_order_created',
    webhookOrderUpdated: 'api_webhook_order_updated',
    webhookProductUpdated: 'api_webhook_product_updated',
    rateLimit: 'api_rate_limit',
    rateLimitWindow: 'api_rate_limit_window'
  };

  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      const dbKey = settingsMap[key as keyof ApiSettings];
      await upsertSiteSetting(db, siteId, dbKey, String(value));
    }
  }
}
