import { describe, it, expect } from 'vitest';
import {
  substituteTemplate,
  substituteTemplateInObject,
  createSiteContext,
  createDefaultSiteContext,
  createUserContext,
  AVAILABLE_TEMPLATES,
  type SiteContext,
  type TemplateVariables,
  type UserInfo
} from './templateSubstitution';
import type { GeneralSettings } from '$lib/server/db/site-settings';

describe('Template Substitution', () => {
  const mockSiteContext: SiteContext = {
    name: 'My Awesome Store',
    tagline: 'The best products online',
    description: 'We sell amazing things',
    email: 'store@example.com',
    supportEmail: 'support@example.com',
    phone: '+1-555-123-4567',
    currency: 'USD',
    year: '2025'
  };

  const mockVariables: TemplateVariables = {
    site: mockSiteContext
  };

  describe('substituteTemplate', () => {
    it('should substitute ${site.name} with the site name', () => {
      const result = substituteTemplate('Welcome to ${site.name}!', mockVariables);
      expect(result).toBe('Welcome to My Awesome Store!');
    });

    it('should substitute ${site.tagline} with the site tagline', () => {
      const result = substituteTemplate('${site.tagline}', mockVariables);
      expect(result).toBe('The best products online');
    });

    it('should substitute ${site.description} with the site description', () => {
      const result = substituteTemplate('About us: ${site.description}', mockVariables);
      expect(result).toBe('About us: We sell amazing things');
    });

    it('should substitute ${site.email} with the store email', () => {
      const result = substituteTemplate('Contact: ${site.email}', mockVariables);
      expect(result).toBe('Contact: store@example.com');
    });

    it('should substitute ${site.supportEmail} with the support email', () => {
      const result = substituteTemplate('Support: ${site.supportEmail}', mockVariables);
      expect(result).toBe('Support: support@example.com');
    });

    it('should substitute ${site.phone} with the phone number', () => {
      const result = substituteTemplate('Call us: ${site.phone}', mockVariables);
      expect(result).toBe('Call us: +1-555-123-4567');
    });

    it('should substitute ${site.currency} with the currency code', () => {
      const result = substituteTemplate('Prices in ${site.currency}', mockVariables);
      expect(result).toBe('Prices in USD');
    });

    it('should substitute multiple placeholders in the same string', () => {
      const result = substituteTemplate('${site.name} - ${site.tagline}', mockVariables);
      expect(result).toBe('My Awesome Store - The best products online');
    });

    it('should leave unknown placeholders unchanged', () => {
      const result = substituteTemplate('Hello ${unknown.variable}!', mockVariables);
      expect(result).toBe('Hello ${unknown.variable}!');
    });

    it('should leave unknown properties unchanged', () => {
      const result = substituteTemplate('Hello ${site.unknownProp}!', mockVariables);
      expect(result).toBe('Hello ${site.unknownProp}!');
    });

    it('should return empty string unchanged', () => {
      const result = substituteTemplate('', mockVariables);
      expect(result).toBe('');
    });

    it('should return string without placeholders unchanged', () => {
      const result = substituteTemplate('No placeholders here', mockVariables);
      expect(result).toBe('No placeholders here');
    });

    it('should handle null/undefined input gracefully', () => {
      expect(substituteTemplate(null as unknown as string, mockVariables)).toBe(null);
      expect(substituteTemplate(undefined as unknown as string, mockVariables)).toBe(undefined);
    });

    it('should handle empty site context values', () => {
      const emptyContext: TemplateVariables = {
        site: {
          name: '',
          tagline: '',
          description: '',
          email: '',
          supportEmail: '',
          phone: '',
          currency: '',
          year: ''
        }
      };
      const result = substituteTemplate('Welcome to ${site.name}!', emptyContext);
      expect(result).toBe('Welcome to !');
    });
  });

  describe('substituteTemplateInObject', () => {
    it('should substitute placeholders in object string values', () => {
      const obj = {
        title: 'Welcome to ${site.name}',
        subtitle: '${site.tagline}'
      };
      const result = substituteTemplateInObject(obj, mockVariables);
      expect(result.title).toBe('Welcome to My Awesome Store');
      expect(result.subtitle).toBe('The best products online');
    });

    it('should preserve non-string values', () => {
      const obj = {
        title: '${site.name}',
        count: 42,
        active: true,
        data: null
      };
      const result = substituteTemplateInObject(obj, mockVariables);
      expect(result.title).toBe('My Awesome Store');
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.data).toBe(null);
    });

    it('should substitute placeholders in nested objects', () => {
      const obj = {
        header: {
          title: '${site.name}',
          tagline: '${site.tagline}'
        },
        footer: {
          contact: '${site.email}'
        }
      };
      const result = substituteTemplateInObject(obj, mockVariables);
      expect(result.header.title).toBe('My Awesome Store');
      expect(result.header.tagline).toBe('The best products online');
      expect(result.footer.contact).toBe('store@example.com');
    });

    it('should substitute placeholders in arrays', () => {
      const obj = {
        items: ['${site.name}', '${site.tagline}', 'Static text']
      };
      const result = substituteTemplateInObject(obj, mockVariables);
      expect(result.items).toEqual(['My Awesome Store', 'The best products online', 'Static text']);
    });

    it('should substitute placeholders in arrays of objects', () => {
      const obj = {
        links: [
          { label: '${site.name}', url: '/' },
          { label: 'Contact ${site.email}', url: '/contact' }
        ]
      };
      const result = substituteTemplateInObject(obj, mockVariables);
      expect(result.links[0].label).toBe('My Awesome Store');
      expect(result.links[1].label).toBe('Contact store@example.com');
    });

    it('should handle empty objects', () => {
      const result = substituteTemplateInObject({}, mockVariables);
      expect(result).toEqual({});
    });

    it('should handle null/undefined input gracefully', () => {
      expect(
        substituteTemplateInObject(null as unknown as Record<string, unknown>, mockVariables)
      ).toBe(null);
      expect(
        substituteTemplateInObject(undefined as unknown as Record<string, unknown>, mockVariables)
      ).toBe(undefined);
    });
  });

  describe('createSiteContext', () => {
    it('should create site context from general settings', () => {
      const settings: GeneralSettings = {
        storeName: 'Test Store',
        tagline: 'Test Tagline',
        description: 'Test Description',
        storeEmail: 'test@test.com',
        supportEmail: 'support@test.com',
        contactPhone: '+1-555-0000',
        currency: 'EUR',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        weightUnit: 'kg',
        dimensionUnit: 'cm'
      };

      const context = createSiteContext(settings);

      expect(context.name).toBe('Test Store');
      expect(context.tagline).toBe('Test Tagline');
      expect(context.description).toBe('Test Description');
      expect(context.email).toBe('test@test.com');
      expect(context.supportEmail).toBe('support@test.com');
      expect(context.phone).toBe('+1-555-0000');
      expect(context.currency).toBe('EUR');
    });

    it('should handle empty/undefined settings values', () => {
      const settings: GeneralSettings = {
        storeName: '',
        tagline: '',
        description: '',
        storeEmail: '',
        supportEmail: '',
        contactPhone: '',
        currency: '',
        timezone: '',
        dateFormat: '',
        timeFormat: '',
        weightUnit: '',
        dimensionUnit: ''
      };

      const context = createSiteContext(settings);

      expect(context.name).toBe('');
      expect(context.tagline).toBe('');
      // Empty currency defaults to 'USD' in createSiteContext
      expect(context.currency).toBe('USD');
    });
  });

  describe('createDefaultSiteContext', () => {
    it('should create default site context', () => {
      const context = createDefaultSiteContext();

      expect(context.name).toBe('Ammoura');
      expect(context.tagline).toBe('');
      expect(context.description).toBe('');
      expect(context.email).toBe('');
      expect(context.supportEmail).toBe('');
      expect(context.phone).toBe('');
      expect(context.currency).toBe('USD');
    });
  });

  describe('AVAILABLE_TEMPLATES', () => {
    it('should contain all expected template variables', () => {
      const variableNames = AVAILABLE_TEMPLATES.map((t) => t.variable);

      expect(variableNames).toContain('${site.name}');
      expect(variableNames).toContain('${site.tagline}');
      expect(variableNames).toContain('${site.description}');
      expect(variableNames).toContain('${site.email}');
      expect(variableNames).toContain('${site.supportEmail}');
      expect(variableNames).toContain('${site.phone}');
      expect(variableNames).toContain('${site.currency}');
      expect(variableNames).toContain('${user.display_name}');
      expect(variableNames).toContain('${user.first_name}');
      expect(variableNames).toContain('${user.email}');
      expect(variableNames).toContain('${user.role}');
    });

    it('should have descriptions for all templates', () => {
      for (const template of AVAILABLE_TEMPLATES) {
        expect(template.description).toBeDefined();
        expect(template.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createUserContext', () => {
    it('should create user context from user info', () => {
      const userInfo: UserInfo = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin'
      };

      const context = createUserContext(userInfo);

      expect(context.display_name).toBe('John Doe');
      expect(context.first_name).toBe('John');
      expect(context.email).toBe('john@example.com');
      expect(context.role).toBe('admin');
      expect(context.is_authenticated).toBe('true');
    });

    it('should extract first name from display name', () => {
      const userInfo: UserInfo = {
        name: 'Jane Marie Smith',
        email: 'jane@example.com'
      };

      const context = createUserContext(userInfo);

      expect(context.display_name).toBe('Jane Marie Smith');
      expect(context.first_name).toBe('Jane');
    });

    it('should handle single word names', () => {
      const userInfo: UserInfo = {
        name: 'Madonna',
        email: 'madonna@example.com'
      };

      const context = createUserContext(userInfo);

      expect(context.display_name).toBe('Madonna');
      expect(context.first_name).toBe('Madonna');
    });

    it('should return empty values for null user', () => {
      const context = createUserContext(null);

      expect(context.display_name).toBe('');
      expect(context.first_name).toBe('');
      expect(context.email).toBe('');
      expect(context.role).toBe('');
      expect(context.is_authenticated).toBe('false');
    });

    it('should return empty values for undefined user', () => {
      const context = createUserContext(undefined);

      expect(context.display_name).toBe('');
      expect(context.first_name).toBe('');
      expect(context.email).toBe('');
      expect(context.role).toBe('');
      expect(context.is_authenticated).toBe('false');
    });

    it('should handle user with roles array instead of role', () => {
      const userInfo: UserInfo = {
        name: 'Test User',
        email: 'test@example.com',
        roles: ['customer', 'subscriber']
      };

      const context = createUserContext(userInfo);

      expect(context.role).toBe('customer');
    });

    it('should handle user with missing optional fields', () => {
      const userInfo: UserInfo = {
        id: 1
      };

      const context = createUserContext(userInfo);

      expect(context.display_name).toBe('');
      expect(context.first_name).toBe('');
      expect(context.email).toBe('');
      expect(context.role).toBe('');
      expect(context.is_authenticated).toBe('true');
    });
  });

  describe('substituteTemplate with user context', () => {
    const mockUserContext = createUserContext({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      role: 'customer'
    });

    const mockVariablesWithUser: TemplateVariables = {
      site: mockSiteContext,
      user: mockUserContext
    };

    it('should substitute ${user.display_name} with the user display name', () => {
      const result = substituteTemplate('Hello, ${user.display_name}!', mockVariablesWithUser);
      expect(result).toBe('Hello, Alice Johnson!');
    });

    it('should substitute ${user.first_name} with the user first name', () => {
      const result = substituteTemplate('Hi ${user.first_name}!', mockVariablesWithUser);
      expect(result).toBe('Hi Alice!');
    });

    it('should substitute ${user.email} with the user email', () => {
      const result = substituteTemplate('Your email: ${user.email}', mockVariablesWithUser);
      expect(result).toBe('Your email: alice@example.com');
    });

    it('should substitute ${user.role} with the user role', () => {
      const result = substituteTemplate('Role: ${user.role}', mockVariablesWithUser);
      expect(result).toBe('Role: customer');
    });

    it('should substitute both site and user variables in the same string', () => {
      const result = substituteTemplate(
        'Welcome to ${site.name}, ${user.first_name}!',
        mockVariablesWithUser
      );
      expect(result).toBe('Welcome to My Awesome Store, Alice!');
    });

    it('should handle empty user display_name gracefully', () => {
      const emptyUserContext = createUserContext(null);
      const variablesWithEmptyUser: TemplateVariables = {
        site: mockSiteContext,
        user: emptyUserContext
      };
      const result = substituteTemplate('Hello${user.display_name}!', variablesWithEmptyUser);
      expect(result).toBe('Hello!');
    });

    it('should work without user context (backwards compatible)', () => {
      const result = substituteTemplate('Welcome to ${site.name}!', mockVariables);
      expect(result).toBe('Welcome to My Awesome Store!');
    });

    it('should leave user placeholders unchanged if user context not provided', () => {
      const result = substituteTemplate('Hello ${user.display_name}!', mockVariables);
      expect(result).toBe('Hello ${user.display_name}!');
    });
  });
});
