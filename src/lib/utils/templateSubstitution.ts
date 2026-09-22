/**
 * Template Substitution Utility
 *
 * Provides functionality to substitute template placeholders like ${site.name}
 * with actual values from site settings in component text content.
 */

import type { GeneralSettings } from '$lib/server/db/site-settings';
import { DEFAULT_STORE_NAME } from '$lib/branding';

/**
 * Site context containing all available template variables
 */
export interface SiteContext {
  name: string;
  tagline: string;
  description: string;
  email: string;
  supportEmail: string;
  phone: string;
  currency: string;
  year: string;
}

/**
 * Current calendar year for ${site.year} — keeps seeded copyright lines from going stale
 */
export function currentYear(): string {
  return String(new Date().getFullYear());
}

/**
 * User context containing user-related template variables
 * All fields are optional since user may not be logged in
 */
export interface UserContext {
  display_name: string;
  first_name: string;
  email: string;
  role: string;
  is_authenticated: string;
}

/**
 * Template variables available for substitution
 */
export type TemplateVariables = {
  site: SiteContext;
  user?: UserContext;
};

/**
 * Creates a SiteContext from GeneralSettings
 */
export function createSiteContext(settings: GeneralSettings): SiteContext {
  return {
    name: settings.storeName || '',
    tagline: settings.tagline || '',
    description: settings.description || '',
    email: settings.storeEmail || '',
    supportEmail: settings.supportEmail || '',
    phone: settings.contactPhone || '',
    currency: settings.currency || 'USD',
    year: currentYear()
  };
}

/**
 * Creates default site context when settings are not available
 */
export function createDefaultSiteContext(): SiteContext {
  return {
    name: DEFAULT_STORE_NAME,
    tagline: '',
    description: '',
    email: '',
    supportEmail: '',
    phone: '',
    currency: 'USD',
    year: currentYear()
  };
}

/**
 * User information used to create user context
 */
export interface UserInfo {
  id?: number | string;
  email?: string;
  name?: string;
  role?: string;
  roles?: string[];
}

/**
 * Creates a UserContext from user information
 * If user is null/undefined (not logged in), returns a context with empty strings
 *
 * @param user - The user information object or null/undefined if not authenticated
 * @returns UserContext with user's display name, first name, email, and role
 */
export function createUserContext(user: UserInfo | null | undefined): UserContext {
  if (!user) {
    return {
      display_name: '',
      first_name: '',
      email: '',
      role: '',
      is_authenticated: 'false'
    };
  }

  const displayName = user.name || '';
  // Extract first name by splitting on space and taking the first part
  const firstName = displayName.split(' ')[0] || '';

  return {
    display_name: displayName,
    first_name: firstName,
    email: user.email || '',
    role: user.role || (user.roles && user.roles[0]) || '',
    is_authenticated: 'true'
  };
}

/**
 * Regular expression to match template placeholders like ${site.name}
 * Matches: ${namespace.property} where namespace and property are alphanumeric with underscores
 */
const TEMPLATE_REGEX = /\$\{(\w+)\.(\w+)\}/g;

/**
 * Substitutes template placeholders in a string with actual values
 *
 * @param template - The string containing template placeholders
 * @param variables - The template variables object
 * @returns The string with placeholders replaced by actual values
 *
 * @example
 * ```typescript
 * const result = substituteTemplate(
 *   'Welcome to ${site.name}!',
 *   { site: { name: 'My Store', tagline: 'Best products' } }
 * );
 * // result: 'Welcome to My Store!'
 * ```
 */
export function substituteTemplate(template: string, variables: TemplateVariables): string {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(TEMPLATE_REGEX, (match, namespace, property) => {
    const namespaceObj = variables[namespace as keyof TemplateVariables];
    if (namespaceObj && typeof namespaceObj === 'object') {
      const value = namespaceObj[property as keyof typeof namespaceObj];
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
    // Return the original placeholder if no substitution found
    return match;
  });
}

/**
 * Recursively substitutes template placeholders in an object's string values
 *
 * @param obj - The object containing string values with template placeholders
 * @param variables - The template variables object
 * @returns A new object with all string values having placeholders substituted
 */
export function substituteTemplateInObject<T extends Record<string, unknown>>(
  obj: T,
  variables: TemplateVariables
): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = substituteTemplate(value, variables);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === 'string') {
          return substituteTemplate(item, variables);
        } else if (typeof item === 'object' && item !== null) {
          return substituteTemplateInObject(item as Record<string, unknown>, variables);
        }
        return item;
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = substituteTemplateInObject(value as Record<string, unknown>, variables);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * List of available template variables for documentation/help purposes
 */
export const AVAILABLE_TEMPLATES = [
  { variable: '${site.name}', description: 'Site title (from settings)' },
  { variable: '${site.tagline}', description: 'Site tagline (from settings)' },
  { variable: '${site.description}', description: 'Site description (from settings)' },
  { variable: '${site.email}', description: 'Store email address' },
  { variable: '${site.supportEmail}', description: 'Support email address' },
  { variable: '${site.phone}', description: 'Contact phone number' },
  { variable: '${site.currency}', description: 'Store currency code' },
  { variable: '${site.year}', description: 'Current calendar year' },
  {
    variable: '${user.display_name}',
    description: "Logged-in user's full name (empty if not logged in)"
  },
  {
    variable: '${user.first_name}',
    description: "Logged-in user's first name (empty if not logged in)"
  },
  {
    variable: '${user.email}',
    description: "Logged-in user's email address (empty if not logged in)"
  },
  { variable: '${user.role}', description: "Logged-in user's role (empty if not logged in)" }
];
