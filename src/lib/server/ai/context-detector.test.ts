import { describe, it, expect } from 'vitest';
import {
  detectContextFromUrl,
  extractEntityIdFromUrl,
  analyzeConversation,
  detectAIContext
} from '$lib/server/ai/context-detector';

describe('context-detector', () => {
  describe('detectContextFromUrl', () => {
    it('detects product creation context', () => {
      const result = detectContextFromUrl('/admin/products/new');
      expect(result).toBe('product_creation');
    });

    it('detects product editing context', () => {
      const result = detectContextFromUrl('/admin/products/123/edit');
      expect(result).toBe('product_editing');
    });

    it('detects page building context', () => {
      const result = detectContextFromUrl('/admin/pages/new');
      expect(result).toBe('page_building');
    });

    it('detects page editing context', () => {
      const result = detectContextFromUrl('/admin/pages/456/edit');
      expect(result).toBe('page_editing');
    });

    it('detects dashboard context', () => {
      expect(detectContextFromUrl('/admin/dashboard')).toBe('dashboard_insights');
      expect(detectContextFromUrl('/admin')).toBe('dashboard_insights');
    });

    it('detects AI chat standalone as product creation', () => {
      const result = detectContextFromUrl('/admin/ai-chat');
      expect(result).toBe('product_creation');
    });

    it('defaults to general help for unknown paths', () => {
      const result = detectContextFromUrl('/admin/unknown');
      expect(result).toBe('general_help');
    });

    // Builder route tests
    it('detects layout building context', () => {
      expect(detectContextFromUrl('/admin/builder/layout')).toBe('layout_building');
      expect(detectContextFromUrl('/admin/builder/layout/')).toBe('layout_building');
    });

    it('detects layout editing context', () => {
      const result = detectContextFromUrl('/admin/builder/layout/123');
      expect(result).toBe('layout_editing');
    });

    it('detects component building context', () => {
      expect(detectContextFromUrl('/admin/builder/component')).toBe('component_building');
      expect(detectContextFromUrl('/admin/builder/component/')).toBe('component_building');
    });

    it('detects component editing context', () => {
      const result = detectContextFromUrl('/admin/builder/component/456');
      expect(result).toBe('component_editing');
    });

    it('detects page building from builder route', () => {
      expect(detectContextFromUrl('/admin/builder')).toBe('page_building');
      expect(detectContextFromUrl('/admin/builder/')).toBe('page_building');
    });

    it('detects page editing from builder route with ID', () => {
      const result = detectContextFromUrl('/admin/builder/some-page-id');
      expect(result).toBe('page_editing');
    });
  });

  describe('extractEntityIdFromUrl', () => {
    it('extracts product ID from edit URL', () => {
      const result = extractEntityIdFromUrl('/admin/products/123/edit');
      expect(result).toBe('123');
    });

    it('extracts page ID from edit URL', () => {
      const result = extractEntityIdFromUrl('/admin/pages/abc-def/edit');
      expect(result).toBe('abc-def');
    });

    it('returns undefined for URLs without entity ID', () => {
      expect(extractEntityIdFromUrl('/admin/products/new')).toBeUndefined();
      expect(extractEntityIdFromUrl('/admin/dashboard')).toBeUndefined();
    });

    // Builder route entity ID extraction tests
    it('extracts layout ID from builder layout URL', () => {
      const result = extractEntityIdFromUrl('/admin/builder/layout/layout-123');
      expect(result).toBe('layout-123');
    });

    it('extracts component ID from builder component URL', () => {
      const result = extractEntityIdFromUrl('/admin/builder/component/comp-456');
      expect(result).toBe('comp-456');
    });

    it('extracts page ID from builder page URL', () => {
      const result = extractEntityIdFromUrl('/admin/builder/page-789');
      expect(result).toBe('page-789');
    });
  });

  describe('analyzeConversation', () => {
    it('switches to product creation when product keywords detected', () => {
      const messages = [
        { role: 'user' as const, content: 'I want to add a new product' },
        { role: 'assistant' as const, content: 'Great! What are you selling?' }
      ];

      const result = analyzeConversation(messages, 'general_help');
      expect(result).toBe('product_creation');
    });

    it('switches to page building when page keywords detected', () => {
      const messages = [
        { role: 'user' as const, content: 'Help me create a new page with widgets' },
        { role: 'assistant' as const, content: 'I can help with that!' }
      ];

      const result = analyzeConversation(messages, 'general_help');
      expect(result).toBe('page_building');
    });

    it('switches to layout building when layout keywords detected', () => {
      const messages = [
        { role: 'user' as const, content: 'I need to create a new layout template' },
        { role: 'assistant' as const, content: 'I can help with that!' }
      ];

      const result = analyzeConversation(messages, 'general_help');
      expect(result).toBe('layout_building');
    });

    it('switches to component building when component keywords detected', () => {
      const messages = [
        { role: 'user' as const, content: 'Help me create a custom widget component' },
        { role: 'assistant' as const, content: 'Sure!' }
      ];

      const result = analyzeConversation(messages, 'general_help');
      expect(result).toBe('component_building');
    });

    it('keeps builder context when widget keywords detected', () => {
      const messages = [{ role: 'user' as const, content: 'Add a new widget section here' }];

      const result = analyzeConversation(messages, 'page_building');
      expect(result).toBe('page_building');
    });

    it('switches to general help when help keywords detected', () => {
      const messages = [
        { role: 'user' as const, content: 'How do I use this feature? Explain it please.' }
      ];

      const result = analyzeConversation(messages, 'product_creation');
      expect(result).toBe('general_help');
    });

    it('keeps current context if no clear intent', () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      const result = analyzeConversation(messages, 'product_editing');
      expect(result).toBe('product_editing');
    });

    it('returns current context for empty conversation', () => {
      const result = analyzeConversation([], 'dashboard_insights');
      expect(result).toBe('dashboard_insights');
    });

    it('stays in layout context when widget keywords are used', () => {
      const messages = [{ role: 'user' as const, content: 'Insert a new widget into the layout' }];

      const result = analyzeConversation(messages, 'layout_editing');
      expect(result).toBe('layout_editing');
    });

    it('stays in component context when widget keywords are used', () => {
      const messages = [{ role: 'user' as const, content: 'Remove this component section' }];

      const result = analyzeConversation(messages, 'component_editing');
      expect(result).toBe('component_editing');
    });
  });

  describe('detectAIContext', () => {
    it('provides complete context detection result', () => {
      const result = detectAIContext('/admin/products/new');

      expect(result.context.type).toBe('product_creation');
      expect(result.systemPrompt).toContain('Ammoura AI');
      expect(result.capabilities).toBeInstanceOf(Array);
      expect(result.capabilities.length).toBeGreaterThan(0);
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('includes entity ID when present', () => {
      const result = detectAIContext('/admin/products/123/edit');

      expect(result.context.entityId).toBe('123');
      expect(result.context.type).toBe('product_editing');
    });

    it('refines context based on conversation', () => {
      const messages = [
        { role: 'user' as const, content: 'I need help building a page' },
        { role: 'assistant' as const, content: 'I can help with that!' }
      ];

      const result = detectAIContext('/admin/ai-chat', undefined, messages);

      expect(result.context.type).toBe('page_building');
    });

    it('includes entity data in context', () => {
      const entityData = {
        product: {
          id: '123',
          name: 'Test Product',
          description: 'Test product description',
          price: 29.99,
          category: 'Test Category',
          type: 'physical',
          stock: 10,
          tags: ['test']
        }
      };

      const result = detectAIContext('/admin/products/123/edit', entityData);

      expect(result.context.entityData).toEqual(entityData);
    });

    it('provides suggestions for component_building context', () => {
      const result = detectAIContext('/admin/builder/component');
      expect(result.context.type).toBe('component_building');
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]).toContain('call-to-action');
    });

    it('provides suggestions for component_editing context', () => {
      const result = detectAIContext('/admin/builder/component/comp-123');
      expect(result.context.type).toBe('component_editing');
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('provides suggestions for dashboard_insights context', () => {
      const result = detectAIContext('/admin/dashboard');
      expect(result.context.type).toBe('dashboard_insights');
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('provides suggestions for layout_editing context', () => {
      const result = detectAIContext('/admin/builder/layout/layout-1');
      expect(result.context.type).toBe('layout_editing');
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('provides suggestions for general_help context', () => {
      const result = detectAIContext('/admin/some-unknown-page');
      expect(result.context.type).toBe('general_help');
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('refines context with multi-message conversation', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there' },
        { role: 'user' as const, content: 'I need to create a product' }
      ];
      const result = detectAIContext('/admin/ai-chat', undefined, messages);
      expect(result.context.conversationHistory).toEqual(messages);
    });

    it('detects layout_building context for builder/layout base path', () => {
      const result = detectAIContext('/admin/builder/layout');
      expect(result.context.type).toBe('layout_building');
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('detects layout_building context with trailing slash', () => {
      const result = detectAIContext('/admin/builder/layout/');
      expect(result.context.type).toBe('layout_building');
    });

    it('detects product_creation from standalone ai-chat page', () => {
      const result = detectAIContext('/admin/ai-chat');
      expect(result.context.type).toBe('product_creation');
    });
  });
});
