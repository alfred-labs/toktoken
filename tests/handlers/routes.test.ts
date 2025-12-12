import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  createAnthropicMessagesHandler,
  createOpenAIChatHandler,
  createHealthHandler,
  createStatsHandler,
  createModelsHandler,
  type RouteHandlerContext,
} from '../../src/handlers/routes.js';
import type { RouterConfig } from '../../src/types/index.js';
import type { AnthropicRouter } from '../../src/router.js';

const mockRouter = {
  handleAnthropicRequest: vi.fn(),
  handleAnthropicStreamingRequest: vi.fn(),
  handleOpenAIRequest: vi.fn(),
  handleOpenAIStreamingRequest: vi.fn(),
  getTelemetryStats: vi.fn(),
};

const mockConfig: RouterConfig = {
  port: 3456,
  host: '0.0.0.0',
  apiKey: 'test-api-key',
  defaultBackend: {
    name: 'vllm',
    url: 'http://localhost:8000',
    apiKey: 'backend-key',
    model: 'test-model',
  },
  telemetry: { enabled: false },
  logLevel: 'info',
};

const ctx: RouteHandlerContext = { router: mockRouter as unknown as AnthropicRouter, config: mockConfig };

describe('Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createHealthHandler', () => {
    it('should return ok status', async () => {
      const handler = createHealthHandler();
      const result = await handler();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('createStatsHandler', () => {
    it('should return telemetry stats', async () => {
      const stats = { requests: 10, tokens: 1000 };
      mockRouter.getTelemetryStats.mockReturnValue(stats);

      const handler = createStatsHandler(ctx);
      const result = await handler();

      expect(result).toEqual(stats);
      expect(mockRouter.getTelemetryStats).toHaveBeenCalled();
    });
  });

  describe('createModelsHandler', () => {
    it('should return models list', async () => {
      const handler = createModelsHandler(ctx);
      const result = await handler();

      expect(result.object).toBe('list');
      expect(result.data[0].id).toBe('test-model');
      expect(result.data[0].object).toBe('model');
    });
  });

  describe('createAnthropicMessagesHandler', () => {
    const createMockRequest = (body: unknown, apiKey?: string) => ({
      headers: {
        authorization: apiKey ? `Bearer ${apiKey}` : undefined,
        'x-api-key': apiKey,
      },
      body,
      log: { error: vi.fn() },
    }) as unknown as FastifyRequest;

    const createMockReply = () => ({
      code: vi.fn().mockReturnThis(),
      sent: false,
      raw: {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      },
      hijack: vi.fn(),
    });

    it('should return 401 for invalid API key', async () => {
      const handler = createAnthropicMessagesHandler(ctx);
      const request = createMockRequest({}, 'wrong-key');
      const reply = createMockReply();

      const result = await handler(request, reply as unknown as FastifyReply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(result).toEqual({ error: { type: 'authentication_error', message: 'Invalid API key' } });
    });

    it('should handle non-streaming request', async () => {
      const mockResponse = { id: 'msg_123', content: [] };
      mockRouter.handleAnthropicRequest.mockResolvedValue(mockResponse);

      const handler = createAnthropicMessagesHandler(ctx);
      const request = createMockRequest({
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      }, 'test-api-key');
      const reply = createMockReply();

      const result = await handler(request, reply as unknown as FastifyReply);

      expect(result).toEqual(mockResponse);
    });

    it('should handle streaming request', async () => {
      async function* mockStream() {
        yield 'chunk1';
        yield 'chunk2';
      }
      mockRouter.handleAnthropicStreamingRequest.mockReturnValue(mockStream());

      const handler = createAnthropicMessagesHandler(ctx);
      const request = createMockRequest({
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        stream: true,
      }, 'test-api-key');
      const reply = createMockReply();

      await handler(request, reply as unknown as FastifyReply);

      expect(reply.raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }));
      expect(reply.raw.write).toHaveBeenCalledWith('chunk1');
      expect(reply.raw.write).toHaveBeenCalledWith('chunk2');
      expect(reply.raw.end).toHaveBeenCalled();
      expect(reply.hijack).toHaveBeenCalled();
    });

    it('should handle streaming error', async () => {
      async function* mockStream(): AsyncGenerator<string> {
        yield ''; // eslint requires at least one yield
        throw new Error('Stream error');
      }
      mockRouter.handleAnthropicStreamingRequest.mockReturnValue(mockStream());

      const handler = createAnthropicMessagesHandler(ctx);
      const request = createMockRequest({
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        stream: true,
      }, 'test-api-key');
      const reply = createMockReply();

      await handler(request, reply as unknown as FastifyReply);

      expect(reply.raw.write).toHaveBeenCalledWith(expect.stringContaining('error'));
    });

    it('should handle non-streaming error', async () => {
      mockRouter.handleAnthropicRequest.mockRejectedValue(new Error('Backend error'));

      const handler = createAnthropicMessagesHandler(ctx);
      const request = createMockRequest({
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      }, 'test-api-key');
      const reply = createMockReply();

      const result = await handler(request, reply as unknown as FastifyReply);

      expect(reply.code).toHaveBeenCalledWith(500);
      expect(result).toEqual({ error: { type: 'api_error', message: 'Backend error' } });
    });
  });

  describe('createOpenAIChatHandler', () => {
    const createMockRequest = (body: unknown, apiKey?: string) => ({
      headers: {
        authorization: apiKey ? `Bearer ${apiKey}` : undefined,
      },
      body,
      log: { error: vi.fn() },
    }) as unknown as FastifyRequest;

    const createMockReply = () => ({
      code: vi.fn().mockReturnThis(),
      sent: false,
      raw: {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
      },
      hijack: vi.fn(),
    });

    it('should return 401 for invalid API key', async () => {
      const handler = createOpenAIChatHandler(ctx);
      const request = createMockRequest({}, 'wrong-key');
      const reply = createMockReply();

      const result = await handler(request, reply as unknown as FastifyReply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(result).toEqual({ error: { message: 'Invalid API key', type: 'invalid_request_error' } });
    });

    it('should handle non-streaming request', async () => {
      const mockResponse = { id: 'chatcmpl-123', choices: [] };
      mockRouter.handleOpenAIRequest.mockResolvedValue(mockResponse);

      const handler = createOpenAIChatHandler(ctx);
      const request = createMockRequest({
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
      }, 'test-api-key');
      const reply = createMockReply();

      const result = await handler(request, reply as unknown as FastifyReply);

      expect(result).toEqual(mockResponse);
    });

    it('should handle streaming request', async () => {
      async function* mockStream() {
        yield 'data: chunk1\n\n';
        yield 'data: chunk2\n\n';
      }
      mockRouter.handleOpenAIStreamingRequest.mockReturnValue(mockStream());

      const handler = createOpenAIChatHandler(ctx);
      const request = createMockRequest({
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      }, 'test-api-key');
      const reply = createMockReply();

      await handler(request, reply as unknown as FastifyReply);

      expect(reply.raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
      }));
      expect(reply.hijack).toHaveBeenCalled();
    });

    it('should handle non-streaming error', async () => {
      mockRouter.handleOpenAIRequest.mockRejectedValue(new Error('Backend error'));

      const handler = createOpenAIChatHandler(ctx);
      const request = createMockRequest({
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
      }, 'test-api-key');
      const reply = createMockReply();

      const result = await handler(request, reply as unknown as FastifyReply);

      expect(reply.code).toHaveBeenCalledWith(500);
      expect(result).toEqual({ error: { message: 'Backend error', type: 'api_error' } });
    });
  });
});
