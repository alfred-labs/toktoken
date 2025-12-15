import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import fp from 'fastify-plugin';

import type {AnthropicRequest, OpenAIRequest, OpenAIResponse} from '../types/index.js';
import {callBackend, streamBackend} from '../services/backend.js';
import {
  SSE_HEADERS,
  StatusCodes,
  createApiError,
  formatSseError,
  getBackendAuth,
  anthropicToOpenAI,
  openAIToAnthropic,
  injectWebSearchPrompt,
  convertOpenAIStreamToAnthropic,
  estimateRequestTokens,
  pipe,
} from '../utils/index.js';

// ============================================================================
// Request Pipeline: Anthropic → preprocess → OpenAI → vLLM
// ============================================================================

const preprocess = pipe<AnthropicRequest>(
  injectWebSearchPrompt,
);

const toOpenAI = (req: AnthropicRequest): OpenAIRequest =>
  anthropicToOpenAI(preprocess(req));

// ============================================================================
// Response Pipeline: vLLM → OpenAI → Anthropic
// ============================================================================

const toAnthropic = (res: OpenAIResponse, model: string) => openAIToAnthropic(res, model);

// ============================================================================
// Route
// ============================================================================

async function anthropicRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/messages', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as AnthropicRequest;
    const backend = app.config.defaultBackend;
    const baseUrl = backend.url as string;
    const auth = getBackendAuth(backend, req.headers.authorization) ?? '';
    const model = backend.model || body.model;

    // Pipeline: Anthropic → OpenAI → vLLM
    const payload = {...toOpenAI(body), model};

    try {
      if (body.stream) return streamAnthropic(reply, baseUrl, payload, auth, model);
      const res = await callBackend<OpenAIResponse>(`${baseUrl}/v1/chat/completions`, payload, auth);
      return toAnthropic(res, model);
    } catch (e) {
      req.log.error({err: e}, 'Request failed');
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR);
      return createApiError(e instanceof Error ? e.message : 'Unknown error');
    }
  });
}

// ============================================================================
// Streaming: OpenAI SSE → Anthropic SSE
// ============================================================================

const streamAnthropic = async (
  reply: FastifyReply,
  baseUrl: string,
  body: OpenAIRequest,
  auth: string,
  model: string,
) => {
  reply.raw.writeHead(200, SSE_HEADERS);

  try {
    const inputTokens = estimateRequestTokens(body.messages);
    const stream = streamBackend(`${baseUrl}/v1/chat/completions`, {...body, stream: true}, auth);

    // Pipeline: OpenAI stream → Anthropic stream
    for await (const chunk of convertOpenAIStreamToAnthropic(stream, model, inputTokens)) {
      reply.raw.write(chunk);
    }
  } catch (e) {
    reply.raw.write(formatSseError(e));
  }

  reply.raw.end();
  reply.hijack();
};

export default fp(anthropicRoutes, {name: 'anthropic-routes'});
