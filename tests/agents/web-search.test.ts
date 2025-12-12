import { describe, it, expect } from 'vitest';
import { WebSearchAgent, webSearchAgent } from '../../src/agents/web-search.js';
import { AgentsManager } from '../../src/agents/manager.js';
import type { AnthropicRequest } from '../../src/types/index.js';

describe('WebSearchAgent', () => {
  describe('shouldHandle', () => {
    it('should handle requests with messages', () => {
      const agent = new WebSearchAgent();
      const request: AnthropicRequest = {
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };

      expect(agent.shouldHandle(request)).toBe(true);
    });

    it('should not handle requests without messages', () => {
      const agent = new WebSearchAgent();
      const request: AnthropicRequest = {
        model: 'test',
        messages: [],
        max_tokens: 100,
      };

      expect(agent.shouldHandle(request)).toBe(false);
    });
  });

  describe('processRequest', () => {
    it('should add web search system prompt to request without system', () => {
      const agent = new WebSearchAgent();
      const request: AnthropicRequest = {
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };

      const result = agent.processRequest(request);

      expect(typeof result.system).toBe('string');
      expect(result.system).toContain('Web Search Guidelines');
    });

    it('should append to existing string system prompt', () => {
      const agent = new WebSearchAgent();
      const request: AnthropicRequest = {
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        system: 'You are helpful',
      };

      const result = agent.processRequest(request);

      expect(typeof result.system).toBe('string');
      expect(result.system).toContain('You are helpful');
      expect(result.system).toContain('Web Search Guidelines');
    });

    it('should append to existing array system prompt', () => {
      const agent = new WebSearchAgent();
      const request: AnthropicRequest = {
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        system: [{ type: 'text', text: 'Existing prompt' }],
      };

      const result = agent.processRequest(request);

      expect(typeof result.system).toBe('string');
      expect(result.system).toContain('Existing prompt');
      expect(result.system).toContain('brave_web_search');
    });
  });

  describe('WebSearch tool handler', () => {
    it('should return deprecation message with query', async () => {
      const agent = new WebSearchAgent();
      const tool = agent.tools.get('WebSearch');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('WebSearch');

      if (!tool) throw new Error('Tool not found');
      const result = await tool.handler({ query: 'test query' });

      expect(result).toContain('ERROR: WebSearch tool is deprecated');
      expect(result).toContain('brave_web_search(query: "test query")');
      expect(result).toContain('tavily_search');
      expect(result).toContain('exa_search');
    });
  });
});

describe('AgentsManager', () => {
  it('should register and retrieve agents', () => {
    const manager = new AgentsManager();
    manager.registerAgent(webSearchAgent);

    expect(manager.getAgent('web-search')).toBe(webSearchAgent);
  });

  it('should return all agents', () => {
    const manager = new AgentsManager();
    manager.registerAgent(webSearchAgent);

    const agents = manager.getAllAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('web-search');
  });

  it('should return all tools from all agents', () => {
    const manager = new AgentsManager();
    manager.registerAgent(webSearchAgent);

    const tools = manager.getAllTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some(t => t.name === 'WebSearch')).toBe(true);
  });

  it('should find tool by name', () => {
    const manager = new AgentsManager();
    manager.registerAgent(webSearchAgent);

    const result = manager.getToolByName('WebSearch');
    expect(result).toBeDefined();
    expect(result?.agent.name).toBe('web-search');
    expect(result?.tool.name).toBe('WebSearch');
  });

  it('should return undefined for unknown tool', () => {
    const manager = new AgentsManager();
    manager.registerAgent(webSearchAgent);

    const result = manager.getToolByName('UnknownTool');
    expect(result).toBeUndefined();
  });

  it('should return undefined for unknown agent', () => {
    const manager = new AgentsManager();
    expect(manager.getAgent('unknown')).toBeUndefined();
  });
});
