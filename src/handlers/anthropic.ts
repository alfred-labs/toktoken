import type { AnthropicRequest, AnthropicResponse, BackendConfig, TokenUsage, OpenAIResponse } from '../types/index.js';
import { SSEEnricher } from '../transform/sse-enricher.js';
import { estimateRequestTokens } from '../transform/token-counter.js';
import { convertAnthropicToOpenAI, convertOpenAIToAnthropic } from '../transform/anthropic-to-openai.js';

function isInternalBackend(url: string): boolean {
  return url.includes('.cluster.local') || url.startsWith('http://');
}

const VISION_SYSTEM_PROMPT = `You are a vision analysis assistant. Your role is to interpret and analyze images accurately.
When analyzing an image:
1. Describe what you see clearly and precisely
2. Extract any text (OCR) if present
3. Identify objects, layouts, colors, and relevant details
4. Focus on the user's specific question about the image
5. Be concise but thorough in your analysis

Always provide actionable information based on the image content.`;

function getAuthHeader(backend: BackendConfig, clientAuthHeader?: string): string {
  if (isInternalBackend(backend.url)) {
    // Internal backend: always use configured API key
    return `Bearer ${backend.apiKey}`;
  }
  // External backend: forward client header (required for JWT auth via kgateway)
  if (!clientAuthHeader) {
    throw new Error('Authorization header required for external backend');
  }
  return clientAuthHeader;
}

export interface AnthropicHandlerOptions {
  backend: BackendConfig;
  onTelemetry?: (usage: Omit<TokenUsage, 'totalTokens'>) => void;
  clientAuthHeader?: string;
  isVisionRequest?: boolean;
}

async function callBackend(
  modifiedRequest: AnthropicRequest,
  backend: BackendConfig,
  authHeader: string
): Promise<AnthropicResponse> {
  const useOpenAI = backend.anthropicNative === false;
  
  if (useOpenAI) {
    const openaiRequest = convertAnthropicToOpenAI(modifiedRequest);
    openaiRequest.model = backend.model;

    const response = await fetch(`${backend.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Backend error: ${response.status} ${error}`);
    }

    const openaiResult = await response.json() as OpenAIResponse;
    return convertOpenAIToAnthropic(openaiResult, modifiedRequest.model);
  } else {
    const proxyRequest = { ...modifiedRequest, model: backend.model };

    const response = await fetch(`${backend.url}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(proxyRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Backend error: ${response.status} ${error}`);
    }

    return await response.json() as AnthropicResponse;
  }
}

export async function handleAnthropicRequest(
  request: AnthropicRequest,
  options: AnthropicHandlerOptions
): Promise<AnthropicResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const { backend, onTelemetry, clientAuthHeader, isVisionRequest } = options;
  
  const authHeader = getAuthHeader(backend, clientAuthHeader);

  // Inject vision system prompt for vision requests
  let modifiedRequest = request;
  if (isVisionRequest) {
    modifiedRequest = {
      ...request,
      system: VISION_SYSTEM_PROMPT,
    };
  }

  const result = await callBackend(modifiedRequest, backend, authHeader);

  const hasToolCalls = result.content?.some(c => c.type === 'tool_use') || false;
  const hasVision = request.messages.some(msg => 
    Array.isArray(msg.content) && msg.content.some(block => block.type === 'image')
  );

  if (onTelemetry) {
    onTelemetry({
      requestId,
      timestamp: new Date(),
      backend: backend.name,
      model: backend.model,
      inputTokens: result.usage?.input_tokens || 0,
      outputTokens: result.usage?.output_tokens || 0,
      latencyMs: Date.now() - startTime,
      hasToolCalls,
      hasVision,
    });
  }

  return result;
}

export async function* handleAnthropicStreamingRequest(
  request: AnthropicRequest,
  options: AnthropicHandlerOptions
): AsyncGenerator<string> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const { backend, onTelemetry, clientAuthHeader, isVisionRequest } = options;
  
  const authHeader = getAuthHeader(backend, clientAuthHeader);

  const estimatedInputTokens = estimateRequestTokens(request.messages);
  const enricher = new SSEEnricher({ estimatedInputTokens });

  // Inject vision system prompt for vision requests
  let modifiedRequest = request;
  if (isVisionRequest) {
    modifiedRequest = {
      ...request,
      system: VISION_SYSTEM_PROMPT,
    };
  }

  const proxyRequest = { ...modifiedRequest, model: backend.model, stream: true };

  const response = await fetch(`${backend.url}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(proxyRequest),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Backend error: ${response.status} ${error}`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const enrichedChunk = enricher.processChunk(chunk);
      if (enrichedChunk) yield enrichedChunk;
    }

    const remaining = enricher.flush();
    if (remaining) yield remaining;
  } finally {
    reader.releaseLock();
  }

  if (onTelemetry) {
    const stats = enricher.getStats();
    onTelemetry({
      requestId,
      timestamp: new Date(),
      backend: backend.name,
      model: backend.model,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      latencyMs: Date.now() - startTime,
      hasToolCalls: stats.hasToolCalls,
      hasVision: request.messages.some(msg => 
        Array.isArray(msg.content) && msg.content.some(block => block.type === 'image')
      ),
    });
  }
}
