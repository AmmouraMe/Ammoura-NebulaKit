import { describe, it, expect } from 'vitest';
import { PRODUCT_CREATION_SYSTEM_PROMPT, PRODUCT_EDIT_SYSTEM_PROMPT } from './prompts';

describe('AI Prompts', () => {
  describe('PRODUCT_CREATION_SYSTEM_PROMPT', () => {
    it('should contain role definition', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Ammoura AI');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('expert eCommerce product specialist');
    });

    it('should contain capabilities section', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Your Capabilities');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Product Information Extraction');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Interactive Guidance');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Best Practices');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Structured Output');
    });

    it('should contain workflow instructions', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Workflow');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Greeting & Understanding');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Information Gathering');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Image Analysis');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Fulfillment & Inventory Management');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Confirmation');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('JSON Output');
    });

    it('should contain critical fulfillment rules', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('CRITICAL RULES FOR STOCK QUANTITIES');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain(
        'NEVER auto-fill or assume stock quantities'
      );
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain(
        'ALWAYS ask which provider(s) the user wants to use'
      );
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain(
        'ALWAYS ask for the stock quantity at each provider'
      );
    });

    it('should contain product JSON schema', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Product JSON Schema');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('action": "create_product');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('fulfillmentOptions');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('providerId');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('stockQuantity');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('CREATE_NEW');
    });

    it('should contain important rules', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Important Rules');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Ask ONE question at a time');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Be conversational');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Provide suggestions');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Validate information');
    });

    it('should contain product categories', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Categories');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Electronics');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Clothing');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Home & Garden');
    });

    it('should contain product types', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Product Types');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('physical');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('digital');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('service');
    });

    it('should contain fulfillment options documentation', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Fulfillment Options');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Physical Products Only');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('providerId');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('providerName');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('cost');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('stockQuantity');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('enabled');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('createProvider');
    });

    it('should contain example interactions', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Example Interactions');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('User');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Assistant');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('leather wallet');
    });

    it('should contain edge cases', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Edge Cases');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('multiple products');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain(
        'For physical products without fulfillment details'
      );
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('NEVER assume');
    });

    it('should contain available providers section', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Available Fulfillment Providers');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('availableProviders');
    });

    it('should emphasize stock quantity rules', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain(
        'NEVER fill out product stock without knowing which providers are available'
      );
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain(
        'Products do NOT have a direct stock quantity'
      );
    });

    it('should be a non-empty string', () => {
      expect(typeof PRODUCT_CREATION_SYSTEM_PROMPT).toBe('string');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT.length).toBeGreaterThan(1000);
    });

    it('should contain JSON examples with proper structure', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('"action": "create_product"');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('"product": {');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('"name":');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('"description":');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('"price":');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('"fulfillmentOptions":');
    });
  });

  describe('PRODUCT_EDIT_SYSTEM_PROMPT', () => {
    it('should contain role definition', () => {
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('Ammoura AI');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('editing an existing product');
    });

    it('should contain edit-specific instructions', () => {
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('Help them update specific fields');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('Suggest improvements');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('Answer questions about best practices');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('Generate updated product data');
    });

    it('should contain update JSON schema', () => {
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('action": "update_product');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('updates');
    });

    it('should emphasize only updating changed fields', () => {
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('Include only the fields that changed');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain(
        'only include fields that are actually being updated'
      );
    });

    it('should be a non-empty string', () => {
      expect(typeof PRODUCT_EDIT_SYSTEM_PROMPT).toBe('string');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it('should be shorter than creation prompt', () => {
      expect(PRODUCT_EDIT_SYSTEM_PROMPT.length).toBeLessThan(PRODUCT_CREATION_SYSTEM_PROMPT.length);
    });

    it('should contain example update structure', () => {
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('"name": "Updated name (if changed)"');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain(
        '"description": "Updated description (if changed)"'
      );
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('"price":');
    });

    it('should emphasize conversational assistance', () => {
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('conversationally');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('help them refine');
    });
  });

  describe('Prompt Consistency', () => {
    it('should both mention Ammoura AI', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('Ammoura AI');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('Ammoura AI');
    });

    it('should both use JSON output format', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('JSON');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('JSON');
    });

    it('should both reference action field', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('"action"');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('"action"');
    });

    it('should use different action types', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain('create_product');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).toContain('update_product');
    });
  });

  describe('Prompt Structure', () => {
    it('should have clear section markers in creation prompt', () => {
      const sections = [
        '## Your Capabilities',
        '## Workflow',
        '## Product JSON Schema',
        '## Important Rules',
        '## Categories',
        '## Product Types',
        '## Fulfillment Options',
        '## Example Interactions',
        '## Edge Cases',
        '## Available Fulfillment Providers'
      ];

      sections.forEach((section) => {
        expect(PRODUCT_CREATION_SYSTEM_PROMPT).toContain(section);
      });
    });

    it('should not contain placeholder or incomplete sections', () => {
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).not.toContain('TODO');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).not.toContain('FIXME');
      expect(PRODUCT_CREATION_SYSTEM_PROMPT).not.toContain('...');

      expect(PRODUCT_EDIT_SYSTEM_PROMPT).not.toContain('TODO');
      expect(PRODUCT_EDIT_SYSTEM_PROMPT).not.toContain('FIXME');
    });
  });
});
