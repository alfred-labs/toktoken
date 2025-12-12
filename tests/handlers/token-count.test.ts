import { describe, it, expect } from 'vitest';
import { handleTokenCount } from '../../src/handlers/token-count.js';

describe('handleTokenCount', () => {
  it('should count tokens for simple text messages', () => {
    const result = handleTokenCount({
      messages: [{ content: 'Hello world' }],
    });

    expect(result.input_tokens).toBeGreaterThan(0);
  });

  it('should count tokens for content array with text', () => {
    const result = handleTokenCount({
      messages: [{
        content: [
          { type: 'text', text: 'Hello' },
        ],
      }],
    });

    expect(result.input_tokens).toBeGreaterThan(0);
  });

  it('should count tokens for tool_use content', () => {
    const result = handleTokenCount({
      messages: [{
        content: [
          { type: 'tool_use', input: { query: 'test' } },
        ],
      }],
    });

    expect(result.input_tokens).toBeGreaterThan(0);
  });

  it('should count tokens for tool_result with string content', () => {
    const result = handleTokenCount({
      messages: [{
        content: [
          { type: 'tool_result', content: 'Result text' },
        ],
      }],
    });

    expect(result.input_tokens).toBeGreaterThan(0);
  });

  it('should count tokens for tool_result with object content', () => {
    const result = handleTokenCount({
      messages: [{
        content: [
          { type: 'tool_result', content: { data: 'value' } },
        ],
      }],
    });

    expect(result.input_tokens).toBeGreaterThan(0);
  });

  it('should count tokens for system string', () => {
    const result = handleTokenCount({
      system: 'You are a helpful assistant',
    });

    expect(result.input_tokens).toBeGreaterThan(0);
  });

  it('should count tokens for system array', () => {
    const result = handleTokenCount({
      system: [
        { type: 'text', text: 'System prompt' },
      ],
    });

    expect(result.input_tokens).toBeGreaterThan(0);
  });

  it('should count tokens for tools', () => {
    const result = handleTokenCount({
      tools: [
        { name: 'search', description: 'Search the web', input_schema: { type: 'object' } },
      ],
    });

    expect(result.input_tokens).toBeGreaterThan(0);
  });

  it('should handle empty request', () => {
    const result = handleTokenCount({});

    expect(result.input_tokens).toBe(0);
  });

  it('should handle missing optional fields in tools', () => {
    const result = handleTokenCount({
      tools: [{}],
    });

    expect(result.input_tokens).toBe(0);
  });
});
